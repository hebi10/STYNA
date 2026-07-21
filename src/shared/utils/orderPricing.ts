import { UserCouponView } from '@/shared/types/coupon';
import { isExpiredOnKstDay } from './kstDate';

export type OrderPricingDeliveryOption = 'standard' | 'express';

export interface OrderPricingItem {
  productId: string;
  price: number;
  discountAmount?: number;
  quantity: number;
  isAvailable?: boolean;
}

export interface CalculateOrderPreviewParams {
  items: OrderPricingItem[];
  deliveryOption: OrderPricingDeliveryOption;
  selectedCoupon?: UserCouponView | null;
  requestedPointAmount?: number;
  pointBalance?: number;
  now?: Date;
}

export interface CouponAvailability {
  usable: boolean;
  reason?: 'used' | 'inactive' | 'expired' | 'minimum';
}

export interface OrderPreview {
  subtotal: number;
  productDiscountAmount: number;
  couponDiscount: number;
  couponFreeShipping: boolean;
  deliveryFee: number;
  estimatedTotalBeforePoints: number;
  maxUsablePoints: number;
  pointUsed: number;
  finalAmount: number;
  usableCoupon: UserCouponView | null;
  couponAvailability: CouponAvailability;
}

const STANDARD_DELIVERY_FEE = 3000;
const EXPRESS_DELIVERY_FEE = 5000;
const STANDARD_FREE_SHIPPING_AMOUNT = 50000;

function toNonNegativeInteger(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return Math.max(0, Math.floor(parsed));
}

export function isCouponExpired(expiryDate: string, now: Date = new Date()): boolean {
  return isExpiredOnKstDay(expiryDate, now);
}

export function getCouponAvailability(
  userCoupon: UserCouponView,
  subtotal: number,
  now: Date = new Date()
): CouponAvailability {
  if (userCoupon.status !== '사용가능') {
    return { usable: false, reason: 'used' };
  }

  if (userCoupon.coupon.isActive !== true) {
    return { usable: false, reason: 'inactive' };
  }

  if (isCouponExpired(userCoupon.coupon.expiryDate, now)) {
    return { usable: false, reason: 'expired' };
  }

  const minOrderAmount = toNonNegativeInteger(userCoupon.coupon.minOrderAmount);
  if (minOrderAmount > 0 && subtotal < minOrderAmount) {
    return { usable: false, reason: 'minimum' };
  }

  return { usable: true };
}

export function calculateCouponDiscount(
  subtotal: number,
  userCoupon: UserCouponView | null
): {
  discount: number;
  freeShipping: boolean;
} {
  if (!userCoupon) {
    return { discount: 0, freeShipping: false };
  }

  const value = toNonNegativeInteger(userCoupon.coupon.value);
  if (userCoupon.coupon.type === '할인율') {
    return {
      discount: Math.floor((subtotal * Math.min(100, value)) / 100),
      freeShipping: false,
    };
  }

  if (userCoupon.coupon.type === '할인금액') {
    return {
      discount: Math.min(subtotal, value),
      freeShipping: false,
    };
  }

  return {
    discount: 0,
    freeShipping: userCoupon.coupon.type === '무료배송',
  };
}

export function calculateDeliveryFee(
  totalAfterCoupon: number,
  deliveryOption: OrderPricingDeliveryOption,
  couponFreeShipping: boolean
): number {
  if (deliveryOption === 'express') {
    return EXPRESS_DELIVERY_FEE;
  }

  if (totalAfterCoupon >= STANDARD_FREE_SHIPPING_AMOUNT || couponFreeShipping) {
    return 0;
  }

  return STANDARD_DELIVERY_FEE;
}

export function calculateOrderPreview(params: CalculateOrderPreviewParams): OrderPreview {
  const items = params.items.filter((item) => item.isAvailable !== false);
  const subtotal = items.reduce(
    (sum, item) => sum + toNonNegativeInteger(item.price) * toNonNegativeInteger(item.quantity),
    0
  );
  const productDiscountAmount = items.reduce(
    (sum, item) => sum + toNonNegativeInteger(item.discountAmount) * toNonNegativeInteger(item.quantity),
    0
  );

  const couponAvailability = params.selectedCoupon
    ? getCouponAvailability(params.selectedCoupon, subtotal, params.now)
    : { usable: true };
  const usableCoupon = params.selectedCoupon && couponAvailability.usable ? params.selectedCoupon : null;
  const coupon = calculateCouponDiscount(subtotal, usableCoupon);
  const totalAfterCoupon = Math.max(0, subtotal - coupon.discount);
  const deliveryFee = calculateDeliveryFee(totalAfterCoupon, params.deliveryOption, coupon.freeShipping);
  const estimatedTotalBeforePoints = Math.max(0, totalAfterCoupon + deliveryFee);
  const maxUsablePoints = Math.min(
    toNonNegativeInteger(params.pointBalance),
    estimatedTotalBeforePoints
  );
  const pointUsed = Math.min(toNonNegativeInteger(params.requestedPointAmount), maxUsablePoints);

  return {
    subtotal,
    productDiscountAmount,
    couponDiscount: coupon.discount,
    couponFreeShipping: coupon.freeShipping,
    deliveryFee,
    estimatedTotalBeforePoints,
    maxUsablePoints,
    pointUsed,
    finalAmount: Math.max(0, estimatedTotalBeforePoints - pointUsed),
    usableCoupon,
    couponAvailability,
  };
}
