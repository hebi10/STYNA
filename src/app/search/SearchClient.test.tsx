import { render, screen, waitFor } from '@testing-library/react';
import SearchClient from './SearchClient';
import { ProductService } from '@/shared/services/productService';
import { Product } from '@/shared/types/product';

jest.mock('./page.module.css', () => ({
  __esModule: true,
  default: new Proxy({}, {
    get: (_target, property) => String(property),
  }),
}));

jest.mock('next/navigation', () => ({
  useSearchParams: (() => {
    const searchParams = new URLSearchParams('q=셔츠');
    return () => searchParams;
  })(),
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('../_components/PageHeader', () => ({
  __esModule: true,
  default: ({ title }: { title: string }) => <h1>{title}</h1>,
}));

jest.mock('@/app/products/_components/ProductCard', () => ({
  __esModule: true,
  default: ({ name }: { name: string }) => <article>{name}</article>,
}));

jest.mock('@/shared/services/productService', () => ({
  ProductService: {
    queryProducts: jest.fn(),
    getCategories: jest.fn(),
    getCategoriesWithNames: jest.fn(),
  },
}));

const product: Product = {
  id: 'shirt-1',
  name: '베이직 셔츠',
  description: '테스트 상품',
  price: 39000,
  brand: 'STYNA',
  category: 'tops',
  categoryId: 'tops',
  images: [],
  detailImages: [],
  sizes: [],
  colors: [],
  stock: 3,
  rating: 4.8,
  reviewCount: 12,
  isNew: false,
  isSale: false,
  tags: [],
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  status: 'active',
  details: {
    material: '',
    origin: '',
    manufacturer: '',
    precautions: '',
    sizes: {},
  },
};

describe('SearchClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (ProductService.queryProducts as jest.Mock).mockResolvedValue({
      items: [product],
      hasMore: true,
    });
    (ProductService.getCategories as jest.Mock).mockResolvedValue(['tops']);
    (ProductService.getCategoriesWithNames as jest.Mock).mockResolvedValue([
      { id: 'tops', name: '상의' },
    ]);
  });

  test('현재 페이지 결과 수를 전체 결과 수로 단정하지 않고, 사용자용 카테고리 이름을 표시한다', async () => {
    render(<SearchClient />);

    expect(await screen.findByText('베이직 셔츠')).toBeInTheDocument();

    await waitFor(() => {
      expect(ProductService.getCategoriesWithNames).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByRole('option', { name: '상의' })).toHaveValue('tops');
    expect(screen.getByRole('status')).toHaveTextContent('현재 페이지 결과 1개');
    expect(screen.queryByText('총 1개')).not.toBeInTheDocument();
  });
});
