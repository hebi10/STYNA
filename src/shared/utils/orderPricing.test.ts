import {
  calculateOrderPreview,
  getCouponAvailability,
  isCouponExpired,
} from './orderPricing';
import { UserCouponView } from '@/shared/types/coupon';

const baseCouponView = (coupon: Partial<UserCouponView['coupon']>): UserCouponView => ({
  id: 'user-coupon-1',
  uid: 'user-1',
  couponId: coupon.id || 'coupon-1',
  status: '사용가능',
  issuedDate: '2026-05-01',
  createdAt: new Date('2026-05-01T00:00:00.000Z'),
  updatedAt: new Date('2026-05-01T00:00:00.000Z'),
  coupon: {
    id: coupon.id || 'coupon-1',
    name: coupon.name || '테스트 쿠폰',
    type: coupon.type || '할인금액',
    value: coupon.value ?? 3000,
    minOrderAmount: coupon.minOrderAmount,
    expiryDate: coupon.expiryDate || '2026-05-31',
    description: '',
    isActive: coupon.isActive ?? true,
    isDirectAssign: false,
    usageLimit: 100,
    usedCount: 0,
    createdAt: new Date('2026-05-01T00:00:00.000Z'),
    updatedAt: new Date('2026-05-01T00:00:00.000Z'),
  },
});

describe('orderPricing', () => {
  const now = new Date('2026-05-12T00:00:00.000Z');

  test('uses discounted cart unit price as subtotal and does not subtract product discount again', () => {
    const preview = calculateOrderPreview({
      items: [
        {
          productId: 'p1',
          price: 8000,
          discountAmount: 2000,
          quantity: 2,
          isAvailable: true,
        },
      ],
      deliveryOption: 'standard',
      selectedCoupon: null,
      requestedPointAmount: 0,
      pointBalance: 0,
      now,
    });

    expect(preview.subtotal).toBe(16000);
    expect(preview.productDiscountAmount).toBe(4000);
    expect(preview.couponDiscount).toBe(0);
    expect(preview.deliveryFee).toBe(3000);
    expect(preview.estimatedTotalBeforePoints).toBe(19000);
    expect(preview.finalAmount).toBe(19000);
  });

  test('applies minimum order amount and fixed coupon discount before standard delivery fee', () => {
    const selectedCoupon = baseCouponView({
      type: '할인금액',
      value: 5000,
      minOrderAmount: 10000,
      expiryDate: '2026-05-31',
    });

    const preview = calculateOrderPreview({
      items: [{ productId: 'p1', price: 12000, discountAmount: 0, quantity: 1, isAvailable: true }],
      deliveryOption: 'standard',
      selectedCoupon,
      requestedPointAmount: 0,
      pointBalance: 0,
      now,
    });

    expect(preview.usableCoupon?.id).toBe('user-coupon-1');
    expect(preview.couponDiscount).toBe(5000);
    expect(preview.deliveryFee).toBe(3000);
    expect(preview.finalAmount).toBe(10000);
  });

  test('free shipping coupon removes standard shipping but not express shipping', () => {
    const selectedCoupon = baseCouponView({
      type: '무료배송',
      value: 0,
      minOrderAmount: 0,
      expiryDate: '2026-05-31',
    });

    const standard = calculateOrderPreview({
      items: [{ productId: 'p1', price: 12000, discountAmount: 0, quantity: 1, isAvailable: true }],
      deliveryOption: 'standard',
      selectedCoupon,
      requestedPointAmount: 0,
      pointBalance: 0,
      now,
    });

    const express = calculateOrderPreview({
      items: [{ productId: 'p1', price: 12000, discountAmount: 0, quantity: 1, isAvailable: true }],
      deliveryOption: 'express',
      selectedCoupon,
      requestedPointAmount: 0,
      pointBalance: 0,
      now,
    });

    expect(standard.deliveryFee).toBe(0);
    expect(standard.finalAmount).toBe(12000);
    expect(express.deliveryFee).toBe(5000);
    expect(express.finalAmount).toBe(17000);
  });

  test('rejects expired and minimum-order coupons from preview calculation', () => {
    const expiredCoupon = baseCouponView({ expiryDate: '2026-05-11' });
    const minimumCoupon = baseCouponView({ minOrderAmount: 50000, expiryDate: '2026-05-31' });

    expect(isCouponExpired('2026-05-11', now)).toBe(true);
    expect(getCouponAvailability(expiredCoupon, 20000, now).usable).toBe(false);
    expect(getCouponAvailability(minimumCoupon, 20000, now).usable).toBe(false);
  });

  test('keeps a coupon valid until the end of its KST expiry day', () => {
    const expiry = '2026-07-21';

    expect(isCouponExpired(expiry, new Date('2026-07-21T14:59:59.999Z'))).toBe(false);
    expect(isCouponExpired(expiry, new Date('2026-07-21T15:00:00.000Z'))).toBe(true);
  });

  test('caps points by current balance and payable amount', () => {
    const preview = calculateOrderPreview({
      items: [{ productId: 'p1', price: 12000, discountAmount: 0, quantity: 1, isAvailable: true }],
      deliveryOption: 'standard',
      selectedCoupon: null,
      requestedPointAmount: 999999,
      pointBalance: 10000,
      now,
    });

    expect(preview.maxUsablePoints).toBe(10000);
    expect(preview.pointUsed).toBe(10000);
    expect(preview.finalAmount).toBe(5000);
  });

  test('keeps selected coupon unusable when subtotal drops below minimum order amount', () => {
    const selectedCoupon = baseCouponView({
      type: '할인금액',
      value: 5000,
      minOrderAmount: 30000,
      expiryDate: '2026-05-31',
    });

    const preview = calculateOrderPreview({
      items: [{ productId: 'p1', price: 12000, discountAmount: 0, quantity: 1, isAvailable: true }],
      deliveryOption: 'standard',
      selectedCoupon,
      requestedPointAmount: 0,
      pointBalance: 0,
      now,
    });

    expect(preview.usableCoupon).toBeNull();
    expect(preview.couponAvailability.reason).toBe('minimum');
    expect(preview.couponDiscount).toBe(0);
    expect(preview.finalAmount).toBe(15000);
  });
});
