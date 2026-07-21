import {
  isExpiredOnKstDay,
  parseCouponExpiryDay,
  toKstDayKey,
} from './kstDate';

describe('KST coupon date contract', () => {
  test.each([
    ['2026-07-20T14:59:59.999Z', '2026-07-20'],
    ['2026-07-20T15:00:00.000Z', '2026-07-21'],
  ])('maps %s to Seoul day %s', (instant, day) => {
    expect(toKstDayKey(new Date(instant))).toBe(day);
  });

  test.each(['2026-07-21', '2026.07.21', '2026/07/21'])(
    'keeps %s valid through its Seoul calendar day',
    (expiry) => {
      expect(isExpiredOnKstDay(expiry, new Date('2026-07-21T14:59:59.999Z'))).toBe(false);
      expect(isExpiredOnKstDay(expiry, new Date('2026-07-21T15:00:00.000Z'))).toBe(true);
    },
  );

  test('normalizes real date-only, Date, and Timestamp-like values consistently', () => {
    expect(parseCouponExpiryDay('2024-02-29')).toBe('2024-02-29');
    expect(parseCouponExpiryDay('2026.07.21')).toBe('2026-07-21');
    expect(parseCouponExpiryDay(new Date('2026-07-20T15:00:00.000Z'))).toBe('2026-07-21');
    expect(parseCouponExpiryDay({
      toDate: () => new Date('2026-07-20T15:00:00.000Z'),
    })).toBe('2026-07-21');
  });

  test.each(['2026-02-29', '2026-13-01', 'not-a-date', new Date('invalid')])(
    'rejects invalid expiry value %p',
    (value) => {
      expect(parseCouponExpiryDay(value)).toBeNull();
      expect(isExpiredOnKstDay(value, new Date('2026-07-20T00:00:00.000Z'))).toBe(true);
    },
  );
});
