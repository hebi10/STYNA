import { getSafeRedirectTarget } from './safeRedirect';

describe('getSafeRedirectTarget', () => {
  test.each([
    'https://evil.example/path',
    '//evil.example/path',
    '/\\evil.example/path',
    'javascript:alert(1)',
  ])('rejects a non-same-origin redirect: %s', (candidate) => {
    expect(getSafeRedirectTarget(candidate, 'https://styna.example')).toBe('/mypage');
  });

  test('keeps an internal path with its search and hash', () => {
    expect(
      getSafeRedirectTarget(
        '/products/p1?resumeIntent=1#buy',
        'https://styna.example',
      ),
    ).toBe('/products/p1?resumeIntent=1#buy');
  });

  test('normalizes an absolute URL only when its origin matches exactly', () => {
    expect(
      getSafeRedirectTarget(
        'https://styna.example/orders/checkout?from=cart',
        'https://styna.example',
      ),
    ).toBe('/orders/checkout?from=cart');
  });
});
