import { doc, documentId, getDoc, getDocs, Timestamp, where, writeBatch } from 'firebase/firestore';
import { normalizeProductSearchTerm, ProductService } from './productService';

jest.mock('firebase/firestore', () => {
  class MockTimestamp {
    static now = jest.fn(() => new MockTimestamp());

    readonly seconds: number;
    readonly nanoseconds: number;

    constructor(seconds = 1767225600, nanoseconds = 0) {
      this.seconds = seconds;
      this.nanoseconds = nanoseconds;
    }

    toDate() {
      return new Date(this.seconds * 1000 + Math.floor(this.nanoseconds / 1_000_000));
    }
  }

  return {
    collection: jest.fn((db, name) => ({ kind: 'collection', name })),
    doc: jest.fn(),
    getDoc: jest.fn(),
    getDocs: jest.fn(),
    query: jest.fn((...args) => ({ kind: 'query', args })),
    where: jest.fn((field, op, value) => ({ type: 'where', field, op, value })),
    writeBatch: jest.fn(),
    orderBy: jest.fn((field, direction) => ({ type: 'orderBy', field, direction })),
    limit: jest.fn((count) => ({ type: 'limit', count })),
    startAfter: jest.fn((cursor) => ({ type: 'startAfter', cursor })),
    documentId: jest.fn(() => '__name__'),
    Timestamp: MockTimestamp,
  };
});

jest.mock('@/shared/libs/firebase/firebase', () => ({
  db: {},
}));

const makeDoc = (id: string, data: Record<string, unknown>) => ({
  id,
  data: () => ({
    name: id,
    description: '',
    price: 10000,
    brand: 'STYNA',
    category: data.categoryId || 'tops',
    categoryId: 'tops',
    images: [],
    sizes: [],
    colors: [],
    stock: 10,
    rating: 4.5,
    reviewCount: 3,
    isNew: false,
    isSale: false,
    tags: [],
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    status: 'active',
    details: {
      material: '',
      origin: '',
      manufacturer: '',
      precautions: '',
      sizes: {},
    },
    ...data,
  }),
});

