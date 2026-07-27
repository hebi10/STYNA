import { createElement, type ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ProductService } from '@/shared/services/productService';
import {
  useHomeProducts,
  useProductsByIds,
} from './useProducts';
import type { Product } from '@/shared/types/product';

jest.mock('@/shared/services/productService', () => ({
  ProductService: {
    getHomePageProducts: jest.fn(),
    getPublicProductById: jest.fn(),
  },
}));

const product = (id: string): Product => ({
  id,
  name: id,
  description: '',
  price: 10000,
  brand: 'STYNA',
  category: 'tops',
  images: [],
  sizes: [],
  colors: [],
  stock: 1,
  rating: 0,
  reviewCount: 0,
  isNew: false,
  isSale: false,
  tags: [],
  createdAt: new Date('2026-07-21T00:00:00.000Z'),
  updatedAt: new Date('2026-07-21T00:00:00.000Z'),
  status: 'active',
  details: {
    material: '',
    origin: '',
    manufacturer: '',
    precautions: '',
    sizes: {},
  },
});

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
    },
  });

  return function QueryWrapper({ children }: { children: ReactNode }) {
    return createElement(
      QueryClientProvider,
      { client: queryClient },
      children,
    );
  };
}

describe('product query hooks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('deduplicates identical home product requests', async () => {
    jest.mocked(ProductService.getHomePageProducts).mockResolvedValue({
      recommendedProducts: [product('recommended')],
      newProducts: [],
      saleProducts: [],
      bestSellerProducts: [],
    });

    const { result } = renderHook(() => ({
      first: useHomeProducts(),
      second: useHomeProducts(),
    }), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.first.isSuccess).toBe(true));
    expect(result.current.second.data?.recommendedProducts[0]?.id).toBe('recommended');
    expect(ProductService.getHomePageProducts).toHaveBeenCalledTimes(1);
  });

  test('distinguishes missing products from failed lookups without a permanent loading state', async () => {
    jest.mocked(ProductService.getPublicProductById).mockImplementation(async (id) => {
      if (id === 'active') return product(id);
      if (id === 'missing') return null;
      throw new Error('temporary firestore failure');
    });

    const { result } = renderHook(
      () => useProductsByIds(['active', 'missing', 'failed', 'active']),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.products.map((item) => item.id)).toEqual(['active']);
    expect(result.current.missingIds).toEqual(['missing']);
    expect(result.current.failedIds).toEqual(['failed']);
    expect(ProductService.getPublicProductById).toHaveBeenCalledTimes(3);
  });
});
