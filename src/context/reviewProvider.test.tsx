import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { ReviewProvider, useReview } from './reviewProvider';
import { ReviewService } from '@/shared/services/reviewService';
import type { Review } from '@/shared/types/review';

jest.mock('@/shared/services/reviewService', () => ({
  ReviewService: {
    getProductReviews: jest.fn(),
    getReviewSummary: jest.fn(),
  },
}));

function wrapper({ children }: { children: ReactNode }) {
  return <ReviewProvider>{children}</ReviewProvider>;
}

function review(id: string, productId: string): Review {
  return {
    id,
    productId,
    userId: 'user-1',
    userName: '테스터',
    rating: 5,
    title: '좋아요',
    content: '좋아요',
    images: [],
    size: 'M',
    color: 'black',
    isRecommended: true,
    createdAt: new Date('2026-08-12T00:00:00.000Z'),
    updatedAt: new Date('2026-08-12T00:00:00.000Z'),
  };
}

describe('ReviewProvider product state isolation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('clears the previous product reviews before the next product request resolves', async () => {
    let resolveSecondRequest: ((value: { reviews: Review[]; hasMore: boolean }) => void) | undefined;
    jest.mocked(ReviewService.getProductReviews)
      .mockResolvedValueOnce({ reviews: [review('review-1', 'product-1')], hasMore: true })
      .mockReturnValueOnce(new Promise((resolve) => {
        resolveSecondRequest = resolve;
      }));
    const { result } = renderHook(() => useReview(), { wrapper });

    await act(async () => {
      await result.current.loadProductReviews('product-1');
    });
    expect(result.current.productReviews.map((item) => item.productId)).toEqual(['product-1']);
    expect(result.current.hasMoreReviews).toBe(true);

    let secondRequest: Promise<void>;
    act(() => {
      secondRequest = result.current.loadProductReviews('product-2');
    });

    expect(result.current.productReviews).toEqual([]);
    expect(result.current.hasMoreReviews).toBe(false);
    expect(result.current.lastDoc).toBeUndefined();

    await act(async () => {
      resolveSecondRequest?.({ reviews: [review('review-2', 'product-2')], hasMore: false });
      await secondRequest!;
    });
    expect(result.current.productReviews.map((item) => item.productId)).toEqual(['product-2']);
  });

  test('keeps the latest summary state when an earlier request resolves last', async () => {
    let resolveFirstRequest: ((value: {
      averageRating: number;
      totalReviews: number;
      ratingDistribution: { 5: number; 4: number; 3: number; 2: number; 1: number };
      recommendationRate: number;
    }) => void) | undefined;
    jest.mocked(ReviewService.getReviewSummary)
      .mockReturnValueOnce(new Promise((resolve) => {
        resolveFirstRequest = resolve;
      }))
      .mockResolvedValueOnce({
        averageRating: 4.8,
        totalReviews: 8,
        ratingDistribution: { 5: 8, 4: 0, 3: 0, 2: 0, 1: 0 },
        recommendationRate: 100,
      });
    const { result } = renderHook(() => useReview(), { wrapper });

    let firstRequest: Promise<void>;
    act(() => {
      firstRequest = result.current.loadReviewSummary('product-1');
    });
    await act(async () => {
      await result.current.loadReviewSummary('product-1');
    });

    await act(async () => {
      resolveFirstRequest?.({
        averageRating: 1,
        totalReviews: 1,
        ratingDistribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 1 },
        recommendationRate: 0,
      });
      await firstRequest!;
    });

    expect(result.current.reviewSummaryByProductId['product-1']).toEqual({
      status: 'ready',
      summary: expect.objectContaining({ averageRating: 4.8, totalReviews: 8 }),
    });
  });
});
