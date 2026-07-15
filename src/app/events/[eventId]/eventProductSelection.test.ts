import { Event, EventUiVariant } from '@/shared/types/event';
import { Product } from '@/shared/types/product';
import { ProductService } from '@/shared/services/productService';

import {
  EventProductLoader,
  getEventProductSectionMeta,
  loadEventProducts,
} from './eventProductSelection';

jest.mock('@/shared/services/productService', () => ({
  ProductService: {
    getProductById: jest.fn(),
    getProductsByCategory: jest.fn(),
    getSaleProducts: jest.fn(),
    getRecommendedProducts: jest.fn(),
    getReviewPopularProducts: jest.fn(),
    getNewProducts: jest.fn(),
  },
}));

const createProduct = (id: string, status: Product['status']): Product => ({
  id,
  name: `상품 ${id}`,
  description: `${id} 설명`,
  price: 10000,
  brand: '테스트 브랜드',
  category: 'tops',
  images: [`/${id}.webp`],
  sizes: ['FREE'],
  colors: ['black'],
  stock: 10,
  rating: 4.5,
  reviewCount: 10,
  isNew: false,
  isSale: false,
  tags: [],
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  status,
  details: {
    material: 'cotton',
    origin: '대한민국',
    manufacturer: '테스트 제조사',
    precautions: '단독 세탁',
    sizes: {},
  },
});

const activeProduct = (id: string) => createProduct(id, 'active');
const inactiveProduct = (id: string) => createProduct(id, 'inactive');

const createEvent = (overrides: Partial<Event> = {}): Event => ({
  id: 'event-1',
  title: '테스트 이벤트',
  description: '테스트 이벤트 설명',
  bannerImage: '/banner.webp',
  thumbnailImage: '/thumbnail.webp',
  eventType: 'sale',
  startDate: new Date('2026-07-01T00:00:00.000Z'),
  endDate: new Date('2026-07-31T23:59:59.000Z'),
  isActive: true,
  participantCount: 0,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  ...overrides,
});

interface ProductLoaderFixture {
  byId?: Product[];
  categories?: Record<string, Product[]>;
  fallback?: Product[];
}

const createProductLoader = ({
  byId = [],
  categories = {},
  fallback = [],
}: ProductLoaderFixture = {}): jest.Mocked<EventProductLoader> => ({
  getProductById: jest.fn(async id => byId.find(product => product.id === id) ?? null),
  getProductsByCategory: jest.fn(async category => categories[category] ?? []),
  getSaleProducts: jest.fn(async () => fallback),
  getRecommendedProducts: jest.fn(async () => fallback),
  getReviewPopularProducts: jest.fn(async () => fallback),
  getNewProducts: jest.fn(async () => fallback),
});

describe('getEventProductSectionMeta', () => {
  test.each([
    ['sale', '지금 할인 중인 상품', '/main/sale'],
    ['coupon', '쿠폰과 함께 보기 좋은 상품', '/recommend'],
    ['review', '리뷰가 많은 상품', '/reviews'],
    ['new', '새로 들어온 상품', '/recommend?filter=new'],
    ['special', '함께 보면 좋은 상품', '/recommend'],
  ])('returns product section metadata for %s', (variant, title, href) => {
    expect(getEventProductSectionMeta(variant as EventUiVariant)).toMatchObject({ title, href });
  });
});

describe('loadEventProducts', () => {
  test('uses strict ProductService options through the default event adapter', async () => {
    jest.mocked(ProductService.getProductsByCategory).mockResolvedValue([]);
    jest.mocked(ProductService.getSaleProducts).mockResolvedValue([]);

    await loadEventProducts({
      event: createEvent({ targetCategories: ['tops'] }),
      variant: 'sale',
    });

    expect(ProductService.getProductsByCategory).toHaveBeenCalledWith(
      'tops',
      8,
      { throwOnError: true },
    );
    expect(ProductService.getSaleProducts).toHaveBeenCalledWith(
      8,
      { throwOnError: true },
    );
  });

  test('caps the requested product limit at eight', async () => {
    const service = createProductLoader({
      fallback: Array.from({ length: 10 }, (_, index) => activeProduct(`p${index + 1}`)),
    });

    const products = await loadEventProducts({
      event: createEvent(),
      variant: 'sale',
      limit: 9,
      service,
    });

    expect(products).toHaveLength(8);
    expect(service.getSaleProducts).toHaveBeenCalledWith(8);
  });

  test('keeps explicit product order, removes inactive products, and fills to eight', async () => {
    const service = createProductLoader({
      byId: [activeProduct('p2'), inactiveProduct('p1')],
      fallback: [activeProduct('p3'), activeProduct('p2')],
    });

    const products = await loadEventProducts({
      event: createEvent({ targetProducts: ['p2', 'p1'] }),
      variant: 'sale',
      service,
    });

    expect(products.map(product => product.id)).toEqual(['p2', 'p3']);
    expect(service.getSaleProducts).toHaveBeenCalledWith(8);
  });

  test('deduplicates category products before using the variant fallback', async () => {
    const service = createProductLoader({
      categories: {
        tops: [activeProduct('p1'), activeProduct('p2')],
        outer: [activeProduct('p2'), activeProduct('p3')],
      },
      fallback: [activeProduct('p4')],
    });

    const products = await loadEventProducts({
      event: createEvent({ targetCategories: ['tops', 'outer'] }),
      variant: 'new',
      service,
    });

    expect(products.map(product => product.id)).toEqual(['p1', 'p2', 'p3', 'p4']);
    expect(service.getProductsByCategory).toHaveBeenNthCalledWith(1, 'tops', 8);
    expect(service.getProductsByCategory).toHaveBeenNthCalledWith(2, 'outer', 8);
    expect(service.getNewProducts).toHaveBeenCalledWith(8);
  });

  test.each([
    ['coupon', 'getRecommendedProducts'],
    ['review', 'getReviewPopularProducts'],
    ['special', 'getRecommendedProducts'],
  ] as const)('uses the %s variant fallback', async (variant, method) => {
    const service = createProductLoader({ fallback: [activeProduct('p1')] });

    await loadEventProducts({ event: createEvent(), variant, service });

    expect(service[method]).toHaveBeenCalledWith(8);
  });

  test('ignores failed explicit lookups and excluded categories while respecting the limit', async () => {
    const service = createProductLoader({
      categories: { tops: [activeProduct('p1'), activeProduct('p2')] },
      fallback: [activeProduct('p3')],
    });
    service.getProductById.mockRejectedValueOnce(new Error('lookup failed'));

    const products = await loadEventProducts({
      event: createEvent({
        targetProducts: ['missing'],
        targetCategories: ['', '전체', 'tops'],
      }),
      variant: 'sale',
      limit: 2,
      service,
    });

    expect(products.map(product => product.id)).toEqual(['p1', 'p2']);
    expect(service.getProductsByCategory).toHaveBeenCalledTimes(1);
    expect(service.getProductsByCategory).toHaveBeenCalledWith('tops', 2);
    expect(service.getSaleProducts).not.toHaveBeenCalled();
  });
});
