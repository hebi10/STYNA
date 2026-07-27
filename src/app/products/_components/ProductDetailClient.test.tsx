import { StrictMode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ProductDetailClient from './ProductDetailClient';
import { Product } from '@/shared/types/product';
import {
  useRecentProductTracking,
  useWishlistActivity,
} from '@/shared/hooks/useUserActivityQueries';
import { QnAService } from '@/shared/services/qnaService';
import {
  PRODUCT_INTENT_STORAGE_KEY,
  saveProductIntent,
} from '@/shared/utils/productIntent';

const push = jest.fn();
const addRecentProduct = jest.fn();
const addToWishlist = jest.fn();
const removeFromWishlist = jest.fn();
const mutateAsync = jest.fn();

let mockUser: { uid: string } | null = { uid: 'user-1' };

let mockWishlistItems: Array<{ id: string; productId: string; userId: string; addedAt: Date }> = [];

function mockActivityHooks() {
  jest.mocked(useWishlistActivity).mockReturnValue({
    wishlistItems: mockWishlistItems,
    addToWishlist,
    removeFromWishlist,
  } as unknown as ReturnType<typeof useWishlistActivity>);
  jest.mocked(useRecentProductTracking).mockReturnValue({
    addRecentProduct,
  } as ReturnType<typeof useRecentProductTracking>);
}

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

jest.mock('@/context/authProvider', () => ({
  useAuth: () => ({ user: mockUser }),
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
    getQnAList: jest.fn(),
  },
}));

jest.mock('@/app/_components/Button', () => function MockButton({
  children,
  className,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button className={className} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  );
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
  name: '블루 사파이어 칵테일 반지',
  description: '테스트 상품 설명',
  price: 985000,
  originalPrice: 1250000,
  brand: 'SAPPHIRE ROYAL',
  category: 'jewelry',
  images: ['/ring.jpg'],
  sizes: ['13호'],
  colors: ['white gold'],
  stock: 12,
  rating: 4.5,
  reviewCount: 13,
  isNew: true,
  isSale: true,
  saleRate: 21,
  tags: ['신상'],
  createdAt: new Date('2026-05-01T00:00:00.000Z'),
  updatedAt: new Date('2026-05-01T00:00:00.000Z'),
  details: {
    material: '18K 골드',
    origin: 'Korea',
    manufacturer: 'SAPPHIRE ROYAL',
    precautions: '보관 주의',
    sizes: {},
  },
  mainImage: '/ring.jpg',
};

describe('ProductDetailClient wishlist button', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(window, 'alert').mockImplementation(() => undefined);
    mockWishlistItems = [{
      id: 'wishlist-1',
      productId: 'product-1',
      userId: 'user-1',
      addedAt: new Date('2026-05-01T00:00:00.000Z'),
    }];
    jest.mocked(useWishlistActivity).mockReturnValue({
      wishlistItems: mockWishlistItems,
      addToWishlist,
      removeFromWishlist,
    } as unknown as ReturnType<typeof useWishlistActivity>);
    jest.mocked(useRecentProductTracking).mockReturnValue({
      addRecentProduct,
    } as ReturnType<typeof useRecentProductTracking>);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('reflects wishlist removal immediately without a blocking alert', async () => {
    let resolveRemove!: () => void;
    removeFromWishlist.mockReturnValue(new Promise<void>((resolve) => {
      resolveRemove = resolve;
    }));

    render(<ProductDetailClient product={product} />);

    const wishlistButton = screen.getByRole('button', { name: '찜 해제' });
    fireEvent.click(wishlistButton);

    expect(screen.getByRole('button', { name: '찜하기' })).toBeInTheDocument();
    expect(window.alert).not.toHaveBeenCalledWith('찜 목록에서 제거되었습니다.');

    resolveRemove();

    await waitFor(() => {
      expect(removeFromWishlist).toHaveBeenCalledWith('product-1');
    });
    expect(window.alert).not.toHaveBeenCalledWith('찜 목록에서 제거되었습니다.');
  });
});

