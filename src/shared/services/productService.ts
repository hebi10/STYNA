import {
  collection,
  doc,
  getDocs,
  getDoc,
  query,
  where,
  writeBatch,
  orderBy,
  limit,
  startAfter,
  DocumentData,
  QueryDocumentSnapshot,
  QueryConstraint,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/shared/libs/firebase/firebase';
import { Product, ProductFilter, ProductSort } from '@/shared/types/product';

type ProductStatus = Product['status'];
type ProductDocumentData = Partial<Omit<Product, 'id' | 'createdAt' | 'updatedAt'>> & {
  createdAt?: unknown;
  updatedAt?: unknown;
};

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
  startAfterDoc?: QueryDocumentSnapshot<DocumentData> | null;
}

export interface ProductQueryResult {
  items: Product[];
  nextCursor?: QueryDocumentSnapshot<DocumentData>;
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

type ProductPayload = Omit<Product, 'id' | 'createdAt' | 'updatedAt'>;

export class ProductService {
  private static readonly PRODUCTS_COLLECTION = 'products';
  private static readonly BRAND_SUMMARIES_COLLECTION = 'brandSummaries';
  private static readonly DEFAULT_PAGE_SIZE = 24;
  private static readonly KEYWORD_SCAN_MULTIPLIER = 3;
  private static readonly DEFAULT_SORT: ProductSort = { field: 'createdAt', order: 'desc' };

  private static normalizeDate(value: unknown): Date {
    if (value instanceof Date) {
      return value;
    }

    if (value instanceof Timestamp) {
      return value.toDate();
    }

    if (value && typeof (value as { toDate?: () => Date }).toDate === 'function') {
      return (value as { toDate: () => Date }).toDate();
    }

    return new Date();
  }

  private static normalizeCategoryId(
    data: { category?: string; categoryId?: string },
    fallbackCategoryId?: string
  ): string {
    return data.categoryId || data.category || fallbackCategoryId || '';
  }

