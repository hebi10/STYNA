'use client';

import { useQueries, useQuery } from '@tanstack/react-query';
import { ProductService } from '@/shared/services/productService';
import type { Product } from '@/shared/types/product';
import { categoryKeys, productKeys } from './queryKeys';

const PRODUCT_STALE_TIME_MS = 5 * 60 * 1000;

export function useHomeProducts() {
  return useQuery({
    queryKey: productKeys.home(),
    queryFn: () => ProductService.getHomePageProducts(),
    staleTime: PRODUCT_STALE_TIME_MS,
  });
}

export function useRelatedProducts(productId: string, limit = 4) {
  return useQuery({
    queryKey: productKeys.related(productId, limit),
    queryFn: () => ProductService.getRelatedProducts(productId, limit, { throwOnError: true }),
    enabled: Boolean(productId),
    staleTime: PRODUCT_STALE_TIME_MS,
  });
}

export function useCategoriesWithNames() {
  return useQuery({
    queryKey: categoryKeys.withNames(),
    queryFn: () => ProductService.getCategoriesWithNames(),
    staleTime: 10 * 60 * 1000,
  });
}

export function useProductsByIds(productIds: string[]) {
  const uniqueIds = Array.from(new Set(productIds.filter(Boolean)));
  const queries = useQueries({
    queries: uniqueIds.map((productId) => ({
      queryKey: productKeys.detail(productId),
      queryFn: () => ProductService.getPublicProductById(productId),
      staleTime: PRODUCT_STALE_TIME_MS,
      retry: false,
    })),
  });

  const productsById = new Map<string, Product>();
  const missingIds: string[] = [];
  const failedIds: string[] = [];

  uniqueIds.forEach((productId, index) => {
    const result = queries[index];
    if (result.isError) {
      failedIds.push(productId);
    } else if (result.isSuccess && result.data === null) {
      missingIds.push(productId);
    } else if (result.data) {
      productsById.set(productId, result.data);
    }
  });

  return {
    products: uniqueIds
      .map((productId) => productsById.get(productId))
      .filter((product): product is Product => Boolean(product)),
    productsById,
    missingIds,
    failedIds,
    isLoading: queries.some((queryResult) => queryResult.isPending),
    isFetching: queries.some((queryResult) => queryResult.isFetching),
    refetch: () => Promise.all(queries.map((queryResult) => queryResult.refetch())),
  };
}