describe('ProductDetailClient detail images', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWishlistItems = [];
    mockActivityHooks();
  });

  test('renders product detail images in the detail tab', () => {
    const productWithDetailImages = {
      ...product,
      detailImages: ['/detail-ring.webp'],
    } as Product & { detailImages: string[] };

    render(<ProductDetailClient product={productWithDetailImages} />);

    const detailImage = screen.getByRole('img', { name: '블루 사파이어 칵테일 반지 상세 이미지 1' });
    expect(decodeURIComponent(detailImage.getAttribute('src') || '')).toContain('/detail-ring.webp');
  });

  test('names color swatches for assistive technology', () => {
    render(<ProductDetailClient product={product} />);

    expect(screen.getByRole('button', { name: 'white gold 색상 선택' })).toBeInTheDocument();
  });

  test('uses denormalized product review stats without fetching review documents', () => {
    render(<ProductDetailClient product={product} />);

    expect(screen.getByText('4.5 (13개 리뷰)')).toBeInTheDocument();
  });
});

describe('ProductDetailClient product Q&A', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWishlistItems = [];
    mockActivityHooks();
    jest.mocked(QnAService.getQnAList).mockResolvedValue({
      qnas: [{
        id: 'qna-1',
        title: '사이즈 문의',
        content: '13호 착용감이 궁금합니다.',
        category: 'product',
        isSecret: false,
        status: 'answered',
        userName: '작**',
        views: 0,
        createdAt: new Date('2026-05-01T00:00:00.000Z'),
        updatedAt: new Date('2026-05-01T00:00:00.000Z'),
        answer: {
          content: '상세 사이즈 표를 참고해 주세요.',
          answeredBy: '관리자',
          answeredAt: new Date('2026-05-02T00:00:00.000Z'),
          isAdmin: true,
        },
      }],
      pagination: { page: 1, limit: 5, totalCount: 1, totalPages: 1 },
    });
  });

  test('shows public Q&A for the product and opens a prefilled inquiry form', async () => {
    render(<ProductDetailClient product={product} />);

    fireEvent.click(screen.getByRole('button', { name: 'Q&A' }));

    expect(await screen.findByText('사이즈 문의')).toBeInTheDocument();
    expect(screen.getByText('상세 사이즈 표를 참고해 주세요.')).toBeInTheDocument();
    expect(QnAService.getQnAList).toHaveBeenCalledWith({ productId: 'product-1' }, 1, 5);

    fireEvent.click(screen.getByRole('button', { name: '문의하기' }));
    expect(push).toHaveBeenCalledWith(
      `/qna/write?productId=${product.id}&productName=${encodeURIComponent(product.name)}`
    );
  });
});

describe('ProductDetailClient policy summary', () => {
  beforeEach(() => {
    mockWishlistItems = [];
    mockActivityHooks();
  });

  test('does not promise unconditional free shipping or returns', () => {
    render(<ProductDetailClient product={product} />);

    expect(screen.getByText('배송비는 주문서에서 조건에 따라 계산됩니다.')).toBeInTheDocument();
    expect(screen.getByText('자동 반품 처리는 제공하지 않으며 가능 여부와 시점은 보장하지 않습니다.')).toBeInTheDocument();
    expect(screen.queryByText('무료배송')).not.toBeInTheDocument();
    expect(screen.queryByText('무료반품 (7일)')).not.toBeInTheDocument();
  });
});

