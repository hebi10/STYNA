const {
  analyzeReviewOrphans,
  parseArgs,
  runReviewOrphanRemediation,
} = require('./review-orphan-remediation');

function document(id, data) {
  return { id, data: () => data, ref: { id, path: `reviews/${id}` } };
}

function createRuntime({ products = [], reviews = [] } = {}) {
  const batch = { delete: jest.fn(), commit: jest.fn().mockResolvedValue(undefined) };
  const collection = jest.fn((name) => ({
    get: jest.fn().mockResolvedValue({ docs: name === 'products' ? products : reviews }),
  }));
  return {
    projectId: 'demo-project',
    targetProjectVerified: true,
    db: { collection, batch: jest.fn(() => batch) },
    batch,
  };
}

describe('review orphan remediation', () => {
  test('analyzes orphan reviews without exposing review content', async () => {
    const runtime = createRuntime({
      products: [document('product-1', {})],
      reviews: [
        document('review-a', {
          productId: 'missing-product',
          createdAt: { seconds: 1784595723, nanoseconds: 0 },
          authorName: 'private',
          content: 'private',
        }),
      ],
    });

    await expect(analyzeReviewOrphans(runtime)).resolves.toEqual({
      projectId: 'demo-project',
      orphanReviewCount: 1,
      orphanReviews: [{
        id: 'review-a',
        productId: 'missing-product',
        createdAt: '2026-07-21T01:02:03.000Z',
      }],
    });
  });

  test('rejects deletion unless exact ids and --execute are both supplied', async () => {
    expect(() => parseArgs(['delete', '--ids', 'review-a'])).toThrow('--execute');
    expect(() => parseArgs(['delete', '--execute'])).toThrow('--ids');
    expect(parseArgs(['delete', '--ids', 'other-product-1', '--execute']))
      .toEqual({ command: 'delete', execute: true, ids: ['other-product-1'] });
  });

  test('deletes only selected documents that are still confirmed as orphan reviews', async () => {
    const runtime = createRuntime({
      products: [document('product-1', {})],
      reviews: [document('review-a', { productId: 'missing-product' })],
    });

    await expect(runReviewOrphanRemediation({
      command: 'delete',
      execute: true,
      ids: ['review-a'],
    }, runtime)).resolves.toMatchObject({ deletedReviewIds: ['review-a'] });
    expect(runtime.batch.delete).toHaveBeenCalledWith({ id: 'review-a', path: 'reviews/review-a' });
    expect(runtime.batch.commit).toHaveBeenCalledTimes(1);
  });
});
