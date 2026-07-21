import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useAuth } from '@/context/authProvider';
import { getEventUiMeta } from '@/shared/constants/eventUiMeta';
import { EventService } from '@/shared/services/eventService';
import { ProductService } from '@/shared/services/productService';
import { Event, EventUiVariant } from '@/shared/types/event';
import { Product } from '@/shared/types/product';
import EventDetailClient from './EventDetailClient';

const push = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

jest.mock('next/image', () => ({
  __esModule: true,
  default: (
    props: React.ImgHTMLAttributes<HTMLImageElement> & { priority?: boolean; fill?: boolean }
  ) => {
    const { alt = '', ...imageProps } = props;
    delete imageProps.priority;
    delete imageProps.fill;
    // eslint-disable-next-line @next/next/no-img-element
    return <img alt={alt} {...imageProps} />;
  },
}));

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({
    href,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

jest.mock('@/context/authProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/context/userActivityProvider', () => ({
  useUserActivity: () => ({
    wishlistItems: [],
    addToWishlist: jest.fn(),
    removeFromWishlist: jest.fn(),
  }),
}));

jest.mock('@/shared/hooks/useAuthUser', () => ({
  useAuthUser: () => ({ user: null, loading: false }),
}));

jest.mock('@/shared/services/eventService', () => {
  return {
    EventService: {
      checkEventParticipation: jest.fn(),
      participateInEvent: jest.fn(),
    },
    getEventStatus: (event: Event) => {
      const now = new Date('2026-07-15T12:00:00+09:00').getTime();
      if (now < event.startDate.getTime()) return 'upcoming';
      if (now > event.endDate.getTime()) return 'ended';
      return 'ongoing';
    },
    getEventParticipationErrorCode: () => 'unknown',
    getEventParticipationErrorMessage: () => '이벤트 참여 중 오류가 발생했습니다.',
  };
});

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

jest.mock('./EventDetailClient.module.css', () => ({
  __esModule: true,
  default: new Proxy({}, { get: (_target, prop) => String(prop) }),
}));

jest.mock('./_components/EventCommerceBlocks.module.css', () => ({
  __esModule: true,
  default: new Proxy({}, { get: (_target, prop) => String(prop) }),
}));

jest.mock('./_components/EventProductShowcase.module.css', () => ({
  __esModule: true,
  default: new Proxy({}, { get: (_target, prop) => String(prop) }),
}));

jest.mock('../../products/_components/ProductCard.module.css', () => ({
  __esModule: true,
  default: new Proxy({}, { get: (_target, prop) => String(prop) }),
}));

const createProduct = (id = 'product-1'): Product => ({
  id,
  name: `테스트 상품 ${id}`,
  description: '상품 설명',
  price: 39000,
  originalPrice: 59000,
  brand: 'STYNA',
  category: '상의',
  images: [`/products/${id}.webp`],
  sizes: ['M'],
  colors: ['블랙'],
  stock: 10,
  rating: 4.8,
  reviewCount: 120,
  isNew: true,
  isSale: true,
  saleRate: 34,
  tags: [],
  createdAt: new Date('2026-07-01T00:00:00+09:00'),
  updatedAt: new Date('2026-07-01T00:00:00+09:00'),
  status: 'active',
  details: {
    material: '면',
    origin: '대한민국',
    manufacturer: 'STYNA',
    precautions: '단독 세탁',
    sizes: {},
  },
});

const createEvent = (overrides: Partial<Event> = {}): Event => ({
  id: 'event-commerce-test',
  title: '라스트 썸머 클리어런스',
  description: '여름 시즌 마지막 할인 혜택을 확인해 보세요.',
  content: '<p>기간 한정 이벤트입니다.</p>',
  bannerImage: '/events/banner.webp',
  thumbnailImage: '/events/card.webp',
  detailImage: '/events/wide.webp',
  eventType: 'sale',
  eligibilityType: 'none',
  rewardType: 'none',
  startDate: new Date('2026-07-01T00:00:00+09:00'),
  endDate: new Date('2026-07-31T23:59:59+09:00'),
  isActive: true,
  discountRate: 70,
  targetCategories: ['전체'],
  participantCount: 0,
  hasMaxParticipants: false,
  createdAt: new Date('2026-06-01T00:00:00+09:00'),
  updatedAt: new Date('2026-06-01T00:00:00+09:00'),
  ...overrides,
});

const variantEvent = (variant: EventUiVariant): Event => {
  if (variant === 'review') {
    return createEvent({
      eventType: 'special',
      title: '리뷰 리워드 이벤트',
      description: '후기를 작성하고 혜택을 받아보세요.',
      eligibilityType: 'review',
      targetProducts: ['product-1'],
    });
  }

  return createEvent({
    eventType: variant,
    title: `${variant} 이벤트`,
    eligibilityType: variant === 'sale' ? 'purchase' : 'none',
    targetProducts: variant === 'sale' ? ['product-1'] : undefined,
    couponType: variant === 'coupon' ? 'auto' : undefined,
    rewardType: variant === 'coupon' ? 'coupon' : 'none',
    rewardCouponId: variant === 'coupon' ? 'coupon-1' : undefined,
  });
};

const sectionExpectations: Array<[EventUiVariant, string, string]> = [
  ['sale', '구매 후 참여하기', '지금 할인 중인 상품'],
  ['coupon', '이벤트 참여하기', '쿠폰과 함께 보기 좋은 상품'],
  ['review', '리뷰 쓰고 참여하기', '리뷰가 많은 상품'],
  ['new', '이벤트 참여하기', '새로 들어온 상품'],
  ['special', '이벤트 참여하기', '함께 보면 좋은 상품'],
];

describe('EventDetailClient commerce template', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: jest.fn().mockReturnValue({
        matches: false,
        media: '(max-width: 640px)',
        onchange: null,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        addListener: jest.fn(),
        removeListener: jest.fn(),
        dispatchEvent: jest.fn(),
      }),
    });
    jest.mocked(useAuth).mockReturnValue({
      user: { uid: 'user-1' },
      loading: false,
    } as ReturnType<typeof useAuth>);
    jest.mocked(EventService.checkEventParticipation).mockResolvedValue(false);
    jest.mocked(EventService.participateInEvent).mockResolvedValue({
      alreadyParticipated: false,
      participantCount: 121,
      rewardIssued: true,
    });

    const products = [createProduct()];
    jest.mocked(ProductService.getProductById).mockResolvedValue(products[0]);
    jest.mocked(ProductService.getProductsByCategory).mockResolvedValue([]);
    jest.mocked(ProductService.getSaleProducts).mockResolvedValue(products);
    jest.mocked(ProductService.getRecommendedProducts).mockResolvedValue(products);
    jest.mocked(ProductService.getReviewPopularProducts).mockResolvedValue(products);
    jest.mocked(ProductService.getNewProducts).mockResolvedValue(products);
  });

  test.each(sectionExpectations)(
    'renders the %s action and product section',
    async (variant, actionLabel, productTitle) => {
      render(<EventDetailClient event={variantEvent(variant)} />);

      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
      expect((await screen.findAllByRole('button', { name: actionLabel })).length).toBeGreaterThanOrEqual(1);
      expect(await screen.findByRole('heading', { name: productTitle })).toBeInTheDocument();
      expect(await screen.findByText('테스트 상품 product-1')).toBeInTheDocument();
    }
  );

  test('does not show unlimited participant metadata', async () => {
    jest.mocked(useAuth).mockReturnValue({
      user: null,
      loading: false,
    } as ReturnType<typeof useAuth>);
    render(<EventDetailClient event={createEvent()} />);

    expect(screen.queryByText(/0명/)).not.toBeInTheDocument();
    expect(screen.queryByText(/제한 없음/)).not.toBeInTheDocument();
    expect(await screen.findByText('테스트 상품 product-1')).toBeInTheDocument();
  });

  test('keeps the existing participation request connected', async () => {
    const event = createEvent({
      eventType: 'coupon',
      couponType: 'auto',
      rewardType: 'coupon',
      rewardCouponId: 'coupon-1',
    });
    render(<EventDetailClient event={event} />);

    expect(await screen.findByText('테스트 상품 product-1')).toBeInTheDocument();
    await waitFor(() => {
      expect(EventService.checkEventParticipation).toHaveBeenCalledWith(event.id, 'user-1');
    });
    fireEvent.click(screen.getAllByRole('button', { name: '이벤트 참여하기' })[0]);

    await waitFor(() => {
      expect(EventService.participateInEvent).toHaveBeenCalledWith(event.id);
    });
  });

  test('returns an anonymous participant to the current event after login', async () => {
    jest.mocked(useAuth).mockReturnValue({
      user: null,
      loading: false,
    } as ReturnType<typeof useAuth>);
    const event = variantEvent('coupon');

    render(<EventDetailClient event={event} />);

    fireEvent.click((await screen.findAllByRole('button', { name: /이벤트 참여하기/ }))[0]);

    expect(push).toHaveBeenCalledWith(
      `/auth/login?redirect=${encodeURIComponent(`/events/${event.id}`)}`,
    );
    expect(EventService.participateInEvent).not.toHaveBeenCalled();
  });

  test.each([
    ['none', '별도 구매 조건 없이 이벤트 기간과 안내를 확인한 뒤 참여할 수 있습니다.', '이벤트 참여하기'],
    ['purchase', '대상 상품의 본인 구매 내역이 있어야 참여할 수 있습니다.', '구매 후 참여하기'],
    ['delivered', '대상 상품이 배송 완료 또는 구매 확정된 뒤 참여할 수 있습니다.', '배송 완료 후 참여하기'],
    ['review', '배송 완료된 대상 상품 옵션의 구매 인증 리뷰를 작성해야 참여할 수 있습니다.', '리뷰 쓰고 참여하기'],
  ] as const)(
    'uses %s eligibility for participation copy and CTA while retaining the sale visual variant',
    async (eligibilityType, participationMethod, actionLabel) => {
      render(<EventDetailClient event={createEvent({
        eligibilityType,
        targetProducts: eligibilityType === 'none' ? undefined : ['product-1'],
      })} />);

      expect(await screen.findByRole('heading', { name: '지금 할인 중인 상품' })).toBeInTheDocument();
      expect(screen.getByText(participationMethod)).toBeInTheDocument();
      expect((await screen.findAllByRole('button', { name: actionLabel })).length).toBeGreaterThanOrEqual(1);
    },
  );

  test('does not infer rewards from a review visual variant when rewardType is none', async () => {
    const event = createEvent({
      eventType: 'special',
      title: '리뷰 참여 이벤트',
      description: '구매 인증 후기를 확인하는 이벤트입니다.',
      eligibilityType: 'review',
      targetProducts: ['product-1'],
      rewardType: 'none',
      discountRate: undefined,
      discountAmount: 5000,
      couponCode: 'STALE-CODE',
    });
    const { container } = render(<EventDetailClient event={event} />);

    expect(await screen.findByText('테스트 상품 product-1')).toBeInTheDocument();
    expect(screen.getAllByText('할인 표시 금액은 5,000원입니다.')).toHaveLength(2);
    expect(container.textContent).not.toMatch(/보상|적립|지급|쿠폰 코드 STALE-CODE/);
    expect(JSON.stringify(getEventUiMeta(event))).not.toMatch(/보상|적립/);
  });

  test('shows coupon reward guidance only for rewardType coupon', async () => {
    render(<EventDetailClient event={createEvent({
      rewardType: 'coupon',
      rewardCouponId: 'coupon-1',
      couponCode: 'EVENT-COUPON',
    })} />);

    expect(await screen.findByText('테스트 상품 product-1')).toBeInTheDocument();
    expect(screen.getByText('참여 조건을 충족하면 이벤트 쿠폰이 지급됩니다.')).toBeInTheDocument();
    expect(screen.getByText('쿠폰 코드 EVENT-COUPON 사용이 가능합니다.')).toBeInTheDocument();
  });

  test('keeps already-participated copy neutral when no reward is configured', async () => {
    jest.mocked(EventService.checkEventParticipation).mockResolvedValueOnce(true);
    render(<EventDetailClient event={createEvent({
      eventType: 'special',
      title: '일반 참여 이벤트',
      description: '참여 안내를 확인해주세요.',
      content: undefined,
      discountRate: undefined,
      targetCategories: undefined,
      rewardType: 'none',
    })} />);

    expect(await screen.findByText(
      '이미 참여가 완료된 이벤트입니다. 아래 상세 안내를 확인해주세요.',
    )).toBeInTheDocument();
    expect(screen.getAllByText('이벤트 상세 안내와 참여 조건을 확인해주세요.')).toHaveLength(2);
  });

  test.each([
    ['sale', '추천 상품 보기', '/recommend'],
    ['new', '추천 상품 보기', '/recommend'],
    ['review', '리뷰 보러가기', '/reviews'],
    ['coupon', '전체 이벤트 보기', '/events'],
    ['special', '전체 이벤트 보기', '/events'],
  ] as const)(
    'routes an ended %s event without login or participation',
    async (variant, label, href) => {
      jest.mocked(useAuth).mockReturnValue({
        user: null,
        loading: false,
      } as ReturnType<typeof useAuth>);
      const event = variantEvent(variant);
      event.endDate = new Date('2026-07-14T23:59:59+09:00');

      render(<EventDetailClient event={event} />);

      fireEvent.click((await screen.findAllByRole('button', { name: label }))[0]);

      expect(push).toHaveBeenCalledWith(href);
      expect(EventService.checkEventParticipation).not.toHaveBeenCalled();
      expect(EventService.participateInEvent).not.toHaveBeenCalled();
    },
  );
});
