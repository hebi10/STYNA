import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ProductList from './ProductList';
import { ProductService } from '@/shared/services/productService';

jest.mock('./ProductList.module.css', () => ({
  __esModule: true,
  default: new Proxy({}, {
    get: (_target, property) => String(property),
  }),
}));

jest.mock('./ProductCard', () => ({
  __esModule: true,
  default: ({ name }: { name: string }) => <article>{name}</article>,
}));

jest.mock('@/shared/services/productService', () => ({
  ProductService: {
    getCategories: jest.fn(),
    queryProducts: jest.fn(),
  },
}));

jest.mock('@/shared/utils/categoryUtils', () => ({
  getDefaultCategoryNames: () => ({
    bags: '가방',
  }),
}));

describe('ProductList loading state', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (ProductService.getCategories as jest.Mock).mockResolvedValue([]);
  });

  test('renders product-shaped skeleton cards during the first load', async () => {
    (ProductService.queryProducts as jest.Mock).mockReturnValue(new Promise(() => undefined));

    render(<ProductList />);

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('상품 목록을 불러오는 중입니다');
    });
    expect(screen.getAllByLabelText('상품 목록 로딩 카드')).toHaveLength(6);
  });

  test('renders known category ids with Korean labels', async () => {
    (ProductService.getCategories as jest.Mock).mockResolvedValue(['bags']);
    (ProductService.queryProducts as jest.Mock).mockResolvedValue({
      items: [],
      hasMore: false,
    });

    render(<ProductList />);

    expect(await screen.findByRole('option', { name: '가방' })).toHaveValue('bags');
  });

  test('labels price controls and describes counts as the current page', async () => {
    (ProductService.queryProducts as jest.Mock).mockResolvedValue({
      items: [],
      hasMore: false,
    });

    render(<ProductList />);

    expect(await screen.findByLabelText('최소 가격')).toBeInTheDocument();
    expect(screen.getByLabelText('최대 가격')).toBeInTheDocument();
    expect(screen.getByText('현재 페이지 상품')).toBeInTheDocument();
  });

  test('applies a changed price range only after the user selects apply', async () => {
    (ProductService.queryProducts as jest.Mock).mockResolvedValue({
      items: [],
      hasMore: false,
    });

    render(<ProductList />);
    await waitFor(() => expect(ProductService.queryProducts).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByLabelText('최소 가격'), { target: { value: '10000' } });
    expect(ProductService.queryProducts).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: '적용' }));
    await waitFor(() => expect(ProductService.queryProducts).toHaveBeenCalledTimes(2));
    expect(ProductService.queryProducts).toHaveBeenLastCalledWith(expect.objectContaining({
      minPrice: 10000,
    }));
  });
});
