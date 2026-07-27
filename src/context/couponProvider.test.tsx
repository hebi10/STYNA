import { type ReactElement, type ReactNode, useRef, useState } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CouponProvider, useCoupon } from './couponProvider';
import { useAuth } from './authProvider';
import { CouponService } from '@/shared/services/couponService';
import { useAvailableOrderCoupons } from '@/shared/hooks/useAvailableOrderCoupons';
import { couponKeys } from '@/shared/hooks/queryKeys';

jest.mock('./authProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/shared/services/couponService', () => ({
  CouponService: {
    getUserCoupons: jest.fn(),
    getUserCouponOverview: jest.fn(),
    getActiveCoupons: jest.fn(),
    getAvailableCouponsForOrder: jest.fn(),
    redeemCoupon: jest.fn(),
    registerCouponByCode: jest.fn(),
    getDaysUntilExpiry: jest.fn(),
    calculateDiscount: jest.fn(),
  },
}));

let queryClient: QueryClient;

function renderWithQuery(ui: ReactElement) {
  return render(ui, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  });
}

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

function OrderCouponsProbe({ orderAmount }: { orderAmount: number }) {
  const {
    getAvailableCouponsForOrder,
    userCoupons,
  } = useCoupon();
  const couponState = useAvailableOrderCoupons({
    enabled: true,
    orderAmount,
    overviewCoupons: userCoupons,
    loadAvailableCoupons: getAvailableCouponsForOrder,
  });

  return (
    <>
      <output data-testid="order-coupon-ids">
        {couponState.coupons.map((coupon) => coupon.couponId).join(',')}
      </output>
      <output data-testid="order-coupon-error">{couponState.error || ''}</output>
    </>
  );
}

function OrderAmountProbe() {
  const [orderAmount, setOrderAmount] = useState(10000);

  return (
    <div>
      <button type="button" onClick={() => setOrderAmount(50000)}>
        주문 금액 변경
      </button>
      <OrderCouponsProbe orderAmount={orderAmount} />
    </div>
  );
}

function LoaderIdentityProbe() {
  const { getAvailableCouponsForOrder } = useCoupon();
  const previousLoaderRef = useRef(getAvailableCouponsForOrder);
  const changeCountRef = useRef(0);

  if (previousLoaderRef.current !== getAvailableCouponsForOrder) {
    previousLoaderRef.current = getAvailableCouponsForOrder;
    changeCountRef.current += 1;
  }

  return <output data-testid="loader-identity-changes">{changeCountRef.current}</output>;
}

function LoaderCaptureProbe({
  capture,
}: {
  capture: (loader: ReturnType<typeof useCoupon>['getAvailableCouponsForOrder']) => void;
}) {
  const { getAvailableCouponsForOrder } = useCoupon();
  capture(getAvailableCouponsForOrder);
  return null;
}

function RefreshAndActionProbe() {
  const { refreshUserCoupons, useCoupon: redeemCoupon, registerCouponByCode } = useCoupon();
  const [refreshResult, setRefreshResult] = useState('');
  const [redeemResult, setRedeemResult] = useState('');
  const [registerResult, setRegisterResult] = useState('');

  return (
    <div>
      <button type="button" onClick={async () => {
        try {
          await refreshUserCoupons();
          setRefreshResult('resolved');
        } catch {
          setRefreshResult('rejected');
        }
      }}>
        새로고침
      </button>
      <button type="button" onClick={async () => {
        const result = await redeemCoupon('user-coupon-1', 'order-1');
        setRedeemResult(result.success ? 'redeemed' : 'redeem-failed');
      }}>
        쿠폰 사용
      </button>
      <button type="button" onClick={async () => {
        const result = await registerCouponByCode('WELCOME');
        setRegisterResult(result.success ? 'registered' : 'register-failed');
      }}>
        쿠폰 등록
      </button>
      <output data-testid="refresh-result">{refreshResult}</output>
      <output data-testid="redeem-result">{redeemResult}</output>
      <output data-testid="register-result">{registerResult}</output>
    </div>
  );
}

function ContextStateProbe() {
  const context = useCoupon() as ReturnType<typeof useCoupon> & {
    userCouponsReady?: boolean;
  };

  return (
    <div>
      <output data-testid="coupon-ids">
        {context.userCoupons.map((coupon) => coupon.couponId).join(',')}
      </output>
      <output data-testid="coupon-ready">
        {context.userCouponsReady ? 'ready' : 'not-ready'}
      </output>
      <output data-testid="coupon-loading">
        {context.loading ? 'loading' : 'idle'}
      </output>
      <output data-testid="coupon-error">{context.error || ''}</output>
      <output data-testid="coupon-stats">{context.couponStats?.available ?? '-'}</output>
    </div>
  );
}

