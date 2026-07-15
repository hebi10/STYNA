import React from 'react';
import { render, screen } from '@testing-library/react';
import EventList from './EventList';
import { Event } from '@/shared/types/event';

jest.mock('./EventList.module.css', () => ({
  __esModule: true,
  default: new Proxy({}, {
    get: (_target, prop) => String(prop),
  }),
}));

jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: React.ImgHTMLAttributes<HTMLImageElement> & { priority?: boolean }) => {
    const { alt, ...imageProps } = props;
    delete imageProps.priority;

    return React.createElement('img', { alt, ...imageProps });
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

jest.mock('@/app/_components/Button', () => ({
  __esModule: true,
  default: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}));

jest.mock('@/shared/services/eventService', () => ({
  getEventStatus: () => 'ongoing',
  getFeaturedEvent: (events: Event[]) => events[0],
}));

jest.mock('@/context/eventProvider', () => ({
  useEvent: jest.fn(),
}));

const { useEvent } = jest.requireMock('@/context/eventProvider') as {
  useEvent: jest.Mock;
};

const baseEvent = (overrides: Partial<Event>): Event => ({
  id: 'event-1',
  title: '미드이어 세일',
  description: '여름 인기 상품을 큰 혜택으로 만나는 기간 한정 세일입니다.',
  content: '<p>이벤트 소개</p>',
  bannerImage: '/events/2026/event-2026-06-midyear-sale-banner.webp',
  thumbnailImage: '/events/2026/event-2026-06-midyear-sale-thumb.webp',
  eventType: 'sale',
  startDate: new Date('2026-06-01T00:00:00+09:00'),
  endDate: new Date('2026-06-30T23:59:59+09:00'),
  isActive: true,
  discountRate: 60,
  participantCount: 120,
  hasMaxParticipants: false,
  createdAt: new Date('2026-06-01T00:00:00+09:00'),
  updatedAt: new Date('2026-06-05T00:00:00+09:00'),
  ...overrides,
});

const renderEventList = () => {
  const events = [
    baseEvent({ id: 'featured-event', title: '미드이어 세일' }),
    baseEvent({
      id: 'coupon-event',
      title: '바캉스 쿠폰팩',
      eventType: 'coupon',
      couponCode: 'VACANCE12',
      bannerImage: '/events/2026/event-2026-07-vacation-coupon-banner.webp',
      thumbnailImage: '/events/2026/event-2026-07-vacation-coupon-thumb.webp',
      createdAt: new Date('2026-05-20T00:00:00+09:00'),
    }),
  ];

  useEvent.mockReturnValue({
    events,
    filteredEvents: events,
    filter: {},
    currentPage: 1,
    eventsPerPage: 6,
    loading: false,
    error: null,
    setFilter: jest.fn(),
    setCurrentPage: jest.fn(),
    getActiveEvents: () => events,
    getTotalParticipants: () => '제한 없음',
    refreshEvents: jest.fn(),
  });

  return render(<EventList />);
};

describe('EventList', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('renders responsive event posters without duplicate promotional copy', () => {
    const { container } = renderEventList();

    const posterHero = container.querySelector<HTMLElement>('.posterHero');
    const featuredPicture = posterHero?.querySelector('picture');
    const posterCards = container.querySelectorAll<HTMLAnchorElement>('.eventPosterCard');
    const couponCard = Array.from(posterCards).find(card =>
      card.getAttribute('href') === '/events/coupon-event'
    );

    expect(posterHero).not.toBeNull();
    expect(container.querySelector('.posterHeroOverlay')).toBeNull();
    expect(posterCards).toHaveLength(2);
    expect(container.querySelectorAll('.posterCardOverlay')).toHaveLength(0);
    expect(container.querySelectorAll('.eventBadges')).toHaveLength(0);
    expect(container.querySelector('.eventInfo')).toBeNull();

    expect(posterHero?.tagName).toBe('DIV');
    expect(posterHero?.closest('a')).toBeNull();
    expect(couponCard).toHaveAccessibleName(
      '바캉스 쿠폰팩: 여름 인기 상품을 큰 혜택으로 만나는 기간 한정 세일입니다.'
    );

    expect(featuredPicture?.querySelector('source')).toHaveAttribute(
      'srcset',
      '/events/event-hub-hero.webp'
    );
    expect(featuredPicture?.querySelector('img')).toHaveAttribute(
      'src',
      '/events/event-hub-hero.webp'
    );
    expect(featuredPicture?.querySelector('img')).toHaveAttribute(
      'alt',
      'STYNA EVENTS - 새로운 스타일과 혜택을 만나보세요'
    );
    expect(couponCard?.querySelector('source')).toHaveAttribute(
      'srcset',
      '/events/2026/event-2026-07-vacation-coupon-thumb.webp'
    );
    expect(couponCard?.querySelector('img')).toHaveAttribute(
      'src',
      '/events/2026/event-2026-07-vacation-coupon-thumb.webp'
    );

    expect(container.querySelector('.posterHeroTitle')).toBeNull();
    expect(container.querySelector('.posterHeroDescription')).toBeNull();
    expect(container.querySelector('.eventTitle')).toBeNull();
    expect(container.querySelector('.eventDescription')).toBeNull();
    expect(container.querySelector('.eventDiscount')).toBeNull();
    expect(container.querySelectorAll('.eventPeriod')).toHaveLength(2);
    expect(couponCard?.querySelector(':scope > .eventFooter')).not.toBeNull();
    expect(couponCard?.querySelector('.posterCardOverlay .eventFooter')).toBeNull();
    expect(screen.queryByText('특가 보기')).not.toBeInTheDocument();
    expect(screen.getByText('할인 상품 보기')).toBeInTheDocument();
  });

  test('renders at most eight event cards and two numbered pages for ten events', () => {
    const events = Array.from({ length: 10 }, (_, index) =>
      baseEvent({ id: `event-${index + 1}`, title: `이벤트 ${index + 1}` })
    );

    useEvent.mockReturnValue({
      events,
      filteredEvents: events,
      filter: {},
      currentPage: 1,
      eventsPerPage: 8,
      loading: false,
      error: null,
      setFilter: jest.fn(),
      setCurrentPage: jest.fn(),
      getActiveEvents: () => events,
      getTotalParticipants: () => 0,
      refreshEvents: jest.fn(),
    });

    const { container } = render(<EventList />);

    expect(container.querySelectorAll('.eventPosterCard')).toHaveLength(8);
    expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '2' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '3' })).not.toBeInTheDocument();
  });

  test('renders event-shaped skeleton cards while loading', () => {
    useEvent.mockReturnValue({
      events: [],
      filteredEvents: [],
      filter: {},
      currentPage: 1,
      eventsPerPage: 6,
      loading: true,
      error: null,
      setFilter: jest.fn(),
      setCurrentPage: jest.fn(),
      getActiveEvents: () => [],
      getTotalParticipants: () => 0,
      refreshEvents: jest.fn(),
    });

    render(<EventList />);

    expect(screen.getByRole('status')).toHaveTextContent('이벤트를 불러오는 중입니다');
    expect(screen.getAllByLabelText('이벤트 로딩 카드')).toHaveLength(3);
  });
});
