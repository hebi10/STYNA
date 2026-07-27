import type { Product } from '@/shared/types/product';
import {
  buildProductJsonLd,
  canonicalUrl,
  getImageMimeType,
  getOpenGraphImage,
  serializeJsonLd,
} from './seo';

const product: Product = {
  id: 'linen-shirt',
  name: '린넨 <셔츠>',
  description: '여름 셔츠',
  price: 39000,
  originalPrice: 49000,
  brand: 'STYNA',
  category: 'tops',
  images: ['/products/linen.webp'],
  mainImage: '/products/linen.webp',
  sizes: [],
  colors: [],
  stock: 3,
  rating: 4.8,
  reviewCount: 12,
  isNew: false,
  isSale: true,
  tags: [],
  createdAt: new Date(),
  updatedAt: new Date(),
  status: 'active',
  details: { material: '', origin: '', manufacturer: '', precautions: '', sizes: {} },
};

describe('SEO helpers', () => {
  test('creates production canonical URLs that match trailingSlash routing', () => {
    expect(canonicalUrl('/products/linen-shirt'))
      .toBe('https://hebimall.web.app/products/linen-shirt/');
  });

  test.each([
    ['image.webp?alt=media', 'image/webp'],
    ['image.png', 'image/png'],
    ['image.jpg', 'image/jpeg'],
    ['image.avif', 'image/avif'],
    ['image', undefined],
  ])('detects %s as %s', (url, expected) => {
    expect(getImageMimeType(url)).toBe(expected);
  });

  test('does not invent a MIME type for an unknown image extension', () => {
    expect(getOpenGraphImage('/image', '상품')).toEqual({
      url: 'https://hebimall.web.app/image',
      alt: '상품',
    });
  });

  test('builds Product JSON-LD with KRW offer data and safe serialization', () => {
    const jsonLd = buildProductJsonLd(product);
    const serialized = serializeJsonLd(jsonLd);

    expect(jsonLd).toMatchObject({
      '@type': 'Product',
      name: '린넨 <셔츠>',
      brand: { '@type': 'Brand', name: 'STYNA' },
      offers: {
        '@type': 'Offer',
        price: 39000,
        priceCurrency: 'KRW',
        availability: 'https://schema.org/InStock',
      },
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: 4.8,
        reviewCount: 12,
      },
    });
    expect(serialized).toContain('\\u003c셔츠>');
    expect(serialized).not.toContain('<셔츠>');
  });

  test('encodes product ids in every Product JSON-LD URL', () => {
    const jsonLd = buildProductJsonLd({ ...product, id: 'linen shirt?#' });
    const expectedUrl = 'https://hebimall.web.app/products/linen%20shirt%3F%23/';

    expect(jsonLd).toMatchObject({
      '@id': expectedUrl,
      url: expectedUrl,
      offers: { url: expectedUrl },
    });
  });

  test('omits the Product JSON-LD image field when no image exists', () => {
    const jsonLd = buildProductJsonLd({
      ...product,
      images: [],
      mainImage: undefined,
    });

    expect(jsonLd).not.toHaveProperty('image');
  });
});
