import { Event } from '@/shared/types/event';
import { isPublicEventReady } from './eventPublicPolicy';

const baseEvent: Event = {
  id: 'event-1',
  title: '일반 이벤트',
  description: '검증된 이벤트 설명',
  content: '<p>검증된 이벤트 본문</p>',
  bannerImage: '/banner.webp',
  thumbnailImage: '/thumbnail.webp',
  eventType: 'special',
  eligibilityType: 'none',
  rewardType: 'none',
  publicPolicyVerified: true,
  startDate: new Date('2026-01-01T00:00:00+09:00'),
  endDate: new Date('2026-12-31T23:59:59+09:00'),
  isActive: true,
  participantCount: 0,
  hasMaxParticipants: false,
  createdAt: new Date('2026-01-01T00:00:00+09:00'),
  updatedAt: new Date('2026-01-01T00:00:00+09:00'),
};

describe('isPublicEventReady', () => {
  test('allows a manually verified canonical event', () => {
    expect(isPublicEventReady(baseEvent)).toBe(true);
  });

  test.each<[string, Partial<Event>]>([
    ['missing verification', { publicPolicyVerified: undefined }],
    ['missing eligibility', { eligibilityType: undefined }],
    ['missing reward', { rewardType: undefined }],
    ['inactive event', { isActive: false }],
    ['stale coupon id', { rewardType: 'none', rewardCouponId: 'coupon-1' }],
    ['stale empty targets for none', { targetProducts: [] }],
    ['stale targets for none', { targetProducts: ['product-1'] }],
    ['missing target products', { eligibilityType: 'review', targetProducts: [] }],
    ['missing reward coupon', { rewardType: 'coupon', rewardCouponId: undefined }],
    ['invalid reward coupon', { rewardType: 'coupon', rewardCouponId: '__reserved__' }],
  ])('hides %s', (_name, overrides) => {
    expect(isPublicEventReady({ ...baseEvent, ...overrides })).toBe(false);
  });

  test.each([
    ['surrounding whitespace', [' product-1 ']],
    ['an empty member', ['product-1', '']],
    ['a nested document path', ['product/child']],
    ['a dot segment', ['.']],
    ['a reserved id', ['__reserved__']],
    ['an oversized id', ['가'.repeat(501)]],
  ])('hides evidence targets containing %s', (_name, targetProducts) => {
    expect(isPublicEventReady({
      ...baseEvent,
      eligibilityType: 'purchase',
      targetProducts,
    })).toBe(false);
  });

  test('allows a verified evidence event with target products and a valid coupon reward', () => {
    expect(isPublicEventReady({
      ...baseEvent,
      eligibilityType: 'review',
      targetProducts: ['product-1'],
      rewardType: 'coupon',
      rewardCouponId: 'coupon-1',
    })).toBe(true);
  });
});
