import type { Product } from '@/shared/types/product';

export type ProductDocumentData = Partial<Omit<Product, 'id' | 'createdAt' | 'updatedAt'>> & {
  createdAt?: unknown;
  updatedAt?: unknown;
};

const SERVER_OWNED_REVIEW_FIELDS = [
  'rating',
  'reviewCount',
  'reviewSummary',
  'reviewStatsEventTime',
  'reviewStatsRunToken',
  'reviewStatsUpdatedAt',
  'reviewStatsVersion',
] as const;

export function normalizeProductDate(value: unknown): Date {
  if (value instanceof Date) {
    return value;
  }

  if (value && typeof (value as { toDate?: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate();
  }

  return new Date();
}

export function normalizeProductCategoryId(
  data: { category?: string; categoryId?: string },
  fallbackCategoryId?: string,
): string {
  return data.categoryId || data.category || fallbackCategoryId || '';
}

export function normalizeProductDocument(
  id: string,
  data: ProductDocumentData,
  fallbackCategoryId?: string,
): Product {
  const categoryId = normalizeProductCategoryId(data, fallbackCategoryId);

  return {
    id,
    name: data.name || '',
    description: data.description || '',
    price: data.price || 0,
    originalPrice: data.originalPrice,
    brand: data.brand || '',
    category: data.category || categoryId,
    categoryId,
    images: Array.isArray(data.images) ? data.images : [],
    detailImages: Array.isArray(data.detailImages) ? data.detailImages : [],
    mainImage: data.mainImage,
    sizes: Array.isArray(data.sizes) ? data.sizes : [],
    colors: Array.isArray(data.colors) ? data.colors : [],
    stock: data.stock || 0,
    rating: data.rating || 0,
    reviewCount: data.reviewCount || 0,
    isNew: Boolean(data.isNew),
    isSale: Boolean(data.isSale),
    saleRate: data.saleRate,
    tags: Array.isArray(data.tags) ? data.tags : [],
    createdAt: normalizeProductDate(data.createdAt),
    updatedAt: normalizeProductDate(data.updatedAt),
    status: data.status || 'active',
    sku: data.sku,
    details: data.details || {
      material: '',
      origin: '',
      manufacturer: '',
      precautions: '',
      sizes: {},
    },
  };
}

export function cleanProductObject<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const cleaned: Partial<T> = {};

  Object.entries(obj).forEach(([key, value]) => {
    if (value !== undefined) {
      cleaned[key as keyof T] = value as T[keyof T];
    }
  });

  return cleaned;
}

export function withoutServerOwnedReviewStats<T extends Record<string, unknown>>(
  data: T,
): Partial<T> {
  const sanitized = { ...data };

  for (const field of SERVER_OWNED_REVIEW_FIELDS) {
    delete sanitized[field];
  }

  return sanitized;
}
