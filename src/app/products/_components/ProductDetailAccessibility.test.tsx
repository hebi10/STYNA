import { fireEvent, render, screen } from '@testing-library/react';
import ProductDetailClient from './ProductDetailClient';
import type { Product } from '@/shared/types/product';
import { useRecentProductTracking, useWishlistActivity } from '@/shared/hooks/useUserActivityQueries';

const push = jest.fn();
const addRecentProduct = jest.fn();
const addToWishlist = jest.fn();
const removeFromWishlist = jest.fn();
const mutateAsync = jest.fn();
let mockUser: { uid: string } | null = { uid: 'user-1' };

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

jest.mock('@/context/authProvider', () => ({
  useAuth: () => ({ user: mockUser }),
}));

jest.mock('@/context/reviewProvider', () => ({
  useReview: () => ({
    reviewSummaryByProductId: {
      'product-1': {
        status: 'ready',
        summary: {
          averageRating: 4.5,
          totalReviews: 2,
          ratingDistribution: { 5: 2, 4: 0, 3: 0, 2: 0, 1: 0 },
          recommendationRate: 100,
        },
      },
    },
    loadReviewSummary: jest.fn(),
  }),
}));

jest.mock('@/shared/hooks/useUserActivityQueries', () => ({
  useWishlistActivity: jest.fn(),
  useRecentProductTracking: jest.fn(),
}));

jest.mock('@/shared/hooks/useProducts', () => ({
  useRelatedProducts: () => ({ data: [] }),
}));

jest.mock('@/shared/hooks/useCart', () => ({
  useAddToCart: () => ({ mutateAsync }),
}));

jest.mock('@/shared/services/qnaService', () => ({
  QnAService: {
    getQnAList: jest.fn().mockResolvedValue({
      qnas: [],
      pagination: { page: 1, limit: 5, totalCount: 0, totalPages: 0 },
    }),
  },
}));

jest.mock('@/app/_components/Button', () => function MockButton({
  children,
  disabled,
  onClick,
  className,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  return <button disabled={disabled} onClick={onClick} className={className}>{children}</button>;
});

jest.mock('./ProductCard', () => function MockProductCard() {
  return <div data-testid="product-card" />;
});

jest.mock('./ProductReviews', () => function MockProductReviews() {
  return <div data-testid="product-reviews" />;
});

jest.mock('./ProductDetail.module.css', () => new Proxy({}, {
  get: (_, property) => String(property),
}));

const product: Product = {
  id: 'product-1',
  name: '테스트 상품',
  description: '설명',
  price: 10000,
  brand: 'STYNA',
  category: 'test',
  images: ['/product.jpg'],
  sizes: ['S', 'M'],
  colors: ['black', 'white'],
  stock: 2,
  rating: 4.5,
  reviewCount: 2,
  isNew: false,
  isSale: false,
  tags: [],
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  details: { material: '', origin: '', manufacturer: '', precautions: '', sizes: {} },
  mainImage: '/product.jpg',
};

describe('ProductDetailClient accessibility', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUser = { uid: 'user-1' };
    jest.mocked(useWishlistActivity).mockReturnValue({
      wishlistItems: [],
      addToWishlist,
      removeFromWishlist,
    } as unknown as ReturnType<typeof useWishlistActivity>);
    jest.mocked(useRecentProductTracking).mockReturnValue({ addRecentProduct } as ReturnType<typeof useRecentProductTracking>);
    jest.spyOn(window, 'alert').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('exposes tabs with WAI-ARIA state and supports Arrow/Home/End navigation', () => {
    render(<ProductDetailClient product={product} />);

    const tablist = screen.getByRole('tablist', { name: '상품 상세 정보' });
    expect(tablist).toBeInTheDocument();

    const detailTab = screen.getByRole('tab', { name: '상품상세' });
    const sizeTab = screen.getByRole('tab', { name: '사이즈 가이드' });
    const qnaTab = screen.getByRole('tab', { name: 'Q&A' });

    expect(detailTab).toHaveAttribute('aria-selected', 'true');
    expect(detailTab).toHaveAttribute('tabindex', '0');
    expect(sizeTab).toHaveAttribute('tabindex', '-1');

    detailTab.focus();
    fireEvent.keyDown(detailTab, { key: 'ArrowRight' });
    expect(sizeTab).toHaveFocus();
    expect(sizeTab).toHaveAttribute('aria-selected', 'true');

    fireEvent.keyDown(sizeTab, { key: 'End' });
    expect(qnaTab).toHaveFocus();
    expect(qnaTab).toHaveAttribute('aria-selected', 'true');

    fireEvent.keyDown(qnaTab, { key: 'Home' });
    expect(detailTab).toHaveFocus();
    expect(detailTab).toHaveAttribute('aria-selected', 'true');
  });

  test('announces option selection and quantity boundaries without blocking alerts', () => {
    render(<ProductDetailClient product={product} />);

    const size = screen.getByRole('button', { name: 'S' });
    const color = screen.getByRole('button', { name: '블랙 색상 선택' });
    expect(size).toHaveAttribute('aria-pressed', 'false');
    expect(color).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(size);
    fireEvent.click(color);
    expect(size).toHaveAttribute('aria-pressed', 'true');
    expect(color).toHaveAttribute('aria-pressed', 'true');

    const decrease = screen.getByRole('button', { name: '수량 1개 감소' });
    const increase = screen.getByRole('button', { name: '수량 1개 증가' });
    expect(decrease).toBeDisabled();
    expect(increase).not.toBeDisabled();

    fireEvent.click(increase);
    expect(screen.getByRole('button', { name: '수량 2개 증가' })).toBeDisabled();
  });

  test('shows missing option errors inline instead of window.alert', () => {
    render(<ProductDetailClient product={product} />);

    fireEvent.click(screen.getByRole('button', { name: '장바구니' }));

    expect(screen.getByRole('alert')).toHaveTextContent('사이즈를 선택해주세요.');
    expect(window.alert).not.toHaveBeenCalled();
  });
});
