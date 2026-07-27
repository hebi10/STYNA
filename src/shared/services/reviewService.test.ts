import {
  average,
  count,
  getAggregateFromServer,
  getCountFromServer,
  getDoc,
  getDocs,
  limit,
  orderBy,
  where,
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { ReviewService } from './reviewService';

jest.mock('firebase/firestore', () => ({
  addDoc: jest.fn(),
  average: jest.fn((field) => ({ type: 'average', field })),
  collection: jest.fn((db, name) => ({ kind: 'collection', name })),
  count: jest.fn(() => ({ type: 'count' })),
  deleteDoc: jest.fn(),
  doc: jest.fn(),
  getAggregateFromServer: jest.fn(),
  getCountFromServer: jest.fn(),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  limit: jest.fn((count) => ({ type: 'limit', count })),
  orderBy: jest.fn((field, direction) => ({ type: 'orderBy', field, direction })),
  query: jest.fn((...args) => ({ kind: 'query', args })),
  startAfter: jest.fn((cursor) => ({ type: 'startAfter', cursor })),
  updateDoc: jest.fn(),
  where: jest.fn((field, op, value) => ({ type: 'where', field, op, value })),
  Timestamp: {
    now: jest.fn(() => ({ toDate: () => new Date('2026-01-01T00:00:00.000Z') })),
  },
}));

jest.mock('@/shared/libs/firebase/firebase', () => ({
  db: {},
}));

jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(),
}));

const makeReviewDoc = (id: string, createdAt: string) => ({
  id,
  data: () => ({
    productId: 'product-1',
    userId: 'user-1',
    userName: '사용자',
    rating: 5,
    title: '좋아요',
    content: '내용',
    images: [],
    isRecommended: true,
    createdAt: { toDate: () => new Date(createdAt) },
    updatedAt: { toDate: () => new Date(createdAt) },
  }),
});

