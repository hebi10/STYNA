import {
  noIndexMetadata,
  rootMetadata,
  routeMetadata,
} from './routeMetadata';

describe('route metadata', () => {
  test('does not define a root canonical that descendants could inherit', () => {
    expect(rootMetadata.alternates).toBeUndefined();
  });

  test.each([
    ['home', 'https://hebimall.web.app/'],
    ['products', 'https://hebimall.web.app/products/'],
    ['categories', 'https://hebimall.web.app/categories/'],
    ['events', 'https://hebimall.web.app/events/'],
    ['brand', 'https://hebimall.web.app/brand/'],
  ] as const)('assigns the %s page its own canonical URL', (route, canonical) => {
    expect(routeMetadata[route].alternates?.canonical).toBe(canonical);
    expect(routeMetadata[route].openGraph?.url).toBe(canonical);
  });

  test('keeps search results and private pages out of the index while allowing link discovery', () => {
    expect(routeMetadata.search.robots).toEqual({ index: false, follow: true });
    expect(noIndexMetadata.robots).toEqual({ index: false, follow: true });
    expect(noIndexMetadata.alternates).toBeUndefined();
  });

  test('keeps the default social preview when page-specific Open Graph data overrides the root', () => {
    expect(routeMetadata.products.openGraph?.images).toEqual([
      expect.objectContaining({
        url: 'https://hebimall.web.app/thum.png',
        type: 'image/png',
        width: 1200,
        height: 630,
      }),
    ]);
    expect(routeMetadata.products.twitter?.images).toEqual([
      'https://hebimall.web.app/thum.png',
    ]);
  });
});
