import { Order, OrderStatus } from '@/shared/types/order';

export interface DeliveryPresentation {
  state: 'registered' | 'unregistered';
  headline: string;
  description: string;
  deliveryCompany?: string;
  trackingNumber?: string;
}

const statusLabels: Partial<Record<OrderStatus, string>> = {
  pending: '결제 대기',
  confirmed: '주문 확인',
  preparing: '상품 준비중',
  shipped: '배송 중',
  delivered: '배송 완료',
  cancelled: '주문 취소',
  returned: '반품',
  exchanged: '교환',
};

function normalizeText(value?: string): string | undefined {
  const normalizedValue = value?.trim();
  return normalizedValue || undefined;
}

export function getDeliverySearchHref(order: Pick<Order, 'id'>): string {
  return `/orders/delivery?orderId=${encodeURIComponent(order.id)}`;
}

export function getDeliveryPresentation(
  order: Pick<Order, 'status' | 'deliveryCompany' | 'trackingNumber'>
): DeliveryPresentation {
  const deliveryCompany = normalizeText(order.deliveryCompany);
  const trackingNumber = normalizeText(order.trackingNumber);

  if (trackingNumber) {
    return {
      state: 'registered',
      headline: statusLabels[order.status] || order.status,
      description: '외부 택배 실시간 추적은 제공하지 않습니다. 아래 주문 배송 정보를 확인해 주세요.',
      deliveryCompany: deliveryCompany || '택배사 미등록',
      trackingNumber,
    };
  }

  return {
    state: 'unregistered',
    headline: '운송장 미등록',
    description: `현재 주문 상태는 ${statusLabels[order.status] || order.status}입니다. 운송장이 등록되면 이 화면에서 확인할 수 있습니다.`,
  };
}

export function getCustomerCancellationAvailability(status: OrderStatus): {
  canCancel: boolean;
  message?: string;
} {
  if (status === 'pending' || status === 'confirmed') {
    return { canCancel: true };
  }

  return {
    canCancel: false,
    message: '상품 준비 이후 주문은 고객센터로 문의해 주세요.',
  };
}
