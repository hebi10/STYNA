import { getDocs } from 'firebase/firestore';
import { ProductService } from './productService';

jest.mock('firebase/firestore', () => ({
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
  Timestamp: {
    now: jest.fn(() => ({ toDate: () => new Date('2026-01-01T00:00:00.000Z') })),
  },
}));

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
    expect(result.nextCursor?.id).toBe('product-12');
    expect(result.hasMore).toBe(true);
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
});