  private static normalizeProduct(
    id: string,
    data: ProductDocumentData,
    fallbackCategoryId?: string
  ): Product {
    const categoryId = this.normalizeCategoryId(data, fallbackCategoryId);

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
      createdAt: this.normalizeDate(data.createdAt),
      updatedAt: this.normalizeDate(data.updatedAt),
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

  private static cleanObject<T extends Record<string, unknown>>(obj: T): Partial<T> {
    const cleaned: Partial<T> = {};

    Object.entries(obj).forEach(([key, value]) => {
      if (value !== undefined) {
        cleaned[key as keyof T] = value as T[keyof T];
      }
    });

    return cleaned;
  }

  private static normalizeSort(sort?: ProductSort): ProductSort {
    if (!sort) {
      return { ...this.DEFAULT_SORT };
    }

    return sort;
  }

  private static filterByKeyword(products: Product[], keyword?: string): Product[] {
    if (!keyword) {
      return products;
    }

    const normalizedKeyword = keyword.trim().toLowerCase();
    if (!normalizedKeyword) {
      return products;
    }

    return products.filter((product) => {
      return (
        product.name.toLowerCase().includes(normalizedKeyword) ||
        (product.brand || '').toLowerCase().includes(normalizedKeyword) ||
        (product.description || '').toLowerCase().includes(normalizedKeyword) ||
        (product.category || '').toLowerCase().includes(normalizedKeyword) ||
        product.tags.some((tag) => tag.toLowerCase().includes(normalizedKeyword))
      );
    });
  }

  private static getActiveProducts(products: Product[]): Product[] {
    return products.filter((product) => product.status === 'active');
  }

  private static sortByCreatedAtDesc(products: Product[]): Product[] {
    return [...products].sort((a, b) => {
      const createdAtDiff = b.createdAt.getTime() - a.createdAt.getTime();
      return createdAtDiff !== 0 ? createdAtDiff : b.id.localeCompare(a.id);
    });
  }

  private static sortByReviewCountDesc(products: Product[]): Product[] {
    return [...products].sort((a, b) => {
      const reviewCountDiff = b.reviewCount - a.reviewCount;
      if (reviewCountDiff !== 0) {
        return reviewCountDiff;
      }

      const createdAtDiff = b.createdAt.getTime() - a.createdAt.getTime();
      return createdAtDiff !== 0 ? createdAtDiff : b.id.localeCompare(a.id);
    });
  }

  private static sortByRatingDesc(products: Product[]): Product[] {
    return [...products].sort((a, b) => {
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
    });
  }

  private static selectNewProducts(products: Product[], limitCount: number): Product[] {
    return this.sortByCreatedAtDesc(products.filter((product) => product.isNew)).slice(0, limitCount);
  }

  private static selectSaleProducts(products: Product[], limitCount: number): Product[] {
    return this.sortByCreatedAtDesc(
      products.filter((product) => product.isSale && product.saleRate && product.saleRate > 0)
    ).slice(0, limitCount);
  }

  private static selectBestSellerProducts(products: Product[], limitCount: number): Product[] {
    return this.sortByReviewCountDesc(
      products.filter((product) => product.reviewCount > 0)
    ).slice(0, limitCount);
  }

  private static selectTopRatedProducts(products: Product[], limitCount: number): Product[] {
    return this.sortByRatingDesc(
      products.filter((product) => product.rating >= 4.3)
    ).slice(0, limitCount);
  }

  private static selectReviewPopularProducts(products: Product[], limitCount: number): Product[] {
    return this.sortByReviewCountDesc(
      products.filter((product) => product.reviewCount >= 10)
    ).slice(0, limitCount);
  }

  private static selectRecommendedProducts(products: Product[], limitCount: number): Product[] {
    return products
      .filter((product) => product.rating >= 4)
      .sort((a, b) => {
        const scoreA = a.rating * 0.4 + Math.min(a.reviewCount / 10, 50) * 0.3 + (a.isNew ? 10 : 0);
        const scoreB = b.rating * 0.4 + Math.min(b.reviewCount / 10, 50) * 0.3 + (b.isNew ? 10 : 0);
        const scoreDiff = scoreB - scoreA;
        return scoreDiff !== 0 ? scoreDiff : b.createdAt.getTime() - a.createdAt.getTime();
      })
      .slice(0, limitCount);
  }

  private static sortProducts(products: Product[], sort: ProductSort): Product[] {
    return [...products].sort((a, b) => {
      let diff = 0;

      switch (sort.field) {
        case 'price':
          diff = a.price - b.price;
          break;
        case 'rating':
          diff = a.rating - b.rating;
          break;
        case 'createdAt':
          diff = a.createdAt.getTime() - b.createdAt.getTime();
          break;
        case 'name':
          diff = a.name.localeCompare(b.name);
          break;
        case 'reviewCount':
          diff = a.reviewCount - b.reviewCount;
          break;
        default:
          diff = 0;
      }

      const orderedDiff = sort.order === 'asc' ? diff : -diff;
      return orderedDiff !== 0 ? orderedDiff : a.id.localeCompare(b.id);
    });
  }

  private static applyQueryClientSide(products: Product[], queryInput: ProductQueryInput): Product[] {
    const sort = this.normalizeSort(queryInput.sort);
    const categoryFilter = queryInput.category || queryInput.categoryId;

    let filtered = products;

    if (queryInput.status) {
      filtered = filtered.filter((product) => product.status === queryInput.status);
    }

    if (categoryFilter) {
      const normalizedCategory = this.normalizeCategoryId({ categoryId: categoryFilter });
      filtered = filtered.filter((product) => this.normalizeCategoryId(product) === normalizedCategory);
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

    return this.sortProducts(this.filterByKeyword(filtered, queryInput.keyword), sort);
  }

  private static async queryProductsWithClientFallback(queryInput: ProductQueryInput): Promise<ProductQueryResult> {
    const pageSize = Math.max(1, queryInput.limitCount ?? this.DEFAULT_PAGE_SIZE);
    const products = this.applyQueryClientSide(await this.getTopLevelProducts(), queryInput);

    return {
      items: products.slice(0, pageSize),
      hasMore: false,
    };
  }

  private static async getTopLevelProducts(): Promise<Product[]> {
    const snapshot = await getDocs(collection(db, this.PRODUCTS_COLLECTION));
    return snapshot.docs.map((productDoc) => this.normalizeProduct(productDoc.id, productDoc.data()));
  }

  private static async getTopLevelProductById(productId: string): Promise<Product | null> {
    const snapshot = await getDoc(doc(db, this.PRODUCTS_COLLECTION, productId));
    if (!snapshot.exists()) {
      return null;
    }

    return this.normalizeProduct(snapshot.id, snapshot.data());
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
    try {
      const sort = this.normalizeSort(queryInput.sort);
      const pageSize = queryInput.limitCount ?? this.DEFAULT_PAGE_SIZE;
      const normalizedPageSize = Math.max(1, pageSize);
      const keyword = queryInput.keyword?.trim();
      const hasKeyword = Boolean(keyword);
      const scanMultiplier = hasKeyword ? this.KEYWORD_SCAN_MULTIPLIER : 1;
      const queryLimit = Math.max(
        normalizedPageSize + 1,
        normalizedPageSize * scanMultiplier + 1
      );

      const constraints: QueryConstraint[] = [];
      const filters = queryInput.category || queryInput.categoryId;

      if (queryInput.status) {
        constraints.push(where('status', '==', queryInput.status));
      }

      if (filters) {
        constraints.push(where('categoryId', '==', this.normalizeCategoryId({ categoryId: filters })));
      }

      if (queryInput.brand) {
        constraints.push(where('brand', '==', queryInput.brand));
      }

      if (typeof queryInput.minPrice === 'number') {
        constraints.push(where('price', '>=', queryInput.minPrice));
      }

      if (typeof queryInput.maxPrice === 'number') {
        constraints.push(where('price', '<=', queryInput.maxPrice));
      }

      if (queryInput.minRating !== undefined) {
        constraints.push(where('rating', '>=', queryInput.minRating));
      }

      if (queryInput.isNew !== undefined) {
        constraints.push(where('isNew', '==', queryInput.isNew));
      }

      if (queryInput.isSale !== undefined) {
        constraints.push(where('isSale', '==', queryInput.isSale));
      }

      constraints.push(orderBy(sort.field, sort.order));
      constraints.push(orderBy('__name__', sort.order));

      let inspectedCount = 0;
      let cursor: QueryDocumentSnapshot<DocumentData> | null = queryInput.startAfterDoc || null;
      let nextCursor: QueryDocumentSnapshot<DocumentData> | null = null;
      let hasMore = false;
      let collected: Product[] = [];

      while (true) {
        const pagedQuery = query(
          collection(db, this.PRODUCTS_COLLECTION),
          ...constraints,
          ...(cursor ? [startAfter(cursor)] : []),
          limit(queryLimit)
        );

        const snapshot = await getDocs(pagedQuery);
        const docs = snapshot.docs;

        if (docs.length === 0) {
          hasMore = false;
          break;
        }

        inspectedCount += docs.length;
        const candidates = docs.map((productDoc) =>
          this.normalizeProduct(productDoc.id, productDoc.data())
        );

        const filtered = this.filterByKeyword(candidates, keyword);
        collected = [...collected, ...filtered];
        const returnedItems = collected.slice(0, normalizedPageSize);
        const lastReturnedItem = returnedItems[returnedItems.length - 1];
        const lastReturnedDoc = lastReturnedItem
          ? docs.find((productDoc) => productDoc.id === lastReturnedItem.id)
          : null;
        nextCursor = lastReturnedDoc || docs[docs.length - 1];
        cursor = docs[docs.length - 1];

        if (collected.length >= normalizedPageSize || docs.length < queryLimit) {
          hasMore = collected.length >= normalizedPageSize && docs.length >= queryLimit;
          break;
        }
      }

      if (inspectedCount === 0) {
        return {
          items: [],
          hasMore: false,
        };
      }

      return {
        items: collected.slice(0, normalizedPageSize),
        nextCursor: hasMore && nextCursor ? nextCursor : undefined,
        hasMore,
      };
    } catch (error) {
      console.warn('Product query used client fallback:', error);

      try {
        return await this.queryProductsWithClientFallback(queryInput);
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
      const categoryId = this.normalizeCategoryId(product);
      if (!categoryId) {
        throw new Error('category or categoryId is required.');
      }

      const now = Timestamp.now();
      const productRef = doc(collection(db, this.PRODUCTS_COLLECTION));
      const productData = this.cleanObject({
        ...product,
        category: categoryId,
        categoryId,
        createdAt: now,
        updatedAt: now,
        status: product.status || 'active',
      });

      const batch = writeBatch(db);
      batch.set(productRef, productData);
      await batch.commit();

      return this.normalizeProduct(productRef.id, productData, categoryId);
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
      const nextCategoryId = this.normalizeCategoryId(updates, previousCategoryId);
      const now = Timestamp.now();

      const mergedProduct = this.cleanObject({
        ...existingProduct,
        ...updates,
        category: nextCategoryId,
        categoryId: nextCategoryId,
        updatedAt: now,
      });

      delete (mergedProduct as Partial<Product>).id;
      delete (mergedProduct as Partial<Product>).createdAt;

      const batch = writeBatch(db);
      batch.set(doc(db, this.PRODUCTS_COLLECTION, productId), mergedProduct, { merge: true });
      await batch.commit();

      return this.normalizeProduct(productId, mergedProduct, nextCategoryId);
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

      const batch = writeBatch(db);
      batch.delete(doc(db, this.PRODUCTS_COLLECTION, productId));
      await batch.commit();
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

  static async getProductsByCategory(categorySlug: string, limitCount?: number): Promise<Product[]> {
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
    return this.sortProducts(products, sort);
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

  static async getRelatedProducts(productId: string, limitCount: number = 4): Promise<Product[]> {
    try {
      const targetProduct = await this.getProductById(productId);
      if (!targetProduct) {
        return [];
      }

      const categoryId = targetProduct.categoryId || targetProduct.category;
      const categoryProducts = await this.getProductsByCategory(categoryId, limitCount + 1);
      return categoryProducts.filter((product) => product.id !== productId).slice(0, limitCount);
    } catch (error) {
      console.error('Failed to load related products:', error);
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
        const products = this.getActiveProducts(await this.getTopLevelProducts());

        return {
          recommendedProducts: this.selectRecommendedProducts(products, limits.recommended ?? 8),
          newProducts: this.selectNewProducts(products, limits.new ?? 8),
          saleProducts: this.selectSaleProducts(products, limits.sale ?? 8),
          bestSellerProducts: this.selectBestSellerProducts(products, limits.bestSeller ?? 8),
        };
      } catch (fallbackError) {
        console.error('Failed to load home page products with fallback:', fallbackError);
        return {
          recommendedProducts: [],
          newProducts: [],
          saleProducts: [],
          bestSellerProducts: [],
        };
      }
    }
  }

  static async getNewProducts(limitCount: number = 8): Promise<Product[]> {
    try {
      const products = this.getActiveProducts(await this.getTopLevelProducts());
      return this.selectNewProducts(products, limitCount);
    } catch (error) {
      console.error('Failed to load new products:', error);
      return [];
    }
  }

  static async getSaleProducts(limitCount: number = 8): Promise<Product[]> {
    try {
      const products = this.getActiveProducts(await this.getTopLevelProducts());
      return this.selectSaleProducts(products, limitCount);
    } catch (error) {
      console.error('Failed to load sale products:', error);
      return [];
    }
  }

  static async getBestSellerProducts(limitCount: number = 8): Promise<Product[]> {
    try {
      const products = this.getActiveProducts(await this.getTopLevelProducts());
      return this.selectBestSellerProducts(products, limitCount);
    } catch (error) {
      console.error('Failed to load best seller products:', error);
      return [];
    }
  }

  static async getTopRatedProducts(limitCount: number = 24): Promise<Product[]> {
    try {
      const products = this.getActiveProducts(await this.getTopLevelProducts());
      return this.selectTopRatedProducts(products, limitCount);
    } catch (error) {
      console.error('Failed to load top rated products:', error);
      return [];
    }
  }

  static async getReviewPopularProducts(limitCount: number = 24): Promise<Product[]> {
    try {
      const products = this.getActiveProducts(await this.getTopLevelProducts());
      return this.selectReviewPopularProducts(products, limitCount);
    } catch (error) {
      console.error('Failed to load review popular products:', error);
      return [];
    }
  }

  static async getRecommendedProducts(limitCount: number = 8): Promise<Product[]> {
    try {
      const products = this.getActiveProducts(await this.getTopLevelProducts());
      return this.selectRecommendedProducts(products, limitCount);
    } catch (error) {
      console.error('Failed to load recommended products:', error);
      return [];
    }
  }

  static async getCategories(): Promise<string[]> {
    try {
      const snapshot = await getDocs(collection(db, 'categories'));
      return snapshot.docs
        .map((categoryDoc) => categoryDoc.id)
        .sort();
    } catch (error) {
      console.error('Failed to load categories:', error);
      return ['accessories', 'bags', 'bottoms', 'shoes', 'tops'];
    }
  }

  static async getCategoriesWithNames(): Promise<{ id: string; name: string }[]> {
    try {
      const categoriesSnapshot = await getDocs(collection(db, 'categories'));
      return categoriesSnapshot.docs
        .map((categoryDoc) => ({
          id: categoryDoc.id,
          name: categoryDoc.data().name || categoryDoc.id,
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
      const summarySnapshot = await getDocs(collection(db, this.BRAND_SUMMARIES_COLLECTION));
      const summaries = summarySnapshot.docs
        .map((summaryDoc) => this.normalizeBrandSummary(summaryDoc.id, summaryDoc.data()))
        .filter((summary): summary is BrandSummary => Boolean(summary))
        .sort((a, b) => a.name.localeCompare(b.name));

      if (summaries.length > 0) {
        return summaries;
      }

      const products = this.getActiveProducts(await this.getTopLevelProducts());
      return this.toBrandSummaryFromProductGroups(products);
    } catch (error) {
      console.warn('Failed to load brand summaries. Falling back to products:', error);
      const products = this.getActiveProducts(await this.getTopLevelProducts());
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
