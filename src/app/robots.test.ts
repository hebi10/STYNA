import robots from './robots';

describe('robots metadata route', () => {
  test('allows public pages and excludes private and API routes', () => {
    expect(robots()).toEqual({
      rules: {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin',
          '/auth',
          '/mypage',
          '/orders',
          '/api',
          '/cart',
        ],
      },
      sitemap: 'https://hebimall.web.app/sitemap.xml',
      host: 'https://hebimall.web.app',
    });
  });
});
