import { getAuthGuardRedirect } from './authRouteGuard';

describe('getAuthGuardRedirect', () => {
  test('sends an anonymous mypage visitor to login', () => {
    expect(getAuthGuardRedirect({
      loading: false,
      hasUser: false,
      pathname: '/mypage/order-list',
    })).toBe('/auth/login');
  });

  test('leaves authenticated login redirects to LoginPage', () => {
    expect(getAuthGuardRedirect({
      loading: false,
      hasUser: true,
      pathname: '/auth/login',
    })).toBeNull();
  });

  test.each([
    { loading: true, hasUser: false, pathname: '/mypage' },
    { loading: false, hasUser: false, pathname: '/admin' },
    { loading: false, hasUser: false, pathname: '/products/product-1' },
  ])('does not redirect outside the anonymous mypage guard: %o', (input) => {
    expect(getAuthGuardRedirect(input)).toBeNull();
  });
});
