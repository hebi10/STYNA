import type { Product, ProductFilter, ProductSort } from '@/shared/types/product';
import { isFirestorePermissionDenied } from '@/shared/utils/firebaseError';
import {
  applyProductQueryClientSide,
  compareProductToSortKey,
  createProductClientCursor,
  filterProductsByKeyword,
  getActiveProducts,
  getProductSortValue,
  isFirestoreTimestampSortValue,
  normalizeProductSearchTerm,
  normalizeProductSort,
  selectBestSellerProducts,
  selectNewProducts,
  selectRecommendedProducts,
  selectReviewPopularProducts,
  selectSaleProducts,
  selectTopRatedProducts,
  sortProducts,
  type ProductClientCursor,
} from './productDomain';
import {
  cleanProductObject,
  normalizeProductCategoryId,
  normalizeProductDocument,
  withoutServerOwnedReviewStats,
  type ProductDocumentData,
} from './productMapper';
import { ProductRepository, type ProductDocumentCursor } from './productRepository';

export { normalizeProductSearchTerm } from './productDomain';
export type { ClientProductSortValue, FirestoreTimestampSortValue } from './productDomain';


export type ClientProductCursor = ProductClientCursor;
export type ProductPageCursor = ProductDocumentCursor | ProductClientCursor;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object');
}

function isProductSort(value: unknown): value is ProductSort {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.field === 'string'
    && ['price', 'rating', 'createdAt', 'name', 'reviewCount'].includes(value.field)
    && (value.order === 'asc' || value.order === 'desc')
  );
}

function isClientProductCursor(cursor: unknown): cursor is ClientProductCursor {
  if (
    !isRecord(cursor)
    || cursor.kind !== 'client-keyset'
    || !isProductSort(cursor.sort)
    || typeof cursor.productId !== 'string'
    || cursor.productId.length === 0
  ) {
    return false;
  }

  switch (cursor.sort.field) {
    case 'createdAt':
      return isFirestoreTimestampSortValue(cursor.sortValue);
    case 'name':
      return typeof cursor.sortValue === 'string';
    case 'price':
    case 'rating':
    case 'reviewCount':
      return typeof cursor.sortValue === 'number' && Number.isFinite(cursor.sortValue);
  }
}

function isFirestoreProductCursor(cursor: unknown): cursor is ProductDocumentCursor {
  return (
    isRecord(cursor)
    && typeof cursor.id === 'string'
    && cursor.id.length > 0
    && typeof cursor.data === 'function'
  );
}

type ProductStatus = Product['status'];

interface ProductDocumentRecord {
  product: Product;
  data: ProductDocumentData;
}

export interface ProductQueryInput {
  category?: string;
  categoryId?: string;
  brand?: string;
  status?: ProductStatus;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  isNew?: boolean;
  isSale?: boolean;
  keyword?: string;
  sort?: ProductSort;
  limitCount?: number;
  startAfterDoc?: ProductPageCursor | null;
}

export interface ProductQueryResult {
  items: Product[];
  nextCursor?: ProductPageCursor;
  hasMore: boolean;
}

export interface HomePageProductGroups {
  recommendedProducts: Product[];
  newProducts: Product[];
  saleProducts: Product[];
  bestSellerProducts: Product[];
}

export interface BrandSummary {
  id: string;
  name: string;
  productCount: number;
  image?: string;
  slug?: string;
}

interface HomePageProductLimits {
  recommended?: number;
  new?: number;
  sale?: number;
  bestSeller?: number;
}

export interface ProductLoaderOptions {
  throwOnError?: boolean;
}

type ProductPayload = Omit<Product, 'id' | 'createdAt' | 'updatedAt'>;

export class ProductService {
  private static readonly DEFAULT_PAGE_SIZE = 24;
  private static readonly KEYWORD_SCAN_MULTIPLIER = 3;

