import { summarizeAvailableCouponBenefits } from './couponBenefitSummary';
import { UserCouponView } from '@/shared/types/coupon';

function makeCoupon(
  type: UserCouponView['coupon']['type'],
  value: number,
  status: UserCouponView['status'] = '사용가능',
): UserCouponView {
  return {
    id: `${type}-${value}-${status}`,
    uid: 'user-1',
    couponId: `${type}-${value}`,
    status,
    issuedDate: '2026-07-10',
    createdAt: new Date('2026-07-10T00:00:00.000Z'),
    updatedAt: new Date('2026-07-10T00:00:00.000Z'),
    coupon: {
      id: `${type}-${value}`,
      name: '테스트 쿠폰',
      type,
      value,
      expiryDate: '2026-12-31',
      isActive: true,
      isDirectAssign: false,
      usageLimit: 10,
      usedCount: 0,
      createdAt: new Date('2026-07-10T00:00:00.000Z'),
      updatedAt: new Date('2026-07-10T00:00:00.000Z'),
    },
  };
}

describe('summarizeAvailableCouponBenefits', () => {
  test('keeps fixed, percentage, and free-shipping benefits distinct', () => {
    const summary = summarizeAvailableCouponBenefits([
      makeCoupon('할인금액', 3000),
      makeCoupon('할인금액', 5000),
      makeCoupon('할인율', 10),
      makeCoupon('무료배송', 0),
      makeCoupon('할인금액', 1000, '사용완료'),
    ]);

    expect(summary.fixedDiscountAmount).toBe(8000);
    expect(summary.percentageCouponCount).toBe(1);
    expect(summary.freeShippingCouponCount).toBe(1);
    expect(summary.label).toBe('사용 가능 혜택');
    expect(summary.valueText).toBe('정액 8,000원 · 정률 1장 · 무료배송 1장');
    expect(summary.description).toContain('주문 금액과 배송 조건');
  });
});
