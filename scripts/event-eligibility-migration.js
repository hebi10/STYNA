const KNOWN_REVIEW_EVENT_IDS = Object.freeze([
  'event-2026-02-knit-review',
  'event-2026-03-photo-review',
  'event-2026-05-best-review',
  'event-2026-07-summer-review',
]);
const REVIEW_EVENT_KEYWORDS = Object.freeze(['리뷰', '후기']);

const VALID_ELIGIBILITY_TYPES = new Set(['none', 'purchase', 'delivered', 'review']);
const VALID_REWARD_TYPES = new Set(['none', 'coupon']);
const EVIDENCE_ELIGIBILITY_TYPES = new Set(['purchase', 'delivered', 'review']);

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeTargetProducts(value) {
  if (!Array.isArray(value)) {
    return {
      targetProducts: [],
      hasInvalidTargetProducts: value !== undefined && value !== null,
    };
  }

  const targetProducts = [];
  let hasInvalidTargetProducts = false;

  for (const rawTargetProduct of value) {
    const targetProduct = normalizeString(rawTargetProduct);
    if (!isValidFirestoreDocumentId(targetProduct)) {
      hasInvalidTargetProducts = true;
      continue;
    }
    if (!targetProducts.includes(targetProduct)) {
      targetProducts.push(targetProduct);
    }
  }

  return { targetProducts, hasInvalidTargetProducts };
}

function isValidFirestoreDocumentId(value) {
  return Boolean(value)
    && value !== '.'
    && value !== '..'
    && !value.includes('/')
    && !/^__.*__$/.test(value)
    && Buffer.byteLength(value, 'utf8') <= 1500;
}

function isKnownReviewEvent(event) {
  const eventId = normalizeString(event.id);
  const reviewCopy = [event.title, event.description, event.content]
    .map(normalizeString)
    .join(' ');

  return KNOWN_REVIEW_EVENT_IDS.includes(eventId)
    || (
      event.eventType === 'special'
      && REVIEW_EVENT_KEYWORDS.some(keyword => reviewCopy.includes(keyword))
    );
}

