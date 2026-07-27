import { render, screen, within } from '@testing-library/react';
import ProfileSection from './ProfileSection';
import { usePointBalance } from '@/shared/hooks/usePoint';

jest.mock('@/shared/hooks/usePoint', () => ({ usePointBalance: jest.fn() }));
jest.mock('../layout.module.css', () => ({
  __esModule: true,
  default: new Proxy({}, { get: (_target, property) => String(property) }),
}));

describe('ProfileSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(usePointBalance).mockReturnValue({
      data: { pointBalance: 5000 },
      isLoading: false,
    } as never);
  });

  test('renders the available coupon count passed from the query-backed layout', () => {
    render(
      <ProfileSection
        userInfo={{
          name: '홍길동',
          email: 'user@example.com',
          membershipLevel: 'silver',
          orders: 2,
          reviews: 1,
          coupons: 3,
        }}
      />,
    );

    const couponStat = screen.getByText('쿠폰').parentElement;
    expect(couponStat).not.toBeNull();
    expect(within(couponStat as HTMLElement).getByText('3')).toBeInTheDocument();
  });

  test('renders busy placeholders instead of zero while counts are loading', () => {
    render(
      <ProfileSection
        userInfo={{
          name: '홍길동',
          email: 'user@example.com',
          membershipLevel: 'silver',
          orders: null,
          reviews: 1,
          coupons: null,
        } as never}
      />,
    );

    const orderStat = screen.getByText('총 주문').parentElement;
    const couponStat = screen.getByText('쿠폰').parentElement;
    expect(orderStat).not.toBeNull();
    expect(couponStat).not.toBeNull();
    expect(within(orderStat as HTMLElement).getByText('-')).toHaveAttribute('aria-busy', 'true');
    expect(within(couponStat as HTMLElement).getByText('-')).toHaveAttribute('aria-busy', 'true');
  });

  test('renders non-busy failure labels for unavailable counts', () => {
    render(
      <ProfileSection
        userInfo={{
          name: '홍길동',
          email: 'user@example.com',
          membershipLevel: 'silver',
          orders: 'error',
          reviews: 1,
          coupons: 'error',
        }}
      />,
    );

    const failures = screen.getAllByText('확인 실패');
    expect(failures).toHaveLength(2);
    failures.forEach((failure) => expect(failure).not.toHaveAttribute('aria-busy'));
  });
});
