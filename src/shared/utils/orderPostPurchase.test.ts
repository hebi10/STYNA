import { Order } from '@/shared/types/order';
import {
  getCustomerCancellationAvailability,
  getDeliveryPresentation,
  getDeliverySearchHref,
} from './orderPostPurchase';

const createOrder = (overrides: Partial<Order> = {}): Order => ({
  id: 'order-1',
  userId: 'user-1',
  orderNumber: 'ORD-20260710-TEST',
  products: [],
  finalAmount: 30000,
  status: 'shipped',
  createdAt: new Date('2026-07-10T00:00:00.000Z'),
  updatedAt: new Date('2026-07-10T00:00:00.000Z'),
  ...overrides,
});

describe('구매 후 주문 안내', () => {
  it('운송장이 있는 배송 주문은 현재 상태와 운송장 정보를 표시한다', () => {
    const result = getDeliveryPresentation(createOrder({
      status: 'shipped',
      deliveryCompany: '한빛택배',
      trackingNumber: '1234-5678',
    }));

    expect(result).toEqual({
      state: 'registered',
      headline: '배송 중',
      description: '외부 택배 실시간 추적은 제공하지 않습니다. 아래 주문 배송 정보를 확인해 주세요.',
      deliveryCompany: '한빛택배',
      trackingNumber: '1234-5678',
    });
  });

  it('운송장이 없는 배송 주문은 운송장 미등록으로 정직하게 안내한다', () => {
    const result = getDeliveryPresentation(createOrder({
      status: 'delivered',
      deliveryCompany: '  ',
      trackingNumber: ' ',
    }));

    expect(result).toEqual({
      state: 'unregistered',
      headline: '운송장 미등록',
      description: '현재 주문 상태는 배송 완료입니다. 운송장이 등록되면 이 화면에서 확인할 수 있습니다.',
    });
  });

  it('배송 조회 링크는 주문 식별자만 전달한다', () => {
    expect(getDeliverySearchHref(createOrder({ id: 'order/id?' }))).toBe('/orders/delivery?orderId=order%2Fid%3F');
  });

  it.each(['pending', 'confirmed'] as const)('고객은 %s 주문을 취소할 수 있다', (status) => {
    expect(getCustomerCancellationAvailability(status)).toEqual({ canCancel: true });
  });

  it('상품 준비 이후 주문은 고객 취소 대신 안내를 제공한다', () => {
    expect(getCustomerCancellationAvailability('preparing')).toEqual({
      canCancel: false,
      message: '상품 준비 이후 주문은 고객센터로 문의해 주세요.',
    });
  });
});
