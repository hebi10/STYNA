const crypto = require('crypto');
const fs = require('fs');

const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const DAY_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const PLAN_KEYS = [
  'version',
  'targetProjectId',
  'generatedAt',
  'referenceDay',
  'operations',
  'manualReview',
];

function normalizeDayKey(value) {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})([-./])(\d{2})\2(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const normalized = `${match[1]}-${match[3]}-${match[4]}`;
  const date = new Date(`${normalized}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === normalized
    ? normalized
    : null;
}

function calculatePlanSha256(planBuffer) {
  if (!Buffer.isBuffer(planBuffer)) throw new TypeError('Plan content must be a Buffer.');
  return crypto.createHash('sha256').update(planBuffer).digest('hex');
}

function exactKeys(value, expectedKeys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const actualKeys = Object.keys(value).sort();
  return JSON.stringify(actualKeys) === JSON.stringify([...expectedKeys].sort());
}

function validString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function deepEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function isExpiredDay(expiryDate, referenceDay) {
  const normalizedExpiryDate = normalizeDayKey(expiryDate);
  return normalizedExpiryDate !== null && normalizedExpiryDate < referenceDay;
}

function validateCategoryOperation(operation) {
  return exactKeys(operation, ['operationId', 'collection', 'documentId', 'current', 'update', 'reason'])
    && deepEqual(operation.current, { isActivePresent: false })
    && deepEqual(operation.update, { isActive: true });
}

function validateFeaturedOperation(operation) {
  if (!exactKeys(operation, ['operationId', 'collection', 'documentId', 'current', 'update', 'reason'])) {
    return false;
  }
  if (!exactKeys(operation.current, ['productIds', 'maxCount'])
    || !exactKeys(operation.update, ['productIds', 'maxCount'])
    || !Array.isArray(operation.current.productIds)
    || !Array.isArray(operation.update.productIds)) return false;
  const expectedProductIds = [...new Set(operation.current.productIds.filter((id) => (
    validString(id)
  )))].slice(0, 3);
  return operation.update.maxCount === 3
    && operation.update.productIds.length <= 3
    && deepEqual(operation.update.productIds, expectedProductIds);
}

function validateCouponOperation(operation, referenceDay) {
  return exactKeys(operation, ['operationId', 'collection', 'documentId', 'current', 'update', 'reason'])
    && exactKeys(operation.current, ['expiryDate', 'isActive'])
    && operation.current.isActive === true
    && isExpiredDay(operation.current.expiryDate, referenceDay)
    && deepEqual(operation.update, { isActive: false });
}

function validateUserCouponOperation(operation, referenceDay) {
  return exactKeys(operation, [
    'operationId',
    'collection',
    'documentId',
    'current',
    'update',
    'basis',
    'reason',
  ])
    && exactKeys(operation.current, ['couponId', 'status'])
    && operation.current.status === '사용가능'
    && validString(operation.current.couponId)
    && deepEqual(operation.update, { status: '기간만료' })
    && exactKeys(operation.basis, ['couponDocumentId', 'expiryDate'])
    && operation.basis.couponDocumentId === operation.current.couponId
    && isExpiredDay(operation.basis.expiryDate, referenceDay);
}

function validateOperation(operation, referenceDay) {
  if (!validString(operation?.operationId)
    || !validString(operation?.documentId)
    || operation.documentId.includes('/')
    || !validString(operation?.reason)) return false;

  if (operation.collection === 'categories') return validateCategoryOperation(operation);
  if (operation.collection === 'featuredProducts') return validateFeaturedOperation(operation);
  if (operation.collection === 'coupons') return validateCouponOperation(operation, referenceDay);
  if (operation.collection === 'user_coupons') return validateUserCouponOperation(operation, referenceDay);
  return false;
}

function parseAndValidatePlan(planBuffer) {
  let plan;
  try {
    plan = JSON.parse(planBuffer.toString('utf8'));
  } catch {
    throw new Error('Approved plan is not valid JSON.');
  }
  if (!exactKeys(plan, PLAN_KEYS)
    || plan.version !== 1
    || !validString(plan.targetProjectId)
    || Number.isNaN(new Date(plan.generatedAt).getTime())
    || !DAY_KEY_PATTERN.test(plan.referenceDay)
    || !Array.isArray(plan.operations)
    || !Array.isArray(plan.manualReview)) {
    throw new Error('Approved plan schema is invalid.');
  }
  const operationIds = new Set();
  const targets = new Set();
  for (const operation of plan.operations) {
    if (!validateOperation(operation, plan.referenceDay)) {
      throw new Error('Plan operation is not allowed or is ambiguous.');
    }
    const target = `${operation.collection}/${operation.documentId}`;
    if (operationIds.has(operation.operationId) || targets.has(target)) {
      throw new Error('Plan contains duplicate operations.');
    }
    operationIds.add(operation.operationId);
    targets.add(target);
  }
  for (const review of plan.manualReview) {
    if (!review || typeof review !== 'object' || Array.isArray(review) || 'update' in review) {
      throw new Error('Manual review entries cannot contain executable updates.');
    }
  }
  return plan;
}

function verifyApprovedHash(planBuffer, approvedSha256) {
  if (!SHA256_PATTERN.test(approvedSha256 || '')) {
    throw new Error('A lowercase SHA-256 hash is required.');
  }
  const actualSha256 = calculatePlanSha256(planBuffer);
  if (!crypto.timingSafeEqual(Buffer.from(actualSha256), Buffer.from(approvedSha256))) {
    throw new Error('Approved plan hash does not match.');
  }
  return actualSha256;
}

function requireRuntime(runtime) {
  if (!runtime?.db || runtime.targetProjectVerified !== true || !runtime.projectId) {
    throw new Error('A verified Firestore runtime is required.');
  }
  return runtime;
}

function currentValueMatches(operation, data) {
  if (operation.collection === 'categories') {
    return Object.prototype.hasOwnProperty.call(data, 'isActive') === false;
  }
  if (operation.collection === 'featuredProducts') {
    return deepEqual({
      productIds: data.productIds,
      maxCount: data.maxCount ?? null,
    }, operation.current);
  }
  if (operation.collection === 'coupons') {
    return deepEqual({ expiryDate: data.expiryDate, isActive: data.isActive }, operation.current);
  }
  if (operation.collection === 'user_coupons') {
    return deepEqual({ couponId: data.couponId, status: data.status }, operation.current);
  }
  return false;
}

async function executeApprovedPlan({ planBuffer, approvedSha256 }, runtime) {
  const actualSha256 = verifyApprovedHash(planBuffer, approvedSha256);
  const plan = parseAndValidatePlan(planBuffer);
  const safeRuntime = requireRuntime(runtime);
  if (safeRuntime.projectId !== plan.targetProjectId) {
    throw new Error('Approved plan target project does not match.');
  }

  const preflight = [];
  for (const operation of plan.operations) {
    const reference = safeRuntime.db.collection(operation.collection).doc(operation.documentId);
    const snapshot = await reference.get();
    if (!snapshot.exists || !currentValueMatches(operation, snapshot.data() || {})) {
      throw new Error('A planned document current value changed; no writes were performed.');
    }
    if (operation.collection === 'user_coupons') {
      const couponSnapshot = await safeRuntime.db.collection('coupons')
        .doc(operation.basis.couponDocumentId)
        .get();
      if (!couponSnapshot.exists
        || couponSnapshot.data()?.expiryDate !== operation.basis.expiryDate) {
        throw new Error('A planned coupon basis changed; no writes were performed.');
      }
    }
    preflight.push({ reference: snapshot.ref || reference, update: operation.update });
  }

  if (preflight.length > 0) {
    const batch = safeRuntime.db.batch();
    for (const operation of preflight) batch.update(operation.reference, operation.update);
    await batch.commit();
  }
  return {
    projectId: safeRuntime.projectId,
    appliedOperationCount: preflight.length,
    planSha256: actualSha256,
  };
}

function parseArgs(argv) {
  const [command, ...flags] = argv;
  if (!['hash', 'execute'].includes(command)) {
    throw new Error('Command must be hash or execute.');
  }
  let planPath = null;
  let sha256 = null;
  for (let index = 0; index < flags.length; index += 1) {
    const flag = flags[index];
    if (flag === '--plan') {
      if (planPath !== null) throw new Error('duplicate --plan argument');
      if (!flags[index + 1]) throw new Error('--plan requires a path.');
      planPath = flags[index + 1];
      index += 1;
      continue;
    }
    if (flag === '--sha256') {
      if (sha256 !== null) throw new Error('duplicate --sha256 argument');
      if (!flags[index + 1]) throw new Error('--sha256 requires a hash.');
      sha256 = flags[index + 1];
      index += 1;
      continue;
    }
    throw new Error('Unknown remediation argument.');
  }
  if (!planPath) throw new Error('--plan is required.');
  if (command === 'hash' && sha256 !== null) throw new Error('hash does not accept --sha256.');
  if (command === 'execute' && !sha256) throw new Error('--sha256 is required.');
  return { command, planPath, sha256 };
}

async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const planBuffer = fs.readFileSync(options.planPath);
  if (options.command === 'hash') {
    process.stdout.write(`${calculatePlanSha256(planBuffer)}\n`);
    return;
  }
  verifyApprovedHash(planBuffer, options.sha256);
  parseAndValidatePlan(planBuffer);
  const runtime = require('./firestore-migration-runtime').loadFirestoreMigrationRuntime();
  const result = await executeApprovedPlan({
    planBuffer,
    approvedSha256: options.sha256,
  }, runtime);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : 'Operational data remediation failed.');
    process.exitCode = 1;
  });
}

module.exports = {
  calculatePlanSha256,
  executeApprovedPlan,
  parseAndValidatePlan,
  parseArgs,
};
