import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fireEvent, render, screen } from '@testing-library/react';
import FeaturedProducts from './FeaturedProducts';
import { useQuery } from '@tanstack/react-query';
import { useHomeProducts } from '@/shared/hooks/useProducts';

jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn(),
}));

jest.mock('@/shared/services/featuredProductService', () => ({
  FeaturedProductService: { getFeaturedSection: jest.fn() },
}));

jest.mock('@/shared/hooks/useProducts', () => ({
  useHomeProducts: jest.fn(),
}));

jest.mock('./FeaturedProducts.module.css', () => ({
  __esModule: true,
  default: new Proxy({}, { get: (_target, key) => String(key) }),
}));

jest.mock('./AsyncStatePanel.module.css', () => ({
  __esModule: true,
  default: new Proxy({}, { get: (_target, key) => String(key) }),
}));

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

jest.mock('@/app/products/_components/ProductCard', () => ({
  __esModule: true,
  default: ({ name }: { name: string }) => <article>{name}</article>,
}));

describe('FeaturedProducts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(useHomeProducts).mockReturnValue({
      isLoading: false,
      isError: false,
      data: { recommendedProducts: [] },
      refetch: jest.fn(),
    } as never);
  });

  test('uses the single featured section contract', () => {
    jest.mocked(useQuery).mockReturnValue({
      isLoading: false,
      data: {
        config: { title: '관리자 추천', subtitle: '한 번만 읽은 설정', isActive: true },
        products: [
          {
            id: 'featured-2',
            name: '두 번째 관리자 추천',
            brand: 'STYNA',
            price: 39000,
            images: [],
            stock: 2,
          },
          {
            id: 'featured-1',
            name: '첫 번째 관리자 추천',
            brand: 'STYNA',
            price: 39000,
            images: [],
            stock: 2,
          },
        ],
      },
    } as never);

    render(<FeaturedProducts />);

    expect(screen.getByRole('heading', { name: '관리자 추천' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '두 번째 관리자 추천 상품 보기' }))
      .toHaveAttribute('href', '/products/featured-2');
    expect(screen.getByRole('link', { name: '첫 번째 관리자 추천 상품 보기' }))
      .toHaveAttribute('href', '/products/featured-1');
  });

  test('shows a configurable mood image alongside at most three curated product links', () => {
    jest.mocked(useQuery).mockReturnValue({
      isLoading: false,
      data: {
        config: {
          title: 'STYNA SELECT',
          subtitle: '세 가지 선택',
          description: '테스트 설명',
          heroImage: '/style-now/autumn/style-now-autumn-main.webp',
          isActive: true,
        },
        products: [
          { id: 'select-1', name: '첫 번째 선택', brand: 'STYNA', price: 39000, images: [], stock: 2 },
          { id: 'select-2', name: '두 번째 선택', brand: 'STYNA', price: 49000, images: [], stock: 2 },
          { id: 'select-3', name: '세 번째 선택', brand: 'STYNA', price: 59000, images: [], stock: 2 },
          { id: 'select-4', name: '노출하면 안 되는 선택', brand: 'STYNA', price: 69000, images: [], stock: 2 },
        ],
      },
    } as never);

    render(<FeaturedProducts />);

    expect(screen.getByRole('img', { name: 'STYNA SELECT 무드 이미지' }))
      .toHaveAttribute('src', expect.stringContaining('style-now-autumn-main.webp'));
    expect(screen.getAllByRole('link', { name: /상품 보기$/ })).toHaveLength(3);
    expect(screen.queryByText('노출하면 안 되는 선택')).not.toBeInTheDocument();
  });

  test('shows a compact recovery state for an active featured section with no products', () => {
    jest.mocked(useQuery).mockReturnValue({
      isLoading: false,
      data: { config: { title: '추천', subtitle: '', isActive: true }, products: [] },
    } as never);

    render(<FeaturedProducts />);

    expect(screen.getByRole('heading', { level: 2, name: '추천' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '전체 상품 보기' })).toHaveAttribute(
      'href',
      '/products',
    );
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
  });

  test('shows a retry action when the featured query fails', () => {
    const refetch = jest.fn();
    const homeRefetch = jest.fn();
    jest.mocked(useQuery).mockReturnValue({
      isLoading: false,
      isError: true,
      refetch,
      data: undefined,
    } as never);
    jest.mocked(useHomeProducts).mockReturnValue({
      isLoading: false,
      isError: true,
      data: undefined,
      refetch: homeRefetch,
    } as never);

    render(<FeaturedProducts />);

    expect(screen.getByRole('alert')).toHaveTextContent('추천 상품을 불러오지 못했습니다.');
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(homeRefetch).toHaveBeenCalledTimes(1);
  });

  test('shows one loading status without an alert while the public fallback is loading', () => {
    jest.mocked(useQuery).mockReturnValue({
      isLoading: false,
      isError: true,
      data: undefined,
      refetch: jest.fn(),
    } as never);
    jest.mocked(useHomeProducts).mockReturnValue({
      isLoading: true,
      isError: false,
      data: undefined,
      refetch: jest.fn(),
    } as never);

    render(<FeaturedProducts />);

    expect(screen.getAllByRole('status')).toHaveLength(1);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
  });

  test('shows exactly one retryable alert when the public fallback succeeds without products', () => {
    jest.mocked(useQuery).mockReturnValue({
      isLoading: false,
      isError: true,
      data: undefined,
      refetch: jest.fn(),
    } as never);
    jest.mocked(useHomeProducts).mockReturnValue({
      isLoading: false,
      isError: false,
      data: { recommendedProducts: [] },
      refetch: jest.fn(),
    } as never);

    render(<FeaturedProducts />);

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeInTheDocument();
  });

  test('falls back to at most three public recommended products when the featured config fails', () => {
    jest.mocked(useQuery).mockReturnValue({
      isLoading: false,
      isError: true,
      data: undefined,
      refetch: jest.fn(),
    } as never);
    jest.mocked(useHomeProducts).mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        recommendedProducts: Array.from({ length: 5 }, (_value, index) => ({
          id: `fallback-${index + 1}`,
          name: `대체 추천 ${index + 1}`,
          brand: 'STYNA',
          price: 39000,
          images: [],
          stock: 2,
        })),
      },
      refetch: jest.fn(),
    } as never);

    render(<FeaturedProducts />);

    expect(screen.getAllByRole('link', { name: /상품 보기$/ })).toHaveLength(3);
    expect(screen.getByText('대체 추천 1')).toBeInTheDocument();
    expect(screen.queryByText('대체 추천 4')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  test('keeps an inactive featured section hidden even when fallback products exist', () => {
    const config = { title: '추천', subtitle: '', isActive: false };
    jest.mocked(useQuery).mockReturnValue({
      isLoading: false,
      isError: false,
      data: { config, products: [] },
      refetch: jest.fn(),
    } as never);
    jest.mocked(useHomeProducts).mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        recommendedProducts: [{
          id: 'fallback-1',
          name: '보이면 안 되는 대체 추천',
          brand: 'STYNA',
          price: 39000,
          images: [],
          stock: 2,
        }],
      },
      refetch: jest.fn(),
    } as never);

    const { container } = render(<FeaturedProducts />);

    expect(container).toBeEmptyDOMElement();
  });

  test('keeps the view-all control at least 44 pixels tall for touch input', () => {
    const css = readFileSync(
      resolve(process.cwd(), 'src/app/_components/FeaturedProducts.module.css'),
      'utf8',
    );
    const viewAllBlock = css.match(/\.viewAllButton\s*\{[^}]*\}/)?.[0] ?? '';

    expect(viewAllBlock).toContain('min-height: 44px');
  });
});
