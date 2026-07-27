import type { Firestore } from 'firebase-admin/firestore';
import {
  getAffectedReviewProductIds,
  syncProductReviewStats,
  syncReviewProductStats,
} from '../src/triggers/reviewStats';

function createFirestoreMock(options: {
  productExists?: boolean;
  currentEventTime?: string;
  currentRunToken?: string;
  reviewCount?: number;
  averageRating?: number | null;
  recommendedCount?: number;
  ratingCounts?: Partial<Record<1 | 2 | 3 | 4 | 5, number>>;
} = {}) {
  const productRef = { path: 'products/product-1' };
  const productState: Record<string, unknown> = {
    reviewStatsEventTime: options.currentEventTime,
    reviewStatsRunToken: options.currentRunToken,
  };
  const transactionUpdate = jest.fn((_reference, update: Record<string, unknown>) => {
    Object.assign(productState, update);
  });
  const transactionGet = jest.fn().mockImplementation(async () => ({
    exists: options.productExists ?? true,
    data: () => productState,
  }));
  const aggregateGet = jest.fn().mockResolvedValue({
    data: () => ({
      reviewCount: options.reviewCount ?? 4,
      averageRating: options.averageRating ?? 4.25,
    }),
  });
  const countGet = jest.fn().mockImplementation(async (filters: unknown[]) => {
    const ratingFilter = filters.find((filter) => (
      typeof filter === 'object' && filter !== null && 'rating' in filter
    )) as { rating?: number } | undefined;
    const isRecommended = filters.some((filter) => (
      typeof filter === 'object' && filter !== null && 'recommended' in filter
    ));
    const count = isRecommended
      ? options.recommendedCount ?? 3
      : options.ratingCounts?.[ratingFilter?.rating as 1 | 2 | 3 | 4 | 5]
        ?? ({ 5: 2, 4: 1, 3: 1, 2: 0, 1: 0 } as const)[ratingFilter?.rating as 1 | 2 | 3 | 4 | 5]
        ?? 0;
    return { data: () => ({ count }) };
  });
  const makeQuery = (filters: unknown[] = []): Record<string, unknown> => ({
    where: jest.fn((field: string, _operator: string, value: unknown) => (
      makeQuery([...filters, field === 'rating' ? { rating: value } : { recommended: value }])
    )),
    aggregate: jest.fn(() => ({ get: aggregateGet })),
    count: jest.fn(() => ({ get: () => countGet(filters) })),
  });
  const reviewsWhere = jest.fn(() => makeQuery());
  const firestore = {
    collection: jest.fn((name: string) => {
      if (name === 'reviews') {
        return { where: reviewsWhere };
      }
      return { doc: jest.fn(() => productRef) };
    }),
    runTransaction: jest.fn(async (callback) => callback({
      get: transactionGet,
      update: transactionUpdate,
    })),
  };

  return {
    firestore: firestore as unknown as Firestore,
    aggregateGet,
    countGet,
    reviewsWhere,
    transactionGet,
    transactionUpdate,
  };
}

