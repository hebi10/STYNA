import type { Product, ProductSort } from '@/shared/types/product';

export function normalizeProductSearchTerm(value: string): string {
  return value.normalize('NFKC').trim().replace(/\s+/g, ' ');
}

export interface FirestoreTimestampSortValue {
  kind: 'firestore-timestamp';
  seconds: number;
  nanoseconds: number;
}

export type ClientProductSortValue = number | string | FirestoreTimestampSortValue;

export interface ProductClientCursor {
  kind: 'client-keyset';
  sort: ProductSort;
  sortValue: ClientProductSortValue;
  productId: string;
}

export interface ProductDomainQueryInput {
  category?: string;
  categoryId?: string;
  brand?: string;
  status?: Product['status'];
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  isNew?: boolean;
  isSale?: boolean;
  keyword?: string;
  sort?: ProductSort;
}

export const DEFAULT_PRODUCT_SORT: ProductSort = { field: 'createdAt', order: 'desc' };

const isRecord = (value: unknown): value is Record<string, unknown> => (
  Boolean(value && typeof value === 'object')
);

export function isFirestoreTimestampSortValue(value: unknown): value is FirestoreTimestampSortValue {
  if (!isRecord(value) || value.kind !== 'firestore-timestamp') {
    return false;
  }

  return (
    typeof value.seconds === 'number'
    && Number.isFinite(value.seconds)
    && Number.isInteger(value.seconds)
    && typeof value.nanoseconds === 'number'
    && Number.isInteger(value.nanoseconds)
    && value.nanoseconds >= 0
    && value.nanoseconds < 1_000_000_000
  );
}

export function normalizeProductSort(sort?: ProductSort): ProductSort {
  return sort ? { ...sort } : { ...DEFAULT_PRODUCT_SORT };
}

export function compareFirestoreStrings(left: string, right: string): number {
  const leftCodePoints = Array.from(left, character => character.codePointAt(0) ?? 0);
  const rightCodePoints = Array.from(right, character => character.codePointAt(0) ?? 0);
  const sharedLength = Math.min(leftCodePoints.length, rightCodePoints.length);

  for (let index = 0; index < sharedLength; index += 1) {
    const difference = leftCodePoints[index] - rightCodePoints[index];
    if (difference !== 0) {
      return difference;
    }
  }

  return leftCodePoints.length - rightCodePoints.length;
}

export function toTimestampSortValue(
  rawValue: unknown,
  fallbackDate: Date,
): FirestoreTimestampSortValue {
  if (
    isRecord(rawValue)
    && typeof rawValue.seconds === 'number'
    && Number.isFinite(rawValue.seconds)
    && Number.isInteger(rawValue.seconds)
    && typeof rawValue.nanoseconds === 'number'
    && Number.isInteger(rawValue.nanoseconds)
    && rawValue.nanoseconds >= 0
    && rawValue.nanoseconds < 1_000_000_000
  ) {
    return {
      kind: 'firestore-timestamp',
      seconds: rawValue.seconds,
      nanoseconds: rawValue.nanoseconds,
    };
  }

  const sourceDate = rawValue instanceof Date ? rawValue : fallbackDate;
  const milliseconds = sourceDate.getTime();
  const safeMilliseconds = Number.isFinite(milliseconds) ? milliseconds : 0;
  const seconds = Math.floor(safeMilliseconds / 1000);

  return {
    kind: 'firestore-timestamp',
    seconds,
    nanoseconds: Math.trunc((safeMilliseconds - seconds * 1000) * 1_000_000),
  };
}

export function getProductSortValue(
  product: Product,
  field: ProductSort['field'],
  rawValue?: unknown,
): ClientProductSortValue {
  switch (field) {
    case 'price':
      return product.price;
    case 'rating':
      return product.rating;
    case 'createdAt':
      return toTimestampSortValue(rawValue, product.createdAt);
    case 'name':
      return product.name;
    case 'reviewCount':
      return product.reviewCount;
  }
}

export function compareSortValues(
  left: ClientProductSortValue,
  right: ClientProductSortValue,
): number {
  if (typeof left === 'number' && typeof right === 'number') {
    return left - right;
  }

  if (typeof left === 'string' && typeof right === 'string') {
    return compareFirestoreStrings(left, right);
  }

  if (isFirestoreTimestampSortValue(left) && isFirestoreTimestampSortValue(right)) {
    if (left.seconds !== right.seconds) {
      return left.seconds - right.seconds;
    }

    return left.nanoseconds - right.nanoseconds;
  }

  return 0;
}

export function compareProductToSortKey(
  product: Product,
  sortValue: ClientProductSortValue,
  productId: string,
  sort: ProductSort,
  rawSortValue?: unknown,
): number {
  const valueDiff = compareSortValues(
    getProductSortValue(product, sort.field, rawSortValue),
    sortValue,
  );
  const orderedValueDiff = sort.order === 'asc' ? valueDiff : -valueDiff;

  if (orderedValueDiff !== 0) {
    return orderedValueDiff;
  }

  const idDiff = compareFirestoreStrings(product.id, productId);
  return sort.order === 'asc' ? idDiff : -idDiff;
}

export function createProductClientCursor(
  product: Product,
  sort: ProductSort,
  rawSortValue?: unknown,
): ProductClientCursor {
  return {
    kind: 'client-keyset',
    sort: { ...sort },
    sortValue: getProductSortValue(product, sort.field, rawSortValue),
    productId: product.id,
  };
}