function FilterAndRefreshProbe() {
  const { getUserCouponsWithFilter, refreshUserCoupons } = useCoupon();

  return (
    <div>
      <button type="button" onClick={() => void getUserCouponsWithFilter({ status: '사용가능' })}>
        필터 조회
      </button>
      <button type="button" onClick={() => void refreshUserCoupons()}>
        overview 새로고침
      </button>
    </div>
  );
}

describe('CouponProvider availability', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-07-21T15:00:00.000Z'));
    jest.mocked(useAuth).mockReturnValue({ user: { uid: 'user-1' } } as never);
    jest.mocked(CouponService.getUserCouponOverview).mockResolvedValue({
      coupons: [],
      stats: { total: 0, available: 0, used: 0, expired: 0 },
      isTruncated: false,
    });
    jest.mocked(CouponService.getActiveCoupons).mockResolvedValue([]);
    jest.mocked(CouponService.getUserCoupons).mockResolvedValue([]);
    jest.mocked(CouponService.getAvailableCouponsForOrder)
      .mockRejectedValue(new Error('provider should use loaded coupon state'));
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 5 * 60 * 1000 },
      },
    });
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test('filters loaded coupons with the shared KST availability contract', async () => {
    jest.mocked(CouponService.getUserCouponOverview).mockResolvedValue({
      coupons: [
        makeCoupon('available', { expiryDate: '2026-07-22' }),
        makeCoupon('expired', { expiryDate: '2026-07-21' }),
        makeCoupon('minimum', { expiryDate: '2026-07-22', minOrderAmount: 50000 }),
      ],
      stats: { total: 3, available: 3, used: 0, expired: 0 },
      isTruncated: false,
    } as never);

    renderWithQuery(
      <CouponProvider>
        <AvailabilityProbe />
      </CouponProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('coupon-count')).toHaveTextContent('3'));
    fireEvent.click(screen.getByRole('button', { name: '사용 가능 확인' }));

    await waitFor(() => expect(screen.getByText('available')).toBeInTheDocument());
    expect(CouponService.getAvailableCouponsForOrder).not.toHaveBeenCalled();
  });

  test('keeps an overview-seeded candidate cache until explicit invalidation', async () => {
    jest.mocked(CouponService.getUserCouponOverview).mockResolvedValue({
      coupons: [makeCoupon('overview-candidate', { expiryDate: '2026-07-22' })],
      stats: { total: 1, available: 1, used: 0, expired: 0 },
      isTruncated: false,
    } as never);

    renderWithQuery(
      <CouponProvider>
        <ContextStateProbe />
      </CouponProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('coupon-ready')).toHaveTextContent('ready'));
    const cachedQuery = queryClient.getQueryCache().find({
      queryKey: couponKeys.availableOrderCandidatesVersion('user-1', 0),
      exact: true,
    });
    const cacheOptions = cachedQuery?.options as {
      gcTime?: number;
      staleTime?: number;
    } | undefined;

    expect(cacheOptions?.staleTime).toBe(Infinity);
    expect(cacheOptions?.gcTime).toBe(Infinity);
  });

  test('removes the active account candidate cache when the provider unmounts', async () => {
    jest.mocked(CouponService.getUserCouponOverview).mockResolvedValue({
      coupons: [makeCoupon('overview-candidate', { expiryDate: '2026-07-22' })],
      stats: { total: 1, available: 1, used: 0, expired: 0 },
      isTruncated: false,
    } as never);

    const { unmount } = renderWithQuery(
      <CouponProvider>
        <ContextStateProbe />
      </CouponProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('coupon-ready')).toHaveTextContent('ready'));
    expect(queryClient.getQueryData(
      couponKeys.availableOrderCandidatesVersion('user-1', 0),
    )).toBeDefined();

    unmount();

    expect(queryClient.getQueryData(
      couponKeys.availableOrderCandidatesVersion('user-1', 0),
    )).toBeUndefined();
  });

  test('loads the full available set for checkout when the overview is truncated', async () => {
    jest.mocked(CouponService.getUserCouponOverview).mockResolvedValue({
      coupons: [makeCoupon('recent', { expiryDate: '2026-07-22' })],
      stats: { total: 75, available: 60, used: 10, expired: 5 },
      isTruncated: true,
    } as never);
    jest.mocked(CouponService.getUserCoupons).mockResolvedValue([
      makeCoupon('older-available', { expiryDate: '2026-07-22' }),
    ] as never);

    renderWithQuery(
      <CouponProvider>
        <AvailabilityProbe />
      </CouponProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('coupon-count')).toHaveTextContent('1'));
    fireEvent.click(screen.getByRole('button', { name: '사용 가능 확인' }));

    await waitFor(() => expect(screen.getByText('older-available')).toBeInTheDocument());
    expect(CouponService.getUserCoupons).toHaveBeenCalledWith(
      'user-1',
      { status: '사용가능' },
      Number.MAX_SAFE_INTEGER,
    );
  });

  test('reuses one full candidate load when only the order amount changes', async () => {
    jest.mocked(CouponService.getUserCouponOverview).mockResolvedValue({
      coupons: [makeCoupon('recent', { expiryDate: '2026-07-22' })],
      stats: { total: 75, available: 60, used: 10, expired: 5 },
      isTruncated: true,
    } as never);
    jest.mocked(CouponService.getUserCoupons).mockResolvedValue([
      makeCoupon('always', { expiryDate: '2026-07-22' }),
      makeCoupon('high-minimum', { expiryDate: '2026-07-22', minOrderAmount: 30000 }),
    ] as never);

    renderWithQuery(
      <CouponProvider>
        <OrderAmountProbe />
      </CouponProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('order-coupon-ids')).toHaveTextContent('always'));
    expect(screen.getByTestId('order-coupon-ids')).not.toHaveTextContent('high-minimum');

    fireEvent.click(screen.getByRole('button', { name: '주문 금액 변경' }));

    await waitFor(() => expect(screen.getByTestId('order-coupon-ids')).toHaveTextContent('high-minimum'));
    expect(CouponService.getUserCoupons).toHaveBeenCalledTimes(1);
  });

  test('does not reload full candidates when a late overview changes provider state', async () => {
    const initialOverview = createDeferred<{
      coupons: ReturnType<typeof makeCoupon>[];
      stats: { total: number; available: number; used: number; expired: number };
      isTruncated: boolean;
    }>();
    jest.mocked(CouponService.getUserCouponOverview).mockReturnValue(initialOverview.promise as never);
    jest.mocked(CouponService.getUserCoupons).mockResolvedValue([
      makeCoupon('loaded-before-overview', { expiryDate: '2026-07-22' }),
    ] as never);

    renderWithQuery(
      <CouponProvider>
        <OrderCouponsProbe orderAmount={12000} />
      </CouponProvider>,
    );

    await waitFor(() => expect(CouponService.getUserCoupons).toHaveBeenCalledTimes(1));

    await act(async () => {
      initialOverview.resolve({
        coupons: [makeCoupon('overview', { expiryDate: '2026-07-22' })],
        stats: { total: 75, available: 60, used: 10, expired: 5 },
        isTruncated: true,
      });
      await initialOverview.promise;
    });

    await waitFor(() => expect(screen.getByTestId('order-coupon-ids')).toHaveTextContent('loaded-before-overview'));
    expect(CouponService.getUserCoupons).toHaveBeenCalledTimes(1);
  });

  test('does not let a late complete overview overwrite a completed full-candidate query', async () => {
    const initialOverview = createDeferred<{
      coupons: ReturnType<typeof makeCoupon>[];
      stats: { total: number; available: number; used: number; expired: number };
      isTruncated: boolean;
    }>();
    const fullCandidates = createDeferred<ReturnType<typeof makeCoupon>[]>();
    jest.mocked(CouponService.getUserCouponOverview).mockReturnValue(initialOverview.promise as never);
    jest.mocked(CouponService.getUserCoupons).mockReturnValue(fullCandidates.promise as never);

    renderWithQuery(
      <CouponProvider>
        <OrderCouponsProbe orderAmount={12000} />
      </CouponProvider>,
    );
    await waitFor(() => expect(CouponService.getUserCoupons).toHaveBeenCalledTimes(1));

    await act(async () => {
      fullCandidates.resolve([makeCoupon('newer-full-candidate', { expiryDate: '2026-07-22' })]);
      await fullCandidates.promise;
    });
    await waitFor(() => expect(screen.getByTestId('order-coupon-ids')).toHaveTextContent('newer-full-candidate'));

    await act(async () => {
      initialOverview.resolve({
        coupons: [makeCoupon('older-overview-candidate', { expiryDate: '2026-07-22' })],
        stats: { total: 1, available: 1, used: 0, expired: 0 },
        isTruncated: false,
      });
      await initialOverview.promise;
    });

    expect(queryClient.getQueryData<ReturnType<typeof makeCoupon>[]>(
      couponKeys.availableOrderCandidatesVersion('user-1', 0),
    )?.map((coupon) => coupon.couponId)).toEqual(['newer-full-candidate']);
  });

  test('keeps the order-coupon loader identity stable across overview state updates', async () => {
    const initialOverview = createDeferred<{
      coupons: ReturnType<typeof makeCoupon>[];
      stats: { total: number; available: number; used: number; expired: number };
      isTruncated: boolean;
    }>();
    jest.mocked(CouponService.getUserCouponOverview).mockReturnValue(initialOverview.promise as never);

    renderWithQuery(
      <CouponProvider>
        <LoaderIdentityProbe />
      </CouponProvider>,
    );
    expect(screen.getByTestId('loader-identity-changes')).toHaveTextContent('0');

    await act(async () => {
      initialOverview.resolve({
        coupons: [makeCoupon('overview', { expiryDate: '2026-07-22' })],
        stats: { total: 75, available: 60, used: 10, expired: 5 },
        isTruncated: true,
      });
      await initialOverview.promise;
    });

    expect(screen.getByTestId('loader-identity-changes')).toHaveTextContent('0');
  });

  test('coalesces concurrent full candidate loads for the same user', async () => {
    const candidates = createDeferred<ReturnType<typeof makeCoupon>[]>();
    jest.mocked(CouponService.getUserCouponOverview).mockResolvedValue({
      coupons: [makeCoupon('recent', { expiryDate: '2026-07-22' })],
      stats: { total: 75, available: 60, used: 10, expired: 5 },
      isTruncated: true,
    } as never);
    jest.mocked(CouponService.getUserCoupons).mockReturnValue(candidates.promise as never);

    renderWithQuery(
      <CouponProvider>
        <OrderCouponsProbe orderAmount={12000} />
        <OrderCouponsProbe orderAmount={24000} />
      </CouponProvider>,
    );

    await waitFor(() => expect(CouponService.getUserCoupons).toHaveBeenCalled());
    await act(async () => {
      candidates.resolve([makeCoupon('shared', { expiryDate: '2026-07-22' })]);
      await candidates.promise;
    });

    expect(CouponService.getUserCoupons).toHaveBeenCalledTimes(1);
  });

  test('invalidates cached candidates even when an explicit overview refresh fails', async () => {
    jest.mocked(CouponService.getUserCouponOverview)
      .mockResolvedValueOnce({
        coupons: [makeCoupon('recent', { expiryDate: '2026-07-22' })],
        stats: { total: 75, available: 60, used: 10, expired: 5 },
        isTruncated: true,
      } as never)
      .mockRejectedValueOnce(new Error('refresh failed'));
    jest.mocked(CouponService.getUserCoupons)
      .mockResolvedValueOnce([makeCoupon('before-refresh', { expiryDate: '2026-07-22' })] as never)
      .mockResolvedValueOnce([makeCoupon('after-refresh', { expiryDate: '2026-07-22' })] as never);

    renderWithQuery(
      <CouponProvider>
        <OrderCouponsProbe orderAmount={12000} />
        <RefreshAndActionProbe />
      </CouponProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('order-coupon-ids')).toHaveTextContent('before-refresh'));
    fireEvent.click(screen.getByRole('button', { name: '새로고침' }));

    await waitFor(() => expect(screen.getByTestId('refresh-result')).toHaveTextContent('rejected'));
    await waitFor(() => expect(screen.getByTestId('order-coupon-ids')).toHaveTextContent('after-refresh'));
    expect(screen.getByTestId('order-coupon-ids')).not.toHaveTextContent('recent');
    expect(screen.getByTestId('order-coupon-ids')).not.toHaveTextContent('before-refresh');
    expect(CouponService.getUserCoupons).toHaveBeenCalledTimes(2);
  });

  test('does not revive a stale overview when refresh and replacement candidate loads fail', async () => {
    jest.mocked(CouponService.getUserCouponOverview)
      .mockResolvedValueOnce({
        coupons: [makeCoupon('stale-overview', { expiryDate: '2026-07-22' })],
        stats: { total: 75, available: 60, used: 10, expired: 5 },
        isTruncated: true,
      } as never)
      .mockRejectedValueOnce(new Error('refresh failed'));
    jest.mocked(CouponService.getUserCoupons)
      .mockResolvedValueOnce([makeCoupon('before-refresh', { expiryDate: '2026-07-22' })] as never)
      .mockRejectedValueOnce(new Error('candidate load failed'));

    renderWithQuery(
      <CouponProvider>
        <OrderCouponsProbe orderAmount={12000} />
        <RefreshAndActionProbe />
      </CouponProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('order-coupon-ids')).toHaveTextContent('before-refresh'));

    fireEvent.click(screen.getByRole('button', { name: '새로고침' }));

    await waitFor(() => expect(screen.getByTestId('refresh-result')).toHaveTextContent('rejected'));
    await waitFor(() => expect(screen.getByTestId('order-coupon-error')).toHaveTextContent('candidate load failed'));
    expect(screen.getByTestId('order-coupon-ids')).toBeEmptyDOMElement();
  });

  test('loads the full available set when checkout asks before the overview is ready', async () => {
    const initialOverview = createDeferred<{
      coupons: ReturnType<typeof makeCoupon>[];
      stats: { total: number; available: number; used: number; expired: number };
      isTruncated: boolean;
    }>();
    jest.mocked(CouponService.getUserCouponOverview).mockReturnValue(initialOverview.promise as never);
    jest.mocked(CouponService.getUserCoupons).mockResolvedValue([
      makeCoupon('available-before-overview', { expiryDate: '2026-07-22' }),
    ] as never);

    renderWithQuery(
      <CouponProvider>
        <AvailabilityProbe />
      </CouponProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: '사용 가능 확인' }));

    await waitFor(() => expect(screen.getByText('available-before-overview')).toBeInTheDocument());
    expect(CouponService.getUserCoupons).toHaveBeenCalledWith(
      'user-1',
      { status: '사용가능' },
      Number.MAX_SAFE_INTEGER,
    );
  });

  test('keeps complete overview candidates after a page filter replaces the visible list', async () => {
    jest.mocked(CouponService.getUserCouponOverview).mockResolvedValue({
      coupons: [makeCoupon('overview')],
      stats: { total: 2, available: 1, used: 1, expired: 0 },
      isTruncated: false,
    } as never);
    jest.mocked(CouponService.getUserCoupons)
      .mockResolvedValueOnce([{ ...makeCoupon('filtered'), status: '사용완료' }] as never);

    renderWithQuery(
      <CouponProvider>
        <ContextStateProbe />
        <FilterAndRefreshProbe />
        <AvailabilityProbe />
      </CouponProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('coupon-ready')).toHaveTextContent('ready'));

    fireEvent.click(screen.getByRole('button', { name: '필터 조회' }));
    await waitFor(() => expect(screen.getByTestId('coupon-ids')).toHaveTextContent('filtered'));
    fireEvent.click(screen.getByRole('button', { name: '사용 가능 확인' }));

    await waitFor(() => expect(screen.getByText('overview')).toBeInTheDocument());
    expect(CouponService.getUserCoupons).toHaveBeenCalledTimes(1);
    expect(CouponService.getUserCoupons).toHaveBeenLastCalledWith(
      'user-1',
      { status: '사용가능' },
    );
  });

  test('rejects refreshUserCoupons when a coupon refresh fails', async () => {
    renderWithQuery(<CouponProvider><RefreshAndActionProbe /></CouponProvider>);

    await waitFor(() => expect(CouponService.getUserCouponOverview).toHaveBeenCalled());
    jest.mocked(CouponService.getUserCouponOverview).mockRejectedValueOnce(new Error('refresh failed'));
    fireEvent.click(screen.getByRole('button', { name: '새로고침' }));

    await waitFor(() => expect(screen.getByTestId('refresh-result')).toHaveTextContent('rejected'));
  });

  test('keeps a successful coupon redemption successful when only its refresh fails', async () => {
    jest.mocked(CouponService.redeemCoupon).mockResolvedValue({ success: true, message: '사용 완료' });
    renderWithQuery(<CouponProvider><RefreshAndActionProbe /></CouponProvider>);

    await waitFor(() => expect(CouponService.getUserCouponOverview).toHaveBeenCalled());
    jest.mocked(CouponService.getUserCouponOverview).mockRejectedValueOnce(new Error('refresh failed'));
    fireEvent.click(screen.getByRole('button', { name: '쿠폰 사용' }));

    await waitFor(() => expect(screen.getByTestId('redeem-result')).toHaveTextContent('redeemed'));
  });

  test('keeps a successful coupon registration successful when only its refresh fails', async () => {
    jest.mocked(CouponService.registerCouponByCode).mockResolvedValue({ success: true, message: '등록 완료' });
    renderWithQuery(<CouponProvider><RefreshAndActionProbe /></CouponProvider>);

    await waitFor(() => expect(CouponService.getUserCouponOverview).toHaveBeenCalled());
    jest.mocked(CouponService.getUserCouponOverview).mockRejectedValueOnce(new Error('refresh failed'));
    fireEvent.click(screen.getByRole('button', { name: '쿠폰 등록' }));

    await waitFor(() => expect(screen.getByTestId('register-result')).toHaveTextContent('registered'));
  });

  test('keeps the current account coupons when the previous account request resolves late', async () => {
    const firstAccountOverview = createDeferred<{
      coupons: ReturnType<typeof makeCoupon>[];
      stats: { total: number; available: number; used: number; expired: number };
      isTruncated: boolean;
    }>();
    let currentUserId = 'user-1';
    jest.mocked(useAuth).mockImplementation(() => ({
      user: { uid: currentUserId },
    } as never));
    jest.mocked(CouponService.getUserCouponOverview).mockImplementation((userId) => {
      if (userId === 'user-1') {
        return firstAccountOverview.promise as never;
      }
      return Promise.resolve({
        coupons: [makeCoupon('new-account')],
        stats: { total: 1, available: 1, used: 0, expired: 0 },
        isTruncated: false,
      }) as never;
    });

    const { rerender } = renderWithQuery(
      <CouponProvider>
        <ContextStateProbe />
      </CouponProvider>,
    );
    await waitFor(() => expect(CouponService.getUserCouponOverview).toHaveBeenCalledWith('user-1'));

    currentUserId = 'user-2';
    rerender(
      <CouponProvider>
        <ContextStateProbe />
      </CouponProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('coupon-ids')).toHaveTextContent('new-account'));
    expect(screen.getByTestId('coupon-ready')).toHaveTextContent('ready');

    await act(async () => {
      firstAccountOverview.resolve({
        coupons: [makeCoupon('old-account')],
        stats: { total: 1, available: 1, used: 0, expired: 0 },
        isTruncated: false,
      });
      await firstAccountOverview.promise;
    });

    expect(screen.getByTestId('coupon-ids')).toHaveTextContent('new-account');
    expect(screen.getByTestId('coupon-ids')).not.toHaveTextContent('old-account');
    expect(screen.getByTestId('coupon-ready')).toHaveTextContent('ready');
  });

  test('rejects a cached fast-path result from a loader captured for a previous account', async () => {
    let currentUserId = 'user-1';
    let previousAccountLoader: ReturnType<typeof useCoupon>['getAvailableCouponsForOrder'] | null = null;
    jest.mocked(useAuth).mockImplementation(() => ({
      user: { uid: currentUserId },
    } as never));
    jest.mocked(CouponService.getUserCouponOverview).mockImplementation((userId) => Promise.resolve({
      coupons: [makeCoupon(`${userId}-overview`, { expiryDate: '2026-07-22' })],
      stats: { total: 1, available: 1, used: 0, expired: 0 },
      isTruncated: false,
    }) as never);

    const { rerender } = renderWithQuery(
      <CouponProvider>
        <ContextStateProbe />
        <LoaderCaptureProbe capture={(loader) => {
          previousAccountLoader ??= loader;
        }} />
      </CouponProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('coupon-ready')).toHaveTextContent('ready'));

    currentUserId = 'user-2';
    rerender(
      <CouponProvider>
        <ContextStateProbe />
        <LoaderCaptureProbe capture={() => undefined} />
      </CouponProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('coupon-ids')).toHaveTextContent('user-2-overview'));
    queryClient.setQueryData(
      couponKeys.availableOrderCandidatesVersion('user-1', 0),
      [makeCoupon('previous-account-secret', { expiryDate: '2026-07-22' })],
    );

    const staleResult = await previousAccountLoader!(12000);

    expect(staleResult).toEqual([]);
  });

  test('drops cached candidates on logout before the same account signs in again', async () => {
    let currentUserId: string | null = 'user-1';
    jest.mocked(useAuth).mockImplementation(() => ({
      user: currentUserId ? { uid: currentUserId } : null,
    } as never));
    jest.mocked(CouponService.getUserCouponOverview).mockResolvedValue({
      coupons: [makeCoupon('recent', { expiryDate: '2026-07-22' })],
      stats: { total: 75, available: 60, used: 10, expired: 5 },
      isTruncated: true,
    } as never);
    jest.mocked(CouponService.getUserCoupons)
      .mockResolvedValueOnce([makeCoupon('before-logout', { expiryDate: '2026-07-22' })] as never)
      .mockResolvedValueOnce([makeCoupon('after-login', { expiryDate: '2026-07-22' })] as never);

    const { rerender } = renderWithQuery(
      <CouponProvider>
        <OrderCouponsProbe orderAmount={12000} />
      </CouponProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('order-coupon-ids')).toHaveTextContent('before-logout'));

    currentUserId = null;
    rerender(
      <CouponProvider>
        <OrderCouponsProbe orderAmount={12000} />
      </CouponProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('order-coupon-ids')).toBeEmptyDOMElement());

    currentUserId = 'user-1';
    rerender(
      <CouponProvider>
        <OrderCouponsProbe orderAmount={12000} />
      </CouponProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('order-coupon-ids')).toHaveTextContent('after-login'));
    expect(screen.getByTestId('order-coupon-ids')).not.toHaveTextContent('before-logout');
    expect(CouponService.getUserCoupons).toHaveBeenCalledTimes(2);
  });

  test('keeps the newest refresh result when an older request for the same account resolves late', async () => {
    const staleRefresh = createDeferred<{
      coupons: ReturnType<typeof makeCoupon>[];
      stats: { total: number; available: number; used: number; expired: number };
      isTruncated: boolean;
    }>();
    jest.mocked(CouponService.getUserCouponOverview)
      .mockResolvedValueOnce({
        coupons: [makeCoupon('initial')],
        stats: { total: 1, available: 1, used: 0, expired: 0 },
        isTruncated: false,
      } as never)
      .mockReturnValueOnce(staleRefresh.promise as never)
      .mockResolvedValueOnce({
        coupons: [makeCoupon('newest')],
        stats: { total: 1, available: 1, used: 0, expired: 0 },
        isTruncated: false,
      } as never);

    renderWithQuery(
      <CouponProvider>
        <ContextStateProbe />
        <RefreshAndActionProbe />
      </CouponProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('coupon-ids')).toHaveTextContent('initial'));

    fireEvent.click(screen.getByRole('button', { name: '새로고침' }));
    await waitFor(() => expect(CouponService.getUserCouponOverview).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByRole('button', { name: '새로고침' }));
    await waitFor(() => expect(screen.getByTestId('coupon-ids')).toHaveTextContent('newest'));

    await act(async () => {
      staleRefresh.resolve({
        coupons: [makeCoupon('stale')],
        stats: { total: 1, available: 1, used: 0, expired: 0 },
        isTruncated: false,
      });
      await staleRefresh.promise;
    });

    expect(screen.getByTestId('coupon-ids')).toHaveTextContent('newest');
    expect(screen.getByTestId('coupon-ids')).not.toHaveTextContent('stale');
    expect(screen.getByTestId('coupon-loading')).toHaveTextContent('idle');
  });

  test('applies initial overview stats and readiness without overwriting a newer filtered list', async () => {
    const initialOverview = createDeferred<{
      coupons: ReturnType<typeof makeCoupon>[];
      stats: { total: number; available: number; used: number; expired: number };
      isTruncated: boolean;
    }>();
    jest.mocked(CouponService.getUserCouponOverview).mockReturnValue(initialOverview.promise as never);
    jest.mocked(CouponService.getUserCoupons).mockResolvedValue([makeCoupon('filtered')] as never);

    renderWithQuery(
      <CouponProvider>
        <ContextStateProbe />
        <FilterAndRefreshProbe />
      </CouponProvider>,
    );
    await waitFor(() => expect(CouponService.getUserCouponOverview).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole('button', { name: '필터 조회' }));
    await waitFor(() => expect(CouponService.getUserCoupons).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId('coupon-ready')).toHaveTextContent('not-ready');

    await act(async () => {
      initialOverview.resolve({
        coupons: [makeCoupon('overview')],
        stats: { total: 2, available: 1, used: 1, expired: 0 },
        isTruncated: true,
      });
      await initialOverview.promise;
    });

    expect(screen.getByTestId('coupon-ready')).toHaveTextContent('ready');
    expect(screen.getByTestId('coupon-stats')).toHaveTextContent('1');
    expect(screen.getByTestId('coupon-ids')).toHaveTextContent('filtered');
    expect(screen.getByTestId('coupon-ids')).not.toHaveTextContent('overview');
  });

  test('keeps loading true until overlapping overview and filter requests both settle', async () => {
    const overviewRefresh = createDeferred<{
      coupons: ReturnType<typeof makeCoupon>[];
      stats: { total: number; available: number; used: number; expired: number };
      isTruncated: boolean;
    }>();
    const filteredLoad = createDeferred<ReturnType<typeof makeCoupon>[]>();
    jest.mocked(CouponService.getUserCouponOverview)
      .mockResolvedValueOnce({
        coupons: [makeCoupon('initial')],
        stats: { total: 1, available: 1, used: 0, expired: 0 },
        isTruncated: false,
      } as never)
      .mockReturnValueOnce(overviewRefresh.promise as never);
    jest.mocked(CouponService.getUserCoupons).mockReturnValueOnce(filteredLoad.promise as never);

    renderWithQuery(
      <CouponProvider>
        <ContextStateProbe />
        <FilterAndRefreshProbe />
      </CouponProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('coupon-ready')).toHaveTextContent('ready'));

    fireEvent.click(screen.getByRole('button', { name: 'overview 새로고침' }));
    fireEvent.click(screen.getByRole('button', { name: '필터 조회' }));
    await waitFor(() => expect(screen.getByTestId('coupon-loading')).toHaveTextContent('loading'));

    await act(async () => {
      filteredLoad.resolve([makeCoupon('filtered')]);
      await filteredLoad.promise;
    });
    expect(screen.getByTestId('coupon-loading')).toHaveTextContent('loading');

    await act(async () => {
      overviewRefresh.resolve({
        coupons: [makeCoupon('overview')],
        stats: { total: 2, available: 2, used: 0, expired: 0 },
        isTruncated: false,
      });
      await overviewRefresh.promise;
    });
    expect(screen.getByTestId('coupon-loading')).toHaveTextContent('idle');
    expect(screen.getByTestId('coupon-ids')).toHaveTextContent('filtered');
    expect(screen.getByTestId('coupon-stats')).toHaveTextContent('2');
  });

  test('lets a newer overview invalidate an older filtered-list request', async () => {
    const staleFilteredLoad = createDeferred<ReturnType<typeof makeCoupon>[]>();
    jest.mocked(CouponService.getUserCouponOverview)
      .mockResolvedValueOnce({
        coupons: [makeCoupon('initial')],
        stats: { total: 1, available: 1, used: 0, expired: 0 },
        isTruncated: false,
      } as never)
      .mockResolvedValueOnce({
        coupons: [makeCoupon('refreshed')],
        stats: { total: 2, available: 2, used: 0, expired: 0 },
        isTruncated: false,
      } as never);
    jest.mocked(CouponService.getUserCoupons).mockReturnValueOnce(staleFilteredLoad.promise as never);

    renderWithQuery(
      <CouponProvider>
        <ContextStateProbe />
        <FilterAndRefreshProbe />
      </CouponProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('coupon-ids')).toHaveTextContent('initial'));

    fireEvent.click(screen.getByRole('button', { name: '필터 조회' }));
    await waitFor(() => expect(CouponService.getUserCoupons).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: 'overview 새로고침' }));
    await waitFor(() => expect(screen.getByTestId('coupon-ids')).toHaveTextContent('refreshed'));

    await act(async () => {
      staleFilteredLoad.resolve([makeCoupon('stale-filter')]);
      await staleFilteredLoad.promise;
    });

    expect(screen.getByTestId('coupon-ids')).toHaveTextContent('refreshed');
    expect(screen.getByTestId('coupon-ids')).not.toHaveTextContent('stale-filter');
  });

  test('reports an initial coupon-list failure instead of treating an empty fallback as ready', async () => {
    jest.mocked(CouponService.getUserCouponOverview).mockRejectedValue(new Error('coupon list failed'));

    renderWithQuery(
      <CouponProvider>
        <ContextStateProbe />
      </CouponProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('coupon-error')).toHaveTextContent('coupon list failed'));
    expect(screen.getByTestId('coupon-ready')).toHaveTextContent('not-ready');
    expect(screen.getByTestId('coupon-loading')).toHaveTextContent('idle');
  });

  test('publishes coupon statistics from the same overview result', async () => {
    jest.mocked(CouponService.getUserCouponOverview).mockResolvedValue({
      coupons: [makeCoupon('available')],
      stats: { total: 2, available: 1, used: 1, expired: 0 },
      isTruncated: false,
    } as never);

    renderWithQuery(
      <CouponProvider>
        <ContextStateProbe />
      </CouponProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('coupon-stats')).toHaveTextContent('1'));
    expect(screen.getByTestId('coupon-ready')).toHaveTextContent('ready');
    expect(screen.getByTestId('coupon-loading')).toHaveTextContent('idle');
  });
});

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, resolve, reject };
}
