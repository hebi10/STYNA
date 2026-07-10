import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ProductReviews from './ProductReviews';
import { ReviewService } from '@/shared/services/reviewService';

const createReview = jest.fn();

jest.mock('@/context/reviewProvider', () => ({
  useReview: () => ({
    productReviews: [],
    reviewSummary: null,
    hasMoreReviews: false,
    loading: false,
    error: null,
    loadProductReviews: jest.fn(),
    loadMoreProductReviews: jest.fn(),
    loadReviewSummary: jest.fn(),
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
    jest.spyOn(window, 'alert').mockImplementation(() => undefined);
    jest.mocked(ReviewService.getEligibleReviewOptions).mockResolvedValue([{
      orderId: 'order-1',
      orderNumber: 'ORD-1',
      productId: 'product-1',
      size: 'M',
      color: 'black',
    }]);
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