  private static async queryProductsWithClientFallback(queryInput: ProductQueryInput): Promise<ProductQueryResult> {
    const pageSize = Math.max(1, queryInput.limitCount ?? this.DEFAULT_PAGE_SIZE);
    const sort = normalizeProductSort(queryInput.sort);
    const records = await this.getTopLevelProductRecords(queryInput.status);
    const rawSortValues = new Map(records.map(({ product, data }) => (
      [product.id, data[sort.field as keyof ProductDocumentData]] as const
    )));
    const products = applyProductQueryClientSide(
      records.map(({ product }) => product),
      queryInput,
      rawSortValues,
    );
    const offset = this.getClientFallbackOffset(
      products,
      queryInput.startAfterDoc,
      sort,
      rawSortValues,
    );
    const items = products.slice(offset, offset + pageSize);
    const hasMore = offset + items.length < products.length;
    const lastItem = items[items.length - 1];

    return {
      items,
      nextCursor: hasMore && lastItem
        ? createProductClientCursor(lastItem, sort, rawSortValues.get(lastItem.id))
        : undefined,
      hasMore,
    };
  }

  private static getClientFallbackOffset(
    products: Product[],
    cursor: unknown,
    sort: ProductSort,
    rawSortValues: ReadonlyMap<string, unknown>,
  ): number {
    if (isClientProductCursor(cursor)) {
      if (cursor.sort.field !== sort.field || cursor.sort.order !== sort.order) {
        return 0;
      }

      const nextIndex = products.findIndex((product) => (
        compareProductToSortKey(
          product,
          cursor.sortValue,
          cursor.productId,
          sort,
          rawSortValues.get(product.id),
        ) > 0
      ));
      return nextIndex >= 0 ? nextIndex : products.length;
    }

    if (!isFirestoreProductCursor(cursor)) {
      return 0;
    }

    const cursorData = cursor.data() as ProductDocumentData;
    const cursorProduct = normalizeProductDocument(cursor.id, cursorData);
    const cursorSortValue = getProductSortValue(
      cursorProduct,
      sort.field,
      cursorData[sort.field as keyof ProductDocumentData],
    );
    const nextIndex = products.findIndex((product) => (
      compareProductToSortKey(
        product,
        cursorSortValue,
        cursor.id,
        sort,
        rawSortValues.get(product.id),
      ) > 0
    ));
    return nextIndex >= 0 ? nextIndex : products.length;
  }

  private static async getTopLevelProducts(status?: ProductStatus): Promise<Product[]> {
    const records = await this.getTopLevelProductRecords(status);
    return records.map(({ product }) => product);
  }

  private static async getTopLevelProductRecords(
    status?: ProductStatus,
  ): Promise<ProductDocumentRecord[]> {
    const docs = await ProductRepository.listProductDocuments(status);
    return docs.map((productDoc) => {
      const data = productDoc.data() as ProductDocumentData;
      return {
        product: normalizeProductDocument(productDoc.id, data),
        data,
      };
    });
  }

  private static async getTopLevelProductById(productId: string): Promise<Product | null> {
    const productDoc = await ProductRepository.getProductDocumentById(productId);
    return productDoc
      ? normalizeProductDocument(productDoc.id, productDoc.data as ProductDocumentData)
      : null;
  }

