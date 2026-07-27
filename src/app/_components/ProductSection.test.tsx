import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fireEvent, render, screen } from '@testing-library/react';
import ProductSection from './ProductSection';
import { useHomeProducts } from '@/shared/hooks/useProducts';

jest.mock('./ProductSection.module.css', () => ({
  __esModule: true,
  default: new Proxy({}, {
    get: (_target, prop) => String(prop),
  }),
}));

jest.mock('./AsyncStatePanel.module.css', () => ({
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
    isNew,
    mdComment,
    operationLabel,
    reviewLabel,
  }: {
    name: string;
    isNew?: boolean;
    mdComment?: string;
    operationLabel?: string;
    reviewLabel?: string;
  }) => (
    <article>
      {name}
      {isNew && <span>NEW</span>}
      {operationLabel && <span>{operationLabel}</span>}
      {reviewLabel && <span>{reviewLabel}</span>}
      {mdComment && <p>{mdComment}</p>}
    </article>
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

  test('does not repeat generated operating metadata on home product cards', () => {
    jest.mocked(useHomeProducts).mockReturnValue({
      data: {
        recommendedProducts: [],
        newProducts: [
          product('일반 셔츠', 'clothing'),
          { ...product('할인 셔츠', 'clothing'), isSale: true },
        ],
        saleProducts: [],
        bestSellerProducts: [],
      },
      isLoading: false,
    } as unknown as ReturnType<typeof useHomeProducts>);

    const markup = renderToStaticMarkup(
      <ProductSection title="신상품" type="new" />,
    );

    expect(markup).not.toContain('현재 상품에 등록된 할인가입니다.');
    expect(markup).not.toContain('현재 등록된 상품 정보와 리뷰를 확인해 보세요.');
    expect(markup).not.toContain('등록된 리뷰가 많은 상품입니다.');
    expect(markup).not.toContain('리뷰 100+');
  });

  test('shows only one new status badge for a new product', () => {
    jest.mocked(useHomeProducts).mockReturnValue({
      data: {
        recommendedProducts: [],
        newProducts: [{ ...product('신규 셔츠', 'clothing'), isNew: true }],
        saleProducts: [],
        bestSellerProducts: [],
      },
      isLoading: false,
    } as unknown as ReturnType<typeof useHomeProducts>);

    render(<ProductSection title="신상품" type="new" />);

    expect(screen.getByText('신규 셔츠').parentElement).toHaveTextContent('신규 셔츠NEW');
    expect(screen.getAllByText('NEW')).toHaveLength(1);
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

  test('announces the home product loading state politely', () => {
    jest.mocked(useHomeProducts).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    } as unknown as ReturnType<typeof useHomeProducts>);

    render(<ProductSection title="이번 주 신상" type="new" />);

    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByRole('status')).toHaveTextContent('상품을 불러오는 중입니다...');
  });

  test('keeps the section title and offers all-products recovery after a successful empty query', () => {
    jest.mocked(useHomeProducts).mockReturnValue({
      data: {
        recommendedProducts: [],
        newProducts: [],
        saleProducts: [],
        bestSellerProducts: [],
      },
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useHomeProducts>);

    render(<ProductSection title="이번 주 신상" type="new" />);

    expect(screen.getByRole('heading', { level: 2, name: '이번 주 신상' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '전체 상품 보기' })).toHaveAttribute(
      'href',
      '/products',
    );
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
  });

  test('keeps view-all controls at least 44 pixels tall for touch input', () => {
    const css = readFileSync(
      resolve(process.cwd(), 'src/app/_components/ProductSection.module.css'),
      'utf8',
    );
    const viewAllBlock = css.match(/\.viewAllLink,\s*\.viewAllButton\s*\{[^}]*\}/)?.[0] ?? '';

    expect(viewAllBlock).toContain('min-height: 44px');
  });

});
