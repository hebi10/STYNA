import { UserCouponView } from '@/shared/types/coupon';

export interface CouponBenefitSummary {
  fixedDiscountAmount: number;
  percentageCouponCount: number;
  freeShippingCouponCount: number;
  label: string;
  valueText: string;
  description: string;
}

export function summarizeAvailableCouponBenefits(
  userCoupons: UserCouponView[],
): CouponBenefitSummary {
  const availableCoupons = userCoupons.filter((userCoupon) => userCoupon.status === '사용가능');
  const fixedDiscountAmount = availableCoupons
    .filter((userCoupon) => userCoupon.coupon.type === '할인금액')
    .reduce((sum, userCoupon) => sum + Math.max(0, userCoupon.coupon.value), 0);
  const percentageCouponCount = availableCoupons.filter(
    (userCoupon) => userCoupon.coupon.type === '할인율',
  ).length;
  const freeShippingCouponCount = availableCoupons.filter(
    (userCoupon) => userCoupon.coupon.type === '무료배송',
  ).length;

  return {
    fixedDiscountAmount,
    percentageCouponCount,
    freeShippingCouponCount,
    label: '사용 가능 혜택',
    valueText: [
      `정액 ${fixedDiscountAmount.toLocaleString()}원`,
      `정률 ${percentageCouponCount}장`,
      `무료배송 ${freeShippingCouponCount}장`,
    ].join(' · '),
    description: '정률·무료배송 쿠폰의 실제 혜택은 주문 금액과 배송 조건에 따라 주문서에서 계산됩니다.',
  };
}
