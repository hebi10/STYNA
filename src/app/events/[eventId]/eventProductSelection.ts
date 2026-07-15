import { ProductService } from '@/shared/services/productService';
import { Event, EventUiVariant } from '@/shared/types/event';
import { Product } from '@/shared/types/product';

export interface EventProductSectionMeta {
  title: string;
  description: string;
  href: string;
  linkLabel: string;
}

export interface EventProductLoader {
  getProductById(id: string): Promise<Product | null>;
  getProductsByCategory(category: string, limit?: number): Promise<Product[]>;
  getSaleProducts(limit?: number): Promise<Product[]>;
  getRecommendedProducts(limit?: number): Promise<Product[]>;
  getReviewPopularProducts(limit?: number): Promise<Product[]>;
  getNewProducts(limit?: number): Promise<Product[]>;
}

export interface LoadEventProductsOptions {
  event: Event;
  variant: EventUiVariant;
  limit?: number;
  service?: EventProductLoader;
}

const STRICT_PRODUCT_LOADER_OPTIONS = { throwOnError: true } as const;

export const defaultEventProductLoader: EventProductLoader = {
  getProductById: id => ProductService.getProductById(id),
  getProductsByCategory: (category, limit) =>
    ProductService.getProductsByCategory(category, limit, STRICT_PRODUCT_LOADER_OPTIONS),
  getSaleProducts: limit =>
    ProductService.getSaleProducts(limit, STRICT_PRODUCT_LOADER_OPTIONS),
  getRecommendedProducts: limit =>
    ProductService.getRecommendedProducts(limit, STRICT_PRODUCT_LOADER_OPTIONS),
  getReviewPopularProducts: limit =>
    ProductService.getReviewPopularProducts(limit, STRICT_PRODUCT_LOADER_OPTIONS),
  getNewProducts: limit =>
    ProductService.getNewProducts(limit, STRICT_PRODUCT_LOADER_OPTIONS),
};

const PRODUCT_SECTION_META: Record<EventUiVariant, EventProductSectionMeta> = {
  sale: {
    title: '지금 할인 중인 상품',
    description: '이벤트 할인이 적용되는 상품을 확인해 보세요.',
    href: '/main/sale',
    linkLabel: '할인 상품 더 보기',
  },
  coupon: {
    title: '쿠폰과 함께 보기 좋은 상품',
    description: '쿠폰과 함께 구매하기 좋은 상품을 모았습니다.',
    href: '/recommend',
    linkLabel: '추천 상품 더 보기',
  },
  review: {
    title: '리뷰가 많은 상품',
    description: '많은 리뷰로 검증된 상품을 확인해 보세요.',
    href: '/reviews',
    linkLabel: '리뷰 상품 더 보기',
  },
  new: {
    title: '새로 들어온 상품',
    description: '새롭게 입고된 상품을 만나보세요.',
    href: '/recommend?filter=new',
    linkLabel: '신상품 더 보기',
  },
  special: {
    title: '함께 보면 좋은 상품',
    description: '이벤트와 함께 둘러보기 좋은 상품입니다.',
    href: '/recommend',
    linkLabel: '추천 상품 더 보기',
  },
};

const MAX_EVENT_PRODUCT_LIMIT = 8;

const normalizeProductLimit = (limit: number) => {
  if (Number.isNaN(limit)) return MAX_EVENT_PRODUCT_LIMIT;

  return Math.max(0, Math.min(MAX_EVENT_PRODUCT_LIMIT, Math.floor(limit)));
};

const isActive = (product: Product | null): product is Product =>
  Boolean(product && product.status === 'active');

const appendUnique = (target: Product[], products: Product[], limit: number) => {
  const ids = new Set(target.map(product => product.id));

  for (const product of products) {
    if (target.length >= limit) break;
    if (product.status !== 'active' || ids.has(product.id)) continue;

    ids.add(product.id);
    target.push(product);
  }
};

const loadVariantFallback = (
  service: EventProductLoader,
  variant: EventUiVariant,
  limit: number
) => {
  switch (variant) {
    case 'sale':
      return service.getSaleProducts(limit);
    case 'review':
      return service.getReviewPopularProducts(limit);
    case 'new':
      return service.getNewProducts(limit);
    case 'coupon':
    case 'special':
      return service.getRecommendedProducts(limit);
  }
};

export const getEventProductSectionMeta = (
  variant: EventUiVariant
): EventProductSectionMeta => PRODUCT_SECTION_META[variant];

export const loadEventProducts = async ({
  event,
  variant,
  limit: requestedLimit = MAX_EVENT_PRODUCT_LIMIT,
  service = defaultEventProductLoader,
}: LoadEventProductsOptions): Promise<Product[]> => {
  const limit = normalizeProductLimit(requestedLimit);
  const products: Product[] = [];
  const explicitProductIds = event.targetProducts ?? [];

  if (explicitProductIds.length > 0 && products.length < limit) {
    const explicitProductResults = await Promise.allSettled(
      explicitProductIds.map(productId => service.getProductById(productId))
    );
    const explicitProducts = explicitProductResults.flatMap(result =>
      result.status === 'fulfilled' && isActive(result.value) ? [result.value] : []
    );

    appendUnique(products, explicitProducts, limit);
  }

  const targetCategories = (event.targetCategories ?? [])
    .map(category => category.trim())
    .filter(category => category.length > 0 && category !== '전체');

  for (const category of targetCategories) {
    if (products.length >= limit) break;

    const categoryProducts = await service.getProductsByCategory(category, limit);
    appendUnique(products, categoryProducts, limit);
  }

  if (products.length < limit) {
    const fallbackProducts = await loadVariantFallback(service, variant, limit);
    appendUnique(products, fallbackProducts, limit);
  }

  return products.slice(0, limit);
};
