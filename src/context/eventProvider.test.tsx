import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { EventProvider, useEvent } from './eventProvider';
import { Event } from '@/shared/types/event';
import { EventService } from '@/shared/services/eventService';

jest.mock('@/shared/services/eventService', () => ({
  EventService: {
    getEvents: jest.fn(),
  },
}));

const firebaseEvent: Event = {
  id: 'firebase-event',
  title: 'Firebase 이벤트',
  description: 'Firebase only',
  bannerImage: '/firebase-banner.webp',
  thumbnailImage: '/firebase-thumb.webp',
  eventType: 'coupon',
  startDate: new Date('2026-06-01T00:00:00+09:00'),
  endDate: new Date('2026-06-30T23:59:59+09:00'),
  isActive: true,
  participantCount: 3,
  hasMaxParticipants: false,
  createdAt: new Date('2026-06-01T00:00:00+09:00'),
  updatedAt: new Date('2026-06-01T00:00:00+09:00'),
};

function EventCount() {
  const { events, loading } = useEvent();
  return <div>{loading ? 'loading' : `${events.length}:${events.map(event => event.id).join(',')}`}</div>;
}

function EventPaginationSize() {
  const { eventsPerPage, loading } = useEvent();
  return <div>{loading ? 'loading' : `page-size:${eventsPerPage}`}</div>;
}

describe('EventProvider', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('uses Firebase events for the public event list', async () => {
    jest.mocked(EventService.getEvents).mockResolvedValue([firebaseEvent]);

    render(
      <EventProvider>
        <EventCount />
      </EventProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('1:firebase-event')).toBeInTheDocument();
    });
  });

  test('exposes eight events per page for the public event list', async () => {
    jest.mocked(EventService.getEvents).mockResolvedValue([firebaseEvent]);

    render(
      <EventProvider>
        <EventPaginationSize />
      </EventProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('page-size:8')).toBeInTheDocument();
    });
  });
});
