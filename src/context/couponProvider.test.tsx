import { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CouponProvider, useCoupon } from './couponProvider';
import { useAuth } from './authProvider';
import { CouponService } from '@/shared/services/couponService';

jest.mock('./authProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/shared/services/couponService', () => ({
  CouponService: {
    getUserCoupons: jest.fn(),
    getUserCouponStats: jest.fn(),
    getActiveCoupons: jest.fn(),
    getAvailableCouponsForOrder: jest.fn(),
    getDaysUntilExpiry: jest.fn(),
    calculateDiscount: jest.fn(),
  },
}));

const makeCoupon = (
  id: string,
  overrides: Record<string, unknown> = {},
) => ({
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
    ...overrides,
  },
});

function AvailabilityProbe() {
  const { userCoupons, getAvailableCouponsForOrder } = useCoupon();
  const [availableIds, setAvailableIds] = useState<string[]>([]);

  return (
    <div>
      <span data-testid="coupon-count">{userCoupons.length}</span>
      <button
        type="button"
        onClick={async () => {
          const available = await getAvailableCouponsForOrder(12000);
          setAvailableIds(available.map((coupon) => coupon.couponId));
        }}
      >
        사용 가능 확인
      </button>
      <output>{availableIds.join(',')}</output>
    </div>
  );
}

describe('CouponProvider availability', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-07-21T15:00:00.000Z'));
    jest.mocked(useAuth).mockReturnValue({ user: { uid: 'user-1' } } as never);
    jest.mocked(CouponService.getUserCouponStats).mockResolvedValue(null);
    jest.mocked(CouponService.getActiveCoupons).mockResolvedValue([]);
    jest.mocked(CouponService.getAvailableCouponsForOrder)
      .mockRejectedValue(new Error('provider should use loaded coupon state'));
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test('filters loaded coupons with the shared KST availability contract', async () => {
    jest.mocked(CouponService.getUserCoupons).mockResolvedValue([
      makeCoupon('available', { expiryDate: '2026-07-22' }),
      makeCoupon('expired', { expiryDate: '2026-07-21' }),
      makeCoupon('minimum', { expiryDate: '2026-07-22', minOrderAmount: 50000 }),
    ] as never);

    render(
      <CouponProvider>
        <AvailabilityProbe />
      </CouponProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('coupon-count')).toHaveTextContent('3'));
    fireEvent.click(screen.getByRole('button', { name: '사용 가능 확인' }));

    await waitFor(() => expect(screen.getByText('available')).toBeInTheDocument());
    expect(CouponService.getAvailableCouponsForOrder).not.toHaveBeenCalled();
  });
});
