import { getFloatingUiPolicy } from './floatingUi';

describe('getFloatingUiPolicy', () => {
  test.each([
    ['/auth', { hideChat: true, hideGuide: true, suppressChatOnMobile: false, suppressGuideOnMobile: false }],
    ['/auth/login', { hideChat: true, hideGuide: true, suppressChatOnMobile: false, suppressGuideOnMobile: false }],
    ['/orders', { hideChat: true, hideGuide: true, suppressChatOnMobile: false, suppressGuideOnMobile: false }],
    ['/orders/cart', { hideChat: true, hideGuide: true, suppressChatOnMobile: false, suppressGuideOnMobile: false }],
    ['/products', { hideChat: false, hideGuide: true, suppressChatOnMobile: true, suppressGuideOnMobile: false }],
    ['/products/item-1', { hideChat: false, hideGuide: true, suppressChatOnMobile: true, suppressGuideOnMobile: false }],
    ['/events', { hideChat: false, hideGuide: true, suppressChatOnMobile: true, suppressGuideOnMobile: false }],
    ['/events/summer-sale', { hideChat: false, hideGuide: true, suppressChatOnMobile: true, suppressGuideOnMobile: false }],
  ])('applies the complete floating UI policy on %s', (pathname, expectedPolicy) => {
    expect(getFloatingUiPolicy(pathname)).toEqual(expectedPolicy);
  });

  test.each(['/authentication', '/orders-history', '/products-old', '/events-old'])
  ('does not mistake %s for a protected route segment', (pathname) => {
    expect(getFloatingUiPolicy(pathname)).toEqual({
      hideChat: false,
      hideGuide: false,
      suppressChatOnMobile: false,
      suppressGuideOnMobile: false,
    });
  });

  test.each(['/auth/', '/orders/cart/', '/products/item-1/', '/events/summer-sale/'])
  ('treats a trailing slash on %s as the same route', (pathname) => {
    const withoutTrailingSlash = pathname.slice(0, -1);

    expect(getFloatingUiPolicy(pathname)).toEqual(getFloatingUiPolicy(withoutTrailingSlash));
  });

  test('keeps both floating tools available when pathname is null', () => {
    expect(getFloatingUiPolicy(null)).toEqual({
      hideChat: false,
      hideGuide: false,
      suppressChatOnMobile: false,
      suppressGuideOnMobile: false,
    });
  });
});
