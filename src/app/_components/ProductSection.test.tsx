import { renderToStaticMarkup } from 'react-dom/server';
import ProductSection from './ProductSection';
import { useProduct } from '@/context/productProvider';

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

jest.mock('@/context/productProvider', () => ({
  useProduct: jest.fn(),
}));

jest.mock('@/app/products/_components/ProductCard', () => ({
  __esModule: true,
  default: ({ name }: { name: string }) => <article>{name}</article>,
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
    jest.mocked(useProduct).mockReturnValue({
      recommendedProducts: [],
      newProducts: [
        product('베이직 코튼 셔츠', 'clothing'),
        product('수영 고글 세트', 'sports'),
        product('여행 캐리어 20인치', 'travel'),
        product('캠핑 어닝 세트', 'outdoor'),
      ],
      saleProducts: [],
      bestSellerProducts: [],
      loading: false,
    } as unknown as ReturnType<typeof useProduct>);
  });

  test('filters off-brand products from main product sections', () => {
    const markup = renderToStaticMarkup(
      <ProductSection title="이번 주 신상" type="new" />,
    );

    expect(markup).toContain('베이직 코튼 셔츠');
    expect(markup).not.toContain('수영 고글 세트');
    expect(markup).not.toContain('여행 캐리어 20인치');
    expect(markup).not.toContain('캠핑 어닝 세트');
  });

  test('keeps ranking sections to a complete one-row set when eight items are not available', () => {
    jest.mocked(useProduct).mockReturnValue({
      recommendedProducts: [],
      newProducts: [],
      saleProducts: [],
      bestSellerProducts: Array.from({ length: 5 }, (_value, index) =>
        product(`ranking product ${index + 1}`, 'clothing'),
      ),
      loading: false,
    } as unknown as ReturnType<typeof useProduct>);

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
});
