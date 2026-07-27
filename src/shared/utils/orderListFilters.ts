import { Order, OrderStatus } from '@/shared/types/order';

export type OrderListPeriod = '1개월' | '3개월' | '6개월' | '1년';
export type CanonicalOrderStatus =
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'returned'
  | 'exchanged';
export type OrderListStatus = '전체' | CanonicalOrderStatus;

interface OrderListFilterOptions {
  status: OrderListStatus;
  period: OrderListPeriod;
  now: Date;
}

const PERIOD_MONTHS: Record<OrderListPeriod, number> = {
  '1개월': 1,
  '3개월': 3,
  '6개월': 6,
  '1년': 12,
};

const LEGACY_ORDER_STATUS_MAP: Partial<Record<OrderStatus, CanonicalOrderStatus>> = {
  '배송완료': 'delivered',
  '배송중': 'shipped',
  '주문확인': 'confirmed',
  '취소': 'cancelled',
  '교환': 'exchanged',
  '반품': 'returned',
};

export function normalizeOrderStatus(status: OrderStatus): CanonicalOrderStatus {
  return LEGACY_ORDER_STATUS_MAP[status] ?? status as CanonicalOrderStatus;
}

function subtractCalendarMonths(date: Date, months: number): Date {
  const result = new Date(date.getTime());
  const originalDay = result.getDate();

  result.setDate(1);
  result.setMonth(result.getMonth() - months);

  const lastDayOfTargetMonth = new Date(
    result.getFullYear(),
    result.getMonth() + 1,
    0,
  ).getDate();
  result.setDate(Math.min(originalDay, lastDayOfTargetMonth));

  return result;
}

export function filterOrders(
  orders: readonly Order[],
  { status, period, now }: OrderListFilterOptions,
): Order[] {
  const periodStart = subtractCalendarMonths(now, PERIOD_MONTHS[period]);

  return orders.filter((order) => {
    const matchesStatus = status === '전체' || normalizeOrderStatus(order.status) === status;
    const matchesPeriod = order.createdAt.getTime() >= periodStart.getTime();

    return matchesStatus && matchesPeriod;
  });
}