describe('ProductService.queryProducts', () => {
  let consoleErrorSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(getDocs).mockReset();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  it('falls back to top-level products when Firestore composite query fails', async () => {
    jest
      .mocked(getDocs)
      .mockRejectedValueOnce(new Error('The query requires an index.'))
      .mockResolvedValueOnce({
        docs: [
          makeDoc('expensive-top', {
            categoryId: 'tops',
            price: 30000,
            createdAt: new Date('2026-01-03T00:00:00.000Z'),
          }),
          makeDoc('cheap-top', {
            categoryId: 'tops',
            price: 5000,
            createdAt: new Date('2026-01-02T00:00:00.000Z'),
          }),
          makeDoc('bag', {
            category: 'bags',
            categoryId: 'bags',
            price: 20000,
            createdAt: new Date('2026-01-04T00:00:00.000Z'),
          }),
          makeDoc('inactive-top', {
            categoryId: 'tops',
            status: 'inactive',
            price: 1000,
            createdAt: new Date('2026-01-05T00:00:00.000Z'),
          }),
        ],
      } as unknown as Awaited<ReturnType<typeof getDocs>>);

    const result = await ProductService.queryProducts({
      category: 'tops',
      status: 'active',
      minPrice: 0,
      maxPrice: 20000,
      sort: { field: 'createdAt', order: 'desc' },
      limitCount: 12,
    });

    expect(result.items.map((product) => product.id)).toEqual(['cheap-top']);
    expect(result.hasMore).toBe(false);
    expect(jest.mocked(where).mock.calls.filter(
      ([field, operator, value]) => field === 'status' && operator === '==' && value === 'active'
    )).toHaveLength(2);
  });

  it('keeps client-fallback pagination available instead of hiding later products', async () => {
    const fallbackDocs = Array.from({ length: 25 }, (_, index) => makeDoc(
      `fallback-${String(index + 1).padStart(2, '0')}`,
      { createdAt: new Date(`2026-01-${String((index % 25) + 1).padStart(2, '0')}T00:00:00.000Z`) },
    ));

    jest.mocked(getDocs)
      .mockRejectedValueOnce(new Error('The query requires an index.'))
      .mockResolvedValueOnce({ docs: fallbackDocs } as unknown as Awaited<ReturnType<typeof getDocs>>);

    const firstPage = await ProductService.queryProducts({
      status: 'active',
      sort: { field: 'createdAt', order: 'desc' },
      limitCount: 12,
    });

    expect(firstPage.items).toHaveLength(12);
    expect(firstPage.hasMore).toBe(true);
    expect(firstPage.nextCursor).toEqual({
      kind: 'client-keyset',
      sort: { field: 'createdAt', order: 'desc' },
      sortValue: {
        kind: 'firestore-timestamp',
        seconds: new Date('2026-01-14T00:00:00.000Z').getTime() / 1000,
        nanoseconds: 0,
      },
      productId: 'fallback-14',
    });

    jest.mocked(getDocs).mockResolvedValueOnce({
      docs: fallbackDocs,
    } as unknown as Awaited<ReturnType<typeof getDocs>>);

    const secondPage = await ProductService.queryProducts({
      status: 'active',
      sort: { field: 'createdAt', order: 'desc' },
      limitCount: 12,
      startAfterDoc: firstPage.nextCursor,
    });

    expect(secondPage.items).toHaveLength(12);
    expect(secondPage.items[0]?.id).not.toBe(firstPage.items[0]?.id);
    expect(secondPage.hasMore).toBe(true);
    expect(secondPage.nextCursor).toEqual({
      kind: 'client-keyset',
      sort: { field: 'createdAt', order: 'desc' },
      sortValue: {
        kind: 'firestore-timestamp',
        seconds: new Date('2026-01-02T00:00:00.000Z').getTime() / 1000,
        nanoseconds: 0,
      },
      productId: 'fallback-02',
    });
  });

  it('uses the last displayed product as the next-page cursor without skipping the extra document', async () => {
    jest.mocked(getDocs).mockResolvedValue({
      docs: Array.from({ length: 13 }, (_, index) => makeDoc(`product-${index + 1}`, {
        createdAt: new Date(`2026-01-${String(index + 1).padStart(2, '0')}T00:00:00.000Z`),
      })),
    } as unknown as Awaited<ReturnType<typeof getDocs>>);

    const result = await ProductService.queryProducts({
      status: 'active',
      sort: { field: 'createdAt', order: 'desc' },
      limitCount: 12,
    });

    expect(result.items).toHaveLength(12);
    expect(result.nextCursor && 'id' in result.nextCursor ? result.nextCursor.id : undefined)
      .toBe('product-12');
    expect(result.hasMore).toBe(true);
  });

  it('continues after a Firestore cursor when a later page switches to client fallback', async () => {
    const fallbackDocs = Array.from({ length: 25 }, (_, index) => makeDoc(
      `product-${String(index + 1).padStart(2, '0')}`,
      { createdAt: new Date(`2026-01-${String(25 - index).padStart(2, '0')}T00:00:00.000Z`) },
    ));
    const firstPageCursor = fallbackDocs[11];

    jest.mocked(getDocs)
      .mockRejectedValueOnce(new Error('transient paged query failure'))
      .mockResolvedValueOnce({ docs: fallbackDocs } as unknown as Awaited<ReturnType<typeof getDocs>>);

    const result = await ProductService.queryProducts({
      status: 'active',
      sort: { field: 'createdAt', order: 'desc' },
      limitCount: 12,
      startAfterDoc: firstPageCursor as never,
    });

    expect(result.items[0]?.id).toBe('product-13');
    expect(result.items).toHaveLength(12);
    expect(result.nextCursor).toEqual({
      kind: 'client-keyset',
      sort: { field: 'createdAt', order: 'desc' },
      sortValue: {
        kind: 'firestore-timestamp',
        seconds: new Date('2026-01-02T00:00:00.000Z').getTime() / 1000,
        nanoseconds: 0,
      },
      productId: 'product-24',
    });
  });

  it('matches the Firestore document-id tie-break direction after switching to fallback', async () => {
    const tiedDate = new Date('2026-01-10T00:00:00.000Z');
    const fallbackDocs = ['a', 'b', 'c', 'd'].map(id => makeDoc(id, { createdAt: tiedDate }));
    const firestoreCursor = makeDoc('c', { createdAt: tiedDate });

    jest.mocked(getDocs)
      .mockRejectedValueOnce(new Error('transient paged query failure'))
      .mockResolvedValueOnce({ docs: fallbackDocs } as unknown as Awaited<ReturnType<typeof getDocs>>);

    const result = await ProductService.queryProducts({
      status: 'active',
      sort: { field: 'createdAt', order: 'desc' },
      limitCount: 2,
      startAfterDoc: firestoreCursor as never,
    });

    expect(result.items.map(product => product.id)).toEqual(['b', 'a']);
    expect(result.hasMore).toBe(false);
  });

  it('uses Firestore UTF-8 byte ordering for mixed-case document-id ties', async () => {
    const tiedDate = new Date('2026-01-10T00:00:00.000Z');
    const fallbackDocs = ['A', 'B', 'Z', '_', 'a', 'b']
      .map(id => makeDoc(id, { createdAt: tiedDate }));
    const firestoreCursor = makeDoc('a', { createdAt: tiedDate });

    jest.mocked(getDocs)
      .mockRejectedValueOnce(new Error('transient paged query failure'))
      .mockResolvedValueOnce({ docs: fallbackDocs } as unknown as Awaited<ReturnType<typeof getDocs>>);

    const result = await ProductService.queryProducts({
      status: 'active',
      sort: { field: 'createdAt', order: 'desc' },
      limitCount: 10,
      startAfterDoc: firestoreCursor as never,
    });

    expect(result.items.map(product => product.id)).toEqual(['_', 'Z', 'B', 'A']);
  });

  it('uses Firestore UTF-8 byte ordering for string sort fields', async () => {
    const fallbackDocs = [
      makeDoc('lower-a', { name: 'a' }),
      makeDoc('underscore', { name: '_' }),
      makeDoc('upper-z', { name: 'Z' }),
      makeDoc('upper-a', { name: 'A' }),
      makeDoc('upper-b', { name: 'B' }),
    ];

    jest.mocked(getDocs)
      .mockRejectedValueOnce(new Error('The query requires an index.'))
      .mockResolvedValueOnce({ docs: fallbackDocs } as unknown as Awaited<ReturnType<typeof getDocs>>);

    const result = await ProductService.queryProducts({
      status: 'active',
      sort: { field: 'name', order: 'asc' },
      limitCount: 10,
    });

    expect(result.items.map(product => product.id)).toEqual([
      'upper-a',
      'upper-b',
      'upper-z',
      'underscore',
      'lower-a',
    ]);
  });

  it('preserves Firestore timestamp nanoseconds across a primary-cursor to fallback boundary', async () => {
    const seconds = 1767225600;
    const firestoreCursor = makeDoc('m-boundary', {
      createdAt: new Timestamp(seconds, 500),
    });
    const fallbackDocs = [
      makeDoc('a-before', { createdAt: new Timestamp(seconds, 900) }),
      makeDoc('z-after', { createdAt: new Timestamp(seconds, 100) }),
    ];

    jest.mocked(getDocs)
      .mockRejectedValueOnce(new Error('transient paged query failure'))
      .mockResolvedValueOnce({ docs: fallbackDocs } as unknown as Awaited<ReturnType<typeof getDocs>>);

    const result = await ProductService.queryProducts({
      status: 'active',
      sort: { field: 'createdAt', order: 'desc' },
      limitCount: 10,
      startAfterDoc: firestoreCursor as never,
    });

    expect(result.items.map(product => product.id)).toEqual(['z-after']);
  });

  it('round-trips a nanosecond timestamp keyset cursor through JSON without duplicate pages', async () => {
    const seconds = 1767225600;
    const fallbackDocs = [
      makeDoc('z-low', { createdAt: new Timestamp(seconds, 100) }),
      makeDoc('a-high', { createdAt: new Timestamp(seconds, 900) }),
    ];

    jest.mocked(getDocs)
      .mockRejectedValueOnce(new Error('The query requires an index.'))
      .mockResolvedValueOnce({ docs: fallbackDocs } as unknown as Awaited<ReturnType<typeof getDocs>>);

    const firstPage = await ProductService.queryProducts({
      status: 'active',
      sort: { field: 'createdAt', order: 'desc' },
      limitCount: 1,
    });

    expect(firstPage.items.map(product => product.id)).toEqual(['a-high']);
    expect(firstPage.nextCursor).toEqual({
      kind: 'client-keyset',
      sort: { field: 'createdAt', order: 'desc' },
      sortValue: {
        kind: 'firestore-timestamp',
        seconds,
        nanoseconds: 900,
      },
      productId: 'a-high',
    });

    const serializedCursor = JSON.parse(JSON.stringify(firstPage.nextCursor));
    jest.mocked(getDocs).mockResolvedValueOnce(
      { docs: fallbackDocs } as unknown as Awaited<ReturnType<typeof getDocs>>,
    );
    const secondPage = await ProductService.queryProducts({
      status: 'active',
      sort: { field: 'createdAt', order: 'desc' },
      limitCount: 1,
      startAfterDoc: serializedCursor,
    });

    expect(secondPage.items.map(product => product.id)).toEqual(['z-low']);
    expect(secondPage.hasMore).toBe(false);
  });

  it('continues from the cursor sort tuple when the Firestore cursor document disappeared', async () => {
    const firestoreCursor = makeDoc('product-3', {
      createdAt: new Date('2026-01-03T00:00:00.000Z'),
    });
    const fallbackDocs = [5, 4, 2, 1].map(day => makeDoc(`product-${day}`, {
      createdAt: new Date(`2026-01-0${day}T00:00:00.000Z`),
    }));

    jest.mocked(getDocs)
      .mockRejectedValueOnce(new Error('transient paged query failure'))
      .mockResolvedValueOnce({ docs: fallbackDocs } as unknown as Awaited<ReturnType<typeof getDocs>>);

    const result = await ProductService.queryProducts({
      status: 'active',
      sort: { field: 'createdAt', order: 'desc' },
      limitCount: 2,
      startAfterDoc: firestoreCursor as never,
    });

    expect(result.items.map(product => product.id)).toEqual(['product-2', 'product-1']);
    expect(result.hasMore).toBe(false);
  });

  it('uses a keyset cursor so inserts before the boundary do not duplicate later pages', async () => {
    const initialDocs = [5, 4, 3, 2, 1].map(day => makeDoc(`product-${day}`, {
      createdAt: new Date(`2026-01-0${day}T00:00:00.000Z`),
    }));
    const docsAfterInsert = [6, 5, 4, 3, 2, 1].map(day => makeDoc(`product-${day}`, {
      createdAt: new Date(`2026-01-0${day}T00:00:00.000Z`),
    }));

    jest.mocked(getDocs)
      .mockRejectedValueOnce(new Error('The query requires an index.'))
      .mockResolvedValueOnce({ docs: initialDocs } as unknown as Awaited<ReturnType<typeof getDocs>>);

    const firstPage = await ProductService.queryProducts({
      status: 'active',
      sort: { field: 'createdAt', order: 'desc' },
      limitCount: 2,
    });

    jest.mocked(getDocs).mockResolvedValueOnce(
      { docs: docsAfterInsert } as unknown as Awaited<ReturnType<typeof getDocs>>,
    );
    const secondPage = await ProductService.queryProducts({
      status: 'active',
      sort: { field: 'createdAt', order: 'desc' },
      limitCount: 2,
      startAfterDoc: firstPage.nextCursor,
    });

    jest.mocked(getDocs).mockResolvedValueOnce(
      { docs: docsAfterInsert } as unknown as Awaited<ReturnType<typeof getDocs>>,
    );
    const thirdPage = await ProductService.queryProducts({
      status: 'active',
      sort: { field: 'createdAt', order: 'desc' },
      limitCount: 2,
      startAfterDoc: secondPage.nextCursor,
    });

    const pagedIds = [...firstPage.items, ...secondPage.items, ...thirdPage.items]
      .map(product => product.id);
    expect(pagedIds).toEqual(['product-5', 'product-4', 'product-3', 'product-2', 'product-1']);
    expect(new Set(pagedIds).size).toBe(pagedIds.length);
    expect(thirdPage.hasMore).toBe(false);
  });

  it.each([
    ['legacy offset cursor', { kind: 'client-offset', offset: 12 }],
    ['malformed keyset cursor', {
      kind: 'client-keyset',
      sort: null,
      sortValue: 0,
      productId: 'product-2',
    }],
  ])('restarts safely from the first page for a %s', async (_caseName, invalidCursor) => {
    const fallbackDocs = [3, 2, 1].map(day => makeDoc(`product-${day}`, {
      createdAt: new Date(`2026-01-0${day}T00:00:00.000Z`),
    }));

    jest.mocked(getDocs)
      .mockRejectedValueOnce(new Error('The query requires an index.'))
      .mockResolvedValueOnce({ docs: fallbackDocs } as unknown as Awaited<ReturnType<typeof getDocs>>);

    const result = await ProductService.queryProducts({
      status: 'active',
      sort: { field: 'createdAt', order: 'desc' },
      limitCount: 2,
      startAfterDoc: invalidCursor as never,
    });

    expect(result.items.map(product => product.id)).toEqual(['product-3', 'product-2']);
  });

  it('restarts safely when a valid client cursor belongs to another sort', async () => {
    const fallbackDocs = [
      makeDoc('expensive', { price: 30000 }),
      makeDoc('cheap', { price: 10000 }),
    ];
    const mismatchedCursor = {
      kind: 'client-keyset',
      sort: { field: 'createdAt', order: 'desc' },
      sortValue: {
        kind: 'firestore-timestamp',
        seconds: 1767225600,
        nanoseconds: 0,
      },
      productId: 'old-boundary',
    } as const;

    jest.mocked(getDocs).mockResolvedValueOnce(
      { docs: fallbackDocs } as unknown as Awaited<ReturnType<typeof getDocs>>,
    );

    const result = await ProductService.queryProducts({
      status: 'active',
      sort: { field: 'price', order: 'asc' },
      limitCount: 2,
      startAfterDoc: mismatchedCursor as never,
    });

    expect(result.items.map(product => product.id)).toEqual(['cheap', 'expensive']);
  });
});

