const fs = require('fs');

const file = 'src/shared/services/productService.ts';
let source = fs.readFileSync(file, 'utf8');

function replaceExact(from, to, expectedCount = 1) {
  const count = source.split(from).length - 1;
  if (count !== expectedCount) {
    throw new Error(`Expected ${expectedCount} occurrence(s), found ${count}: ${from.slice(0, 120)}`);
  }
  source = source.split(from).join(to);
}

function replaceBetween(start, end, replacement) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  if (startIndex < 0 || endIndex < 0) {
    throw new Error(`Could not find range: ${start.slice(0, 80)} ... ${end.slice(0, 80)}`);
  }
  source = source.slice(0, startIndex) + replacement + source.slice(endIndex);
}

replaceBetween(
  "import {\n  collection,",
  "import { Product, ProductFilter, ProductSort } from '@/shared/types/product';",
  `import type { Product, ProductFilter, ProductSort } from '@/shared/types/product';\nimport { isFirestorePermissionDenied } from '@/shared/utils/firebaseError';\nimport {\n  applyProductQueryClientSide,\n  compareProductToSortKey,\n  createProductClientCursor,\n  filterProductsByKeyword,\n  getActiveProducts,\n  getProductSortValue,\n  isFirestoreTimestampSortValue,\n  normalizeProductSearchTerm,\n  normalizeProductSort,\n  selectBestSellerProducts,\n  selectNewProducts,\n  selectRecommendedProducts,\n  selectReviewPopularProducts,\n  selectSaleProducts,\n  selectTopRatedProducts,\n  sortProducts,\n  type ClientProductSortValue,\n  type FirestoreTimestampSortValue,\n  type ProductClientCursor,\n} from './productDomain';\nimport {\n  cleanProductObject,\n  normalizeProductCategoryId,\n  normalizeProductDocument,\n  withoutServerOwnedReviewStats,\n  type ProductDocumentData,\n} from './productMapper';\nimport { ProductRepository, type ProductDocumentCursor } from './productRepository';\n\nexport { normalizeProductSearchTerm } from './productDomain';\nexport type { ClientProductSortValue, FirestoreTimestampSortValue } from './productDomain';\n\n`,
);

replaceExact("import { Product, ProductFilter, ProductSort } from '@/shared/types/product';\nimport { isFirestorePermissionDenied } from '@/shared/utils/firebaseError';\n", '');

replaceBetween(
  'export function normalizeProductSearchTerm(value: string): string {',
  'export interface ProductQueryInput {',
  `export type ClientProductCursor = ProductClientCursor;\nexport type ProductPageCursor = ProductDocumentCursor | ProductClientCursor;\n\nfunction isRecord(value: unknown): value is Record<string, unknown> {\n  return Boolean(value && typeof value === 'object');\n}\n\nfunction isProductSort(value: unknown): value is ProductSort {\n  if (!isRecord(value)) {\n    return false;\n  }\n\n  return (\n    typeof value.field === 'string'\n    && ['price', 'rating', 'createdAt', 'name', 'reviewCount'].includes(value.field)\n    && (value.order === 'asc' || value.order === 'desc')\n  );\n}\n\nfunction isClientProductCursor(cursor: unknown): cursor is ClientProductCursor {\n  if (\n    !isRecord(cursor)\n    || cursor.kind !== 'client-keyset'\n    || !isProductSort(cursor.sort)\n    || typeof cursor.productId !== 'string'\n    || cursor.productId.length === 0\n  ) {\n    return false;\n  }\n\n  switch (cursor.sort.field) {\n    case 'createdAt':\n      return isFirestoreTimestampSortValue(cursor.sortValue);\n    case 'name':\n      return typeof cursor.sortValue === 'string';\n    case 'price':\n    case 'rating':\n    case 'reviewCount':\n      return typeof cursor.sortValue === 'number' && Number.isFinite(cursor.sortValue);\n  }\n}\n\nfunction isFirestoreProductCursor(cursor: unknown): cursor is ProductDocumentCursor {\n  return (\n    isRecord(cursor)\n    && typeof cursor.id === 'string'\n    && cursor.id.length > 0\n    && typeof cursor.data === 'function'\n  );\n}\n\ntype ProductStatus = Product['status'];\n\ninterface ProductDocumentRecord {\n  product: Product;\n  data: ProductDocumentData;\n}\n\n`,
);

replaceBetween(
  "  private static readonly PRODUCTS_COLLECTION = 'products';",
  '  private static async queryProductsWithClientFallback',
  `  private static readonly DEFAULT_PAGE_SIZE = 24;\n  private static readonly KEYWORD_SCAN_MULTIPLIER = 3;\n\n  private static async queryProductsWithClientFallback`,
);

