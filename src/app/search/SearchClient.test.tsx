import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import SearchClient from './SearchClient';
import { ProductService, type ClientProductCursor } from '@/shared/services/productService';
import { Product } from '@/shared/types/product';
import { useCategoriesWithNames } from '@/shared/hooks/useProducts';

let currentSearchParams = new URLSearchParams('q=셔츠');
const routerPush = jest.fn();

jest.mock('./page.module.css', () => ({
  __esModule: true,
  default: new Proxy({}, {
    get: (_target, property) => String(property),
  }),
}));

jest.mock('next/navigation', () => ({
  useSearchParams: () => currentSearchParams,
  useRouter: () => ({ push: (...args: unknown[]) => routerPush(...args) }),
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
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function clientCursor(productId: string, sortValue: number): ClientProductCursor {
  return {
    kind: 'client-keyset',
    sort: { field: 'createdAt', order: 'desc' },
    sortValue,
    productId,
  };
}

function productWithName(id: string, name: string): Product {
  return { ...product, id, name };
}

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
    currentSearchParams = new URLSearchParams('q=셔츠');
    (ProductService.queryProducts as jest.Mock).mockResolvedValue({
      items: [product],
      hasMore: true,
    });
    jest.mocked(useCategoriesWithNames).mockReturnValue({
      data: [{ id: 'tops', name: '상의' }],
    } as unknown as ReturnType<typeof useCategoriesWithNames>);
  });

  test('현재 페이지 결과 수를 전체 결과 수로 단정하지 않고, 사용자용 카테고리 이름을 표시한다', async () => {
    render(<SearchClient />);

    expect(await screen.findByText('베이직 셔츠')).toBeInTheDocument();

    expect(screen.getByRole('option', { name: '상의' })).toHaveValue('tops');
    expect(screen.getByRole('status')).toHaveTextContent('현재 페이지 결과 1개');
    expect(screen.queryByText('총 1개')).not.toBeInTheDocument();
  });

  test('URL 검색어의 전각 문자와 중복 공백을 정규화한다', async () => {
    currentSearchParams = new URLSearchParams(
      'q=%EF%BC%B3%EF%BC%B4%EF%BC%B9%EF%BC%AE%EF%BC%A1%20%20%EB%A6%B0%EB%84%A8',
    );

    render(<SearchClient />);

    await waitFor(() => expect(ProductService.queryProducts).toHaveBeenCalledWith(expect.objectContaining({
      keyword: 'STYNA 린넨',
    })));
  });

  test('announces an in-progress search through a polite status message', async () => {
    (ProductService.queryProducts as jest.Mock).mockReturnValue(new Promise(() => undefined));

    render(<SearchClient />);

    const loadingMessage = await screen.findByText('검색 중...');
    expect(loadingMessage).toHaveAttribute('role', 'status');
    expect(loadingMessage).toHaveAttribute('aria-live', 'polite');
  });

  test('announces a search failure as an alert', async () => {
    (ProductService.queryProducts as jest.Mock).mockRejectedValue(new Error('검색 서버 오류'));

    render(<SearchClient />);

    expect(await screen.findByRole('alert')).toHaveTextContent('검색 서버 오류');
  });

  test('keeps optimistic results when void navigation leaves the previous URL until the target is observed', async () => {
    (ProductService.queryProducts as jest.Mock).mockImplementation(async (input) => ({
      items: [productWithName(String(input.keyword), `${input.keyword} 결과`)],
      hasMore: false,
    }));

    const { rerender } = render(<SearchClient />);
    expect(await screen.findByText('셔츠 결과')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('상품 검색어'), { target: { value: '바지' } });
    fireEvent.click(screen.getByRole('button', { name: '검색' }));

    expect(routerPush).toHaveBeenCalledWith('/search?q=%EB%B0%94%EC%A7%80');
    await waitFor(() => expect(screen.getByLabelText('상품 검색어')).toHaveValue('바지'));
    expect(await screen.findByText('바지 결과')).toBeInTheDocument();
    expect(ProductService.queryProducts).toHaveBeenLastCalledWith(expect.objectContaining({
      keyword: '바지',
    }));
    expect(routerPush).toHaveReturnedWith(undefined);

    rerender(<SearchClient />);
    expect(screen.getByLabelText('상품 검색어')).toHaveValue('바지');
    expect(screen.getByText('바지 결과')).toBeInTheDocument();

    currentSearchParams = new URLSearchParams('q=바지');
    rerender(<SearchClient />);
    await waitFor(() => expect(screen.getByLabelText('상품 검색어')).toHaveValue('바지'));
    expect(ProductService.queryProducts).toHaveBeenCalledTimes(2);
  });

  test('keeps the current results while explicitly reloading the same normalized query', async () => {
    const refreshedPage = deferred<{ items: Product[]; hasMore: boolean }>();
    (ProductService.queryProducts as jest.Mock)
      .mockResolvedValueOnce({
        items: [productWithName('shirt-1', '기존 셔츠 결과')],
        hasMore: false,
      })
      .mockReturnValueOnce(refreshedPage.promise);

    render(<SearchClient />);
    expect(await screen.findByText('기존 셔츠 결과')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '검색' }));

    await waitFor(() => expect(ProductService.queryProducts).toHaveBeenCalledTimes(2));
    expect(screen.getByText('기존 셔츠 결과')).toBeInTheDocument();
    expect(screen.queryByText('검색 결과가 없습니다.')).not.toBeInTheDocument();
    expect(routerPush).not.toHaveBeenCalled();

    await act(async () => {
      refreshedPage.resolve({
        items: [productWithName('shirt-2', '갱신된 셔츠 결과')],
        hasMore: false,
      });
      await refreshedPage.promise;
    });

    expect(await screen.findByText('갱신된 셔츠 결과')).toBeInTheDocument();
    expect(screen.queryByText('기존 셔츠 결과')).not.toBeInTheDocument();
  });

  test('ignores an older search page response after filters change', async () => {
    const stalePage = deferred<{ items: Product[]; hasMore: boolean }>();
    (ProductService.queryProducts as jest.Mock)
      .mockResolvedValueOnce({
        items: [productWithName('shirt-1', '기존 검색 결과')],
        hasMore: true,
        nextCursor: clientCursor('shirt-1', 20),
      })
      .mockReturnValueOnce(stalePage.promise)
      .mockResolvedValueOnce({
        items: [productWithName('tops-1', '상의 필터 결과')],
        hasMore: false,
      });

    render(<SearchClient />);
    expect(await screen.findByText('기존 검색 결과')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '다음' }));
    await waitFor(() => expect(ProductService.queryProducts).toHaveBeenCalledTimes(2));
    fireEvent.change(screen.getByLabelText('카테고리'), { target: { value: 'tops' } });

    expect(await screen.findByText('상의 필터 결과')).toBeInTheDocument();

    await act(async () => {
      stalePage.resolve({
        items: [productWithName('stale-2', '지연된 검색 결과')],
        hasMore: false,
      });
      await stalePage.promise;
    });

    expect(screen.queryByText('지연된 검색 결과')).not.toBeInTheDocument();
    expect(screen.getByText('상의 필터 결과')).toBeInTheDocument();
  });

  test('clears a pending loading state when moving to a cached search page', async () => {
    const slowThirdPage = deferred<{ items: Product[]; hasMore: boolean }>();
    (ProductService.queryProducts as jest.Mock)
      .mockResolvedValueOnce({
        items: [productWithName('page-1', '검색 캐시 첫 페이지')],
        hasMore: true,
        nextCursor: clientCursor('page-1', 20),
      })
      .mockResolvedValueOnce({
        items: [productWithName('page-2', '검색 캐시 둘째 페이지')],
        hasMore: true,
        nextCursor: clientCursor('page-2', 40),
      })
      .mockReturnValueOnce(slowThirdPage.promise);

    render(<SearchClient />);
    expect(await screen.findByText('검색 캐시 첫 페이지')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '다음' }));
    expect(await screen.findByText('검색 캐시 둘째 페이지')).toBeInTheDocument();
    const nextButton = screen.getByRole('button', { name: '다음' });
    const previousButton = screen.getByRole('button', { name: '이전' });
    act(() => {
      nextButton.click();
      previousButton.click();
    });
    await waitFor(() => expect(ProductService.queryProducts).toHaveBeenCalledTimes(3));

    expect(await screen.findByText('검색 캐시 첫 페이지')).toBeInTheDocument();
    expect(screen.queryByText('검색 중...')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '검색' })).toBeEnabled();

    await act(async () => {
      slowThirdPage.resolve({
        items: [productWithName('page-3', '지연된 검색 셋째 페이지')],
        hasMore: false,
      });
      await slowThirdPage.promise;
    });
    expect(screen.queryByText('지연된 검색 셋째 페이지')).not.toBeInTheDocument();
  });

  test('drops downstream search cache and cursors when retrying from the first page', async () => {
    const firstCursor = clientCursor('page-1', 20);
    const secondCursor = clientCursor('page-2', 40);
    const refreshedCursor = clientCursor('page-1-new', 21);
    (ProductService.queryProducts as jest.Mock)
      .mockResolvedValueOnce({
        items: [productWithName('page-1', '기존 검색 첫 페이지')],
        hasMore: true,
        nextCursor: firstCursor,
      })
      .mockResolvedValueOnce({
        items: [productWithName('page-2', '기존 검색 둘째 페이지')],
        hasMore: true,
        nextCursor: secondCursor,
      })
      .mockRejectedValueOnce(new Error('검색 셋째 페이지 조회 실패'))
      .mockResolvedValueOnce({
        items: [productWithName('page-1-new', '갱신된 검색 첫 페이지')],
        hasMore: true,
        nextCursor: refreshedCursor,
      })
      .mockResolvedValueOnce({
        items: [productWithName('page-2-new', '갱신된 검색 둘째 페이지')],
        hasMore: false,
      });

    render(<SearchClient />);
    expect(await screen.findByText('기존 검색 첫 페이지')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '다음' }));
    expect(await screen.findByText('기존 검색 둘째 페이지')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '다음' }));
    expect(await screen.findByText('검색 셋째 페이지 조회 실패')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(await screen.findByText('갱신된 검색 첫 페이지')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '다음' }));

    expect(await screen.findByText('갱신된 검색 둘째 페이지')).toBeInTheDocument();
    expect(ProductService.queryProducts).toHaveBeenCalledTimes(5);
    expect(ProductService.queryProducts).toHaveBeenLastCalledWith(expect.objectContaining({
      startAfterDoc: refreshedCursor,
    }));
    expect(screen.queryByText('기존 검색 둘째 페이지')).not.toBeInTheDocument();
  });
});
