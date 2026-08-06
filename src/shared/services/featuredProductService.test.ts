import { getDoc } from 'firebase/firestore';
import { FeaturedProductService } from './featuredProductService';
import { ProductService } from './productService';
import type { Product } from '@/shared/types/product';

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  doc: jest.fn((_db, collectionName, id) => ({ collectionName, id })),
  getDocs: jest.fn(),
  getDoc: jest.fn(),
  setDoc: jest.fn(),
  updateDoc: jest.fn(),
  query: jest.fn(),
  orderBy: jest.fn(),
  Timestamp: { now: jest.fn() },
}));

jest.mock('@/shared/libs/firebase/firebase', () => ({ db: {} }));

jest.mock('./productService', () => ({
  ProductService: {
    getPublicProductById: jest.fn(),
  },
}));

const product = (id: string): Product => ({
  id,
  name: id,
  description: '',
  price: 10000,
  brand: 'STYNA',
  category: 'tops',
  images: [],
  sizes: [],
  colors: [],
  stock: 1,
  rating: 0,
  reviewCount: 0,
  isNew: false,
  isSale: false,
  tags: [],
  createdAt: new Date(),
  updatedAt: new Date(),
  status: 'active',
  details: { material: '', origin: '', manufacturer: '', precautions: '', sizes: {} },
});

describe('FeaturedProductService.getFeaturedSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    jest.mocked(getDoc).mockResolvedValue({
      exists: () => true,
      id: 'mainPageFeatured',
      data: () => ({
        productIds: ['second', 'missing', 'first', 'second'],
        title: '편집 추천',
        subtitle: '관리자 선택',
        description: '',
        isActive: true,
        maxCount: 4,
      }),
    } as never);
    jest.mocked(ProductService.getPublicProductById).mockImplementation(async (id) => (
      id === 'missing' ? null : product(id)
    ));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('reads the config once, resolves products in parallel, and preserves configured order', async () => {
    const section = await FeaturedProductService.getFeaturedSection();

    expect(getDoc).toHaveBeenCalledTimes(1);
    expect(ProductService.getPublicProductById).toHaveBeenCalledTimes(3);
    expect(section?.products.map((item) => item.id)).toEqual(['second', 'first']);
    expect(section?.config.title).toBe('편집 추천');
    expect(section?.config.heroImage).toBe('/style-now/autumn/style-now-autumn-main.webp');
  });

  test('rejects when the featured config lookup fails', async () => {
    const lookupError = new Error('firestore unavailable');
    jest.mocked(getDoc).mockRejectedValueOnce(lookupError);

    await expect(FeaturedProductService.getFeaturedProductConfig()).rejects.toBe(lookupError);
  });

  test('rejects when any configured product lookup fails', async () => {
    const lookupError = new Error('product lookup unavailable');
    jest.mocked(ProductService.getPublicProductById).mockImplementation(async (id) => {
      if (id === 'missing') {
        throw lookupError;
      }
      return product(id);
    });

    await expect(FeaturedProductService.getFeaturedSection()).rejects.toBe(lookupError);
  });
});