replaceExact('this.normalizeSort(', 'normalizeProductSort(', 3);
replaceExact('this.applyQueryClientSide(', 'applyProductQueryClientSide(', 1);
replaceExact('this.createClientProductCursor(', 'createProductClientCursor(', 1);
replaceExact('this.compareProductToSortKey(', 'compareProductToSortKey(', 2);
replaceExact('this.normalizeProduct(', 'normalizeProductDocument(', 4);
replaceExact('this.getProductSortValue(', 'getProductSortValue(', 3);
replaceExact('this.filterByKeyword(', 'filterProductsByKeyword(', 1);
replaceExact('this.getActiveProducts(', 'getActiveProducts(', 7);
replaceExact('this.selectRecommendedProducts(', 'selectRecommendedProducts(', 2);
replaceExact('this.selectNewProducts(', 'selectNewProducts(', 2);
replaceExact('this.selectSaleProducts(', 'selectSaleProducts(', 2);
replaceExact('this.selectBestSellerProducts(', 'selectBestSellerProducts(', 2);
replaceExact('this.selectTopRatedProducts(', 'selectTopRatedProducts(', 1);
replaceExact('this.selectReviewPopularProducts(', 'selectReviewPopularProducts(', 1);
replaceExact('this.sortProducts(', 'sortProducts(', 1);
replaceExact('this.normalizeCategoryId(', 'normalizeProductCategoryId(', 4);
replaceExact('this.cleanObject(', 'cleanProductObject(', 2);
replaceExact('this.withoutServerOwnedReviewStats(', 'withoutServerOwnedReviewStats(', 1);

replaceBetween(
  '  private static async getTopLevelProductRecords(',
  '  private static toBrandSummaryFromProductGroups',
  `  private static async getTopLevelProductRecords(\n    status?: ProductStatus,\n  ): Promise<ProductDocumentRecord[]> {\n    const docs = await ProductRepository.listProductDocuments(status);\n    return docs.map((productDoc) => {\n      const data = productDoc.data() as ProductDocumentData;\n      return {\n        product: normalizeProductDocument(productDoc.id, data),\n        data,\n      };\n    });\n  }\n\n  private static async getTopLevelProductById(productId: string): Promise<Product | null> {\n    const productDoc = await ProductRepository.getProductDocumentById(productId);\n    return productDoc\n      ? normalizeProductDocument(productDoc.id, productDoc.data as ProductDocumentData)\n      : null;\n  }\n\n  private static toBrandSummaryFromProductGroups`,
);

replaceBetween(
  '      const constraints: QueryConstraint[] = [];',
  '      let cursor:',
  `      const categoryId = queryInput.category || queryInput.categoryId;\n\n      let cursor:`,
);
replaceExact(
  '      let cursor: QueryDocumentSnapshot<DocumentData> | null = firestoreCursor;',
  '      let cursor: ProductDocumentCursor | null = firestoreCursor;',
);
replaceBetween(
  '        const pagedQuery = query(',
  '        if (docs.length === 0) {',
  `        const docs = await ProductRepository.queryProductDocuments({\n          status: queryInput.status,\n          categoryId: categoryId ? normalizeProductCategoryId({ categoryId }) : undefined,\n          brand: queryInput.brand,\n          minPrice: queryInput.minPrice,\n          maxPrice: queryInput.maxPrice,\n          minRating: queryInput.minRating,\n          isNew: queryInput.isNew,\n          isSale: queryInput.isSale,\n          sort,\n          startAfterDoc: cursor,\n          limitCount: queryLimit,\n        });\n\n        if (docs.length === 0) {`,
);

replaceBetween(
  '  static async createProduct(product: ProductPayload): Promise<Product> {',
  '  static async updateProduct(productId: string, updates: Partial<Product>): Promise<Product> {',
  `  static async createProduct(product: ProductPayload): Promise<Product> {\n    try {\n      const categoryId = normalizeProductCategoryId(product);\n      if (!categoryId) {\n        throw new Error('category or categoryId is required.');\n      }\n\n      const productData = cleanProductObject({\n        ...product,\n        rating: 0,\n        reviewCount: 0,\n        reviewSummary: {\n          schemaVersion: 1,\n          totalReviews: 0,\n          averageRating: 0,\n          recommendedCount: 0,\n          recommendationRate: 0,\n          ratingDistribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },\n        },\n        category: categoryId,\n        categoryId,\n        status: product.status || 'active',\n      });\n      const created = await ProductRepository.createProductDocument(productData as Record<string, unknown>);\n      return normalizeProductDocument(created.id, created.data as ProductDocumentData, categoryId);\n    } catch (error) {\n      console.error('Failed to create product:', error);\n      throw new Error('상품 생성에 실패했습니다.');\n    }\n  }\n\n  static async updateProduct(productId: string, updates: Partial<Product>): Promise<Product> {`,
);