export function filterProductsByKeyword(products: Product[], keyword?: string): Product[] {
  if (!keyword) {
    return products;
  }

  const normalizedKeyword = normalizeProductSearchTerm(keyword).toLowerCase();
  if (!normalizedKeyword) {
    return products;
  }

  return products.filter((product) => (
    normalizeProductSearchTerm(product.name).toLowerCase().includes(normalizedKeyword)
    || normalizeProductSearchTerm(product.brand || '').toLowerCase().includes(normalizedKeyword)
    || normalizeProductSearchTerm(product.description || '').toLowerCase().includes(normalizedKeyword)
    || normalizeProductSearchTerm(product.category || '').toLowerCase().includes(normalizedKeyword)
    || product.tags.some((tag) => normalizeProductSearchTerm(tag).toLowerCase().includes(normalizedKeyword))
  ));
}

export function getActiveProducts(products: Product[]): Product[] {
  return products.filter((product) => product.status === 'active');
}

export function sortProducts(
  products: Product[],
  sort: ProductSort,
  rawSortValues?: ReadonlyMap<string, unknown>,
): Product[] {
  return [...products].sort((a, b) => compareProductToSortKey(
    a,
    getProductSortValue(b, sort.field, rawSortValues?.get(b.id)),
    b.id,
    sort,
    rawSortValues?.get(a.id),
  ));
}

const sortByCreatedAtDesc = (products: Product[]): Product[] => (
  [...products].sort((a, b) => {
    const createdAtDiff = b.createdAt.getTime() - a.createdAt.getTime();
    return createdAtDiff !== 0 ? createdAtDiff : b.id.localeCompare(a.id);
  })
);

const sortByReviewCountDesc = (products: Product[]): Product[] => (
  [...products].sort((a, b) => {
    const reviewCountDiff = b.reviewCount - a.reviewCount;
    if (reviewCountDiff !== 0) {
      return reviewCountDiff;
    }

    const createdAtDiff = b.createdAt.getTime() - a.createdAt.getTime();
    return createdAtDiff !== 0 ? createdAtDiff : b.id.localeCompare(a.id);
  })
);

const sortByRatingDesc = (products: Product[]): Product[] => (
  [...products].sort((a, b) => {
    const ratingDiff = b.rating - a.rating;
    if (ratingDiff !== 0) {
      return ratingDiff;
    }

    const reviewCountDiff = b.reviewCount - a.reviewCount;
    if (reviewCountDiff !== 0) {
      return reviewCountDiff;
    }

    const createdAtDiff = b.createdAt.getTime() - a.createdAt.getTime();
    return createdAtDiff !== 0 ? createdAtDiff : b.id.localeCompare(a.id);
  })
);

export const selectNewProducts = (products: Product[], limitCount: number): Product[] => (
  sortByCreatedAtDesc(products.filter((product) => product.isNew)).slice(0, limitCount)
);

export const selectSaleProducts = (products: Product[], limitCount: number): Product[] => (
  sortByCreatedAtDesc(
    products.filter((product) => product.isSale && product.saleRate && product.saleRate > 0),
  ).slice(0, limitCount)
);

export const selectBestSellerProducts = (products: Product[], limitCount: number): Product[] => (
  sortByReviewCountDesc(products.filter((product) => product.reviewCount > 0)).slice(0, limitCount)
);

export const selectTopRatedProducts = (products: Product[], limitCount: number): Product[] => (
  sortByRatingDesc(products.filter((product) => product.rating >= 4.3)).slice(0, limitCount)
);

export const selectReviewPopularProducts = (products: Product[], limitCount: number): Product[] => (
  sortByReviewCountDesc(products.filter((product) => product.reviewCount >= 10)).slice(0, limitCount)
);

export const selectRecommendedProducts = (products: Product[], limitCount: number): Product[] => (
  products
    .filter((product) => product.rating >= 4)
    .sort((a, b) => {
      const scoreA = a.rating * 0.4 + Math.min(a.reviewCount / 10, 50) * 0.3 + (a.isNew ? 10 : 0);
      const scoreB = b.rating * 0.4 + Math.min(b.reviewCount / 10, 50) * 0.3 + (b.isNew ? 10 : 0);
      const scoreDiff = scoreB - scoreA;
      return scoreDiff !== 0 ? scoreDiff : b.createdAt.getTime() - a.createdAt.getTime();
    })
    .slice(0, limitCount)
);

export function applyProductQueryClientSide(
  products: Product[],
  queryInput: ProductDomainQueryInput,
  rawSortValues?: ReadonlyMap<string, unknown>,
): Product[] {
  const sort = normalizeProductSort(queryInput.sort);
  const categoryFilter = queryInput.category || queryInput.categoryId;
  let filtered = products;

  if (queryInput.status) {
    filtered = filtered.filter((product) => product.status === queryInput.status);
  }

  if (categoryFilter) {
    filtered = filtered.filter((product) => (
      (product.categoryId || product.category || '') === categoryFilter
    ));
  }

  if (queryInput.brand) {
    filtered = filtered.filter((product) => product.brand === queryInput.brand);
  }

  if (typeof queryInput.minPrice === 'number') {
    filtered = filtered.filter((product) => product.price >= queryInput.minPrice!);
  }

  if (typeof queryInput.maxPrice === 'number') {
    filtered = filtered.filter((product) => product.price <= queryInput.maxPrice!);
  }

  if (queryInput.minRating !== undefined) {
    filtered = filtered.filter((product) => product.rating >= queryInput.minRating!);
  }

  if (queryInput.isNew !== undefined) {
    filtered = filtered.filter((product) => product.isNew === queryInput.isNew);
  }

  if (queryInput.isSale !== undefined) {
    filtered = filtered.filter((product) => product.isSale === queryInput.isSale);
  }

  return sortProducts(filterProductsByKeyword(filtered, queryInput.keyword), sort, rawSortValues);
}