describe('ProductService.getPublicProductById', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(getDocs).mockReset();
    jest.mocked(getDoc).mockReset();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('queries by document id and active status without issuing an unrestricted document read', async () => {
    jest.mocked(getDocs).mockResolvedValue({
      docs: [makeDoc('active-product', { status: 'active' })],
    } as unknown as Awaited<ReturnType<typeof getDocs>>);

    const result = await ProductService.getPublicProductById('active-product');

    expect(result?.id).toBe('active-product');
    expect(getDoc).not.toHaveBeenCalled();
    expect(documentId).toHaveBeenCalledTimes(1);
    expect(where).toHaveBeenCalledWith('__name__', '==', 'active-product');
    expect(where).toHaveBeenCalledWith('status', '==', 'active');
  });

  it('returns null for an empty active query', async () => {
    jest.mocked(getDocs).mockResolvedValueOnce({
      docs: [],
    } as unknown as Awaited<ReturnType<typeof getDocs>>);

    await expect(ProductService.getPublicProductById('draft-product')).resolves.toBeNull();
  });

  it.each(['permission-denied', 'firestore/permission-denied'])(
    'normalizes Firebase %s to null for a hidden or missing public product',
    async (code) => {
      jest.mocked(getDocs).mockRejectedValueOnce({ code });

      await expect(ProductService.getPublicProductById('draft-product')).resolves.toBeNull();
    },
  );

  it.each(['unavailable', 'failed-precondition'])(
    'propagates Firebase %s failures from public product detail',
    async (code) => {
      const upstreamError = { code };
      jest.mocked(getDocs).mockRejectedValueOnce(upstreamError);

      await expect(ProductService.getPublicProductById('active-product')).rejects.toBe(upstreamError);
    },
  );
});

