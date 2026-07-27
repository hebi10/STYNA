import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ProductService } from '@/shared/services/productService';
import type { Product } from '@/shared/types/product';
import StyleNowSection from './StyleNowSection';

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

function renderSection() {
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
      <StyleNowSection />
    </QueryClientProvider>,
  );
}

describe('StyleNowSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(ProductService.getPublicProductsByIds).mockImplementation(
      async (productIds) => {
        const season = productIds[0]?.split('-')[2] as
          | 'spring'
          | 'summer'
          | 'autumn'
          | 'winter';
        return makeProducts(season);
      },
    );
  });

  test('renders the spring panel with twenty existing product cards', async () => {
    renderSection();

    expect(
      screen.getByRole('heading', { name: '스타일나우' }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('tab')).toHaveLength(4);
    expect(screen.getByRole('tab', { name: '봄' })).toHaveAttribute(
      'aria-selected',
      'true',
    );

    expect(await screen.findByText('spring 상품 01')).toBeInTheDocument();
    expect(screen.getByText('spring 상품 20')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /spring 상품 01/ }),
    ).toHaveAttribute('href', '/products/style-now-spring-01');
    expect(screen.getByText('20개 상품')).toBeInTheDocument();
  });

  test('changes seasons with tabs and keyboard arrow navigation', async () => {
    renderSection();
    await screen.findByText('spring 상품 01');

    const springTab = screen.getByRole('tab', { name: '봄' });
    springTab.focus();
    fireEvent.keyDown(springTab, { key: 'ArrowRight' });

    const summerTab = screen.getByRole('tab', { name: '여름' });
    expect(summerTab).toHaveFocus();
    expect(summerTab).toHaveAttribute('aria-selected', 'true');
    expect(await screen.findByText('summer 상품 01')).toBeInTheDocument();
  });

  test('shows an actionable error when a season does not contain exactly twenty products', async () => {
    jest.mocked(ProductService.getPublicProductsByIds).mockResolvedValueOnce(
      makeProducts('spring').slice(0, 19),
    );

    renderSection();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '봄 상품은 20개가 필요하지만 19개만 확인되었습니다.',
    );
    expect(
      screen.getByRole('button', { name: '봄 상품 다시 불러오기' }),
    ).toBeInTheDocument();
  });

  test('keeps a Firebase read failure inside the section and retries on request', async () => {
    jest.mocked(ProductService.getPublicProductsByIds)
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(makeProducts('spring'));

    renderSection();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '봄 상품을 불러오지 못했습니다.',
    );
    fireEvent.click(
      screen.getByRole('button', { name: '봄 상품 다시 불러오기' }),
    );

    await waitFor(() => {
      expect(screen.getByText('spring 상품 01')).toBeInTheDocument();
    });
  });
});
