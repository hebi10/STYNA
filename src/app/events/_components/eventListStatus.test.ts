import { Event } from '@/shared/types/event';
import {
  countEventsByStatusTab,
  filterEventsByStatusTab,
} from './eventListStatus';

jest.mock('@/shared/services/eventService', () => ({
  getEventStatus: (event: Event, currentDate: Date) => {
    if (!event.isActive || currentDate > event.endDate) return 'ended';
    if (currentDate < event.startDate) return 'upcoming';
    return 'ongoing';
  },
}));

const referenceDate = new Date('2026-07-31T12:00:00+09:00');

const event = (overrides: Partial<Event>): Event => ({
  id: 'event-1',
  title: '이벤트',
  description: '이벤트 설명',
  bannerImage: '/events/banner.webp',
  thumbnailImage: '/events/card.webp',
  eventType: 'special',
  eligibilityType: 'none',
  rewardType: 'none',
  publicPolicyVerified: true,
  startDate: new Date('2026-07-01T00:00:00+09:00'),
  endDate: new Date('2026-08-01T23:59:59+09:00'),
  isActive: true,
  participantCount: 0,
  createdAt: new Date('2026-07-01T00:00:00+09:00'),
  updatedAt: new Date('2026-07-01T00:00:00+09:00'),
  ...overrides,
});

describe('eventListStatus', () => {
  test('진행 중과 예정 이벤트를 진행·예정 탭에 함께 분류한다', () => {
    const events = [
      event({ id: 'ongoing' }),
      event({
        id: 'upcoming',
        startDate: new Date('2026-08-10T00:00:00+09:00'),
        endDate: new Date('2026-08-20T23:59:59+09:00'),
      }),
      event({
        id: 'ended',
        startDate: new Date('2026-06-01T00:00:00+09:00'),
        endDate: new Date('2026-06-30T23:59:59+09:00'),
      }),
    ];

    expect(
      filterEventsByStatusTab(events, 'current', referenceDate).map(item => item.id),
    ).toEqual(['ongoing', 'upcoming']);
    expect(countEventsByStatusTab(events, 'current', referenceDate)).toBe(2);
  });

  test('기간이 끝났거나 비활성화된 이벤트를 종료 탭에 분류한다', () => {
    const events = [
      event({
        id: 'date-ended',
        endDate: new Date('2026-07-30T23:59:59+09:00'),
      }),
      event({ id: 'inactive', isActive: false }),
      event({ id: 'ongoing' }),
    ];

    expect(
      filterEventsByStatusTab(events, 'ended', referenceDate).map(item => item.id),
    ).toEqual(['date-ended', 'inactive']);
    expect(countEventsByStatusTab(events, 'ended', referenceDate)).toBe(2);
  });
});
