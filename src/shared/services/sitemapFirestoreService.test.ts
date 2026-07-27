import {
  collection,
  documentId,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  Timestamp,
  where,
} from 'firebase/firestore';
import { SitemapFirestoreService } from './sitemapFirestoreService';

jest.mock('firebase/firestore', () => {
  class MockTimestamp {
    readonly seconds: number;
    readonly nanoseconds: number;

    constructor(seconds: number, nanoseconds: number) {
      this.seconds = seconds;
      this.nanoseconds = nanoseconds;
    }

    toDate() {
      return new Date(this.seconds * 1000 + Math.floor(this.nanoseconds / 1_000_000));
    }
  }

  return {
    collection: jest.fn((db, name) => ({ kind: 'collection', name })),
    documentId: jest.fn(() => '__name__'),
    getDocs: jest.fn(),
    limit: jest.fn((count) => ({ type: 'limit', count })),
    orderBy: jest.fn((field, direction) => ({ type: 'orderBy', field, direction })),
    query: jest.fn((...args) => ({ kind: 'query', args })),
    startAfter: jest.fn((...values) => ({ type: 'startAfter', values })),
    Timestamp: MockTimestamp,
    where: jest.fn((field, operator, value) => ({ type: 'where', field, operator, value })),
  };
});

jest.mock('@/shared/libs/firebase/firebase', () => ({
  db: {},
}));

const makeProductDoc = (
  id: string,
  createdAt: InstanceType<typeof Timestamp>,
  updatedAt: InstanceType<typeof Timestamp> = createdAt,
) => ({
  id,
  data: () => ({
    status: 'active',
    createdAt,
    updatedAt,
  }),
});

describe('SitemapFirestoreService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(getDocs).mockReset();
  });

  test('advances active products with a createdAt and document-id keyset', async () => {
    const newest = new Timestamp(1_800_000_000, 900);
    const boundary = new Timestamp(1_700_000_000, 500);
    const extra = new Timestamp(1_600_000_000, 100);
    jest.mocked(getDocs).mockResolvedValueOnce({
      docs: [
        makeProductDoc('product-c', newest),
        makeProductDoc('product-b', boundary),
        makeProductDoc('product-a', extra),
      ],
    } as unknown as Awaited<ReturnType<typeof getDocs>>);

    const firstPage = await SitemapFirestoreService.queryActiveProductsPage({ pageSize: 2 });

    expect(firstPage.items.map((product) => product.id)).toEqual(['product-c', 'product-b']);
    expect(firstPage.hasMore).toBe(true);
    expect(firstPage.nextCursor).toEqual({
      createdAt: { seconds: boundary.seconds, nanoseconds: boundary.nanoseconds },
      productId: 'product-b',
    });
    expect(where).toHaveBeenCalledWith('status', '==', 'active');
    expect(orderBy).toHaveBeenCalledWith('createdAt', 'desc');
    expect(documentId).toHaveBeenCalledTimes(1);
    expect(orderBy).toHaveBeenCalledWith('__name__', 'desc');
    expect(limit).toHaveBeenCalledWith(3);

    jest.mocked(getDocs).mockResolvedValueOnce({
      docs: [makeProductDoc('product-a', extra)],
    } as unknown as Awaited<ReturnType<typeof getDocs>>);

    const secondPage = await SitemapFirestoreService.queryActiveProductsPage({
      pageSize: 2,
      cursor: firstPage.nextCursor,
    });

    expect(secondPage.items.map((product) => product.id)).toEqual(['product-a']);
    expect(secondPage.hasMore).toBe(false);
    expect(startAfter).toHaveBeenCalledWith(
      expect.objectContaining({ seconds: boundary.seconds, nanoseconds: boundary.nanoseconds }),
      'product-b',
    );
    expect(query).toHaveBeenCalledTimes(2);
  });

  test('propagates Firestore failures after one query without a full-collection fallback', async () => {
    const upstreamError = new Error('The query requires an index.');
    jest.mocked(getDocs).mockRejectedValueOnce(upstreamError);

    await expect(
      SitemapFirestoreService.queryActiveProductsPage({ pageSize: 500 }),
    ).rejects.toBe(upstreamError);
    expect(getDocs).toHaveBeenCalledTimes(1);
  });

  test('loads only active category ids for routes accepted by the category page', async () => {
    jest.mocked(getDocs).mockResolvedValueOnce({
      docs: [{ id: 'tops' }, { id: 'bags' }],
    } as unknown as Awaited<ReturnType<typeof getDocs>>);

    await expect(SitemapFirestoreService.getCategoryIds()).resolves.toEqual(['bags', 'tops']);
    expect(where).toHaveBeenCalledWith('isActive', '==', true);
    expect(query).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'collection', name: 'categories' }),
      expect.objectContaining({ field: 'isActive', operator: '==', value: true }),
    );
  });

  test('loads category ids without substituting fallback data on Firebase failure', async () => {
    const upstreamError = new Error('categories unavailable');
    jest.mocked(getDocs).mockRejectedValueOnce(upstreamError);

    await expect(SitemapFirestoreService.getCategoryIds()).rejects.toBe(upstreamError);
    expect(collection).toHaveBeenCalledWith(expect.anything(), 'categories');
  });
});
