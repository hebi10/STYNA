import {
  getCountFromServer,
  getDocs,
  limit,
  orderBy,
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { ReviewService } from './reviewService';

jest.mock('firebase/firestore', () => ({
  addDoc: jest.fn(),
  collection: jest.fn((db, name) => ({ kind: 'collection', name })),
  deleteDoc: jest.fn(),
  doc: jest.fn(),
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
    jest.mocked(getAuth).mockReturnValue({
      currentUser: {
        getIdToken: jest.fn().mockResolvedValue('review-token'),
      },
    } as never);
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