describe('ProductDetailClient login intent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
    window.history.pushState({}, '', '/products/product-1');
    window.confirm = jest.fn(() => false);
    window.alert = jest.fn();
    mockUser = { uid: 'user-1' };
    mutateAsync.mockResolvedValue(undefined);
    mockWishlistItems = [];
    mockActivityHooks();
    addToWishlist.mockResolvedValue(undefined);
  });

  afterEach(() => {
    mockUser = { uid: 'user-1' };
  });

  test.each([
    ['cart', '장바구니'],
    ['buy', '바로구매'],
    ['wishlist', '찜하기'],
  ] as const)('stores the %s action before sending an anonymous user to login', (action, buttonName) => {
    mockUser = null;
    render(<ProductDetailClient product={product} />);

    fireEvent.click(screen.getByRole('button', { name: '13호' }));
    fireEvent.click(screen.getByRole('button', { name: 'white gold 색상 선택' }));
    fireEvent.click(screen.getByRole('button', { name: buttonName }));

    expect(JSON.parse(sessionStorage.getItem(PRODUCT_INTENT_STORAGE_KEY) || '{}')).toMatchObject({
      action,
      productId: 'product-1',
      pathname: '/products/product-1',
      size: '13호',
      color: 'white gold',
      quantity: 1,
    });
    expect(push).toHaveBeenCalledWith(
      `/auth/login?redirect=${encodeURIComponent('/products/product-1?resumeIntent=1')}`,
    );
  });

  test('restores a cart action once, including under StrictMode', async () => {
    window.history.pushState({}, '', '/products/product-1?resumeIntent=1');
    saveProductIntent(sessionStorage, {
      action: 'cart',
      productId: 'product-1',
      pathname: '/products/product-1',
      size: '13호',
      color: 'white gold',
      quantity: 2,
    }, Date.now());

    render(
      <StrictMode>
        <ProductDetailClient product={product} />
      </StrictMode>,
    );

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    expect(mutateAsync).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-1',
      request: expect.objectContaining({
        productId: 'product-1',
        size: '13호',
        color: 'white gold',
        quantity: 2,
      }),
    }));
    expect(sessionStorage.getItem(PRODUCT_INTENT_STORAGE_KEY)).toBeNull();
    expect(window.location.search).not.toContain('resumeIntent');
  });

  test('restores a buy action with the original options and quantity', async () => {
    window.history.pushState({}, '', '/products/product-1?resumeIntent=1');
    saveProductIntent(sessionStorage, {
      action: 'buy',
      productId: 'product-1',
      pathname: '/products/product-1',
      size: '13호',
      color: 'white gold',
      quantity: 3,
    }, Date.now());

    render(<ProductDetailClient product={product} />);

    await waitFor(() => expect(push).toHaveBeenCalledWith('/orders/checkout'));
    expect(JSON.parse(sessionStorage.getItem('orderData') || '{}')).toMatchObject({
      items: [expect.objectContaining({
        productId: 'product-1',
        size: '13호',
        color: 'white gold',
        quantity: 3,
      })],
      deliveryFee: 0,
    });
  });

  test('uses the shared shipping policy when preparing a low-value buy-now draft', async () => {
    window.history.pushState({}, '', '/products/product-1?resumeIntent=1');
    saveProductIntent(sessionStorage, {
      action: 'buy',
      productId: 'product-1',
      pathname: '/products/product-1',
      size: '13호',
      color: 'white gold',
      quantity: 3,
    }, Date.now());

    render(<ProductDetailClient product={{
      ...product,
      price: 10000,
      originalPrice: 10000,
      isSale: false,
      saleRate: 0,
    }} />);

    await waitFor(() => expect(push).toHaveBeenCalledWith('/orders/checkout'));
    expect(JSON.parse(sessionStorage.getItem('orderData') || '{}')).toMatchObject({
      subtotal: 30000,
      deliveryFee: 3000,
      finalAmount: 33000,
    });
  });

  test('restores a wishlist action as an add exactly once', async () => {
    window.history.pushState({}, '', '/products/product-1?resumeIntent=1');
    saveProductIntent(sessionStorage, {
      action: 'wishlist',
      productId: 'product-1',
      pathname: '/products/product-1',
      size: '',
      color: '',
      quantity: 1,
    }, Date.now());

    render(<ProductDetailClient product={product} />);

    await waitFor(() => expect(addToWishlist).toHaveBeenCalledTimes(1));
    expect(addToWishlist).toHaveBeenCalledWith('product-1');
    expect(removeFromWishlist).not.toHaveBeenCalled();
  });

  test('consumes an invalid option without executing the stored action', async () => {
    window.history.pushState({}, '', '/products/product-1?resumeIntent=1');
    saveProductIntent(sessionStorage, {
      action: 'cart',
      productId: 'product-1',
      pathname: '/products/product-1',
      size: '99호',
      color: 'white gold',
      quantity: 1,
    }, Date.now());

    render(<ProductDetailClient product={product} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('옵션을 다시 선택해 주세요.');
    expect(mutateAsync).not.toHaveBeenCalled();
    expect(sessionStorage.getItem(PRODUCT_INTENT_STORAGE_KEY)).toBeNull();
  });
});
