import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import type { Product } from '@/shared/types/product';
import { ProductService } from '@/shared/services/productService';
import StyleNowSeasonPage from './StyleNowSeasonPage';

jest.mock('@/shared/services/productService', () => ({
  ProductService: {
    getPublicProductsByIds: jest.fn(),
  },
}));

jest.mock('@/context/authProvider', () => ({
  useAuth: () => ({ user: null }),
}));

jest.mock('@/shared/hooks/useUserActivityQueries', () => ({
  useWishlistActivity: () => ({
    wishlistItems: [],
    addToWishlist: jest.fn(),
    removeFromWishlist: jest.fn(),
  }),
}));

jest.mock('./StyleNowSection.module.css', () => ({
  __esModule: true,
  default: new Proxy({}, {
    get: (_target, prop) => String(prop),
  }),
}));

jest.mock('./StyleNowSeasonPage.module.css', () => ({
  __esModule: true,
  default: new Proxy({}, {
    get: (_target, prop) => String(prop),
  }),
}));

jest.mock('@/app/products/_components/ProductCard.module.css', () => ({
  __esModule: true,
  default: new Proxy({}, {
    get: (_target, prop) => String(prop),
  }),
}));

function makeProducts(season: 'spring' | 'summer' | 'autumn' | 'winter'): Product[] {
  return Array.from({ length: 20 }, (_, index) => {
    const number = String(index + 1).padStart(2, '0');
    return {
      id: `style-now-${season}-${number}`,
      name: `${season} 상품 ${number}`,
      description: `${season} 상품 설명`,
      price: 10000 + index * 1000,
      brand: 'STYNA',
      category: 'clothing',
      categoryId: 'clothing',
      images: [`https://example.com/${season}-${number}.webp`],
      mainImage: `https://example.com/${season}-${number}.webp`,
      sizes: ['M'],
      colors: ['아이보리'],
      stock: 10,
      rating: 0,
      reviewCount: 0,
      isNew: true,
      isSale: false,
      saleRate: 0,
      tags: ['style-now', `style-now-${season}`],
      createdAt: new Date('2026-07-27T00:00:00.000Z'),
      updatedAt: new Date('2026-07-27T00:00:00.000Z'),
      status: 'active',
      sku: `STN-${season}-${number}`,
      details: {
        material: '코튼',
        origin: '대한민국',
        manufacturer: 'STYNA',
        precautions: '케어 라벨 확인',
        sizes: { M: { chest: 100, length: 68 } },
      },
    };
  });
}

function renderSeasonPage(season: 'spring' | 'summer' | 'autumn' | 'winter' = 'spring') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: Infinity,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <StyleNowSeasonPage season={season} />
    </QueryClientProvider>,
  );
}

describe('StyleNowSeasonPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(ProductService.getPublicProductsByIds).mockResolvedValue(
      makeProducts('spring'),
    );
  });

  test('renders a three-part spring editorial with Korean overlay copy', () => {
    renderSeasonPage();

    const editorial = screen.getByRole('region', {
      name: '봄 스타일 에디토리얼',
    });
    const editorialImages = within(editorial).getAllByRole('img');
    expect(editorialImages).toHaveLength(3);

    const modelImage = within(editorial).getByRole('img', {
      name: '봄 모델 스타일 화보',
    });
    const productImage = within(editorial).getByRole('img', {
      name: '봄 트렌치 재킷 상품 강조',
    });
    const detailImage = within(editorial).getByRole('img', {
      name: '봄 스웨이드 미니백 상품 디테일',
    });

    expect(modelImage.getAttribute('src')).toContain(
      'style-now-spring-main.webp',
    );
    expect(modelImage).not.toHaveAttribute('loading', 'lazy');
    expect(productImage.getAttribute('src')).toContain(
      'style-now-spring-feature-trench-v2.webp',
    );
    expect(detailImage.getAttribute('src')).toContain(
      'style-now-spring-feature-bag-v2.webp',
    );

    expect(
      within(editorial).getByRole('heading', {
        name: '봄날의 가벼운 시작',
      }),
    ).toBeInTheDocument();
    expect(
      within(editorial).getByRole('heading', {
        name: '가볍게 걸치는 트렌치',
      }),
    ).toBeInTheDocument();
    expect(
      within(editorial).getByRole('heading', {
        name: '부드러운 색, 선명한 질감',
      }),
    ).toBeInTheDocument();
  });

  test('loads the selected season data and renders twenty existing product cards', async () => {
    renderSeasonPage();

    const expectedProductIds = Array.from(
      { length: 20 },
      (_, index) => `style-now-spring-${String(index + 1).padStart(2, '0')}`,
    );

    expect(ProductService.getPublicProductsByIds).toHaveBeenCalledWith(
      expectedProductIds,
    );
    expect(await screen.findByText('spring 상품 01')).toBeInTheDocument();
    expect(screen.getByText('spring 상품 20')).toBeInTheDocument();
    expect(screen.getByText('20개 상품')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /spring 상품 01/ }),
    ).toHaveAttribute('href', '/products/style-now-spring-01');
  });
});
