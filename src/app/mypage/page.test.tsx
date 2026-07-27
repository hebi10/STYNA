import { render, screen, within } from '@testing-library/react';
import MyPage from './page';
import { useAuth } from '@/context/authProvider';
import { useCoupon } from '@/context/couponProvider';
import { useUserActivity } from '@/context/userActivityProvider';
import { useOrderCount } from '@/shared/hooks/useOrders';

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props}>{children}</a>,
}));

jest.mock('@/context/authProvider', () => ({ useAuth: jest.fn() }));
jest.mock('@/context/couponProvider', () => ({ useCoupon: jest.fn() }));
jest.mock('@/context/userActivityProvider', () => ({ useUserActivity: jest.fn() }));
jest.mock('@/shared/hooks/useOrders', () => ({ useOrderCount: jest.fn() }));
jest.mock('./_components/RecentProducts', () => ({
  __esModule: true,
  default: () => <div>최근 본 상품 목록</div>,
}));
jest.mock('./_components/WishlistProducts', () => ({
  __esModule: true,
  default: () => <div>찜한 상품 목록</div>,
}));
jest.mock('./page.module.css', () => ({
  __esModule: true,
  default: new Proxy({}, { get: (_target, property) => String(property) }),
}));

describe('MyPage shopping counts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.scrollTo = jest.fn();
    jest.mocked(useAuth).mockReturnValue({ user: { uid: 'user-1' } } as never);
    jest.mocked(useUserActivity).mockReturnValue({
      recentProducts: [],
      wishlistItems: [],
    } as never);
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
  });

  test('shows actual order and available coupon counts', () => {
    render(<MyPage />);

    const orderCard = screen.getByRole('link', { name: /주문내역/ });
    const couponCard = screen.getByRole('link', { name: /보유 쿠폰/ });
    expect(within(orderCard).getByText('2')).toBeInTheDocument();
    expect(within(couponCard).getByText('3')).toBeInTheDocument();
    expect(useOrderCount).toHaveBeenCalledWith('user-1');
  });

  test('does not present zero while order and coupon counts are loading', () => {
    jest.mocked(useOrderCount).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    } as never);
    jest.mocked(useCoupon).mockReturnValue({
      couponStats: null,
      userCouponsReady: false,
      loading: true,
    } as never);

    render(<MyPage />);

    const orderCard = screen.getByRole('link', { name: /주문내역/ });
    const couponCard = screen.getByRole('link', { name: /보유 쿠폰/ });
    expect(within(orderCard).getByText('-')).toHaveAttribute('aria-busy', 'true');
    expect(within(couponCard).getByText('-')).toHaveAttribute('aria-busy', 'true');
  });

  test('shows a non-busy failure label when count queries fail', () => {
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

    render(<MyPage />);

    const orderCard = screen.getByRole('link', { name: /주문내역/ });
    const couponCard = screen.getByRole('link', { name: /보유 쿠폰/ });
    expect(within(orderCard).getByText('확인 실패')).not.toHaveAttribute('aria-busy');
    expect(within(couponCard).getByText('확인 실패')).not.toHaveAttribute('aria-busy');
  });
});
