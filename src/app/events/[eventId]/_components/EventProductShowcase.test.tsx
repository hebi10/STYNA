import { fireEvent, render, screen } from '@testing-library/react';
import { Event } from '@/shared/types/event';
import { Product } from '@/shared/types/product';
import { useUserActivity } from '@/context/userActivityProvider';
import { useAuthUser } from '@/shared/hooks/useAuthUser';
import { loadEventProducts } from '../eventProductSelection';
import EventProductShowcase from './EventProductShowcase';

jest.mock('./EventProductShowcase.module.css', () => ({
  __esModule: true,
  default: new Proxy({}, { get: (_target, prop) => String(prop) }),
}));

jest.mock('@/app/products/_components/ProductCard.module.css', () => ({
  __esModule: true,
  default: new Proxy({}, { get: (_target, prop) => String(prop) }),
}));

jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: React.ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean }) => {
    const { alt, ...imageProps } = props;
    delete imageProps.fill;
    // eslint-disable-next-line @next/next/no-img-element
    return <img alt={alt} {...imageProps} />;
  },
}));

jest.mock('@/context/userActivityProvider', () => ({
  useUserActivity: jest.fn(),
}));

jest.mock('@/shared/hooks/useAuthUser', () => ({
  useAuthUser: jest.fn(),
}));

jest.mock('@/shared/services/productService', () => ({
  ProductService: {},
}));

jest.mock('../eventProductSelection', () => ({
  ...jest.requireActual('../eventProductSelection'),
  loadEventProducts: jest.fn(),
}));

const mockedLoadEventProducts = jest.mocked(loadEventProducts);

const event: Event = {
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
};

const product = (id: string): Product => ({
  id,
  name: `상품 ${id}`,
  description: `${id} 설명`,
  price: 10000,
  originalPrice: 12000,
  brand: '테스트 브랜드',
  category: 'tops',
  images: [`/fallback-${id}.webp`],
  mainImage: `/main-${id}.webp`,
  sizes: ['FREE'],
  colors: ['black'],
  stock: 10,
  rating: 4.5,
  reviewCount: 12,
  isNew: false,
  isSale: true,
  saleRate: 17,
  tags: [],
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  status: 'active',
  details: {
    material: 'cotton',
    origin: '대한민국',
    manufacturer: '테스트 제조사',
    precautions: '단독 세탁',
    sizes: {},
  },
});

describe('EventProductShowcase', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(useUserActivity).mockReturnValue({
      wishlistItems: [],
      addToWishlist: jest.fn(),
      removeFromWishlist: jest.fn(),
    } as unknown as ReturnType<typeof useUserActivity>);
    jest.mocked(useAuthUser).mockReturnValue({
      user: null,
      loading: false,
    } as ReturnType<typeof useAuthUser>);
  });

  test('renders at most eight products with the shared ProductCard', async () => {
    mockedLoadEventProducts.mockResolvedValue(
      Array.from({ length: 10 }, (_, index) => product(`p${index + 1}`)),
    );

    render(<EventProductShowcase event={event} variant="sale" />);

    expect(await screen.findAllByRole('heading', { level: 3 })).toHaveLength(8);
    expect(screen.getByRole('link', { name: /상품 p1/ })).toHaveAttribute('href', '/products/p1');
    expect(screen.getByRole('img', { name: '상품 p1' })).toHaveAttribute('src', '/main-p1.webp');
    expect(screen.queryByText('상품 p9')).not.toBeInTheDocument();
  });

  test('isolates product errors and retries without failing the event page', async () => {
    mockedLoadEventProducts
      .mockRejectedValueOnce(new Error('load failed'))
      .mockResolvedValueOnce([product('p1')]);

    render(<EventProductShowcase event={event} variant="sale" />);

    expect(await screen.findByText('상품을 불러오지 못했습니다.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '할인 상품 더 보기' })).toHaveAttribute(
      'href',
      '/main/sale',
    );
    fireEvent.click(screen.getByRole('button', { name: '상품 다시 불러오기' }));

    expect(await screen.findByRole('heading', { level: 3, name: '상품 p1' })).toBeInTheDocument();
  });

  test('renders only the section link when no products are available', async () => {
    mockedLoadEventProducts.mockResolvedValue([]);

    render(<EventProductShowcase event={event} variant="sale" />);

    expect(await screen.findByRole('link', { name: '할인 상품 더 보기' })).toHaveAttribute(
      'href',
      '/main/sale',
    );
    expect(screen.queryByRole('heading', { level: 3 })).not.toBeInTheDocument();
  });
});