replaceBetween(
  '  static async updateProduct(productId: string, updates: Partial<Product>): Promise<Product> {',
  '  static async deleteProduct(productId: string): Promise<void> {',
  `  static async updateProduct(productId: string, updates: Partial<Product>): Promise<Product> {\n    try {\n      const existingProduct = await this.getProductById(productId);\n      if (!existingProduct) {\n        throw new Error('상품을 찾을 수 없습니다.');\n      }\n\n      const previousCategoryId = existingProduct.categoryId || existingProduct.category;\n      const nextCategoryId = normalizeProductCategoryId(updates, previousCategoryId);\n      const hasCategoryUpdate = Object.prototype.hasOwnProperty.call(updates, 'category')\n        || Object.prototype.hasOwnProperty.call(updates, 'categoryId');\n      const updateData = cleanProductObject(withoutServerOwnedReviewStats({\n        ...updates,\n        ...(hasCategoryUpdate ? { category: nextCategoryId, categoryId: nextCategoryId } : {}),\n      }));\n\n      delete updateData.id;\n      delete updateData.createdAt;\n\n      const persistedData = await ProductRepository.updateProductDocument(\n        productId,\n        updateData as Record<string, unknown>,\n      );\n      return normalizeProductDocument(\n        productId,\n        { ...existingProduct, ...persistedData } as ProductDocumentData,\n        nextCategoryId,\n      );\n    } catch (error) {\n      console.error('Failed to update product:', error);\n      throw new Error('상품 수정에 실패했습니다.');\n    }\n  }\n\n  static async deleteProduct(productId: string): Promise<void> {`,
);

replaceBetween(
  '  static async deleteProduct(productId: string): Promise<void> {',
  '  static async getProductById(productId: string): Promise<Product | null> {',
  `  static async deleteProduct(productId: string): Promise<void> {\n    try {\n      const existingProduct = await this.getProductById(productId);\n      if (!existingProduct) {\n        throw new Error('상품을 찾을 수 없습니다.');\n      }\n      await ProductRepository.deleteProductDocument(productId);\n    } catch (error) {\n      console.error('Failed to delete product:', error);\n      throw new Error('상품 삭제에 실패했습니다.');\n    }\n  }\n\n  static async getProductById(productId: string): Promise<Product | null> {`,
);

replaceBetween(
  '  static async getPublicProductById(productId: string): Promise<Product | null> {',
  '  static async getPublicProductsByIds(productIds: string[]): Promise<Product[]> {',
  `  static async getPublicProductById(productId: string): Promise<Product | null> {\n    try {\n      const productDoc = await ProductRepository.getPublicProductDocumentById(productId);\n      if (!productDoc) {\n        return null;\n      }\n      const product = normalizeProductDocument(productDoc.id, productDoc.data as ProductDocumentData);\n      return product.status === 'active' ? product : null;\n    } catch (error) {\n      if (isFirestorePermissionDenied(error)) {\n        return null;\n      }\n      console.error('Failed to load public product detail:', error);\n      throw error;\n    }\n  }\n\n  static async getPublicProductsByIds(productIds: string[]): Promise<Product[]> {`,
);

replaceBetween(
  '  static async getCategories(): Promise<string[]> {',
  '  static async getBrands(): Promise<string[]> {',
  `  static async getCategories(): Promise<string[]> {\n    try {\n      const categories = await ProductRepository.listCategoryDocuments();\n      return categories.map((category) => category.id).sort();\n    } catch (error) {\n      console.error('Failed to load categories:', error);\n      return ['accessories', 'bags', 'bottoms', 'shoes', 'tops'];\n    }\n  }\n\n  static async getCategoriesWithNames(): Promise<{ id: string; name: string }[]> {\n    try {\n      const categories = await ProductRepository.listCategoryDocuments();\n      return categories\n        .map((category) => ({\n          id: category.id,\n          name: typeof category.data.name === 'string' ? category.data.name : category.id,\n        }))\n        .sort((a, b) => a.name.localeCompare(b.name));\n    } catch (error) {\n      console.error('Failed to load category names:', error);\n      return [\n        { id: 'accessories', name: '액세서리' },\n        { id: 'bags', name: '가방' },\n        { id: 'bottoms', name: '바지' },\n        { id: 'shoes', name: '신발' },\n        { id: 'tops', name: '상의' },\n      ];\n    }\n  }\n\n  static async getBrands(): Promise<string[]> {`,
);

replaceBetween(
  '      const summarySnapshot = await getDocs(collection(db, this.BRAND_SUMMARIES_COLLECTION));',
  '      if (summaries.length > 0) {',
  `      const summaryDocs = await ProductRepository.listBrandSummaryDocuments();\n      const summaries = summaryDocs\n        .map((summaryDoc) => this.normalizeBrandSummary(summaryDoc.id, summaryDoc.data))\n        .filter((summary): summary is BrandSummary => Boolean(summary))\n        .sort((a, b) => a.name.localeCompare(b.name));\n\n      if (summaries.length > 0) {`,
);

const forbidden = [
  "from 'firebase/firestore'",
  'private static normalizeProduct',
  'private static selectRecommendedProducts',
  'collection(db,',
  'getDocs(',
  'writeBatch(',
];
for (const value of forbidden) {
  if (source.includes(value)) {
    throw new Error(`Forbidden ProductService responsibility remains: ${value}`);
  }
}

fs.writeFileSync(file, source);
console.log('Phase 5 ProductService refactor applied.');
