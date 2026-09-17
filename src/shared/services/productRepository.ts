import {
  collection,
  doc,
  documentId,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  Timestamp,
  where,
  writeBatch,
  type DocumentData,
  type QueryConstraint,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from '@/shared/libs/firebase/firebase';
import type { Product, ProductSort } from '@/shared/types/product';

const PRODUCTS_COLLECTION = 'products';
const BRAND_SUMMARIES_COLLECTION = 'brandSummaries';
const CATEGORIES_COLLECTION = 'categories';

export type ProductDocumentCursor = QueryDocumentSnapshot<DocumentData>;

export interface ProductRepositoryQueryInput {
  categoryId?: string;
  brand?: string;
  status?: Product['status'];
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  isNew?: boolean;
  isSale?: boolean;
  sort: ProductSort;
  startAfterDoc?: ProductDocumentCursor | null;
  limitCount: number;
}

export interface ProductDocumentRecord {
  id: string;
  data: DocumentData;
  cursor?: ProductDocumentCursor;
}

export const ProductRepository = {
  async queryProductDocuments(input: ProductRepositoryQueryInput): Promise<ProductDocumentCursor[]> {
    const constraints: QueryConstraint[] = [];

    if (input.status) {
      constraints.push(where('status', '==', input.status));
    }
    if (input.categoryId) {
      constraints.push(where('categoryId', '==', input.categoryId));
    }
    if (input.brand) {
      constraints.push(where('brand', '==', input.brand));
    }
    if (typeof input.minPrice === 'number') {
      constraints.push(where('price', '>=', input.minPrice));
    }
    if (typeof input.maxPrice === 'number') {
      constraints.push(where('price', '<=', input.maxPrice));
    }
    if (input.minRating !== undefined) {
      constraints.push(where('rating', '>=', input.minRating));
    }
    if (input.isNew !== undefined) {
      constraints.push(where('isNew', '==', input.isNew));
    }
    if (input.isSale !== undefined) {
      constraints.push(where('isSale', '==', input.isSale));
    }

    constraints.push(orderBy(input.sort.field, input.sort.order));
    constraints.push(orderBy('__name__', input.sort.order));

    const snapshot = await getDocs(query(
      collection(db, PRODUCTS_COLLECTION),
      ...constraints,
      ...(input.startAfterDoc ? [startAfter(input.startAfterDoc)] : []),
      limit(input.limitCount),
    ));

    return snapshot.docs;
  },

  async listProductDocuments(status?: Product['status']): Promise<ProductDocumentCursor[]> {
    const productsCollection = collection(db, PRODUCTS_COLLECTION);
    const productsQuery = status
      ? query(productsCollection, where('status', '==', status))
      : productsCollection;
    const snapshot = await getDocs(productsQuery);
    return snapshot.docs;
  },

  async getProductDocumentById(productId: string): Promise<ProductDocumentRecord | null> {
    const snapshot = await getDoc(doc(db, PRODUCTS_COLLECTION, productId));
    if (!snapshot.exists()) {
      return null;
    }

    return { id: snapshot.id, data: snapshot.data() };
  },

  async getPublicProductDocumentById(productId: string): Promise<ProductDocumentRecord | null> {
    const snapshot = await getDocs(query(
      collection(db, PRODUCTS_COLLECTION),
      where(documentId(), '==', productId),
      where('status', '==', 'active'),
      limit(1),
    ));
    const productDoc = snapshot.docs[0];

    return productDoc
      ? { id: productDoc.id, data: productDoc.data(), cursor: productDoc }
      : null;
  },

  async createProductDocument(data: Record<string, unknown>): Promise<ProductDocumentRecord> {
    const now = Timestamp.now();
    const productRef = doc(collection(db, PRODUCTS_COLLECTION));
    const persistedData = { ...data, createdAt: now, updatedAt: now };
    const batch = writeBatch(db);
    batch.set(productRef, persistedData);
    await batch.commit();

    return { id: productRef.id, data: persistedData };
  },

  async updateProductDocument(
    productId: string,
    data: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const persistedData = { ...data, updatedAt: Timestamp.now() };
    const batch = writeBatch(db);
    batch.set(doc(db, PRODUCTS_COLLECTION, productId), persistedData, { merge: true });
    await batch.commit();
    return persistedData;
  },

  async deleteProductDocument(productId: string): Promise<void> {
    const batch = writeBatch(db);
    batch.delete(doc(db, PRODUCTS_COLLECTION, productId));
    await batch.commit();
  },

  async listCategoryDocuments(): Promise<ProductDocumentRecord[]> {
    const snapshot = await getDocs(collection(db, CATEGORIES_COLLECTION));
    return snapshot.docs.map((categoryDoc) => ({
      id: categoryDoc.id,
      data: categoryDoc.data(),
      cursor: categoryDoc,
    }));
  },

  async listBrandSummaryDocuments(): Promise<ProductDocumentRecord[]> {
    const snapshot = await getDocs(collection(db, BRAND_SUMMARIES_COLLECTION));
    return snapshot.docs.map((summaryDoc) => ({
      id: summaryDoc.id,
      data: summaryDoc.data(),
      cursor: summaryDoc,
    }));
  },
};
