import { renderToStaticMarkup } from 'react-dom/server';
import { fireEvent, render, screen } from '@testing-library/react';
import ProductSection from './ProductSection';
import { useHomeProducts } from '@/shared/hooks/useProducts';

jest.mock('./ProductSection.module.css', () => ({
  __esModule: true,
  default: new Proxy({}, {
    get: (_target, prop) => String(prop),
  }),
}));

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({
    href,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

jest.mock('@/shared/hooks/useProducts', () => ({
  useHomeProducts: jest.fn(),
}));

jest.mock('@/app/products/_components/ProductCard', () => ({
  __esModule: true,
  default: ({
    name,
    mdComment,
    operationLabel,
  }: { name: string; mdComment?: string; operationLabel?: string }) => (
    <article>{name}{operationLabel && <span>{operationLabel}</span>}{mdComment && <p>{mdComment}</p>}</article>
  ),
}));

const product = (name: string, categoryId: string) => ({
  id: name,
  name,
  description: '',
  price: 10000,
  brand: 'STYNA',
  category: categoryId,
  categoryId,
  images: [],
  sizes: [],
  colors: [],
  stock: 10,
  rating: 4.8,
  reviewCount: 120,
  isNew: false,
  isSale: false,
  tags: [],
  createdAt: new Date(),
  updatedAt: new Date(),
  details: {
    material: '',
    origin: '',
    manufacturer: '',
    precautions: '',
    sizes: {},
  },
});

describe('ProductSection curated main exposure', () => {
  beforeEach(() => {
    jest.mocked(useHomeProducts).mockReturnValue({
      data: {
        recommendedProducts: [],
        newProducts: [
        product('베이직 코튼 셔츠', 'clothing'),
        product('수영 고글 세트', 'sports'),
        product('여행 캐리어 20인치', 'travel'),
        product('캠핑 어닝 세트', 'outdoor'),
        ],
        saleProducts: [],
        bestSellerProducts: [],
      },
      isLoading: false,
    } as unknown as ReturnType<typeof useHomeProducts>);
  });

  test('filters off-brand products from main product sections', () => {
    const markup = renderToStaticMarkup(
      <ProductSection title="이번 주 신상" type="new" />,
    );

    expect(markup).toContain('베이직 코튼 셔츠');
    expect(markup).not.toContain('수영 고글 세트');
    expect(markup).not.toContain('여행 캐리어 20인치');
    expect(markup).not.toContain('캠핑 어닝 세트');
    expect(markup).not.toMatch(/MD추천|기준으로 골랐/);
  });

  test('keeps ranking sections to a complete one-row set when eight items are not available', () => {
    jest.mocked(useHomeProducts).mockReturnValue({
      data: {
        recommendedProducts: [],
        newProducts: [],
        saleProducts: [],
        bestSellerProducts: Array.from({ length: 5 }, (_value, index) =>
          product(`ranking product ${index + 1}`, 'clothing'),
        ),
      },
      isLoading: false,
    } as unknown as ReturnType<typeof useHomeProducts>);

    const markup = renderToStaticMarkup(
      <ProductSection
        title="Best Ranking"
        type="bestseller"
        maxItems={8}
        variant="ranking"
      />,
    );

    expect(markup).toContain('ranking product 1');
    expect(markup).toContain('ranking product 4');
    expect(markup).not.toContain('ranking product 5');
  });

  test('describes sale metadata without inventing an unsupported deadline', () => {
    jest.mocked(useHomeProducts).mockReturnValue({
      data: {
        recommendedProducts: [],
        newProducts: [],
        saleProducts: [{ ...product('할인 셔츠', 'clothing'), isSale: true }],
        bestSellerProducts: [],
      },
      isLoading: false,
    } as unknown as ReturnType<typeof useHomeProducts>);

    const markup = renderToStaticMarkup(
      <ProductSection title="할인 상품" type="sale" />,
    );

    expect(markup).toContain('현재 상품에 등록된 할인가입니다.');
    expect(markup).not.toContain('이번 주만');
  });

  test('shows a retry action when the home product query fails', () => {
    const refetch = jest.fn();
    jest.mocked(useHomeProducts).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch,
    } as unknown as ReturnType<typeof useHomeProducts>);

    render(<ProductSection title="이번 주 신상" type="new" />);

    expect(screen.getByRole('alert')).toHaveTextContent('상품을 불러오지 못했습니다.');
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});
