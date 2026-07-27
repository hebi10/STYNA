import {
  collection,
  documentId,
  getDocs,
  limit,
  orderBy,
  query,
  type QueryConstraint,
  startAfter,
  Timestamp,
  where,
} from 'firebase/firestore';
import { db } from '@/shared/libs/firebase/firebase';

const PRODUCTS_COLLECTION = 'products';
const CATEGORIES_COLLECTION = 'categories';
const DEFAULT_PAGE_SIZE = 500;

interface TimestampParts {
  seconds: number;
  nanoseconds: number;
}

export interface SitemapProductCursor {
  createdAt: TimestampParts;
  productId: string;
}

export interface SitemapProductItem {
  id: string;
  updatedAt?: Date;
}

export interface SitemapProductPage {
  items: SitemapProductItem[];
  hasMore: boolean;
  nextCursor?: SitemapProductCursor;
}

export interface SitemapProductPageInput {
  pageSize?: number;
  cursor?: SitemapProductCursor | null;
}

function isValidTimestampParts(value: unknown): value is TimestampParts {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<TimestampParts>;
  return (
    typeof candidate.seconds === 'number'
    && Number.isFinite(candidate.seconds)
    && Number.isInteger(candidate.seconds)
    && typeof candidate.nanoseconds === 'number'
    && Number.isInteger(candidate.nanoseconds)
    && candidate.nanoseconds >= 0
    && candidate.nanoseconds < 1_000_000_000
  );
}

function timestampPartsFromDate(date: Date): TimestampParts | null {
  const milliseconds = date.getTime();
  if (!Number.isFinite(milliseconds)) {
    return null;
  }

  const seconds = Math.floor(milliseconds / 1000);
  return {
    seconds,
    nanoseconds: Math.trunc((milliseconds - seconds * 1000) * 1_000_000),
  };
}

function toTimestampParts(value: unknown): TimestampParts | null {
  if (isValidTimestampParts(value)) {
    return {
      seconds: value.seconds,
      nanoseconds: value.nanoseconds,
    };
  }

  if (value instanceof Date) {
    return timestampPartsFromDate(value);
  }

  if (value && typeof (value as { toDate?: unknown }).toDate === 'function') {
    const date = (value as { toDate: () => Date }).toDate();
    return date instanceof Date ? timestampPartsFromDate(date) : null;
  }

  return null;
}

function toDate(value: unknown): Date | undefined {
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value : undefined;
  }

  if (value && typeof (value as { toDate?: unknown }).toDate === 'function') {
    const date = (value as { toDate: () => Date }).toDate();
    return date instanceof Date && Number.isFinite(date.getTime()) ? date : undefined;
  }

  return undefined;
}

function normalizePageSize(pageSize: number | undefined): number {
  const candidate = pageSize ?? DEFAULT_PAGE_SIZE;
  if (!Number.isFinite(candidate) || candidate < 1) {
    throw new RangeError('Sitemap product pageSize must be a positive finite number.');
  }

  return Math.floor(candidate);
}

export class SitemapFirestoreService {
  static async getCategoryIds(): Promise<string[]> {
    const snapshot = await getDocs(query(
      collection(db, CATEGORIES_COLLECTION),
      where('isActive', '==', true),
    ));
    return snapshot.docs.map((categoryDoc) => categoryDoc.id).sort();
  }

  static async queryActiveProductsPage(
    input: SitemapProductPageInput = {},
  ): Promise<SitemapProductPage> {
    const pageSize = normalizePageSize(input.pageSize);
    const constraints: QueryConstraint[] = [
      where('status', '==', 'active'),
      orderBy('createdAt', 'desc'),
      orderBy(documentId(), 'desc'),
    ];

    if (input.cursor) {
      const { createdAt, productId } = input.cursor;
      if (!isValidTimestampParts(createdAt) || !productId) {
        throw new TypeError('Sitemap product cursor is invalid.');
      }

      constraints.push(
        startAfter(new Timestamp(createdAt.seconds, createdAt.nanoseconds), productId),
      );
    }

    constraints.push(limit(pageSize + 1));

    const snapshot = await getDocs(query(
      collection(db, PRODUCTS_COLLECTION),
      ...constraints,
    ));
    const pageDocuments = snapshot.docs.slice(0, pageSize);
    const hasMore = snapshot.docs.length > pageSize;
    const items = pageDocuments.map((productDocument) => {
      const data = productDocument.data();
      return {
        id: productDocument.id,
        updatedAt: toDate(data.updatedAt),
      };
    });

    if (!hasMore) {
      return { items, hasMore: false };
    }

    const boundaryDocument = pageDocuments[pageDocuments.length - 1];
    const createdAt = boundaryDocument
      ? toTimestampParts(boundaryDocument.data().createdAt)
      : null;

    if (!boundaryDocument || !createdAt) {
      throw new Error('Active sitemap product is missing a valid createdAt cursor value.');
    }

    return {
      items,
      hasMore: true,
      nextCursor: {
        createdAt,
        productId: boundaryDocument.id,
      },
    };
  }
}
