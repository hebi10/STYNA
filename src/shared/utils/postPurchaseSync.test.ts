import type { QueryClient } from '@tanstack/react-query';
import { cartKeys, orderKeys, pointKeys } from '@/shared/hooks/queryKeys';
import { refreshPostPurchaseState } from './postPurchaseSync';

describe('refreshPostPurchaseState', () => {
  test('settles every refresh even when coupon refresh fails', async () => {
    const invalidateQueries = jest.fn().mockResolvedValue(undefined);
    const refetchQueries = jest.fn().mockResolvedValue(undefined);
    const refreshUserCoupons = jest.fn().mockRejectedValue(new Error('coupon unavailable'));

    const result = await refreshPostPurchaseState({
      queryClient: { invalidateQueries, refetchQueries } as unknown as QueryClient,
      userId: 'user-1',
      refreshUserCoupons,
    });

    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: cartKeys.list('user-1') });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: cartKeys.count('user-1'),
      refetchType: 'active',
    });
    expect(refetchQueries).not.toHaveBeenCalled();
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: pointKeys.all('user-1') });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: orderKeys.all('user-1') });
    expect(refreshUserCoupons).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ total: 5, succeeded: 4, failed: 1 });
  });

  test('attempts later refreshes when an earlier invalidation rejects', async () => {
    const invalidateQueries = jest.fn(({ queryKey }: { queryKey: readonly unknown[] }) =>
      JSON.stringify(queryKey) === JSON.stringify(cartKeys.list('user-1'))
        ? Promise.reject(new Error('cart unavailable'))
        : Promise.resolve(),
    );
    const refetchQueries = jest.fn().mockResolvedValue(undefined);
    const refreshUserCoupons = jest.fn().mockResolvedValue(undefined);

    const result = await refreshPostPurchaseState({
      queryClient: { invalidateQueries, refetchQueries } as unknown as QueryClient,
      userId: 'user-1',
      refreshUserCoupons,
    });

    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: orderKeys.all('user-1') });
    expect(refreshUserCoupons).toHaveBeenCalledTimes(1);
    expect(result.failed).toBe(1);
  });
});
