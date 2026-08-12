import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ProductReviews from './ProductReviews';
import { ReviewService } from '@/shared/services/reviewService';

const createReview = jest.fn();
const loadProductReviews = jest.fn();
const loadMoreProductReviews = jest.fn();
const loadReviewSummary = jest.fn();
let reviewContext = {
  productReviews: [],
  reviewSummaryByProductId: {
    'product-1': {
      status: 'ready' as const,
      summary: {
        averageRating: 0,
        totalReviews: 0,
        ratingDistribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
        recommendationRate: 0,
      },
    },
  },
  hasMoreReviews: false,
  loading: false,
  error: null,
};

jest.mock('@/context/reviewProvider', () => ({
  useReview: () => ({
    ...reviewContext,
    loadProductReviews,
    loadMoreProductReviews,
    loadReviewSummary,
    createReview,
    deleteReview: jest.fn(),
  }),
}));

jest.mock('@/context/authProvider', () => ({
  useAuth: () => ({ user: { uid: 'user-1' } }),
}));

jest.mock('@/shared/services/reviewService', () => ({
  ReviewService: {
    getEligibleReviewOptions: jest.fn(),
  },
}));

jest.mock('./ProductReviews.module.css', () => new Proxy({}, {
  get: (_, property) => String(property),
}));

describe('ProductReviews verified purchase flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    reviewContext = {
      productReviews: [],
      reviewSummaryByProductId: {
        'product-1': {
          status: 'ready',
          summary: {
            averageRating: 0,
            totalReviews: 0,
            ratingDistribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
            recommendationRate: 0,
          },
        },
      },
      hasMoreReviews: false,
      loading: false,
      error: null,
    };
    jest.spyOn(window, 'alert').mockImplementation(() => undefined);
    jest.mocked(ReviewService.getEligibleReviewOptions).mockResolvedValue([{
      orderId: 'order-1',
      orderNumber: 'ORD-1',
      productId: 'product-1',
      size: 'M',
      color: 'black',
    }]);
  });

  test('shows a retry prompt when a nonzero summary has no first page reviews', () => {
    reviewContext = {
      ...reviewContext,
      reviewSummaryByProductId: {
        'product-1': {
          status: 'ready',
          summary: {
            averageRating: 4,
            totalReviews: 1,
            ratingDistribution: { 5: 0, 4: 1, 3: 0, 2: 0, 1: 0 },
            recommendationRate: 100,
          },
        },
      },
    };

    render(<ProductReviews productId="product-1" />);

    expect(screen.getByText('리뷰를 불러오지 못했습니다. 다시 시도해 주세요.')).toBeInTheDocument();
    expect(screen.queryByText('아직 리뷰가 없습니다. 첫 리뷰를 작성해보세요!')).not.toBeInTheDocument();
    expect(loadReviewSummary).not.toHaveBeenCalled();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('requires selecting a server-provided completed-order option before review submission', async () => {
    render(<ProductReviews productId="product-1" />);

    fireEvent.click(screen.getByRole('button', { name: '리뷰 작성' }));

    const optionSelect = await screen.findByLabelText('구매 상품 옵션');
    expect(optionSelect).toHaveTextContent('ORD-1 / black / M');
    expect(ReviewService.getEligibleReviewOptions).toHaveBeenCalledWith('product-1');

    fireEvent.change(optionSelect, { target: { value: (optionSelect as HTMLSelectElement).options[1].value } });
    fireEvent.change(screen.getByLabelText('제목'), { target: { value: '좋아요' } });
    fireEvent.change(screen.getByLabelText('내용'), { target: { value: '내용' } });
    fireEvent.click(screen.getByRole('button', { name: '리뷰 등록' }));

    await waitFor(() => {
      expect(createReview).toHaveBeenCalledWith('product-1', expect.objectContaining({
        orderId: 'order-1',
        size: 'M',
        color: 'black',
      }));
    });
  });
});