describe('ProductService.getPublicProductsByIds', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(getDocs).mockReset();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('deduplicates ids, skips missing products, and preserves the requested order', async () => {
    jest.mocked(getDocs)
      .mockResolvedValueOnce({
        docs: [makeDoc('product-b', { status: 'active' })],
      } as unknown as Awaited<ReturnType<typeof getDocs>>)
      .mockResolvedValueOnce({
        docs: [],
      } as unknown as Awaited<ReturnType<typeof getDocs>>)
      .mockResolvedValueOnce({
        docs: [makeDoc('product-a', { status: 'active' })],
      } as unknown as Awaited<ReturnType<typeof getDocs>>);

    const products = await ProductService.getPublicProductsByIds([
      'product-b',
      'missing',
      'product-a',
      'product-b',
    ]);

    expect(products.map((product) => product.id)).toEqual([
      'product-b',
      'product-a',
    ]);
    expect(getDocs).toHaveBeenCalledTimes(3);
  });

  it('propagates a public product service failure instead of returning a partial list', async () => {
    const upstreamError = { code: 'unavailable' };
    jest.mocked(getDocs)
      .mockResolvedValueOnce({
        docs: [makeDoc('product-a', { status: 'active' })],
      } as unknown as Awaited<ReturnType<typeof getDocs>>)
      .mockRejectedValueOnce(upstreamError);

    await expect(
      ProductService.getPublicProductsByIds(['product-a', 'product-b']),
    ).rejects.toBe(upstreamError);
  });
});

