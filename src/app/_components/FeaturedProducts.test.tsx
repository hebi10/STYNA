import { fireEvent, render, screen } from '@testing-library/react';
import FeaturedProducts from './FeaturedProducts';
import { useQuery } from '@tanstack/react-query';

jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn(),
}));

jest.mock('@/shared/services/featuredProductService', () => ({
  FeaturedProductService: { getFeaturedSection: jest.fn() },
}));

jest.mock('./FeaturedProducts.module.css', () => ({
  __esModule: true,
  default: new Proxy({}, { get: (_target, key) => String(key) }),
}));

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

jest.mock('@/app/products/_components/ProductCard', () => ({
  __esModule: true,
  default: ({ name }: { name: string }) => <article>{name}</article>,
}));

describe('FeaturedProducts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('uses the single featured section contract', () => {
    jest.mocked(useQuery).mockReturnValue({
      isLoading: false,
      data: {
        config: { title: '관리자 추천', subtitle: '한 번만 읽은 설정', isActive: true },
        products: [{
          id: 'featured-1',
          name: '추천 셔츠',
          brand: 'STYNA',
          price: 39000,
          images: [],
          stock: 2,
        }],
      },
    } as never);

    render(<FeaturedProducts />);

    expect(screen.getByRole('heading', { name: '관리자 추천' })).toBeInTheDocument();
    expect(screen.getByText('추천 셔츠')).toBeInTheDocument();
  });

  test('hides an empty featured section', () => {
    jest.mocked(useQuery).mockReturnValue({
      isLoading: false,
      data: { config: { title: '추천', subtitle: '', isActive: true }, products: [] },
    } as never);

    const { container } = render(<FeaturedProducts />);
    expect(container).toBeEmptyDOMElement();
  });

  test('shows a retry action when the featured query fails', () => {
    const refetch = jest.fn();
    jest.mocked(useQuery).mockReturnValue({
      isLoading: false,
      isError: true,
      refetch,
      data: undefined,
    } as never);

    render(<FeaturedProducts />);

    expect(screen.getByRole('alert')).toHaveTextContent('추천 상품을 불러오지 못했습니다.');
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});
