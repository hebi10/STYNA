import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { ProductService } from '@/shared/services/productService';
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
    jest.mocked(ProductService.getPublicProductsByIds).mockResolvedValue([]);
  });

  test('shows four season image cards that open their dedicated pages', () => {
    renderSection();

    const seasons = [
      {
        label: '봄',
        href: '/style-now/spring',
        imageFile: 'style-now-spring-category-v2.webp',
      },
      {
        label: '여름',
        href: '/style-now/summer',
        imageFile: 'style-now-summer-category-v2.webp',
      },
      {
        label: '가을',
        href: '/style-now/autumn',
        imageFile: 'style-now-autumn-category-v2.webp',
      },
      {
        label: '겨울',
        href: '/style-now/winter',
        imageFile: 'style-now-winter-category-v2.webp',
      },
    ] as const;

    expect(
      screen.getByRole('heading', { level: 2, name: '스타일나우' }),
    ).toBeInTheDocument();

    for (const season of seasons) {
      const card = screen.getByRole('link', {
        name: new RegExp(`${season.label} 스타일`),
      });
      expect(card).toHaveAttribute('href', season.href);

      const image = within(card).getByRole('img', {
        name: `${season.label} 스타일나우 카테고리`,
      });
      expect(image.getAttribute('src')).toContain(season.imageFile);
    }
  });

  test('does not render season tabs or request products on the home page', () => {
    renderSection();

    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    expect(screen.queryByText('20개 상품')).not.toBeInTheDocument();
    expect(ProductService.getPublicProductsByIds).not.toHaveBeenCalled();
  });
});