describe('ProductService.updateProduct', () => {
  test('writes only explicitly changed fields for a status-only update', async () => {
    const set = jest.fn();
    const commit = jest.fn().mockResolvedValue(undefined);
    const getProductSpy = jest.spyOn(ProductService, 'getProductById').mockResolvedValue({
        id: 'product-1',
        name: '현재 이름',
        description: '현재 설명',
        price: 10000,
        brand: 'STYNA',
        category: 'tops',
        categoryId: 'tops',
        images: [],
        sizes: [],
        colors: [],
        stock: 3,
        rating: 0,
        reviewCount: 0,
        isNew: false,
        isSale: false,
        tags: [],
        status: 'active',
        createdAt: new Date('2026-07-01T00:00:00.000Z'),
        updatedAt: new Date('2026-07-01T00:00:00.000Z'),
        details: { material: '', origin: '', manufacturer: '', precautions: '', sizes: {} },
      });
    jest.mocked(writeBatch).mockReturnValue({
      set,
      commit,
    } as unknown as ReturnType<typeof writeBatch>);
    jest.mocked(doc).mockReturnValue({ kind: 'product-ref' } as never);

    const result = await ProductService.updateProduct('product-1', { status: 'inactive' });

    expect(set).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ status: 'inactive' }),
      { merge: true },
    );
    const writtenFields = set.mock.calls[0][1];
    expect(writtenFields).not.toHaveProperty('name');
    expect(writtenFields).not.toHaveProperty('price');
    expect(result).toMatchObject({ name: '현재 이름', status: 'inactive' });
    expect(commit).toHaveBeenCalledTimes(1);
    getProductSpy.mockRestore();
  });

  test('never writes stale server-owned review statistics from an edit payload', async () => {
    const set = jest.fn();
    const commit = jest.fn().mockResolvedValue(undefined);
    const getProductSpy = jest.spyOn(ProductService, 'getProductById').mockResolvedValue({
      id: 'product-1',
      name: '현재 이름',
      description: '현재 설명',
      price: 10000,
      brand: 'STYNA',
      category: 'tops',
      categoryId: 'tops',
      images: [],
      sizes: [],
      colors: [],
      stock: 3,
      rating: 4.8,
      reviewCount: 50,
      isNew: false,
      isSale: false,
      tags: [],
      status: 'active',
      createdAt: new Date('2026-07-01T00:00:00.000Z'),
      updatedAt: new Date('2026-07-01T00:00:00.000Z'),
      details: { material: '', origin: '', manufacturer: '', precautions: '', sizes: {} },
    });
    jest.mocked(writeBatch).mockReturnValue({ set, commit } as unknown as ReturnType<typeof writeBatch>);
    jest.mocked(doc).mockReturnValue({ kind: 'product-ref' } as never);

    const result = await ProductService.updateProduct('product-1', {
      name: '새 이름',
      rating: 1,
      reviewCount: 2,
      reviewSummary: { totalReviews: 2 },
      reviewStatsEventTime: 'stale',
      reviewStatsRunToken: 'stale',
      reviewStatsUpdatedAt: 'stale',
      reviewStatsVersion: 'stale',
    } as never);

    const writtenFields = set.mock.calls[0][1];
    expect(writtenFields).toMatchObject({ name: '새 이름' });
    for (const field of [
      'rating',
      'reviewCount',
      'reviewSummary',
      'reviewStatsEventTime',
      'reviewStatsRunToken',
      'reviewStatsUpdatedAt',
      'reviewStatsVersion',
    ]) {
      expect(writtenFields).not.toHaveProperty(field);
    }
    expect(result).toMatchObject({ name: '새 이름', rating: 4.8, reviewCount: 50 });
    getProductSpy.mockRestore();
  });
});

