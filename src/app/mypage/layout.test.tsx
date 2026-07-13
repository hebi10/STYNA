import { render, screen } from '@testing-library/react';
import MyPageLayout from './layout';
import { useAuth } from '@/context/authProvider';

let mockPathname = '/mypage';

jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}));

jest.mock('@/context/authProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../_components/PageHeader', () => ({
  __esModule: true,
  default: ({ title }: { title: string }) => <header>{title}</header>,
}));

jest.mock('./_components', () => ({
  ProfileSection: () => <section data-testid="profile-section" />,
  QuickActions: () => <nav data-testid="quick-actions" />,
  SidebarMenu: () => <aside data-testid="sidebar-menu" />,
}));

jest.mock('@/context/couponProvider', () => ({
  CouponProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="nested-coupon-provider">{children}</div>
  ),
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

  test('does not add a second coupon provider inside mypage layout', () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: { uid: 'user-1' },
      userData: { name: '홍길동', email: 'user@example.com' },
      isUserDataLoading: false,
      loading: false,
      logout: jest.fn(),
    });

    render(<MyPageLayout>마이페이지 본문</MyPageLayout>);

    expect(screen.queryByTestId('nested-coupon-provider')).not.toBeInTheDocument();
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
});
