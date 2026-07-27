import { render } from '@testing-library/react';
import { notFound } from 'next/navigation';
import { ProductService } from '@/shared/services/productService';
import type { Product } from '@/shared/types/product';
import ProductPage, { generateMetadata } from './page';

jest.mock('next/navigation', () => ({
  notFound: jest.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));

jest.mock('@/shared/services/productService', () => ({
  ProductService: { getPublicProductById: jest.fn() },
}));

jest.mock('../_components/ProductDetailClient', () => ({
  __esModule: true,
  default: ({ product }: { product: Product }) => <div>{product.name}</div>,
}));

jest.mock('@/context/reviewProvider', () => ({
  ReviewProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const product: Product = {
  id: 'linen-shirt',
  name: '린넨 <셔츠>',
  description: '가벼운 여름 셔츠',
  price: 39000,
  brand: 'STYNA',
  category: 'tops',
  images: ['https://example.com/linen.webp'],
  mainImage: 'https://example.com/linen.webp',
  sizes: [],
  colors: [],
  stock: 2,
  rating: 4.7,
  reviewCount: 8,
  isNew: false,
  isSale: false,
  tags: [],
  createdAt: new Date('2026-07-01T00:00:00.000Z'),
  updatedAt: new Date('2026-07-01T00:00:00.000Z'),
  status: 'active',
  details: { material: '', origin: '', manufacturer: '', precautions: '', sizes: {} },
};

const props = { params: Promise.resolve({ productId: product.id }) };

describe('product detail server boundary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(ProductService.getPublicProductById).mockResolvedValue(product);
  });

  test('uses a canonical URL and the actual WebP MIME type', async () => {
    const metadata = await generateMetadata(props);

    expect(metadata.alternates?.canonical).toBe(
      'https://hebimall.web.app/products/linen-shirt/',
    );
    expect(metadata.openGraph).toEqual(expect.objectContaining({
      url: 'https://hebimall.web.app/products/linen-shirt/',
      images: [expect.objectContaining({ type: 'image/webp' })],
    }));
  });

  test('encodes a dynamic product id before building canonical URLs', async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ productId: 'linen shirt?#' }),
    });

    expect(metadata.alternates?.canonical).toBe(
      'https://hebimall.web.app/products/linen%20shirt%3F%23/',
    );
    expect(metadata.openGraph).toEqual(expect.objectContaining({
      url: 'https://hebimall.web.app/products/linen%20shirt%3F%23/',
    }));
  });

  test('renders safe Product JSON-LD', async () => {
    const page = await ProductPage(props);
    const { container } = render(page);
    const script = container.querySelector('script[type="application/ld+json"]');

    expect(script).not.toBeNull();
    expect(script?.innerHTML).toContain('\\u003c셔츠>');
    expect(JSON.parse(script?.innerHTML || '{}')).toMatchObject({
      '@type': 'Product',
      name: '린넨 <셔츠>',
    });
  });

  test('routes only a confirmed missing product to notFound', async () => {
    jest.mocked(ProductService.getPublicProductById).mockResolvedValue(null);
    await expect(ProductPage(props)).rejects.toThrow('NEXT_NOT_FOUND');
    expect(notFound).toHaveBeenCalled();
  });

  test('propagates Firestore failures instead of converting them to 404', async () => {
    jest.mocked(ProductService.getPublicProductById).mockRejectedValue(
      new Error('firestore unavailable'),
    );

    await expect(ProductPage(props)).rejects.toThrow('firestore unavailable');
    await expect(generateMetadata(props)).rejects.toThrow('firestore unavailable');
  });
});
