import type { QueryClient } from '@tanstack/react-query';
import { cartKeys, orderKeys, pointKeys } from '@/shared/hooks/queryKeys';

export interface SettledRefreshSummary {
  total: number;
  succeeded: number;
  failed: number;
}

interface RefreshPostPurchaseStateParams {
  queryClient: QueryClient;
  userId: string;
  refreshUserCoupons: () => Promise<void>;
}

export async function refreshPostPurchaseState({
  queryClient,
  userId,
  refreshUserCoupons,
}: RefreshPostPurchaseStateParams): Promise<SettledRefreshSummary> {
  const results = await Promise.allSettled([
    queryClient.invalidateQueries({ queryKey: cartKeys.list(userId) }),
    queryClient.invalidateQueries({
      queryKey: cartKeys.count(userId),
      refetchType: 'active',
    }),
    queryClient.invalidateQueries({ queryKey: pointKeys.all(userId) }),
    queryClient.invalidateQueries({ queryKey: orderKeys.all(userId) }),
    refreshUserCoupons(),
  ]);
  const failed = results.filter((result) => result.status === 'rejected').length;

  return {
    total: results.length,
    succeeded: results.length - failed,
    failed,
  };
}
