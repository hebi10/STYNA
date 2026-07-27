import { Order, OrderStatus } from '@/shared/types/order';
import {
  filterOrders,
  normalizeOrderStatus,
  OrderListPeriod,
} from './orderListFilters';

function makeOrder(id: string, status: OrderStatus, createdAt: Date): Order {
  return { id, status, createdAt } as Order;
}

describe('filterOrders', () => {
  test('applies the selected status and period together', () => {
    const now = new Date(2026, 6, 21, 12, 30, 0);
    const recentPending = makeOrder('recent-pending', 'pending', new Date(2026, 5, 1, 12, 30, 0));
    const recentShipped = makeOrder('recent-shipped', 'shipped', new Date(2026, 4, 1, 12, 30, 0));
    const oldPending = makeOrder('old-pending', 'pending', new Date(2026, 2, 1, 12, 30, 0));

    expect(filterOrders(
      [recentPending, recentShipped, oldPending],
      { status: 'pending', period: '3개월', now },
    )).toEqual([recentPending]);
  });

  test('includes an order at the exact calendar-month boundary', () => {
    const now = new Date(2026, 2, 31, 18, 15, 20, 125);
    const atBoundary = makeOrder('at-boundary', 'pending', new Date(2026, 1, 28, 18, 15, 20, 125));
    const beforeBoundary = makeOrder('before-boundary', 'pending', new Date(2026, 1, 28, 18, 15, 20, 124));

    expect(filterOrders(
      [atBoundary, beforeBoundary],
      { status: '전체', period: '1개월', now },
    )).toEqual([atBoundary]);
  });

  test.each<[OrderListPeriod, Date]>([
    ['1개월', new Date(2026, 5, 21, 12, 30, 0)],
    ['3개월', new Date(2026, 3, 21, 12, 30, 0)],
    ['6개월', new Date(2026, 0, 21, 12, 30, 0)],
    ['1년', new Date(2025, 6, 21, 12, 30, 0)],
  ])('%s uses the matching calendar boundary', (period, boundary) => {
    const now = new Date(2026, 6, 21, 12, 30, 0);
    const included = makeOrder(`included-${period}`, 'pending', boundary);
    const excluded = makeOrder(`excluded-${period}`, 'pending', new Date(boundary.getTime() - 1));

    expect(filterOrders(
      [included, excluded],
      { status: '전체', period, now },
    )).toEqual([included]);
  });

  test.each([
    ['배송완료', 'delivered'],
    ['배송중', 'shipped'],
    ['주문확인', 'confirmed'],
    ['취소', 'cancelled'],
    ['교환', 'exchanged'],
    ['반품', 'returned'],
  ] as const)('normalizes legacy status %s to %s', (legacyStatus, canonicalStatus) => {
    expect(normalizeOrderStatus(legacyStatus)).toBe(canonicalStatus);

    const order = makeOrder('legacy-order', legacyStatus, new Date(2026, 6, 20));
    expect(filterOrders(
      [order],
      { status: canonicalStatus, period: '1개월', now: new Date(2026, 6, 21) },
    )).toEqual([order]);
  });
});