describe('normalizeProductSearchTerm', () => {
  it('normalizes width, surrounding whitespace, and repeated whitespace', () => {
    expect(normalizeProductSearchTerm('  ＳＴＹＮＡ\t  린넨   셔츠  ')).toBe('STYNA 린넨 셔츠');
  });
});

describe('ProductService.getHomePageProducts', () => {
  beforeEach(() => {
    jest.mocked(getDocs).mockReset();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('loads home sections with limited section queries instead of one full product scan', async () => {
    jest.mocked(getDocs).mockResolvedValue({
      docs: [
        makeDoc('home-product', {
          isNew: true,
          isSale: true,
          reviewCount: 12,
          createdAt: new Date('2026-01-03T00:00:00.000Z'),
        }),
      ],
    } as unknown as Awaited<ReturnType<typeof getDocs>>);

    await ProductService.getHomePageProducts();

    expect(getDocs).toHaveBeenCalledTimes(3);
  });

  it('rejects when both the section queries and the top-level fallback fail', async () => {
    jest.mocked(getDocs).mockRejectedValue(new Error('firestore unavailable'));

    await expect(ProductService.getHomePageProducts()).rejects.toThrow(
      '홈 상품을 불러오는데 실패했습니다.',
    );
  });
});

describe('ProductService strict product loaders', () => {
  beforeEach(() => {
    jest.mocked(getDocs).mockReset();
    jest.mocked(getDocs).mockRejectedValue(new Error('firestore unavailable'));
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('rejects a variant loader failure when throwOnError is true', async () => {
    await expect(
      ProductService.getSaleProducts(8, { throwOnError: true })
    ).rejects.toThrow('firestore unavailable');
  });

  it('rejects a category loader failure when throwOnError is true', async () => {
    await expect(
      ProductService.getProductsByCategory('tops', 8, { throwOnError: true })
    ).rejects.toBeInstanceOf(Error);
  });
});
