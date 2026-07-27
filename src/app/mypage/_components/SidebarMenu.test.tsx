import { render, screen, within } from '@testing-library/react';
import SidebarMenu from './SidebarMenu';

jest.mock('../layout.module.css', () => ({
  __esModule: true,
  default: new Proxy({}, {
    get: (_target, property) => String(property),
  }),
}));

describe('SidebarMenu', () => {
  test('exposes the implemented inquiry history without empty support routes', () => {
    render(<SidebarMenu activeTab="reviews" logout={jest.fn()} />);

    const desktopNavigation = screen.getByRole('navigation', { name: '마이페이지 메뉴' });
    expect(within(desktopNavigation).getByRole('link', { name: '문의관리' })).toHaveAttribute('href', '/mypage/qa');
    expect(within(desktopNavigation).queryByRole('link', { name: '상담내역' })).not.toBeInTheDocument();
    expect(within(desktopNavigation).queryByRole('link', { name: '재입고알림' })).not.toBeInTheDocument();
  });

  test('highlights the shopping overview on the mypage root', () => {
    render(<SidebarMenu activeTab="overview" logout={jest.fn()} />);

    const desktopNavigation = screen.getByRole('navigation', { name: '마이페이지 메뉴' });
    expect(within(desktopNavigation).getByRole('link', { name: '나의 쇼핑 현황' })).toHaveClass('active');
    expect(within(desktopNavigation).getByRole('link', { name: '나의 쇼핑 현황' })).toHaveAttribute('aria-current', 'page');
    expect(within(desktopNavigation).getByRole('link', { name: '주문내역' })).not.toHaveClass('active');
  });

  test('renders the same links in a mobile alternative navigation', () => {
    render(<SidebarMenu activeTab="reviews" logout={jest.fn()} />);

    const desktopNavigation = screen.getByRole('navigation', { name: '마이페이지 메뉴' });
    const mobileNavigation = screen.getByRole('navigation', { name: '마이페이지 모바일 메뉴' });
    const getLinkEntries = (navigation: HTMLElement) => within(navigation)
      .getAllByRole('link')
      .map((link) => [link.textContent, link.getAttribute('href')]);

    expect(getLinkEntries(mobileNavigation)).toEqual(getLinkEntries(desktopNavigation));
  });

  test.each([
    ['overview', '나의 쇼핑 현황'],
    ['orders', '주문내역'],
    ['reviews', '문의관리'],
    ['wishlist', '최근본상품'],
    ['favorite', '찜한상품'],
    ['coupons', '쿠폰관리'],
    ['point', '적립금'],
    ['profile', '회원정보수정'],
  ])('marks the %s link as current in both navigations', (activeTab, linkName) => {
    render(<SidebarMenu activeTab={activeTab} logout={jest.fn()} />);

    const navigations = [
      screen.getByRole('navigation', { name: '마이페이지 메뉴' }),
      screen.getByRole('navigation', { name: '마이페이지 모바일 메뉴' }),
    ];

    navigations.forEach((navigation) => {
      expect(within(navigation).getByRole('link', { name: linkName })).toHaveAttribute('aria-current', 'page');
    });
  });
});
