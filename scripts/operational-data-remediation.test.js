const crypto = require('crypto');

const {
  analyzeOperationalData,
  buildOperationalDataPlan,
  redactAuditReport,
} = require('./operational-data-audit');
const {
  calculatePlanSha256,
  executeApprovedPlan,
  parseArgs,
} = require('./operational-data-remediation');

function document(collection, id, data) {
  return {
    id,
    ref: { collection, id, path: `${collection}/${id}` },
    data: () => data,
  };
}

function createRuntime(seed = {}) {
  const stored = new Map();
  for (const [collectionName, records] of Object.entries(seed)) {
    stored.set(collectionName, new Map(records.map((record) => [record.id, record])));
  }

  const batch = {
    update: jest.fn(),
    commit: jest.fn().mockResolvedValue(undefined),
  };
  const collection = jest.fn((collectionName) => ({
    get: jest.fn().mockResolvedValue({
      docs: [...(stored.get(collectionName)?.values() || [])],
    }),
    doc: jest.fn((id) => ({
      get: jest.fn().mockResolvedValue((() => {
        const record = stored.get(collectionName)?.get(id);
        return record
          ? { exists: true, id, ref: record.ref, data: record.data }
          : { exists: false, id, ref: { collection: collectionName, id }, data: () => undefined };
      })()),
    })),
  }));

  return {
    projectId: 'demo-project',
    targetProjectVerified: true,
    db: {
      collection,
      batch: jest.fn(() => batch),
    },
    batch,
  };
}

function auditFixture() {
  return createRuntime({
    users: [
      document('users', 'private-user-id', { pointBalance: 400_000_000_000, email: 'private@example.com' }),
    ],
    coupons: [
      document('coupons', 'expired-coupon', {
        expiryDate: '2026.08.01',
        isActive: true,
        usedCount: 0,
      }),
    ],
    user_coupons: [
      document('user_coupons', 'private-user-coupon', {
        uid: 'private-user-id',
        couponId: 'expired-coupon',
        status: '사용가능',
      }),
    ],
    featuredProducts: [
      document('featuredProducts', 'mainPageFeatured', {
        productIds: ['one', 'two', 'two', 'three', 'four'],
        maxCount: 10,
      }),
    ],
    categories: [
      document('categories', 'Bags', { slug: 'Bags', name: '가방' }),
      document('categories', 'bag', { slug: 'bag', name: '가방 별칭', isActive: true }),
    ],
    products: [
      document('products', 'summer-shirt', {
        name: '여름 반팔 티셔츠',
        details: { material: '울 100%' },
      }),
    ],
  });
}

