import {
  buildProductReviewAggregate,
  normalizeReviewStatsEventTime,
  shouldClaimReviewStatsRun,
} from '../src/domain/reviewAggregate';

describe('review aggregate domain', () => {
  test('builds one bounded materialized product summary', () => {
    expect(buildProductReviewAggregate({
      reviewCount: 4,
      averageRating: 4.266,
      recommendedCount: 3,
      ratingCounts: { 5: 2, 4: 1, 3: 1, 2: 0, 1: 0 },
    })).toEqual({
      reviewCount: 4,
      rating: 4.3,
      reviewSummary: {
        schemaVersion: 1,
        totalReviews: 4,
        averageRating: 4.3,
        recommendedCount: 3,
        recommendationRate: 75,
        ratingDistribution: { 5: 2, 4: 1, 3: 1, 2: 0, 1: 0 },
      },
    });

    expect(buildProductReviewAggregate({
      reviewCount: -2,
      averageRating: 9,
      recommendedCount: 99,
      ratingCounts: { 5: 99, 4: -1, 3: Number.NaN, 2: 0, 1: 0 },
    })).toMatchObject({
      reviewCount: 0,
      rating: 5,
      reviewSummary: {
        totalReviews: 0,
        recommendedCount: 0,
        recommendationRate: 0,
        ratingDistribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
      },
    });
  });

  test('normalizes event time without using unordered event ids as a tie-break', () => {
    const later = normalizeReviewStatsEventTime('2026-07-21T01:02:03.1Z');
    const earlier = normalizeReviewStatsEventTime('2026-07-21T01:02:03.09Z');

    expect(later).toBe('2026-07-21T01:02:03.100000000Z');
    expect(earlier).toBe('2026-07-21T01:02:03.090000000Z');
    expect(shouldClaimReviewStatsRun(earlier, later)).toBe(true);
    expect(shouldClaimReviewStatsRun(later, earlier)).toBe(false);
  });

  test('allows an equal-time reconciliation to reclaim with a run token', () => {
    const eventTime = normalizeReviewStatsEventTime('2026-07-21T01:02:03.123Z');

    expect(shouldClaimReviewStatsRun(eventTime, eventTime)).toBe(true);
    expect(shouldClaimReviewStatsRun(undefined, eventTime)).toBe(true);
  });
});