  private static toBrandSummaryFromProductGroups(products: Product[]): BrandSummary[] {
    const brandMap = new Map<string, BrandSummary>();

    products.forEach((product) => {
      const brandName = product.brand?.trim();
      if (!brandName) {
        return;
      }

      const current = brandMap.get(brandName);
      brandMap.set(brandName, {
        id: current?.id || brandName,
        name: brandName,
        productCount: (current?.productCount || 0) + 1,
        image: current?.image || product.mainImage || product.images[0],
        slug: current?.slug || brandName,
      });
    });

    return Array.from(brandMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  private static normalizeBrandSummary(id: string, data: Partial<BrandSummary>): BrandSummary | null {
    const name = typeof data.name === 'string' ? data.name.trim() : '';
    if (!name) {
      return null;
    }

    return {
      id,
      name,
      productCount: Number(data.productCount) || 0,
      image: typeof data.image === 'string' ? data.image : undefined,
      slug: typeof data.slug === 'string' ? data.slug : id,
    };
  }

  static async queryProducts(queryInput: ProductQueryInput = {}): Promise<ProductQueryResult> {
    const requestedCursor: unknown = queryInput.startAfterDoc;
    const sort = normalizeProductSort(queryInput.sort);

    if (isClientProductCursor(requestedCursor)) {
      return this.queryProductsWithClientFallback(queryInput);
    }

    const firestoreCursor = isFirestoreProductCursor(requestedCursor)
      ? requestedCursor
      : null;
    const safeQueryInput = requestedCursor && !firestoreCursor
      ? { ...queryInput, startAfterDoc: null }
      : queryInput;

    try {
      const pageSize = queryInput.limitCount ?? this.DEFAULT_PAGE_SIZE;
      const normalizedPageSize = Math.max(1, pageSize);
      const keyword = queryInput.keyword
        ? normalizeProductSearchTerm(queryInput.keyword)
        : undefined;
      const hasKeyword = Boolean(keyword);
      const scanMultiplier = hasKeyword ? this.KEYWORD_SCAN_MULTIPLIER : 1;
      const queryLimit = Math.max(
        normalizedPageSize + 1,
        normalizedPageSize * scanMultiplier + 1
      );

      const categoryId = queryInput.category || queryInput.categoryId;

      let cursor: ProductDocumentCursor | null = firestoreCursor;
      const collected: Array<{
        product: Product;
        cursor: ProductDocumentCursor;
      }> = [];

      while (true) {
        const docs = await ProductRepository.queryProductDocuments({
          status: queryInput.status,
          categoryId: categoryId ? normalizeProductCategoryId({ categoryId }) : undefined,
          brand: queryInput.brand,
          minPrice: queryInput.minPrice,
          maxPrice: queryInput.maxPrice,
          minRating: queryInput.minRating,
          isNew: queryInput.isNew,
          isSale: queryInput.isSale,
          sort,
          startAfterDoc: cursor,
          limitCount: queryLimit,
        });

        if (docs.length === 0) {
          return {
            items: collected.slice(0, normalizedPageSize).map(({ product }) => product),
            hasMore: false,
          };
        }

        for (const productDoc of docs) {
          const product = normalizeProductDocument(productDoc.id, productDoc.data());
          if (filterProductsByKeyword([product], keyword).length > 0) {
            collected.push({ product, cursor: productDoc });
          }
        }
        cursor = docs[docs.length - 1];

        if (collected.length >= normalizedPageSize || docs.length < queryLimit) {
          const items = collected.slice(0, normalizedPageSize);
          const hasMore = collected.length > normalizedPageSize || docs.length >= queryLimit;
          return {
            items: items.map(({ product }) => product),
            nextCursor: hasMore ? items[items.length - 1]?.cursor : undefined,
            hasMore,
          };
        }
      }
    } catch (error) {
      console.warn('Product query used client fallback:', error);

      try {
        return await this.queryProductsWithClientFallback(safeQueryInput);
      } catch (fallbackError) {
        console.error('Failed to query products with fallback:', fallbackError);
        throw new Error('상품 조회에 실패했습니다.');
      }
    }
  }

  static async getAllProducts(): Promise<Product[]> {
    try {
      return await this.getTopLevelProducts();
    } catch (error) {
      console.error('Failed to load products:', error);
      throw new Error('상품 목록을 불러오는데 실패했습니다.');
    }
  }

  static async createProduct(product: ProductPayload): Promise<Product> {
    try {
      const categoryId = normalizeProductCategoryId(product);
      if (!categoryId) {
        throw new Error('category or categoryId is required.');
      }

      const productData = cleanProductObject({
        ...product,
        rating: 0,
        reviewCount: 0,
        reviewSummary: {
          schemaVersion: 1,
          totalReviews: 0,
          averageRating: 0,
          recommendedCount: 0,
          recommendationRate: 0,
          ratingDistribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
        },
        category: categoryId,
        categoryId,
        status: product.status || 'active',
      });
      const created = await ProductRepository.createProductDocument(productData as Record<string, unknown>);
      return normalizeProductDocument(created.id, created.data as ProductDocumentData, categoryId);
    } catch (error) {
      console.error('Failed to create product:', error);
      throw new Error('상품 생성에 실패했습니다.');
    }
  }

  static async updateProduct(productId: string, updates: Partial<Product>): Promise<Product> {
    try {
      const existingProduct = await this.getProductById(productId);
      if (!existingProduct) {
        throw new Error('상품을 찾을 수 없습니다.');
      }

      const previousCategoryId = existingProduct.categoryId || existingProduct.category;
      const nextCategoryId = normalizeProductCategoryId(updates, previousCategoryId);
      const hasCategoryUpdate = Object.prototype.hasOwnProperty.call(updates, 'category')
        || Object.prototype.hasOwnProperty.call(updates, 'categoryId');
      const updateData = cleanProductObject(withoutServerOwnedReviewStats({
        ...updates,
        ...(hasCategoryUpdate ? { category: nextCategoryId, categoryId: nextCategoryId } : {}),
      }));

      delete updateData.id;
      delete updateData.createdAt;

      const persistedData = await ProductRepository.updateProductDocument(
        productId,
        updateData as Record<string, unknown>,
      );
      return normalizeProductDocument(
        productId,
        { ...existingProduct, ...persistedData } as ProductDocumentData,
        nextCategoryId,
      );
    } catch (error) {
      console.error('Failed to update product:', error);
      throw new Error('상품 수정에 실패했습니다.');
    }
  }

  static async deleteProduct(productId: string): Promise<void> {
    try {
      const existingProduct = await this.getProductById(productId);
      if (!existingProduct) {
        throw new Error('상품을 찾을 수 없습니다.');
      }
      await ProductRepository.deleteProductDocument(productId);
    } catch (error) {
      console.error('Failed to delete product:', error);
      throw new Error('상품 삭제에 실패했습니다.');
    }
  }

  static async getProductById(productId: string): Promise<Product | null> {
    try {
      return await this.getTopLevelProductById(productId);
    } catch (error) {
      console.error('Failed to load product detail:', error);
      throw new Error('상품 상세 정보를 불러오는데 실패했습니다.');
    }
  }

  static async getPublicProductById(productId: string): Promise<Product | null> {
    try {
      const productDoc = await ProductRepository.getPublicProductDocumentById(productId);
      if (!productDoc) {
        return null;
      }
      const product = normalizeProductDocument(productDoc.id, productDoc.data as ProductDocumentData);
      return product.status === 'active' ? product : null;
    } catch (error) {
      if (isFirestorePermissionDenied(error)) {
        return null;
      }
      console.error('Failed to load public product detail:', error);
      throw error;
    }
  }

  static async getPublicProductsByIds(productIds: string[]): Promise<Product[]> {
    const uniqueProductIds = Array.from(
      new Set(
        productIds
          .map((productId) => productId.trim())
          .filter(Boolean),
      ),
    );
    const products = await Promise.all(
      uniqueProductIds.map((productId) => this.getPublicProductById(productId)),
    );

    return products.filter((product): product is Product => product !== null);
  }

  static async getProductsByCategory(
    categorySlug: string,
    limitCount?: number,
    options: ProductLoaderOptions = {}
  ): Promise<Product[]> {
    try {
      const result = await this.queryProducts({
        category: categorySlug,
        status: 'active',
        sort: { field: 'createdAt', order: 'desc' },
        limitCount,
      });

      return result.items;
    } catch (error) {
      console.error('Failed to load category products:', error);
      if (options.throwOnError) {
        throw error;
      }
      return [];
    }
  }

  static async getFilteredProducts(filter: ProductFilter): Promise<Product[]> {
    try {
      const result = await this.queryProducts({
        category: filter.category,
        brand: filter.brand,
        minPrice: filter.minPrice,
        maxPrice: filter.maxPrice,
        minRating: filter.rating,
        isNew: filter.isNew,
        isSale: filter.isSale,
        status: filter.status,
        sort: { field: 'createdAt', order: 'desc' },
        limitCount: 1000,
      });

      let products = result.items;

      if (filter.size) {
        products = products.filter((product) => product.sizes.includes(filter.size!));
      }

      if (filter.color) {
        products = products.filter((product) => product.colors.includes(filter.color!));
      }

      return products;
    } catch (error) {
      console.error('Failed to filter products:', error);
      throw new Error('상품 필터링에 실패했습니다.');
    }
  }

  static async getSortedProducts(products: Product[], sort: ProductSort): Promise<Product[]> {
    return sortProducts(products, sort);
  }

  static async searchProducts(searchQuery: string): Promise<Product[]> {
    try {
      const result = await this.queryProducts({
        status: 'active',
        keyword: searchQuery,
        sort: { field: 'createdAt', order: 'desc' },
        limitCount: 1000,
      });
      return result.items;
    } catch (error) {
      console.error('Failed to search products:', error);
      throw new Error('상품 검색에 실패했습니다.');
    }
  }

  static async getRelatedProducts(
    productId: string,
    limitCount: number = 4,
    options: ProductLoaderOptions = {},
  ): Promise<Product[]> {
    try {
      const targetProduct = await this.getPublicProductById(productId);
      if (!targetProduct) {
        return [];
      }

      const categoryId = targetProduct.categoryId || targetProduct.category;
      const categoryProducts = await this.getProductsByCategory(categoryId, limitCount + 1);
      return categoryProducts.filter((product) => product.id !== productId).slice(0, limitCount);
    } catch (error) {
      console.error('Failed to load related products:', error);
      if (options.throwOnError) {
        throw error;
      }
      return [];
    }
  }

  static async getHomePageProducts(limits: HomePageProductLimits = {}): Promise<HomePageProductGroups> {
    try {
      const recommendedLimit = limits.recommended ?? 8;
      const bestSellerLimit = limits.bestSeller ?? 8;
      const bestSellerQueryLimit = Math.max(recommendedLimit, bestSellerLimit);

      const [newProducts, saleProducts, bestSellerProducts] = await Promise.all([
        this.queryProducts({
          status: 'active',
          isNew: true,
          sort: { field: 'createdAt', order: 'desc' },
          limitCount: limits.new ?? 8,
        }),
        this.queryProducts({
          status: 'active',
          isSale: true,
          sort: { field: 'createdAt', order: 'desc' },
          limitCount: limits.sale ?? 8,
        }),
        this.queryProducts({
          status: 'active',
          sort: { field: 'reviewCount', order: 'desc' },
          limitCount: bestSellerQueryLimit,
        }),
      ]);

      return {
        recommendedProducts: bestSellerProducts.items.slice(0, recommendedLimit),
        newProducts: newProducts.items,
        saleProducts: saleProducts.items,
        bestSellerProducts: bestSellerProducts.items.slice(0, bestSellerLimit),
      };
    } catch (error) {
      console.error('Failed to load home page products:', error);
      try {
        const products = getActiveProducts(await this.getTopLevelProducts('active'));

        return {
          recommendedProducts: selectRecommendedProducts(products, limits.recommended ?? 8),
          newProducts: selectNewProducts(products, limits.new ?? 8),
          saleProducts: selectSaleProducts(products, limits.sale ?? 8),
          bestSellerProducts: selectBestSellerProducts(products, limits.bestSeller ?? 8),
        };
      } catch (fallbackError) {
        console.error('Failed to load home page products with fallback:', fallbackError);
        throw new Error('홈 상품을 불러오는데 실패했습니다.');
      }
    }
  }

  static async getNewProducts(
    limitCount: number = 8,
    options: ProductLoaderOptions = {}
  ): Promise<Product[]> {
    try {
      const products = getActiveProducts(await this.getTopLevelProducts('active'));
      return selectNewProducts(products, limitCount);
    } catch (error) {
      console.error('Failed to load new products:', error);
      if (options.throwOnError) {
        throw error;
      }
      return [];
    }
  }

  static async getSaleProducts(
    limitCount: number = 8,
    options: ProductLoaderOptions = {}
  ): Promise<Product[]> {
    try {
      const products = getActiveProducts(await this.getTopLevelProducts('active'));
      return selectSaleProducts(products, limitCount);
    } catch (error) {
      console.error('Failed to load sale products:', error);
      if (options.throwOnError) {
        throw error;
      }
      return [];
    }
  }

  static async getBestSellerProducts(limitCount: number = 8): Promise<Product[]> {
    try {
      const products = getActiveProducts(await this.getTopLevelProducts('active'));
      return selectBestSellerProducts(products, limitCount);
    } catch (error) {
      console.error('Failed to load best seller products:', error);
      return [];
    }
  }

  static async getTopRatedProducts(limitCount: number = 24): Promise<Product[]> {
    try {
      const products = getActiveProducts(await this.getTopLevelProducts('active'));
      return selectTopRatedProducts(products, limitCount);
    } catch (error) {
      console.error('Failed to load top rated products:', error);
      return [];
    }
  }

  static async getReviewPopularProducts(
    limitCount: number = 24,
    options: ProductLoaderOptions = {}
  ): Promise<Product[]> {
    try {
      const products = getActiveProducts(await this.getTopLevelProducts('active'));
      return selectReviewPopularProducts(products, limitCount);
    } catch (error) {
      console.error('Failed to load review popular products:', error);
      if (options.throwOnError) {
        throw error;
      }
      return [];
    }
  }

  static async getRecommendedProducts(
    limitCount: number = 8,
    options: ProductLoaderOptions = {}
  ): Promise<Product[]> {
    try {
      const products = getActiveProducts(await this.getTopLevelProducts('active'));
      return selectRecommendedProducts(products, limitCount);
    } catch (error) {
      console.error('Failed to load recommended products:', error);
      if (options.throwOnError) {
        throw error;
      }
      return [];
    }
  }

  static async getCategories(): Promise<string[]> {
    try {
      const categories = await ProductRepository.listCategoryDocuments();
      return categories.map((category) => category.id).sort();
    } catch (error) {
      console.error('Failed to load categories:', error);
      return ['accessories', 'bags', 'bottoms', 'shoes', 'tops'];
    }
  }

  static async getCategoriesWithNames(): Promise<{ id: string; name: string }[]> {
    try {
      const categories = await ProductRepository.listCategoryDocuments();
      return categories
        .map((category) => ({
          id: category.id,
          name: typeof category.data.name === 'string' ? category.data.name : category.id,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      console.error('Failed to load category names:', error);
      return [
        { id: 'accessories', name: '액세서리' },
        { id: 'bags', name: '가방' },
        { id: 'bottoms', name: '바지' },
        { id: 'shoes', name: '신발' },
        { id: 'tops', name: '상의' },
      ];
    }
  }

  static async getBrands(): Promise<string[]> {
    try {
      const summaries = await this.getBrandSummaries();
      return summaries.map((brand) => brand.name);
    } catch (error) {
      console.error('Failed to load brands:', error);
      return [];
    }
  }

  static async getBrandSummaries(): Promise<BrandSummary[]> {
    try {
      const summaryDocs = await ProductRepository.listBrandSummaryDocuments();
      const summaries = summaryDocs
        .map((summaryDoc) => this.normalizeBrandSummary(summaryDoc.id, summaryDoc.data))
        .filter((summary): summary is BrandSummary => Boolean(summary))
        .sort((a, b) => a.name.localeCompare(b.name));

      if (summaries.length > 0) {
        return summaries;
      }

      const products = getActiveProducts(await this.getTopLevelProducts('active'));
      return this.toBrandSummaryFromProductGroups(products);
    } catch (error) {
      console.warn('Failed to load brand summaries. Falling back to products:', error);
      const products = getActiveProducts(await this.getTopLevelProducts('active'));
      return this.toBrandSummaryFromProductGroups(products);
    }
  }

  static getPriceRange(products: Product[]): { min: number; max: number } {
    if (products.length === 0) {
      return { min: 0, max: 0 };
    }

    const prices = products.map((product) => product.price);
    return {
      min: Math.min(...prices),
      max: Math.max(...prices),
    };
  }

  static isInStock(product: Product): boolean {
    return product.stock > 0;
  }

  static calculateDiscountPrice(price: number, saleRate?: number): number {
    if (!saleRate) {
      return price;
    }

    return Math.round(price * (1 - saleRate / 100));
  }

  static calculateAverageRating(products: Product[]): number {
    if (products.length === 0) {
      return 0;
    }

    const total = products.reduce((sum, product) => sum + product.rating, 0);
    return Math.round((total / products.length) * 10) / 10;
  }
}