describe('operational data audit', () => {
  test('reports all six anomaly groups without performing Firestore writes', async () => {
    const runtime = auditFixture();

    const report = await analyzeOperationalData(runtime, new Date('2026-08-12T12:00:00+09:00'));

    expect(Object.keys(report)).toEqual([
      'invalidPointBalances',
      'expiredActiveCoupons',
      'couponSummaryMismatches',
      'featuredProductOverLimit',
      'duplicateCategoryIds',
      'suspiciousProductDetails',
    ]);
    expect(report.invalidPointBalances).toHaveLength(1);
    expect(report.expiredActiveCoupons).toHaveLength(2);
    expect(report.couponSummaryMismatches).toHaveLength(1);
    expect(report.featuredProductOverLimit).toHaveLength(1);
    expect(report.duplicateCategoryIds).toHaveLength(1);
    expect(report.suspiciousProductDetails).toHaveLength(1);
    expect(runtime.db.batch).not.toHaveBeenCalled();
  });

  test('redacts document ids and private values from the console report', async () => {
    const report = await analyzeOperationalData(
      auditFixture(),
      new Date('2026-08-12T12:00:00+09:00'),
    );

    const serialized = JSON.stringify(redactAuditReport(report));

    expect(serialized).not.toContain('private-user-id');
    expect(serialized).not.toContain('private@example.com');
    expect(serialized).not.toContain('400000000000');
    expect(serialized).not.toContain('울 100%');
    expect(serialized).not.toContain('여름 반팔 티셔츠');
    expect(serialized).toContain('documentRefHash');
  });

  test('builds an explicit plan whose operations include only deterministic remediations', async () => {
    const report = await analyzeOperationalData(
      auditFixture(),
      new Date('2026-08-12T12:00:00+09:00'),
    );

    const plan = buildOperationalDataPlan(report, {
      projectId: 'demo-project',
      generatedAt: '2026-08-12T03:00:00.000Z',
    });

    expect(plan.operations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        collection: 'coupons',
        documentId: 'expired-coupon',
        current: { expiryDate: '2026.08.01', isActive: true },
        update: { isActive: false },
      }),
      expect.objectContaining({
        collection: 'user_coupons',
        documentId: 'private-user-coupon',
        current: { couponId: 'expired-coupon', status: '사용가능' },
        update: { status: '기간만료' },
      }),
      expect.objectContaining({
        collection: 'featuredProducts',
        documentId: 'mainPageFeatured',
        update: { productIds: ['one', 'two', 'three'], maxCount: 3 },
      }),
      expect.objectContaining({
        collection: 'categories',
        documentId: 'Bags',
        current: { isActivePresent: false },
        update: { isActive: true },
      }),
    ]));
    expect(plan.operations).toHaveLength(4);
    expect(plan.manualReview).toEqual(expect.arrayContaining([
      expect.objectContaining({ collection: 'users', documentId: 'private-user-id' }),
      expect.objectContaining({ collection: 'products', documentId: 'summer-shirt' }),
      expect.objectContaining({ collection: 'coupons', documentId: 'expired-coupon' }),
    ]));
    expect(plan.operations.some((operation) => operation.collection === 'users')).toBe(false);
    expect(plan.operations.some((operation) => operation.collection === 'products')).toBe(false);
  });

  test('preserves an allowed legacy expiry literal so preflight compares the real current value', async () => {
    const runtime = auditFixture();
    const report = await analyzeOperationalData(runtime, new Date('2026-08-12T12:00:00+09:00'));
    const plan = buildOperationalDataPlan(report, {
      projectId: 'demo-project',
      generatedAt: '2026-08-12T03:00:00.000Z',
    });
    const planBuffer = Buffer.from(`${JSON.stringify(plan, null, 2)}\n`, 'utf8');
    const approvedSha256 = calculatePlanSha256(planBuffer);

    await expect(executeApprovedPlan({ planBuffer, approvedSha256 }, runtime))
      .resolves.toMatchObject({ appliedOperationCount: 4 });
  });
});

