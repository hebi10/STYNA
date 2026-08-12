const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const MAX_REASONABLE_POINT_BALANCE = 100_000_000;
const MAX_FEATURED_PRODUCT_COUNT = 3;
const DEFAULT_PLAN_PATH = path.resolve(process.cwd(), 'tmp', 'operational-data-plan.json');
const KST_DAY_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const CATEGORY_ALIASES = {
  top: 'clothing',
  tops: 'clothing',
  clothing: 'clothing',
  pants: 'bottoms',
  bottoms: 'bottoms',
  shoe: 'shoes',
  shoes: 'shoes',
  bag: 'bags',
  bags: 'bags',
  accessory: 'accessories',
  accessories: 'accessories',
  jewelry: 'jewelry',
  sports: 'sports',
  outdoor: 'outdoor',
};

function requireReadRuntime(runtime) {
  if (!runtime?.db || runtime.targetProjectVerified !== true || !runtime.projectId) {
    throw new Error('A verified Firestore runtime is required for operational data audit.');
  }
  return runtime;
}

function toKstDayKey(date) {
  const parts = Object.fromEntries(
    KST_DAY_FORMATTER.formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function normalizeDayKey(value) {
  let rawValue = value;
  if (value && typeof value.toDate === 'function') rawValue = value.toDate();
  if (rawValue instanceof Date) {
    return Number.isNaN(rawValue.getTime()) ? null : toKstDayKey(rawValue);
  }
  if (typeof rawValue !== 'string') return null;

  const match = /^(\d{4})([-./])(\d{2})\2(\d{2})$/.exec(rawValue.trim());
  if (!match) return null;
  const normalized = `${match[1]}-${match[3]}-${match[4]}`;
  const date = new Date(`${normalized}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === normalized
    ? normalized
    : null;
}

function normalizeCategoryId(value) {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return CATEGORY_ALIASES[normalized] || normalized;
}

function uniqueProductIds(value) {
  if (!Array.isArray(value)) return null;
  return [...new Set(value.filter((id) => typeof id === 'string' && id.trim().length > 0))]
    .slice(0, MAX_FEATURED_PRODUCT_COUNT);
}

function documentData(document) {
  return document.data() || {};
}

function invalidPointReason(value) {
  if (!Number.isFinite(value) || !Number.isSafeInteger(value)) return '포인트 잔액이 안전한 정수가 아님';
  if (value < 0) return '포인트 잔액이 음수임';
  if (value > MAX_REASONABLE_POINT_BALANCE) return '포인트 잔액이 운영 검토 상한을 초과함';
  return null;
}

function isSuspiciousProductDetail(product) {
  const seasonalText = [product.name, product.description, ...(Array.isArray(product.tags) ? product.tags : [])]
    .filter((value) => typeof value === 'string')
    .join(' ');
  const material = typeof product.details?.material === 'string'
    ? product.details.material
    : typeof product.material === 'string' ? product.material : '';
  return /(여름|반팔|반소매|쿨|summer|cool)/i.test(seasonalText)
    && /(울|wool)/i.test(material);
}

async function readInventory(runtime) {
  const collectionNames = [
    'users',
    'coupons',
    'user_coupons',
    'featuredProducts',
    'categories',
    'products',
  ];
  const snapshots = await Promise.all(
    collectionNames.map((collectionName) => runtime.db.collection(collectionName).get()),
  );
  return Object.fromEntries(collectionNames.map((name, index) => [name, snapshots[index].docs]));
}

async function analyzeOperationalData(runtime, now = new Date()) {
  const safeRuntime = requireReadRuntime(runtime);
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('A valid audit reference date is required.');
  }
  const referenceDay = toKstDayKey(now);
  const inventory = await readInventory(safeRuntime);

  const invalidPointBalances = inventory.users.flatMap((document) => {
    const pointBalance = documentData(document).pointBalance;
    const reason = invalidPointReason(pointBalance);
    return reason ? [{
      collection: 'users',
      documentId: document.id,
      current: { pointBalance },
      proposed: null,
      reason,
      pendingReason: '사용자 포인트 값 승인 필요',
    }] : [];
  });

  const couponById = new Map(inventory.coupons.map((document) => [document.id, document]));
  const expiredCouponIds = new Set();
  const expiredActiveCoupons = [];
  for (const document of inventory.coupons) {
    const coupon = documentData(document);
    const expiryDate = normalizeDayKey(coupon.expiryDate);
    if (coupon.isActive !== true || !expiryDate || expiryDate >= referenceDay) continue;
    expiredCouponIds.add(document.id);
    expiredActiveCoupons.push({
      kind: 'couponMaster',
      collection: 'coupons',
      documentId: document.id,
      current: { expiryDate: coupon.expiryDate, isActive: true },
      proposed: { isActive: false },
      reason: '기준일보다 만료일이 앞선 활성 쿠폰',
    });
  }
  for (const document of inventory.user_coupons) {
    const userCoupon = documentData(document);
    if (userCoupon.status !== '사용가능' || !expiredCouponIds.has(userCoupon.couponId)) continue;
    const masterCoupon = documentData(couponById.get(userCoupon.couponId));
    expiredActiveCoupons.push({
      kind: 'userCoupon',
      collection: 'user_coupons',
      documentId: document.id,
      current: { couponId: userCoupon.couponId, status: '사용가능' },
      proposed: { status: '기간만료' },
      basis: {
        couponDocumentId: userCoupon.couponId,
        expiryDate: masterCoupon.expiryDate,
      },
      reason: '만료된 쿠폰 마스터를 참조하는 사용 가능 쿠폰',
    });
  }

  const issuedCouponCounts = new Map();
  for (const document of inventory.user_coupons) {
    const couponId = documentData(document).couponId;
    if (typeof couponId !== 'string' || !couponId) continue;
    issuedCouponCounts.set(couponId, (issuedCouponCounts.get(couponId) || 0) + 1);
  }
  const couponSummaryMismatches = inventory.coupons.flatMap((document) => {
    const coupon = documentData(document);
    const usedCount = Number.isSafeInteger(coupon.usedCount) ? coupon.usedCount : 0;
    const userCouponCount = issuedCouponCounts.get(document.id) || 0;
    return usedCount !== userCouponCount ? [{
      collection: 'coupons',
      documentId: document.id,
      current: { usedCount },
      observed: { userCouponCount },
      proposed: null,
      reason: '쿠폰 마스터 요약 수와 발급 목록 수가 일치하지 않음',
      pendingReason: '이력 보존 정책 확인 필요',
    }] : [];
  });

  const featuredProductOverLimit = inventory.featuredProducts.flatMap((document) => {
    const featured = documentData(document);
    const productIds = uniqueProductIds(featured.productIds);
    if (!productIds) return [];
    const rawProductIds = featured.productIds;
    const requiresNormalization = rawProductIds.length !== productIds.length
      || rawProductIds.some((id, index) => id !== productIds[index])
      || featured.maxCount !== MAX_FEATURED_PRODUCT_COUNT;
    return requiresNormalization ? [{
      collection: 'featuredProducts',
      documentId: document.id,
      current: {
        productIds: rawProductIds,
        maxCount: featured.maxCount ?? null,
      },
      proposed: { productIds, maxCount: MAX_FEATURED_PRODUCT_COUNT },
      reason: '추천 상품을 중복 없는 3개로 제한해야 함',
    }] : [];
  });

  const categoriesByCanonicalId = new Map();
  for (const document of inventory.categories) {
    const category = documentData(document);
    const sourceId = category.slug || category.id || document.id;
    const canonicalId = normalizeCategoryId(sourceId);
    if (!canonicalId) continue;
    const group = categoriesByCanonicalId.get(canonicalId) || [];
    group.push({
      documentId: document.id,
      sourceId,
      isActivePresent: Object.prototype.hasOwnProperty.call(category, 'isActive'),
      currentIsActive: category.isActive,
    });
    categoriesByCanonicalId.set(canonicalId, group);
  }
  const duplicateCategoryIds = [...categoriesByCanonicalId.entries()]
    .filter(([, documents]) => documents.length > 1)
    .map(([canonicalId, documents]) => ({
      canonicalId,
      documents,
      proposed: null,
      reason: '대소문자 또는 별칭 정규화 결과가 같은 카테고리 문서가 중복됨',
      pendingReason: '정본 카테고리 문서 선택 필요',
    }));

  const suspiciousProductDetails = inventory.products.flatMap((document) => {
    const product = documentData(document);
    if (!isSuspiciousProductDetail(product)) return [];
    return [{
      collection: 'products',
      documentId: document.id,
      current: {
        name: product.name ?? null,
        material: product.details?.material ?? product.material ?? null,
      },
      proposed: null,
      reason: '계절·상품 유형과 소재 값의 조합이 비정상적으로 보임',
      pendingReason: '상품 소재 값 승인 필요',
    }];
  });

  return {
    invalidPointBalances,
    expiredActiveCoupons,
    couponSummaryMismatches,
    featuredProductOverLimit,
    duplicateCategoryIds,
    suspiciousProductDetails,
  };
}

function buildOperationalDataPlan(report, options) {
  const generatedAt = options?.generatedAt || new Date().toISOString();
  const generatedDate = new Date(generatedAt);
  if (!options?.projectId || Number.isNaN(generatedDate.getTime())) {
    throw new Error('A project id and valid generation time are required.');
  }
  const referenceDay = options.referenceDay || toKstDayKey(generatedDate);
  const operations = [];

  for (const finding of report.expiredActiveCoupons) {
    if (!finding.proposed) continue;
    operations.push({
      operationId: `${finding.collection}/${finding.documentId}:${finding.kind}`,
      collection: finding.collection,
      documentId: finding.documentId,
      current: finding.current,
      update: finding.proposed,
      ...(finding.basis ? { basis: finding.basis } : {}),
      reason: finding.reason,
    });
  }
  for (const finding of report.featuredProductOverLimit) {
    operations.push({
      operationId: `${finding.collection}/${finding.documentId}:productIds`,
      collection: finding.collection,
      documentId: finding.documentId,
      current: finding.current,
      update: finding.proposed,
      reason: finding.reason,
    });
  }
  for (const group of report.duplicateCategoryIds) {
    for (const category of group.documents.filter((entry) => !entry.isActivePresent)) {
      operations.push({
        operationId: `categories/${category.documentId}:isActive`,
        collection: 'categories',
        documentId: category.documentId,
        current: { isActivePresent: false },
        update: { isActive: true },
        reason: '누락된 카테고리 활성 상태를 명시적으로 기록',
      });
    }
  }

  const manualReview = [
    ...report.invalidPointBalances,
    ...report.couponSummaryMismatches,
    ...report.suspiciousProductDetails,
    ...report.duplicateCategoryIds.map((group) => ({
      collection: 'categories',
      documentId: group.documents.map((entry) => entry.documentId).join(','),
      current: { canonicalId: group.canonicalId, documentIds: group.documents.map((entry) => entry.documentId) },
      proposed: null,
      reason: group.reason,
      pendingReason: group.pendingReason,
    })),
  ];

  return {
    version: 1,
    targetProjectId: options.projectId,
    generatedAt: generatedDate.toISOString(),
    referenceDay,
    operations,
    manualReview,
  };
}

function documentRefHash(collection, documentId) {
  return crypto.createHash('sha256').update(`${collection}/${documentId}`).digest('hex').slice(0, 16);
}

function redactAuditReport(report) {
  const redactFinding = (finding) => ({
    documentRefHash: documentRefHash(finding.collection, finding.documentId),
    reason: finding.reason,
  });
  return {
    invalidPointBalances: report.invalidPointBalances.map(redactFinding),
    expiredActiveCoupons: report.expiredActiveCoupons.map(redactFinding),
    couponSummaryMismatches: report.couponSummaryMismatches.map(redactFinding),
    featuredProductOverLimit: report.featuredProductOverLimit.map(redactFinding),
    duplicateCategoryIds: report.duplicateCategoryIds.map((group) => ({
      documentRefHashes: group.documents.map((entry) => documentRefHash('categories', entry.documentId)),
      reason: group.reason,
    })),
    suspiciousProductDetails: report.suspiciousProductDetails.map(redactFinding),
  };
}

function parseArgs(argv) {
  if (argv.length !== 1 || argv[0] !== 'analyze') {
    throw new Error('Usage: node scripts/operational-data-audit.js analyze');
  }
  return { command: 'analyze' };
}

async function main(argv = process.argv.slice(2)) {
  parseArgs(argv);
  const runtime = require('./firestore-migration-runtime').loadFirestoreMigrationRuntime();
  const now = new Date();
  const report = await analyzeOperationalData(runtime, now);
  const plan = buildOperationalDataPlan(report, {
    projectId: runtime.projectId,
    generatedAt: now.toISOString(),
    referenceDay: toKstDayKey(now),
  });
  const planBuffer = Buffer.from(`${JSON.stringify(plan, null, 2)}\n`, 'utf8');
  const planSha256 = crypto.createHash('sha256').update(planBuffer).digest('hex');
  fs.mkdirSync(path.dirname(DEFAULT_PLAN_PATH), { recursive: true });
  fs.writeFileSync(DEFAULT_PLAN_PATH, planBuffer);
  process.stdout.write(`${JSON.stringify(redactAuditReport(report), null, 2)}\n`);
  process.stderr.write(`Plan: ${path.relative(process.cwd(), DEFAULT_PLAN_PATH)}\nSHA-256: ${planSha256}\n`);
  return { report, plan, planSha256 };
}

if (require.main === module) {
  main().catch(() => {
    console.error('Operational data audit failed.');
    process.exitCode = 1;
  });
}

module.exports = {
  analyzeOperationalData,
  buildOperationalDataPlan,
  normalizeDayKey,
  parseArgs,
  redactAuditReport,
};