describe('review product stats synchronization', () => {
  test('writes one current aggregate summary after claiming the run', async () => {
    const mock = createFirestoreMock();

    await syncProductReviewStats(
      mock.firestore,
      'product-1',
      '2026-07-21T01:02:03.100000000Z',
      'run-b',
    );

    expect(mock.reviewsWhere).toHaveBeenCalledWith('productId', '==', 'product-1');
    expect(mock.aggregateGet).toHaveBeenCalledTimes(1);
    expect(mock.countGet).toHaveBeenCalledTimes(6);
    expect(mock.transactionUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({ path: 'products/product-1' }),
      expect.objectContaining({
        reviewCount: 4,
        rating: 4.3,
        reviewSummary: expect.objectContaining({
          schemaVersion: 1,
          recommendedCount: 3,
          ratingDistribution: { 5: 2, 4: 1, 3: 1, 2: 0, 1: 0 },
        }),
      }),
    );
  });

  test('does not let an older event claim or aggregate after a newer event time', async () => {
    const mock = createFirestoreMock({
      currentEventTime: '2026-07-21T01:02:03.200000000Z',
    });

    await syncProductReviewStats(
      mock.firestore,
      'product-1',
      '2026-07-21T01:02:03.100000000Z',
      'run-a',
    );

    expect(mock.aggregateGet).not.toHaveBeenCalled();
    expect(mock.transactionUpdate).not.toHaveBeenCalled();
  });

  test('does not finalize a run after another equal-time run owns the token', async () => {
    const mock = createFirestoreMock();
    mock.transactionGet
      .mockResolvedValueOnce({ exists: true, data: () => ({}) })
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({ reviewStatsRunToken: 'newer-claim' }),
      });

    await syncProductReviewStats(
      mock.firestore,
      'product-1',
      '2026-07-21T01:02:03.100000000Z',
      'run-a',
    );

    expect(mock.transactionUpdate).toHaveBeenCalledTimes(1);
    expect(mock.transactionUpdate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ reviewStatsRunToken: 'run-a' }),
    );
  });

  test('retries instead of publishing a summary assembled from inconsistent snapshots', async () => {
    const mock = createFirestoreMock({
      reviewCount: 4,
      ratingCounts: { 5: 4, 4: 4, 3: 0, 2: 0, 1: 0 },
    });

    await expect(syncProductReviewStats(
      mock.firestore,
      'product-1',
      '2026-07-21T01:02:03.100000000Z',
      'run-a',
    )).rejects.toThrow('inconsistent');

    expect(mock.transactionUpdate).toHaveBeenCalledTimes(1);
    expect(mock.transactionUpdate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ reviewStatsRunToken: 'run-a' }),
    );
  });

  test('ignores a review whose product was removed', async () => {
    const mock = createFirestoreMock({ productExists: false });

    await syncProductReviewStats(
      mock.firestore,
      'product-1',
      '2026-07-21T01:02:03.100000000Z',
      'run-b',
    );

    expect(mock.aggregateGet).not.toHaveBeenCalled();
    expect(mock.transactionUpdate).not.toHaveBeenCalled();
  });

  test('skips copy-only updates but processes all fields used by the summary', () => {
    expect(getAffectedReviewProductIds(
      { productId: 'product-1', rating: 4, isRecommended: false, title: 'before' },
      { productId: 'product-1', rating: 4, isRecommended: false, title: 'after' },
    )).toEqual([]);
    expect(getAffectedReviewProductIds(
      { productId: 'product-1', rating: 4, isRecommended: false },
      { productId: 'product-1', rating: 5, isRecommended: false },
    )).toEqual(['product-1']);
    expect(getAffectedReviewProductIds(
      { productId: 'product-1', rating: 4, isRecommended: false },
      { productId: 'product-1', rating: 4, isRecommended: true },
    )).toEqual(['product-1']);
  });

  test('reconciles both products when productId changes and handles create/delete', () => {
    expect(getAffectedReviewProductIds(
      { productId: 'product-old', rating: 4 },
      { productId: 'product-new', rating: 4 },
    )).toEqual(['product-old', 'product-new']);
    expect(getAffectedReviewProductIds(null, { productId: 'product-new', rating: 5 }))
      .toEqual(['product-new']);
    expect(getAffectedReviewProductIds({ productId: 'product-old', rating: 5 }, null))
      .toEqual(['product-old']);
  });

  test('does not reinterpret a whitespace-padded legacy productId as another document id', () => {
    expect(getAffectedReviewProductIds(
      null,
      { productId: ' product-1 ', rating: 5, isRecommended: true },
    )).toEqual([]);
  });

  test('deploys in the Firestore region with retries enabled', () => {
    const endpoint = (syncReviewProductStats as unknown as {
      __endpoint: { eventTrigger: { retry: boolean }; region: string[] };
    }).__endpoint;

    expect(endpoint.region).toContain('asia-northeast1');
    expect(endpoint.eventTrigger.retry).toBe(true);
  });
});
