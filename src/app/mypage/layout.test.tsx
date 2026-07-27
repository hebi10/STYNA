import { render, screen } from '@testing-library/react';
import MyPageLayout from './layout';
import { useAuth } from '@/context/authProvider';
import { useCoupon } from '@/context/couponProvider';
import { useOrderCount } from '@/shared/hooks/useOrders';

let mockPathname = '/mypage';

jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}));

jest.mock('@/context/authProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/context/couponProvider', () => ({
  useCoupon: jest.fn(),
  CouponProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="nested-coupon-provider">{children}</div>
  ),
}));

jest.mock('@/context/userActivityProvider', () => ({
  UserActivityProvider: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('@/shared/hooks/useOrders', () => ({
  useOrderCount: jest.fn(),
}));

jest.mock('../_components/PageHeader', () => ({
  __esModule: true,
  default: ({ title }: { title: string }) => <header>{title}</header>,
}));

jest.mock('./_components', () => ({
  ProfileSection: ({ userInfo }: {
    userInfo: { orders: number | null | 'error'; coupons: number | null | 'error' };
  }) => (
    <section data-testid="profile-section">
      <span>총 주문 {userInfo.orders === 'error' ? '확인 실패' : userInfo.orders ?? '-'}</span>
      <span>쿠폰 {userInfo.coupons === 'error' ? '확인 실패' : userInfo.coupons ?? '-'}</span>
    </section>
  ),
  QuickActions: () => <nav data-testid="quick-actions" />,
  SidebarMenu: () => <aside data-testid="sidebar-menu" />,
}));

jest.mock('./layout.module.css', () => ({
  __esModule: true,
  default: new Proxy({}, {
    get: (_target, property) => String(property),
  }),
}));

describe('MyPageLayout loading behavior', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPathname = '/mypage';
    window.scrollTo = jest.fn();
    jest.mocked(useOrderCount).mockReturnValue({ data: 0, isLoading: false, isError: false } as never);
    jest.mocked(useCoupon).mockReturnValue({
      couponStats: { total: 0, available: 0, used: 0, expired: 0 },
      userCouponsReady: true,
      loading: false,
    } as never);
  });

  test('shows a mypage skeleton while signed-in user data is preparing', () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: { uid: 'user-1' },
      userData: null,
      isUserDataLoading: true,
      loading: false,
      logout: jest.fn(),
    });

    render(<MyPageLayout>마이페이지 본문</MyPageLayout>);

    expect(screen.getByRole('status')).toHaveTextContent('마이페이지 준비 중');
    expect(screen.queryByText('마이페이지 본문')).not.toBeInTheDocument();
  });

  test('shows only the login prompt when no user is signed in', () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: null,
      userData: null,
      isUserDataLoading: false,
      loading: false,
      logout: jest.fn(),
    });

    render(<MyPageLayout>마이페이지 본문</MyPageLayout>);

    expect(screen.getByText('로그인이 필요합니다')).toBeInTheDocument();
    expect(screen.queryByTestId('profile-section')).not.toBeInTheDocument();
    expect(screen.queryByTestId('quick-actions')).not.toBeInTheDocument();
    expect(screen.queryByText('마이페이지 본문')).not.toBeInTheDocument();
  });

  test('owns the coupon provider at the mypage route boundary', () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: { uid: 'user-1' },
      userData: { name: '홍길동', email: 'user@example.com' },
      isUserDataLoading: false,
      loading: false,
      logout: jest.fn(),
    });

    render(<MyPageLayout>마이페이지 본문</MyPageLayout>);

    expect(screen.getAllByTestId('nested-coupon-provider')).toHaveLength(1);
    expect(screen.getByText('마이페이지 본문')).toBeInTheDocument();
  });

  test('shows profile and quick actions only on the mypage overview', () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: { uid: 'user-1' },
      userData: { name: '홍길동', email: 'user@example.com' },
      isUserDataLoading: false,
      loading: false,
      logout: jest.fn(),
    });

    const { rerender } = render(<MyPageLayout>마이페이지 본문</MyPageLayout>);

    expect(screen.getByTestId('profile-section')).toBeInTheDocument();
    expect(screen.getByTestId('quick-actions')).toBeInTheDocument();

    mockPathname = '/mypage/order-list';
    rerender(<MyPageLayout>주문내역 본문</MyPageLayout>);

    expect(screen.queryByTestId('profile-section')).not.toBeInTheDocument();
    expect(screen.queryByTestId('quick-actions')).not.toBeInTheDocument();
    expect(screen.getByText('주문내역 본문')).toBeInTheDocument();
  });

  test('passes query-backed order and coupon counts to the profile', () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: { uid: 'user-1' },
      userData: {
        name: '홍길동',
        email: 'user@example.com',
        orders: 99,
        coupons: 99,
      },
      isUserDataLoading: false,
      loading: false,
      logout: jest.fn(),
    });
    jest.mocked(useOrderCount).mockReturnValue({
      data: 2,
      isLoading: false,
      isError: false,
    } as never);
    jest.mocked(useCoupon).mockReturnValue({
      couponStats: { total: 4, available: 3, used: 1, expired: 0 },
      userCouponsReady: true,
      loading: false,
    } as never);

    render(<MyPageLayout>마이페이지 본문</MyPageLayout>);

    expect(screen.getByTestId('profile-section')).toHaveTextContent('총 주문 2');
    expect(screen.getByTestId('profile-section')).toHaveTextContent('쿠폰 3');
    expect(useOrderCount).toHaveBeenCalledWith('user-1');
  });

  test('keeps the mypage usable while count-backed profile values are loading', () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: { uid: 'user-1' },
      userData: { name: '홍길동', email: 'user@example.com' },
      isUserDataLoading: false,
      loading: false,
      logout: jest.fn(),
    });
    jest.mocked(useOrderCount).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    } as never);

    render(<MyPageLayout>마이페이지 본문</MyPageLayout>);

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByTestId('profile-section')).toHaveTextContent('총 주문 -');
    expect(screen.getByText('마이페이지 본문')).toBeInTheDocument();
  });

  test('does not present failed counts as zero or as an endless loading state', () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: { uid: 'user-1' },
      userData: { name: '홍길동', email: 'user@example.com' },
      isUserDataLoading: false,
      loading: false,
      logout: jest.fn(),
    });
    jest.mocked(useOrderCount).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    } as never);
    jest.mocked(useCoupon).mockReturnValue({
      couponStats: null,
      userCouponsReady: false,
      loading: false,
      error: 'coupon stats failed',
    } as never);

    render(<MyPageLayout>마이페이지 본문</MyPageLayout>);

    expect(screen.getByTestId('profile-section')).toHaveTextContent('총 주문 확인 실패');
    expect(screen.getByTestId('profile-section')).toHaveTextContent('쿠폰 확인 실패');
    expect(screen.getByTestId('profile-section')).not.toHaveTextContent('총 주문 0');
  });
});
