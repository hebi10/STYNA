import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import AdminEventList from './AdminEventList';
import { Event } from '@/shared/types/event';
import { EventService } from '@/shared/services/eventService';

jest.mock('./AdminEventList.module.css', () => ({
  __esModule: true,
  default: new Proxy({}, {
    get: (_target, prop) => String(prop),
  }),
}));

jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => React.createElement('img', props),
}));

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

jest.mock('@/app/_components/Button', () => ({
  __esModule: true,
  default: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}));

jest.mock('@/shared/services/eventService', () => ({
  EventService: {
    getAdminEvents: jest.fn(),
    toggleEventStatus: jest.fn(),
    deleteEvent: jest.fn(),
  },
}));

const event = (overrides: Partial<Event>): Event => ({
  id: 'event-1',
  title: '기본 이벤트',
  description: '이벤트 설명',
  bannerImage: '/banner.webp',
  thumbnailImage: '/thumb.webp',
  eventType: 'sale',
  startDate: new Date('2026-06-01T00:00:00+09:00'),
  endDate: new Date('2026-06-30T23:59:59+09:00'),
  isActive: true,
  participantCount: 0,
  hasMaxParticipants: false,
  createdAt: new Date('2026-06-01T00:00:00+09:00'),
  updatedAt: new Date('2026-06-01T00:00:00+09:00'),
  ...overrides,
});

describe('AdminEventList', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('filters event list by upcoming status and event type', async () => {
    jest.mocked(EventService.getAdminEvents).mockResolvedValue([
      event({
        id: 'upcoming-sale',
        title: '예정 세일',
        eventType: 'sale',
        startDate: new Date('2099-01-01T00:00:00+09:00'),
        endDate: new Date('2099-01-31T23:59:59+09:00'),
      }),
      event({
        id: 'active-coupon',
        title: '진행 쿠폰',
        eventType: 'coupon',
        startDate: new Date('2020-01-01T00:00:00+09:00'),
        endDate: new Date('2099-12-31T23:59:59+09:00'),
      }),
    ]);

    render(<AdminEventList />);

    await waitFor(() => {
      expect(screen.getByText('예정 세일')).toBeInTheDocument();
      expect(screen.getByText('진행 쿠폰')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('이벤트 상태 필터'), {
      target: { value: 'upcoming' },
    });
    fireEvent.change(screen.getByLabelText('이벤트 유형 필터'), {
      target: { value: 'sale' },
    });

    expect(screen.getByText('예정 세일')).toBeInTheDocument();
    expect(screen.queryByText('진행 쿠폰')).not.toBeInTheDocument();
  });

  test('labels discountAmount as a display amount rather than points', async () => {
    jest.mocked(EventService.getAdminEvents).mockResolvedValue([
      event({ discountAmount: 5000 }),
    ]);

    render(<AdminEventList />);

    expect(await screen.findByText('할인 표시 금액: 5,000원')).toBeInTheDocument();
    expect(screen.queryByText(/적립금:/)).not.toBeInTheDocument();
  });
});
