import { getEventStatus } from '@/shared/services/eventService';
import { Event } from '@/shared/types/event';

export type EventStatusTab = 'current' | 'ended';

export function filterEventsByStatusTab(
  events: Event[],
  tab: EventStatusTab,
  referenceDate: Date = new Date(),
): Event[] {
  return events.filter(event => {
    const status = getEventStatus(event, referenceDate);
    return tab === 'ended' ? status === 'ended' : status !== 'ended';
  });
}

export function countEventsByStatusTab(
  events: Event[],
  tab: EventStatusTab,
  referenceDate: Date = new Date(),
): number {
  return filterEventsByStatusTab(events, tab, referenceDate).length;
}
