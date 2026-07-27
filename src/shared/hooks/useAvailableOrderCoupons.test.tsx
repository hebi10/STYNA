import { act, render, screen, waitFor } from '@testing-library/react';
import { useAvailableOrderCoupons } from './useAvailableOrderCoupons';
import type { UserCouponView } from '@/shared/types/coupon';

interface HookProbeProps {
  loadAvailableCoupons: (orderAmount: number) => Promise<UserCouponView[]>;
  snapshots: Array<{
    couponIds: string[];
    loading: boolean;
    ready: boolean;
  }>;
}

function HookProbe({ loadAvailableCoupons, snapshots }: HookProbeProps) {
  const state = useAvailableOrderCoupons({
    enabled: true,
    orderAmount: 12000,
    overviewCoupons: [],
    loadAvailableCoupons,
  });
  const couponIds = state.coupons.map((coupon) => coupon.couponId);
  snapshots.push({ couponIds, loading: state.loading, ready: state.ready });

  return <output data-testid="coupon-ids">{couponIds.join(',')}</output>;
}

describe('useAvailableOrderCoupons result ownership', () => {
  test('does not expose the previous loader result during an account-scope render', async () => {
    const snapshots: HookProbeProps['snapshots'] = [];
    const nextLoad = createDeferred<UserCouponView[]>();
    const firstLoader = jest.fn().mockResolvedValue([makeCoupon('previous-account')]);
    const nextLoader = jest.fn().mockReturnValue(nextLoad.promise);

    const { rerender } = render(
      <HookProbe loadAvailableCoupons={firstLoader} snapshots={snapshots} />,
    );
    await waitFor(() => expect(screen.getByTestId('coupon-ids')).toHaveTextContent('previous-account'));
    snapshots.length = 0;

    rerender(<HookProbe loadAvailableCoupons={nextLoader} snapshots={snapshots} />);

    expect(snapshots[0]).toEqual({
      couponIds: [],
      loading: true,
      ready: false,
    });

    await act(async () => {
      nextLoad.resolve([makeCoupon('next-account')]);
      await nextLoad.promise;
    });
    await waitFor(() => expect(screen.getByTestId('coupon-ids')).toHaveTextContent('next-account'));
  });
});

function makeCoupon(id: string): UserCouponView {
  return {
    id: `user-${id}`,
    uid: 'user-1',
    couponId: id,
    status: '사용가능',
    issuedDate: '2026-07-01',
    createdAt: new Date('2026-07-01T00:00:00.000Z'),
    updatedAt: new Date('2026-07-01T00:00:00.000Z'),
    coupon: {
      id,
      name: id,
      type: '할인금액',
      value: 1000,
      minOrderAmount: 0,
      expiryDate: '2026-07-31',
      description: '',
      isActive: true,
      isDirectAssign: false,
      usageLimit: 100,
      usedCount: 0,
      createdAt: new Date('2026-07-01T00:00:00.000Z'),
      updatedAt: new Date('2026-07-01T00:00:00.000Z'),
    },
  };
}

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
}