describe('ReviewService Firestore query cost', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    jest.mocked(getAuth).mockReturnValue({
      currentUser: {
        getIdToken: jest.fn().mockResolvedValue('review-token'),
      },
    } as never);
    jest.mocked(getDoc).mockResolvedValue({
      exists: () => false,
    } as unknown as Awaited<ReturnType<typeof getDoc>>);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('counts reviews with Firestore count aggregation', async () => {
    jest.mocked(getCountFromServer).mockResolvedValue({
      data: () => ({ count: 1152 }),
    } as unknown as Awaited<ReturnType<typeof getCountFromServer>>);

    await expect(ReviewService.getTotalReviewsCount()).resolves.toBe(1152);

    expect(getCountFromServer).toHaveBeenCalledTimes(1);
    expect(getDocs).not.toHaveBeenCalled();
  });

  test('calculates review statistics with server aggregates without reading review documents', async () => {
    jest.mocked(getAggregateFromServer)
      .mockResolvedValueOnce({
        data: () => ({ totalCount: 4, averageRating: 4.25 }),
      } as unknown as Awaited<ReturnType<typeof getAggregateFromServer>>)
      .mockResolvedValueOnce({
        data: () => ({ recommendedCount: 3 }),
      } as unknown as Awaited<ReturnType<typeof getAggregateFromServer>>);

    await expect(ReviewService.getReviewStatistics()).resolves.toEqual({
      totalCount: 4,
      averageRating: 4.3,
      recommendationRate: 75,
    });

    expect(getAggregateFromServer).toHaveBeenCalledTimes(2);
    expect(count).toHaveBeenCalledTimes(2);
    expect(average).toHaveBeenCalledWith('rating');
    expect(where).toHaveBeenCalledWith('isRecommended', '==', true);
    expect(getDocs).not.toHaveBeenCalled();
  });

  test('applies the same rating filter to total and recommended aggregates', async () => {
    jest.mocked(getAggregateFromServer)
      .mockResolvedValueOnce({
        data: () => ({ totalCount: 2, averageRating: 5 }),
      } as unknown as Awaited<ReturnType<typeof getAggregateFromServer>>)
      .mockResolvedValueOnce({
        data: () => ({ recommendedCount: 1 }),
      } as unknown as Awaited<ReturnType<typeof getAggregateFromServer>>);

    await expect(ReviewService.getReviewStatistics(5)).resolves.toEqual({
      totalCount: 2,
      averageRating: 5,
      recommendationRate: 50,
    });

    expect(where).toHaveBeenCalledWith('rating', '==', 5);
    expect(where).toHaveBeenCalledWith('isRecommended', '==', true);
  });

  test('keeps the recommendation rate within 0 to 100 during concurrent aggregate reads', async () => {
    jest.mocked(getAggregateFromServer)
      .mockResolvedValueOnce({
        data: () => ({ totalCount: 1, averageRating: 5 }),
      } as unknown as Awaited<ReturnType<typeof getAggregateFromServer>>)
      .mockResolvedValueOnce({
        data: () => ({ recommendedCount: 2 }),
      } as unknown as Awaited<ReturnType<typeof getAggregateFromServer>>);

    await expect(ReviewService.getReviewStatistics()).resolves.toMatchObject({
      recommendationRate: 100,
    });
  });

  test('keeps a legacy invalid aggregate rating within the public 0 to 5 contract', async () => {
    jest.mocked(getAggregateFromServer)
      .mockResolvedValueOnce({
        data: () => ({ totalCount: 1, averageRating: 7 }),
      } as unknown as Awaited<ReturnType<typeof getAggregateFromServer>>)
      .mockResolvedValueOnce({
        data: () => ({ recommendedCount: 1 }),
      } as unknown as Awaited<ReturnType<typeof getAggregateFromServer>>);

    await expect(ReviewService.getReviewStatistics()).resolves.toMatchObject({
      averageRating: 5,
    });
  });

  test('keeps the zero statistics fallback when an aggregate query fails', async () => {
    jest.mocked(getAggregateFromServer)
      .mockRejectedValueOnce(new Error('aggregate unavailable'))
      .mockResolvedValueOnce({
        data: () => ({ recommendedCount: 0 }),
      } as unknown as Awaited<ReturnType<typeof getAggregateFromServer>>);

    await expect(ReviewService.getReviewStatistics()).resolves.toEqual({
      totalCount: 0,
      averageRating: 0,
      recommendationRate: 0,
    });

    expect(getDocs).not.toHaveBeenCalled();
  });

  test('builds a product review summary from server aggregates without reading review documents', async () => {
    jest.mocked(getAggregateFromServer).mockResolvedValueOnce({
      data: () => ({ totalReviews: 4, averageRating: 4.25 }),
    } as unknown as Awaited<ReturnType<typeof getAggregateFromServer>>);
    jest.mocked(getCountFromServer)
      .mockResolvedValueOnce({ data: () => ({ count: 3 }) } as never)
      .mockResolvedValueOnce({ data: () => ({ count: 2 }) } as never)
      .mockResolvedValueOnce({ data: () => ({ count: 1 }) } as never)
      .mockResolvedValueOnce({ data: () => ({ count: 1 }) } as never)
      .mockResolvedValueOnce({ data: () => ({ count: 0 }) } as never)
      .mockResolvedValueOnce({ data: () => ({ count: 0 }) } as never);

    await expect(ReviewService.getReviewSummary('product-1')).resolves.toEqual({
      averageRating: 4.3,
      totalReviews: 4,
      ratingDistribution: { 5: 2, 4: 1, 3: 1, 2: 0, 1: 0 },
      recommendationRate: 75,
    });

    expect(getAggregateFromServer).toHaveBeenCalledTimes(1);
    expect(getCountFromServer).toHaveBeenCalledTimes(6);
    expect(where).toHaveBeenCalledWith('productId', '==', 'product-1');
    expect(where).toHaveBeenCalledWith('isRecommended', '==', true);
    for (const rating of [5, 4, 3, 2, 1]) {
      expect(where).toHaveBeenCalledWith('rating', '==', rating);
    }
    expect(getDocs).not.toHaveBeenCalled();
  });

  test('reads a valid materialized product summary without aggregate requests', async () => {
    jest.mocked(getDoc).mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        reviewSummary: {
          schemaVersion: 1,
          totalReviews: 4,
          averageRating: 4.3,
          recommendedCount: 3,
          recommendationRate: 75,
          ratingDistribution: { 5: 2, 4: 1, 3: 1, 2: 0, 1: 0 },
        },
      }),
    } as unknown as Awaited<ReturnType<typeof getDoc>>);

    await expect(ReviewService.getReviewSummary('product-1')).resolves.toEqual({
      averageRating: 4.3,
      totalReviews: 4,
      ratingDistribution: { 5: 2, 4: 1, 3: 1, 2: 0, 1: 0 },
      recommendationRate: 75,
    });

    expect(getAggregateFromServer).not.toHaveBeenCalled();
    expect(getCountFromServer).not.toHaveBeenCalled();
  });

  test('falls back when a legacy materialized summary is missing or internally inconsistent', async () => {
    jest.mocked(getDoc).mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        reviewSummary: {
          schemaVersion: 1,
          totalReviews: 4,
          averageRating: 4.3,
          recommendedCount: 3,
          recommendationRate: 75,
          ratingDistribution: { 5: 4, 4: 4, 3: 0, 2: 0, 1: 0 },
        },
      }),
    } as unknown as Awaited<ReturnType<typeof getDoc>>);
    jest.mocked(getAggregateFromServer).mockResolvedValueOnce({
      data: () => ({ totalReviews: 0, averageRating: null }),
    } as unknown as Awaited<ReturnType<typeof getAggregateFromServer>>);

    await expect(ReviewService.getReviewSummary('product-1')).resolves.toMatchObject({
      totalReviews: 0,
    });

    expect(getAggregateFromServer).toHaveBeenCalledTimes(1);
  });

  test('falls back to aggregates when the product summary read is unavailable', async () => {
    jest.mocked(getDoc).mockRejectedValueOnce(new Error('product read unavailable'));
    jest.mocked(getAggregateFromServer).mockResolvedValueOnce({
      data: () => ({ totalReviews: 0, averageRating: null }),
    } as unknown as Awaited<ReturnType<typeof getAggregateFromServer>>);

    await expect(ReviewService.getReviewSummary('product-1')).resolves.toMatchObject({
      totalReviews: 0,
    });

    expect(getAggregateFromServer).toHaveBeenCalledTimes(1);
  });

  test('returns an empty product summary after one aggregate when there are no reviews', async () => {
    jest.mocked(getAggregateFromServer).mockResolvedValueOnce({
      data: () => ({ totalReviews: 0, averageRating: null }),
    } as unknown as Awaited<ReturnType<typeof getAggregateFromServer>>);

    await expect(ReviewService.getReviewSummary('product-1')).resolves.toEqual({
      averageRating: 0,
      totalReviews: 0,
      ratingDistribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
      recommendationRate: 0,
    });

    expect(getCountFromServer).not.toHaveBeenCalled();
    expect(getDocs).not.toHaveBeenCalled();
  });

  test('loads latest reviews with indexed ordering and page-size limit', async () => {
    jest.mocked(getCountFromServer).mockResolvedValue({
      data: () => ({ count: 2 }),
    } as unknown as Awaited<ReturnType<typeof getCountFromServer>>);
    jest.mocked(getDocs).mockResolvedValue({
      docs: [
        makeReviewDoc('review-2', '2026-01-02T00:00:00.000Z'),
        makeReviewDoc('review-1', '2026-01-01T00:00:00.000Z'),
      ],
    } as unknown as Awaited<ReturnType<typeof getDocs>>);

    const result = await ReviewService.getAllReviews(1, 10, undefined, 'latest');

    expect(result.reviews.map((review) => review.id)).toEqual(['review-2', 'review-1']);
    expect(orderBy).toHaveBeenCalledWith('createdAt', 'desc');
    expect(limit).toHaveBeenCalledWith(10);
  });

  test('loads product reviews newest first before applying the page-size limit', async () => {
    jest.mocked(getDocs).mockResolvedValue({
      docs: [
        makeReviewDoc('review-2', '2026-01-02T00:00:00.000Z'),
        makeReviewDoc('review-1', '2026-01-01T00:00:00.000Z'),
      ],
    } as unknown as Awaited<ReturnType<typeof getDocs>>);

    const result = await ReviewService.getProductReviews('product-1', 10);

    expect(result.reviews.map((review) => review.id)).toEqual(['review-2', 'review-1']);
    expect(where).toHaveBeenCalledWith('productId', '==', 'product-1');
    expect(orderBy).toHaveBeenCalledWith('createdAt', 'desc');
    expect(limit).toHaveBeenCalledWith(10);
  });

  test('creates a review through the verified-purchase API without client identity fields', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          id: 'review-1',
          orderId: 'order-1',
          productId: 'product-1',
          userId: 'user-1',
          userName: '사용자',
          rating: 5,
          title: '좋아요',
          content: '내용',
          images: [],
          size: 'M',
          color: 'black',
          isRecommended: true,
          verifiedPurchase: true,
          createdAt: '2026-07-10T00:00:00.000Z',
          updatedAt: '2026-07-10T00:00:00.000Z',
        },
      }),
    } as Response);
    Object.defineProperty(global, 'fetch', { value: fetchMock, configurable: true });

    const review = await ReviewService.createReview('product-1', {
      orderId: 'order-1',
      size: 'M',
      color: 'black',
      rating: 5,
      title: '좋아요',
      content: '내용',
      images: [],
      isRecommended: true,
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/review', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ Authorization: 'Bearer review-token' }),
    }));
    const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(requestBody).toEqual(expect.objectContaining({ orderId: 'order-1', productId: 'product-1' }));
    expect(requestBody).not.toHaveProperty('userId');
    expect(requestBody).not.toHaveProperty('userName');
    expect(review.verifiedPurchase).toBe(true);
    expect(review.createdAt).toEqual(new Date('2026-07-10T00:00:00.000Z'));
  });

  test('gets only still-eligible completed-order options from the review API', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          options: [{
            orderId: 'order-1',
            orderNumber: 'ORD-1',
            productId: 'product-1',
            size: 'M',
            color: 'black',
          }],
        },
      }),
    } as Response);
    Object.defineProperty(global, 'fetch', { value: fetchMock, configurable: true });

    await expect(ReviewService.getEligibleReviewOptions('product-1')).resolves.toEqual([
      expect.objectContaining({ orderId: 'order-1', size: 'M', color: 'black' }),
    ]);
    expect(fetchMock).toHaveBeenCalledWith('/api/review', expect.objectContaining({
      body: JSON.stringify({ action: 'eligibleOptions', productId: 'product-1' }),
    }));
  });
});
