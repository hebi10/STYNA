import type { Product } from '@/shared/types/product';
import { getProductPricing } from '@/shared/utils/productPricing';

export const SITE_URL = 'https://hebimall.web.app';
export const SITE_NAME = 'STYNA';

export function absoluteSiteUrl(value: string): string {
  try {
    return new URL(value, `${SITE_URL}/`).toString();
  } catch {
    return `${SITE_URL}/`;
  }
}

export function canonicalUrl(pathname: string): string {
  const url = new URL(pathname, `${SITE_URL}/`);
  if (!url.pathname.endsWith('/')) {
    url.pathname = `${url.pathname}/`;
  }
  url.search = '';
  url.hash = '';
  return url.toString();
}

export function getImageMimeType(imageUrl: string): string | undefined {
  let pathname = imageUrl.split(/[?#]/, 1)[0].toLowerCase();
  try {
    pathname = new URL(imageUrl, `${SITE_URL}/`).pathname.toLowerCase();
  } catch {
    // 확장자 기반 fallback을 그대로 사용한다.
  }

  if (pathname.endsWith('.webp')) return 'image/webp';
  if (pathname.endsWith('.png')) return 'image/png';
  if (pathname.endsWith('.jpg') || pathname.endsWith('.jpeg')) return 'image/jpeg';
  if (pathname.endsWith('.avif')) return 'image/avif';
  if (pathname.endsWith('.gif')) return 'image/gif';
  return undefined;
}

export function getOpenGraphImage(imageUrl: string, alt: string) {
  const type = getImageMimeType(imageUrl);
  return {
    url: absoluteSiteUrl(imageUrl),
    alt,
    ...(type ? { type } : {}),
  };
}

export function buildProductJsonLd(product: Product) {
  const pricing = getProductPricing(product);
  const productUrl = canonicalUrl(`/products/${encodeURIComponent(product.id)}`);
  const images = Array.from(new Set([
    product.mainImage,
    ...(product.images || []),
  ].filter((image): image is string => Boolean(image)))).map(absoluteSiteUrl);
  const hasAggregateRating = Number.isFinite(product.rating)
    && product.rating > 0
    && product.rating <= 5
    && Number.isInteger(product.reviewCount)
    && product.reviewCount > 0;

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': productUrl,
    url: productUrl,
    name: product.name,
    description: product.description,
    ...(images.length > 0 ? { image: images } : {}),
    ...(product.sku ? { sku: product.sku } : {}),
    brand: {
      '@type': 'Brand',
      name: product.brand,
    },
    offers: {
      '@type': 'Offer',
      url: productUrl,
      price: pricing.salePrice,
      priceCurrency: 'KRW',
      availability: product.stock > 0
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
    },
    ...(hasAggregateRating ? {
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: product.rating,
        reviewCount: product.reviewCount,
      },
    } : {}),
  };
}

export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}
