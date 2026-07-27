const fs = require('node:fs');
const path = require('node:path');

const {
  analyzeReviewSummaryBackfill,
  buildReviewSummary,
  main,
  normalizeFirestoreTimestamp,
  resolveFirestoreServerClock,
  runReviewSummaryBackfill,
} = require('./review-summary-backfill');

function document(id, data) {
  return { id, data: () => data, ref: { id, path: `products/${id}` } };
}

function createAnalyzeRuntime({ products = [], reviews = [] } = {}) {
  const collection = jest.fn((name) => ({
    get: jest.fn().mockResolvedValue({
      docs: name === 'products' ? products : reviews,
    }),
  }));
  return {
    projectId: 'demo-project',
    targetProjectVerified: true,
    db: { collection },
  };
}

describe('review summary backfill', () => {
  test('builds the same complete materialized summary as the trigger', () => {
    expect(buildReviewSummary([
      { rating: 5, isRecommended: true },
      { rating: 5, isRecommended: true },
      { rating: 4, isRecommended: false },
      { rating: 3, isRecommended: true },
    ])).toEqual({
      reviewCount: 4,
      rating: 4.3,
      reviewSummary: {
        schemaVersion: 1,
        totalReviews: 4,
        averageRating: 4.3,
        recommendedCount: 3,
        recommendationRate: 75,
        ratingDistribution: { 5: 2, 4: 1, 3: 1, 2: 0, 1: 0 },
      },
    });
  });

  test('analyzes stale, invalid, and orphan data without writing', async () => {
    const runtime = createAnalyzeRuntime({
      products: [document('product-1', { rating: 0, reviewCount: 0 })],
      reviews: [
        document('review-1', { productId: 'product-1', rating: 5, isRecommended: true }),
        document('review-invalid', { productId: 'product-1', rating: 8, isRecommended: true }),
        document('review-noncanonical-id', {
          productId: ' product-1 ',
          rating: 5,
          isRecommended: true,
        }),
        document('review-orphan', { productId: 'missing-product', rating: 4, isRecommended: false }),
      ],
    });

    const report = await analyzeReviewSummaryBackfill(runtime);

    expect(report).toMatchObject({
      dryRun: true,
      productCount: 1,
      reviewCount: 4,
      staleProductCount: 1,
      invalidReviewCount: 2,
      orphanReviewCount: 1,
    });
    expect(report.invalidReviewIds).toEqual([
      'review-invalid',
      'review-noncanonical-id',
    ]);
    expect(report.orphanProductIds).toEqual(['missing-product']);
    expect(runtime.db.collection).toHaveBeenCalledWith('products');
    expect(runtime.db.collection).toHaveBeenCalledWith('reviews');
  });

  test('keeps backfill mode read-only unless --execute is explicit', async () => {
    const runtime = createAnalyzeRuntime({
      products: [document('product-1', {})],
      reviews: [],
    });
    const reconcile = jest.fn();

    const result = await runReviewSummaryBackfill({ execute: false }, runtime, reconcile);

    expect(result.dryRun).toBe(true);
    expect(reconcile).not.toHaveBeenCalled();
  });

  test('blocks execute when invalid or orphan reviews make a partial backfill unsafe', async () => {
    const runtime = createAnalyzeRuntime({
      products: [document('product-1', {})],
      reviews: [document('review-1', {
        productId: 'missing-product',
        rating: 5,
        isRecommended: true,
      })],
    });

    await expect(runReviewSummaryBackfill(
      { execute: true },
      runtime,
      jest.fn(),
    )).rejects.toThrow('Backfill preconditions failed');
  });

  test('blocks execute when the migration target was not cross-checked', async () => {
    const runtime = createAnalyzeRuntime({
      products: [document('product-1', {})],
      reviews: [],
    });
    delete runtime.targetProjectVerified;

    await expect(runReviewSummaryBackfill(
      { execute: true },
      runtime,
      jest.fn(),
      jest.fn(),
    )).rejects.toThrow('target project is not verified');
  });

  test('executes reconciliation only after the explicit flag and clean analysis', async () => {
    const runtime = createAnalyzeRuntime({
      products: [document('product-1', {})],
      reviews: [],
    });
    const reconcile = jest.fn().mockResolvedValue(true);
    const runRef = { set: jest.fn().mockResolvedValue(undefined) };
    const resolveServerClock = jest.fn().mockResolvedValue({
      eventTime: '2026-07-21T01:02:03.123456789Z',
      runRef,
    });

    const result = await runReviewSummaryBackfill(
      { execute: true },
      runtime,
      reconcile,
      resolveServerClock,
    );

    expect(result).toMatchObject({ dryRun: false, reconciledProductCount: 1 });
    expect(reconcile).toHaveBeenCalledTimes(1);
    expect(reconcile).toHaveBeenCalledWith(
      runtime,
      'product-1',
      '2026-07-21T01:02:03.123456789Z',
      expect.stringContaining('backfill:'),
    );
    expect(resolveServerClock).toHaveBeenCalledWith(runtime, expect.any(String));
    expect(runRef.set).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'completed' }),
      { merge: true },
    );
  });

  test('normalizes the Firestore server timestamp without consulting local Date.now', () => {
    const dateNow = jest.spyOn(Date, 'now').mockReturnValue(4102444800000);

    expect(normalizeFirestoreTimestamp({
      seconds: 1784595723,
      nanoseconds: 123456789,
    })).toBe('2026-07-21T01:02:03.123456789Z');

    expect(dateNow).not.toHaveBeenCalled();
    dateNow.mockRestore();
  });

  test('obtains the backfill watermark from a committed Firestore server timestamp', async () => {
    const timestampMarker = { type: 'server-timestamp-sentinel' };
    const runRef = {
      set: jest.fn().mockResolvedValue(undefined),
      get: jest.fn().mockResolvedValue({
        exists: true,
        data: () => ({
          startedAt: { seconds: 1784595723, nanoseconds: 123456789 },
        }),
      }),
    };
    const doc = jest.fn(() => runRef);
    const runtime = {
      projectId: 'verified-project',
      targetProjectVerified: true,
      admin: {
        firestore: {
          FieldValue: { serverTimestamp: jest.fn(() => timestampMarker) },
        },
      },
      db: {
        collection: jest.fn(() => ({ doc })),
      },
    };

    await expect(resolveFirestoreServerClock(runtime, 'run-1')).resolves.toEqual({
      eventTime: '2026-07-21T01:02:03.123456789Z',
      runRef,
    });
    expect(runRef.set).toHaveBeenCalledWith(expect.objectContaining({
      status: 'running',
      targetProjectId: 'verified-project',
      startedAt: timestampMarker,
    }));
  });

  test('rejects unknown CLI shapes before loading a runtime', async () => {
    await expect(main(['analyze', '--execute'])).rejects.toThrow(
      '--execute is only valid with backfill',
    );
    await expect(main(['backfill', '--unknown'])).rejects.toThrow('Unknown argument');
  });

  test('registers separate analyze, dry-run, and explicit execute scripts', () => {
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'),
    );

    expect(packageJson.scripts['migrate:review-summary:analyze']).toBe(
      'node scripts/review-summary-backfill.js analyze',
    );
    expect(packageJson.scripts['migrate:review-summary:dry-run']).toBe(
      'node scripts/review-summary-backfill.js backfill',
    );
    expect(packageJson.scripts['migrate:review-summary:execute']).toBe(
      'node scripts/review-summary-backfill.js backfill --execute',
    );
  });
});
