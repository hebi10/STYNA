import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import ProductList from './ProductList';
import { ProductService, type ClientProductCursor } from '@/shared/services/productService';
import { useCategoriesWithNames } from '@/shared/hooks/useProducts';

const routerReplace = jest.fn();
let currentSearchParams = new URLSearchParams();

jest.mock('next/navigation', () => ({
  usePathname: () => '/products',
  useRouter: () => ({ replace: (...args: unknown[]) => routerReplace(...args) }),
  useSearchParams: () => currentSearchParams,
}));

jest.mock('./ProductList.module.css', () => ({
  __esModule: true,
  default: new Proxy({}, {
    get: (_target, property) => String(property),
  }),
}));

jest.mock('@/app/_components/AsyncStatePanel.module.css', () => ({
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
  normalizeProductSearchTerm: (value: string) => value.normalize('NFKC').trim().replace(/\s+/g, ' '),
  ProductService: {
    queryProducts: jest.fn(),
  },
}));

jest.mock('@/shared/hooks/useProducts', () => ({
  useCategoriesWithNames: jest.fn(),
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function clientCursor(productId: string, sortValue: number): ClientProductCursor {
  return {
    kind: 'client-keyset',
    sort: { field: 'createdAt', order: 'desc' },
    sortValue,
    productId,
  };
}

function product(id: string, name: string) {
  return {
    id,
    name,
    price: 10000,
    images: [],
    mainImage: '/product.jpg',
    stock: 1,
  };
}

describe('ProductList loading state', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    currentSearchParams = new URLSearchParams();
    jest.mocked(useCategoriesWithNames).mockReturnValue({
      data: [],
    } as unknown as ReturnType<typeof useCategoriesWithNames>);
  });

  test('restores normalized filters from the URL and writes changes back to it', async () => {
    currentSearchParams = new URLSearchParams(
      'q=%EF%BC%B3%EF%BC%B4%EF%BC%B9%EF%BC%AE%EF%BC%A1++%EB%A6%B0%EB%84%A8&category=bags&sort=price-asc&minPrice=10000&maxPrice=50000',
    );
    jest.mocked(useCategoriesWithNames).mockReturnValue({
      data: [{ id: 'bags', name: '가방' }],
    } as unknown as ReturnType<typeof useCategoriesWithNames>);
    (ProductService.queryProducts as jest.Mock).mockResolvedValue({ items: [], hasMore: false });

    render(<ProductList />);

    await waitFor(() => expect(ProductService.queryProducts).toHaveBeenCalledWith(expect.objectContaining({
      keyword: 'STYNA 린넨',
      category: 'bags',
      minPrice: 10000,
      maxPrice: 50000,
      sort: { field: 'price', order: 'asc' },
    })));
    expect(screen.getByLabelText('상품명 검색')).toHaveValue('STYNA 린넨');

    fireEvent.change(screen.getByLabelText('정렬 기준'), { target: { value: 'rating-desc' } });
    await waitFor(() => expect(routerReplace).toHaveBeenLastCalledWith(
      expect.stringContaining('sort=rating-desc'),
      { scroll: false },
    ));
  });

  test('restores externally changed URL filters without replacing them with stale local state', async () => {
    jest.mocked(useCategoriesWithNames).mockReturnValue({
      data: [
        { id: 'bags', name: '가방' },
        { id: 'outer', name: '아우터' },
      ],
    } as unknown as ReturnType<typeof useCategoriesWithNames>);
    (ProductService.queryProducts as jest.Mock).mockResolvedValue({ items: [], hasMore: false });

    const { rerender } = render(<ProductList />);
    await waitFor(() => expect(ProductService.queryProducts).toHaveBeenCalledTimes(1));
    routerReplace.mockClear();

    currentSearchParams = new URLSearchParams(
      'q=%EC%9E%AC%ED%82%B7&category=outer&sort=price-desc&minPrice=20000&maxPrice=80000',
    );
    rerender(<ProductList />);

    await waitFor(() => expect(screen.getByLabelText('상품명 검색')).toHaveValue('재킷'));
    expect(screen.getByLabelText('카테고리 필터')).toHaveValue('outer');
    expect(screen.getByLabelText('정렬 기준')).toHaveValue('price-desc');
    expect(screen.getByLabelText('최소 가격')).toHaveValue(20000);
    expect(screen.getByLabelText('최대 가격')).toHaveValue(80000);
    await waitFor(() => expect(ProductService.queryProducts).toHaveBeenLastCalledWith(expect.objectContaining({
      keyword: '재킷',
      category: 'outer',
      minPrice: 20000,
      maxPrice: 80000,
      sort: { field: 'price', order: 'desc' },
    })));
    expect(routerReplace).not.toHaveBeenCalled();
  });

  test('ignores an older page response after filters change', async () => {
    const stalePage = deferred<{ items: ReturnType<typeof product>[]; hasMore: boolean }>();
    jest.mocked(useCategoriesWithNames).mockReturnValue({
      data: [{ id: 'bags', name: '가방' }],
    } as unknown as ReturnType<typeof useCategoriesWithNames>);
    (ProductService.queryProducts as jest.Mock)
      .mockResolvedValueOnce({
        items: [product('old-1', '기존 첫 페이지')],
        hasMore: true,
        nextCursor: clientCursor('old-1', 12),
      })
      .mockReturnValueOnce(stalePage.promise)
      .mockResolvedValueOnce({
        items: [product('bag-1', '가방 필터 결과')],
        hasMore: false,
      });

    render(<ProductList />);
    expect(await screen.findByText('기존 첫 페이지')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '다음' }));
    await waitFor(() => expect(ProductService.queryProducts).toHaveBeenCalledTimes(2));
    fireEvent.change(screen.getByLabelText('카테고리 필터'), { target: { value: 'bags' } });

    expect(await screen.findByText('가방 필터 결과')).toBeInTheDocument();

    await act(async () => {
      stalePage.resolve({ items: [product('old-2', '지연된 이전 결과')], hasMore: false });
      await stalePage.promise;
    });

    expect(screen.queryByText('지연된 이전 결과')).not.toBeInTheDocument();
    expect(screen.getByText('가방 필터 결과')).toBeInTheDocument();
  });

  test('removes previous products and exposes a busy skeleton as soon as filters change', async () => {
    const filteredPage = deferred<{ items: ReturnType<typeof product>[]; hasMore: boolean }>();
    jest.mocked(useCategoriesWithNames).mockReturnValue({
      data: [{ id: 'bags', name: '가방' }],
    } as unknown as ReturnType<typeof useCategoriesWithNames>);
    (ProductService.queryProducts as jest.Mock)
      .mockResolvedValueOnce({
        items: [product('old-1', '이전 조건 상품')],
        hasMore: false,
      })
      .mockReturnValueOnce(filteredPage.promise);

    render(<ProductList />);
    expect(await screen.findByText('이전 조건 상품')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('카테고리 필터'), { target: { value: 'bags' } });

    await waitFor(() => expect(ProductService.queryProducts).toHaveBeenCalledTimes(2));
    expect(screen.queryByText('이전 조건 상품')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('상품 목록을 불러오는 중입니다');
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getAllByLabelText('상품 목록 로딩 카드')).toHaveLength(6);

    await act(async () => {
      filteredPage.resolve({
        items: [product('bag-1', '새 조건 상품')],
        hasMore: false,
      });
      await filteredPage.promise;
    });

    expect(await screen.findByText('새 조건 상품')).toBeInTheDocument();
  });

  test('clears a pending loading state when moving to a cached page', async () => {
    const slowThirdPage = deferred<{ items: ReturnType<typeof product>[]; hasMore: boolean }>();
    (ProductService.queryProducts as jest.Mock)
      .mockResolvedValueOnce({
        items: [product('page-1', '캐시 첫 페이지')],
        hasMore: true,
        nextCursor: clientCursor('page-1', 12),
      })
      .mockResolvedValueOnce({
        items: [product('page-2', '캐시 둘째 페이지')],
        hasMore: true,
        nextCursor: clientCursor('page-2', 24),
      })
      .mockReturnValueOnce(slowThirdPage.promise);

    const { container } = render(<ProductList />);
    expect(await screen.findByText('캐시 첫 페이지')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '다음' }));
    expect(await screen.findByText('캐시 둘째 페이지')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '다음' }));
    await waitFor(() => expect(ProductService.queryProducts).toHaveBeenCalledTimes(3));

    fireEvent.click(screen.getByRole('button', { name: '이전' }));

    expect(await screen.findByText('캐시 첫 페이지')).toBeInTheDocument();
    expect(container.querySelector('.container')).toHaveAttribute('aria-busy', 'false');

    await act(async () => {
      slowThirdPage.resolve({ items: [product('page-3', '지연된 셋째 페이지')], hasMore: false });
      await slowThirdPage.promise;
    });
    expect(screen.queryByText('지연된 셋째 페이지')).not.toBeInTheDocument();
  });

  test('drops downstream page cache and cursors when retrying from the first page', async () => {
    const firstCursor = clientCursor('page-1', 12);
    const secondCursor = clientCursor('page-2', 24);
    const refreshedCursor = clientCursor('page-1-new', 13);
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    (ProductService.queryProducts as jest.Mock)
      .mockResolvedValueOnce({
        items: [product('page-1', '기존 첫 페이지')],
        hasMore: true,
        nextCursor: firstCursor,
      })
      .mockResolvedValueOnce({
        items: [product('page-2', '기존 둘째 페이지')],
        hasMore: true,
        nextCursor: secondCursor,
      })
      .mockRejectedValueOnce(new Error('셋째 페이지 조회 실패'))
      .mockResolvedValueOnce({
        items: [product('page-1-new', '갱신된 첫 페이지')],
        hasMore: true,
        nextCursor: refreshedCursor,
      })
      .mockResolvedValueOnce({
        items: [product('page-2-new', '갱신된 둘째 페이지')],
        hasMore: false,
      });

    try {
      render(<ProductList />);
      expect(await screen.findByText('기존 첫 페이지')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: '다음' }));
      expect(await screen.findByText('기존 둘째 페이지')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: '다음' }));
      expect(await screen.findByRole('alert')).toHaveTextContent('상품 목록을 불러오지 못했습니다.');
      expect(screen.getByRole('alert')).toHaveTextContent('잠시 후 다시 시도하거나 전체 상품으로 돌아가 주세요.');
      expect(screen.getByRole('alert')).not.toHaveTextContent('셋째 페이지 조회 실패');

      fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
      expect(await screen.findByText('갱신된 첫 페이지')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: '다음' }));

      expect(await screen.findByText('갱신된 둘째 페이지')).toBeInTheDocument();
      expect(ProductService.queryProducts).toHaveBeenCalledTimes(5);
      expect(ProductService.queryProducts).toHaveBeenLastCalledWith(expect.objectContaining({
        startAfterDoc: refreshedCursor,
      }));
      expect(screen.queryByText('기존 둘째 페이지')).not.toBeInTheDocument();
    } finally {
      consoleError.mockRestore();
    }
  });

  test('locks a dynamic category while keeping cursor paging in the shared list', async () => {
    (ProductService.queryProducts as jest.Mock).mockResolvedValue({ items: [], hasMore: false });

    render(<ProductList initialCategory="bags" lockCategory />);

    await waitFor(() => expect(ProductService.queryProducts).toHaveBeenCalledWith(expect.objectContaining({
      category: 'bags',
    })));
    expect(screen.queryByLabelText('카테고리 필터')).not.toBeInTheDocument();
  });

  test('renders product-shaped skeleton cards during the first load', async () => {
    (ProductService.queryProducts as jest.Mock).mockReturnValue(new Promise(() => undefined));

    render(<ProductList />);

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('상품 목록을 불러오는 중입니다');
    });
    expect(screen.getAllByLabelText('상품 목록 로딩 카드')).toHaveLength(6);
  });

  test('renders a retryable alert instead of an empty result when the first query fails', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    (ProductService.queryProducts as jest.Mock).mockRejectedValueOnce(new Error('permission-denied'));

    try {
      render(<ProductList />);

      expect(await screen.findByRole('alert')).toHaveTextContent('상품 목록을 불러오지 못했습니다.');
      expect(screen.getByRole('alert')).toHaveTextContent('잠시 후 다시 시도하거나 전체 상품으로 돌아가 주세요.');
      expect(screen.getByRole('alert')).not.toHaveTextContent('permission-denied');
      expect(screen.getByRole('button', { name: '다시 시도' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: '전체 상품 보기' })).toHaveAttribute('href', '/products');
      expect(screen.queryByText('조건에 맞는 상품이 없습니다.')).not.toBeInTheDocument();
    } finally {
      consoleError.mockRestore();
    }
  });

  test('renders a filter reset only for a successful empty result', async () => {
    (ProductService.queryProducts as jest.Mock).mockResolvedValueOnce({
      items: [],
      nextCursor: null,
      hasMore: false,
    });

    render(<ProductList />);

    expect(await screen.findByText('조건에 맞는 상품이 없습니다.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '조건 초기화' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  test('renders known category ids with Korean labels', async () => {
    jest.mocked(useCategoriesWithNames).mockReturnValue({
      data: [{ id: 'bags', name: '가방' }],
    } as unknown as ReturnType<typeof useCategoriesWithNames>);
    (ProductService.queryProducts as jest.Mock).mockResolvedValue({
      items: [],
      hasMore: false,
    });

    render(<ProductList />);

    expect(await screen.findByRole('option', { name: '가방' })).toHaveValue('bags');
  });

  test('keeps the result count while omitting product summary tiles', async () => {
    (ProductService.queryProducts as jest.Mock).mockResolvedValue({
      items: [{
        id: 'product-1',
        name: '테스트 상품',
        price: 10000,
        images: [],
        mainImage: '/product.jpg',
        stock: 1,
      }],
      hasMore: true,
    });

    render(<ProductList />);

    expect(await screen.findByLabelText('최소 가격')).toBeInTheDocument();
    expect(screen.getByLabelText('최대 가격')).toBeInTheDocument();
    expect(screen.getByText('현재 페이지 1개 상품')).toBeInTheDocument();
    expect(screen.queryByText('현재 페이지 상품')).not.toBeInTheDocument();
    expect(screen.queryByText('신상품')).not.toBeInTheDocument();
    expect(screen.queryByText('세일')).not.toBeInTheDocument();
    expect(screen.queryByText('총 1개 상품')).not.toBeInTheDocument();
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

  test('toggles the mobile product filters through one disclosure control', async () => {
    (ProductService.queryProducts as jest.Mock).mockResolvedValue({
      items: [],
      hasMore: false,
    });

    render(<ProductList />);

    const toggle = await screen.findByRole('button', { name: '상품 필터 열기' });
    const panel = screen.getByRole('region', { name: '상품 필터' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveAttribute('aria-controls', 'product-filter-panel');
    expect(panel).not.toHaveClass('filterPanelOpen');

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(toggle).toHaveAccessibleName('상품 필터 닫기');
    expect(panel).toHaveClass('filterPanelOpen');
    expect(panel).toBeVisible();

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveAccessibleName('상품 필터 열기');
    expect(panel).not.toHaveClass('filterPanelOpen');
  });
});
