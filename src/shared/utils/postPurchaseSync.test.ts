import type { QueryClient } from '@tanstack/react-query';
import { cartKeys } from '@/shared/hooks/useCart';
import { orderKeys } from '@/shared/hooks/useOrders';
import { pointKeys } from '@/shared/hooks/usePoint';
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
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: cartKeys.count('user-1') });
    expect(refetchQueries).toHaveBeenCalledWith({
      queryKey: cartKeys.count('user-1'),
      type: 'active',
    });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: pointKeys.all('user-1') });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: orderKeys.all('user-1') });
    expect(refreshUserCoupons).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ total: 5, succeeded: 4, failed: 1 });
  });

  test('attempts later refreshes when an earlier invalidation rejects', async () => {
    const invalidateQueries = jest.fn(({ queryKey }: { queryKey: readonly unknown[] }) =>
      queryKey === cartKeys.list('user-1')
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
