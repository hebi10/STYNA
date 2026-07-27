import React from 'react';
import { render, screen } from '@testing-library/react';
import type { Event } from '@/shared/types/event';
import { EventService } from '@/shared/services/eventService';
import EditEventLoader from './EditEventLoader';

jest.mock('./page.module.css', () => ({
  __esModule: true,
  default: new Proxy({}, {
    get: (_target, prop) => String(prop),
  }),
}));

jest.mock('@/app/admin/events/_components/EventNavigation', () => ({
  __esModule: true,
  default: () => <nav>이벤트 관리 메뉴</nav>,
}));

jest.mock('@/app/admin/events/_components/EventForm', () => ({
  __esModule: true,
  default: ({ event, isEdit }: { event: Event; isEdit: boolean }) => (
    <div data-testid="event-form">{isEdit ? event.title : 'create'}</div>
  ),
}));

jest.mock('@/shared/services/eventService', () => ({
  EventService: {
    getAdminEventById: jest.fn(),
  },
}));

const event: Event = {
  id: 'event-1',
  title: '관리자 수정 이벤트',
  description: '설명',
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
};

describe('EditEventLoader', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('loads an unverified event through the authenticated admin method', async () => {
    jest.mocked(EventService.getAdminEventById).mockResolvedValue(event);

    render(<EditEventLoader eventId="event-1" />);

    expect(await screen.findByTestId('event-form')).toHaveTextContent('관리자 수정 이벤트');
    expect(EventService.getAdminEventById).toHaveBeenCalledWith('event-1');
  });

  test('shows a recoverable empty state when the event does not exist', async () => {
    jest.mocked(EventService.getAdminEventById).mockResolvedValue(null);

    render(<EditEventLoader eventId="missing-event" />);

    expect(await screen.findByText('이벤트를 찾을 수 없습니다.')).toBeInTheDocument();
  });
});
