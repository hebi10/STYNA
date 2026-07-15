import React from 'react';
import { render, screen } from '@testing-library/react';
import { Event } from '@/shared/types/event';
import EventCommerceHero from './EventCommerceHero';
import EventActionBar from './EventActionBar';
import EventMobileStickyAction from './EventMobileStickyAction';

jest.mock('./EventCommerceBlocks.module.css', () => ({
  __esModule: true,
  default: new Proxy({}, {
    get: (_target, prop) => String(prop),
  }),
}), { virtual: true });

jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: React.ImgHTMLAttributes<HTMLImageElement> & { priority?: boolean }) => {
    const { alt, ...imageProps } = props;
    delete imageProps.priority;

    return React.createElement('img', { alt, ...imageProps });
  },
}));

const createEvent = (overrides: Partial<Event> = {}): Event => ({
  id: 'last-summer-clearance',
  title: '라스트 썸머 클리어런스',
  description: '여름의 마지막 인기 상품을 특별한 가격으로 만나보세요.',
  content: '<p>이벤트 소개</p>',
  bannerImage: '/banner.webp',
  thumbnailImage: '/card.webp',
  detailImage: '/wide.webp',
  eventType: 'sale',
  startDate: new Date('2026-08-15T00:00:00+09:00'),
  endDate: new Date('2026-08-31T23:59:59+09:00'),
  isActive: true,
  discountRate: 70,
  participantCount: 0,
  hasMaxParticipants: false,
  createdAt: new Date('2026-07-01T00:00:00+09:00'),
  updatedAt: new Date('2026-07-15T00:00:00+09:00'),
  ...overrides,
});

const renderHero = (event: Event) => render(
  <EventCommerceHero
    event={event}
    desktopImage="/wide.webp"
    mobileImage="/card.webp"
    statusLabel="진행중"
    periodLabel="2026. 8. 15. - 2026. 8. 31."
  />
);

const summaryItems = [
  { label: '혜택', value: '최대 70% 할인' },
  { label: '대상', value: '여름 시즌 상품' },
  { label: '기간', value: '8월 31일까지' },
];

describe('EventCommerceBlocks', () => {
  test('renders campaign image first without promotional text overlay', () => {
    const { container } = renderHero(createEvent());
    const section = container.querySelector('section');

    expect(section?.firstElementChild?.tagName).toBe('PICTURE');
    expect(container.querySelector('[data-promotional-overlay]')).toBeNull();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('라스트 썸머 클리어런스');
    expect(screen.queryByText(/0명/)).toBeNull();
    expect(screen.queryByText(/제한 없음/)).toBeNull();
  });

  test('shows capacity only for a limited event', () => {
    renderHero(createEvent({
      hasMaxParticipants: true,
      maxParticipants: 500,
      participantCount: 120,
    }));

    expect(screen.getByText('120 / 500명')).toBeInTheDocument();
  });

  test('renders no more than three action summary items', () => {
    render(
      <EventActionBar
        items={[...summaryItems, { label: '추가', value: '표시하지 않음' }]}
        label="할인 상품 보기"
        onAction={jest.fn()}
      />
    );

    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.queryByText('표시하지 않음')).toBeNull();
  });

  test('uses the same label and disabled state for desktop and mobile actions', () => {
    const onAction = jest.fn();
    render(
      <>
        <EventActionBar items={summaryItems} label="쿠폰 받기" disabled onAction={onAction} />
        <EventMobileStickyAction
          statusLabel="진행중"
          label="쿠폰 받기"
          disabled
          onAction={onAction}
        />
      </>
    );

    expect(screen.getByLabelText('이벤트 핵심 행동')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: '쿠폰 받기' })).toHaveLength(2);
    screen.getAllByRole('button', { name: '쿠폰 받기' }).forEach(button => {
      expect(button).toBeDisabled();
    });
  });
});
