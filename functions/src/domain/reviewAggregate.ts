export const REVIEW_SUMMARY_SCHEMA_VERSION = 1 as const;

export type ReviewRating = 1 | 2 | 3 | 4 | 5;

export interface MaterializedReviewSummary {
  schemaVersion: typeof REVIEW_SUMMARY_SCHEMA_VERSION;
  totalReviews: number;
  averageRating: number;
  recommendedCount: number;
  recommendationRate: number;
  ratingDistribution: Record<ReviewRating, number>;
}

export interface ProductReviewAggregate {
  reviewCount: number;
  rating: number;
  reviewSummary: MaterializedReviewSummary;
}

export interface ProductReviewAggregateInput {
  reviewCount: unknown;
  averageRating: unknown;
  recommendedCount: unknown;
  ratingCounts: Partial<Record<ReviewRating, unknown>>;
}

function normalizeCount(value: unknown, upperBound = Number.MAX_SAFE_INTEGER): number {
  const parsed = Number(value);
  return Number.isFinite(parsed)
    ? Math.min(upperBound, Math.max(0, Math.floor(parsed)))
    : 0;
}

export function buildProductReviewAggregate(
  input: ProductReviewAggregateInput,
): ProductReviewAggregate {
  const reviewCount = normalizeCount(input.reviewCount);
  const parsedRating = Number(input.averageRating);
  const boundedRating = Number.isFinite(parsedRating)
    ? Math.min(5, Math.max(0, parsedRating))
    : 0;
  const rating = Math.round(boundedRating * 10) / 10;
  const recommendedCount = normalizeCount(input.recommendedCount, reviewCount);
  const ratingDistribution: Record<ReviewRating, number> = {
    5: normalizeCount(input.ratingCounts[5], reviewCount),
    4: normalizeCount(input.ratingCounts[4], reviewCount),
    3: normalizeCount(input.ratingCounts[3], reviewCount),
    2: normalizeCount(input.ratingCounts[2], reviewCount),
    1: normalizeCount(input.ratingCounts[1], reviewCount),
  };
  const recommendationRate = reviewCount > 0
    ? Math.round((recommendedCount / reviewCount) * 100)
    : 0;

  return {
    reviewCount,
    rating,
    reviewSummary: {
      schemaVersion: REVIEW_SUMMARY_SCHEMA_VERSION,
      totalReviews: reviewCount,
      averageRating: rating,
      recommendedCount,
      recommendationRate,
      ratingDistribution,
    },
  };
}

export function isProductReviewAggregateConsistent(
  aggregate: ProductReviewAggregate,
): boolean {
  const distributionTotal = ([5, 4, 3, 2, 1] as ReviewRating[]).reduce(
    (total, reviewRating) => (
      total + aggregate.reviewSummary.ratingDistribution[reviewRating]
    ),
    0,
  );
  return distributionTotal === aggregate.reviewCount
    && aggregate.reviewSummary.totalReviews === aggregate.reviewCount
    && aggregate.reviewSummary.averageRating === aggregate.rating
    && aggregate.reviewSummary.recommendedCount <= aggregate.reviewCount
    && (aggregate.reviewCount === 0 ? aggregate.rating === 0 : aggregate.rating >= 1);
}

export function normalizeReviewStatsEventTime(eventTime: string): string {
  const match = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,9}))?Z$/.exec(eventTime);
  if (!match) {
    const parsedTime = new Date(eventTime);
    if (Number.isNaN(parsedTime.getTime())) {
      throw new Error('Review aggregate event time is invalid.');
    }
    return normalizeReviewStatsEventTime(parsedTime.toISOString());
  }

  const fraction = (match[2] ?? '').padEnd(9, '0');
  return `${match[1]}.${fraction}Z`;
}

export function shouldClaimReviewStatsRun(
  currentEventTime: unknown,
  candidateEventTime: string,
): boolean {
  return typeof currentEventTime !== 'string' || candidateEventTime >= currentEventTime;
}
