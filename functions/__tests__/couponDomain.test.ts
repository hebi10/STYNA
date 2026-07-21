import {
  couponHasExpired,
  isCouponIssuableByAction,
  isAvailableUserCouponStatus,
  normalizeCouponCode,
} from '../src/domain/couponDomain';

describe('coupon domain logic', () => {
  test('normalizes coupon codes before lookup', () => {
    expect(normalizeCouponCode(' welcome2026 ')).toBe('WELCOME2026');
    expect(normalizeCouponCode(undefined)).toBe('');
  });

  test('detects expired coupon dates using day precision', () => {
    const today = new Date('2026-05-11T10:00:00.000Z');

    expect(couponHasExpired('2026-05-10', today)).toBe(true);
    expect(couponHasExpired('2026-05-11', today)).toBe(false);
    expect(couponHasExpired('2026-05-12', today)).toBe(false);
  });

  test('uses the KST calendar boundary for coupon expiry', () => {
    expect(couponHasExpired('2026-07-21', new Date('2026-07-21T14:59:59.999Z'))).toBe(false);
    expect(couponHasExpired('2026.07.21', new Date('2026-07-21T15:00:00.000Z'))).toBe(true);
  });

  test('accepts known available user coupon statuses', () => {
    expect(isAvailableUserCouponStatus('사용가능')).toBe(true);
    expect(isAvailableUserCouponStatus('available')).toBe(true);
    expect(isAvailableUserCouponStatus('ACTIVE')).toBe(true);
    expect(isAvailableUserCouponStatus('사용완료')).toBe(false);
  });

  test('allows direct issue only for active direct assignment coupons', () => {
    expect(
      isCouponIssuableByAction({
        isActive: true,
        isDirectAssign: true,
        expiryDate: '2026-05-12',
        usageLimit: 10,
        usedCount: 9,
      }, new Date('2026-05-11T10:00:00.000Z')),
    ).toEqual({ ok: true });

    expect(
      isCouponIssuableByAction({
        isActive: true,
        isDirectAssign: false,
        couponCode: 'WELCOME2026',
        expiryDate: '2026-05-12',
      }, new Date('2026-05-11T10:00:00.000Z')),
    ).toEqual({ ok: false, reason: 'code_coupon_requires_register' });

    expect(
      isCouponIssuableByAction({
        isActive: true,
        isDirectAssign: true,
        expiryDate: '2026-05-10',
      }, new Date('2026-05-11T10:00:00.000Z')),
    ).toEqual({ ok: false, reason: 'expired' });
  });
});
