'use client';

import { useQuery } from '@tanstack/react-query';
import { OrderService } from '@/shared/services/orderService';
import { orderKeys } from './queryKeys';

export { orderKeys } from './queryKeys';

export function useOrders(userId: string | null, limit: number = 50) {
  return useQuery({
    queryKey: orderKeys.list(userId || '', limit),
    queryFn: () => OrderService.getUserOrders(userId!, limit),
    enabled: Boolean(userId),
  });
}

export function useOrderCount(userId: string | null) {
  return useQuery({
    queryKey: orderKeys.count(userId || ''),
    queryFn: () => OrderService.getUserOrderCount(userId!),
    enabled: Boolean(userId),
  });
}