function planEventEligibilityPatch(event) {
  const source = event && typeof event === 'object' && !Array.isArray(event) ? event : {};
  const reasons = [];
  const {
    targetProducts,
    hasInvalidTargetProducts,
  } = normalizeTargetProducts(source.targetProducts);
  const rawRewardCouponId = normalizeString(source.rewardCouponId);
  const rewardCouponId = isValidFirestoreDocumentId(rawRewardCouponId)
    ? rawRewardCouponId
    : '';

  const hasCanonicalEligibilityType = VALID_ELIGIBILITY_TYPES.has(source.eligibilityType);
  let eligibilityType;
  if (hasCanonicalEligibilityType) {
    eligibilityType = source.eligibilityType;
    reasons.push('preserved_valid_eligibility');
  } else if (isKnownReviewEvent(source)) {
    eligibilityType = 'review';
    reasons.push('inferred_review_from_legacy_copy_or_id');
  } else {
    eligibilityType = 'none';
    reasons.push('defaulted_legacy_eligibility_to_none');
  }

  const hasCanonicalRewardType = VALID_REWARD_TYPES.has(source.rewardType);
  let rewardType;
  if (hasCanonicalRewardType) {
    rewardType = source.rewardType;
    reasons.push('preserved_valid_reward');
  } else if (rewardCouponId) {
    rewardType = 'coupon';
    reasons.push('inferred_coupon_reward_from_coupon_id');
  } else {
    rewardType = 'none';
    reasons.push('defaulted_legacy_reward_to_none');
  }

  const patch = {
    eligibilityType,
    rewardType,
    ...(
      EVIDENCE_ELIGIBILITY_TYPES.has(eligibilityType)
      && targetProducts.length > 0
      && !hasInvalidTargetProducts
      ? { targetProducts }
      : {}),
    ...(rewardType === 'coupon' && rewardCouponId ? { rewardCouponId } : {}),
  };
  const hasStaleTargetProducts =
    !EVIDENCE_ELIGIBILITY_TYPES.has(eligibilityType)
    && Object.prototype.hasOwnProperty.call(source, 'targetProducts');
  const hasStaleRewardCoupon =
    rewardType !== 'coupon'
    && Object.prototype.hasOwnProperty.call(source, 'rewardCouponId');
  const deleteFields = [];
  const requiresManualTargetProducts =
    EVIDENCE_ELIGIBILITY_TYPES.has(eligibilityType)
    && (targetProducts.length === 0 || hasInvalidTargetProducts);
  const requiresManualRewardCoupon = rewardType === 'coupon' && !rewardCouponId;
  const requiresManualPublicPolicyVerification = source.publicPolicyVerified !== true;
  const requiresManualConfiguration =
    requiresManualTargetProducts
    || requiresManualRewardCoupon
    || requiresManualPublicPolicyVerification
    || !hasCanonicalEligibilityType
    || !hasCanonicalRewardType
    || hasStaleTargetProducts
    || hasStaleRewardCoupon;

  if (requiresManualTargetProducts) {
    reasons.push(hasInvalidTargetProducts ? 'invalid_target_products' : 'missing_target_products');
  }
  if (requiresManualRewardCoupon) {
    reasons.push(rawRewardCouponId ? 'invalid_reward_coupon_id' : 'missing_reward_coupon_id');
  }
  if (requiresManualPublicPolicyVerification) {
    reasons.push('public_policy_unverified');
  }
  if (hasStaleTargetProducts) {
    deleteFields.push('targetProducts');
    reasons.push('stale_target_products');
  }
  if (hasStaleRewardCoupon) {
    deleteFields.push('rewardCouponId');
    reasons.push('stale_reward_coupon_id');
  }

  return {
    patch,
    reasons,
    requiresManualTargetProducts,
    requiresManualRewardCoupon,
    requiresManualPublicPolicyVerification,
    requiresManualConfiguration,
    deleteFields,
  };
}

async function analyzeEventEligibility(runtime) {
  if (!runtime || !runtime.db) {
    throw new Error('A Firestore migration runtime must be explicitly provided.');
  }

  const snapshot = await runtime.db.collection('events').get();
  const events = snapshot.docs.map((document) => ({
    ...document.data(),
    id: document.id,
  }));
  const plans = events.map((event) => ({
    id: event.id,
    ...planEventEligibilityPatch(event),
  }));

  return {
    projectId: runtime.projectId || 'unknown',
    dryRun: true,
    eventCount: plans.length,
    manualTargetProductCount: plans.filter(plan => plan.requiresManualTargetProducts).length,
    manualRewardCouponCount: plans.filter(plan => plan.requiresManualRewardCoupon).length,
    manualPublicPolicyVerificationCount:
      plans.filter(plan => plan.requiresManualPublicPolicyVerification).length,
    manualConfigurationCount: plans.filter(plan => plan.requiresManualConfiguration).length,
    plans,
  };
}

function printAnalysis(report) {
  console.log(JSON.stringify(report, null, 2));
}

async function main(argv = process.argv.slice(2)) {
  if (argv.includes('--execute')) {
    throw new Error('Event eligibility migration is dry-run only.');
  }

  const [command = 'analyze', ...flags] = argv;
  if (command !== 'analyze' || flags.length > 0) {
    throw new Error('Only the analyze dry-run command is supported.');
  }

  const {
    loadFirestoreMigrationRuntime,
  } = require('./firestore-migration-runtime');
  const report = await analyzeEventEligibility(loadFirestoreMigrationRuntime());
  printAnalysis(report);
  return report;
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}

module.exports = {
  KNOWN_REVIEW_EVENT_IDS,
  REVIEW_EVENT_KEYWORDS,
  analyzeEventEligibility,
  main,
  planEventEligibilityPatch,
};