describe('approved operational data remediation', () => {
  test('requires execute, one plan path, and an exact sha256', () => {
    expect(() => parseArgs(['hash', '--plan', 'tmp/plan.json'])).not.toThrow();
    expect(() => parseArgs(['execute', '--plan', 'tmp/plan.json'])).toThrow('--sha256');
    expect(() => parseArgs(['execute', '--sha256', 'a'.repeat(64)])).toThrow('--plan');
    expect(() => parseArgs(['execute', '--plan', 'a.json', '--plan', 'b.json', '--sha256', 'a'.repeat(64)]))
      .toThrow('duplicate');
  });

  test('rejects a changed plan hash before creating a batch', async () => {
    const runtime = auditFixture();
    const planBuffer = Buffer.from(JSON.stringify({ version: 1, operations: [] }), 'utf8');

    await expect(executeApprovedPlan({
      planBuffer,
      approvedSha256: '0'.repeat(64),
    }, runtime)).rejects.toThrow('hash');
    expect(runtime.db.batch).not.toHaveBeenCalled();
  });

  test('refuses ambiguous or non-whitelisted operations without any writes', async () => {
    const runtime = auditFixture();
    const planBuffer = Buffer.from(JSON.stringify({
      version: 1,
      targetProjectId: 'demo-project',
      generatedAt: '2026-08-12T03:00:00.000Z',
      referenceDay: '2026-08-12',
      operations: [{
        operationId: 'manual-user-change',
        collection: 'users',
        documentId: 'private-user-id',
        current: { pointBalance: 400_000_000_000 },
        update: { pointBalance: 0 },
        reason: 'manual value',
      }],
      manualReview: [],
    }), 'utf8');

    await expect(executeApprovedPlan({
      planBuffer,
      approvedSha256: calculatePlanSha256(planBuffer),
    }, runtime)).rejects.toThrow('not allowed');
    expect(runtime.db.batch).not.toHaveBeenCalled();
  });

  test('preflights every current value and aborts the whole batch when one changed', async () => {
    const runtime = createRuntime({
      categories: [document('categories', 'Bags', { isActive: false })],
    });
    const planBuffer = Buffer.from(JSON.stringify({
      version: 1,
      targetProjectId: 'demo-project',
      generatedAt: '2026-08-12T03:00:00.000Z',
      referenceDay: '2026-08-12',
      operations: [{
        operationId: 'categories/Bags:isActive',
        collection: 'categories',
        documentId: 'Bags',
        current: { isActivePresent: false },
        update: { isActive: true },
        reason: '누락된 활성 상태 명시',
      }],
      manualReview: [],
    }), 'utf8');

    await expect(executeApprovedPlan({
      planBuffer,
      approvedSha256: calculatePlanSha256(planBuffer),
    }, runtime)).rejects.toThrow('current value');
    expect(runtime.db.batch).not.toHaveBeenCalled();
  });

  test('applies only the approved explicit updates after hash and preflight checks', async () => {
    const runtime = createRuntime({
      featuredProducts: [document('featuredProducts', 'mainPageFeatured', {
        productIds: ['one', 'two', 'two', 'three', 'four'],
        maxCount: 10,
      })],
      categories: [document('categories', 'Bags', { slug: 'Bags' })],
    });
    const plan = {
      version: 1,
      targetProjectId: 'demo-project',
      generatedAt: '2026-08-12T03:00:00.000Z',
      referenceDay: '2026-08-12',
      operations: [
        {
          operationId: 'featuredProducts/mainPageFeatured:productIds',
          collection: 'featuredProducts',
          documentId: 'mainPageFeatured',
          current: { productIds: ['one', 'two', 'two', 'three', 'four'], maxCount: 10 },
          update: { productIds: ['one', 'two', 'three'], maxCount: 3 },
          reason: '추천 상품을 중복 없는 3개로 제한',
        },
        {
          operationId: 'categories/Bags:isActive',
          collection: 'categories',
          documentId: 'Bags',
          current: { isActivePresent: false },
          update: { isActive: true },
          reason: '누락된 활성 상태 명시',
        },
      ],
      manualReview: [],
    };
    const planBuffer = Buffer.from(`${JSON.stringify(plan, null, 2)}\n`, 'utf8');
    const approvedSha256 = crypto.createHash('sha256').update(planBuffer).digest('hex');

    await expect(executeApprovedPlan({ planBuffer, approvedSha256 }, runtime)).resolves.toEqual({
      projectId: 'demo-project',
      appliedOperationCount: 2,
      planSha256: approvedSha256,
    });
    expect(runtime.batch.update).toHaveBeenNthCalledWith(
      1,
      { collection: 'featuredProducts', id: 'mainPageFeatured', path: 'featuredProducts/mainPageFeatured' },
      { productIds: ['one', 'two', 'three'], maxCount: 3 },
    );
    expect(runtime.batch.update).toHaveBeenNthCalledWith(
      2,
      { collection: 'categories', id: 'Bags', path: 'categories/Bags' },
      { isActive: true },
    );
    expect(runtime.batch.commit).toHaveBeenCalledTimes(1);
  });
});
