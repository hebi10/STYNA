import {
  AggregateField,
  FieldValue,
  Firestore,
  getFirestore,
} from 'firebase-admin/firestore';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import {
  buildProductReviewAggregate,
  isProductReviewAggregateConsistent,
  normalizeReviewStatsEventTime,
  ReviewRating,
  shouldClaimReviewStatsRun,
} from '../domain/reviewAggregate';

type ReviewStatsSource = Record<string, unknown> | null;

function normalizeProductId(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 && value === value.trim()
    ? value
    : null;
}

export function getAffectedReviewProductIds(
  before: ReviewStatsSource,
  after: ReviewStatsSource,
): string[] {
  if (before && after) {
    const hasRelevantChange = before.productId !== after.productId
      || before.rating !== after.rating
      || before.isRecommended !== after.isRecommended;
    if (!hasRelevantChange) return [];
  }

  const productIds = new Set<string>();
  for (const data of [before, after]) {
    const productId = normalizeProductId(data?.productId);
    if (productId) productIds.add(productId);
  }
  return Array.from(productIds);
}

async function claimReviewStatsRun(
  firestore: Firestore,
  productId: string,
  eventTime: string,
  runToken: string,
): Promise<boolean> {
  const productRef = firestore.collection('products').doc(productId);
  return firestore.runTransaction(async (transaction) => {
    const productSnapshot = await transaction.get(productRef);
    if (!productSnapshot.exists) return false;

    const currentEventTime = productSnapshot.data()?.reviewStatsEventTime;
    if (!shouldClaimReviewStatsRun(currentEventTime, eventTime)) return false;

    transaction.update(productRef, {
      reviewStatsEventTime: eventTime,
      reviewStatsRunToken: runToken,
    });
    return true;
  });
}

export async function syncProductReviewStats(
  firestore: Firestore,
  productId: string,
  eventTime: string,
  runToken: string,
): Promise<void> {
  const claimed = await claimReviewStatsRun(
    firestore,
    productId,
    eventTime,
    runToken,
  );
  if (!claimed) return;

  const reviewQuery = firestore
    .collection('reviews')
    .where('productId', '==', productId);
  const ratingValues: ReviewRating[] = [5, 4, 3, 2, 1];
  const [aggregateSnapshot, recommendedSnapshot, ...ratingSnapshots] = await Promise.all([
    reviewQuery.aggregate({
      reviewCount: AggregateField.count(),
      averageRating: AggregateField.average('rating'),
    }).get(),
    reviewQuery.where('isRecommended', '==', true).count().get(),
    ...ratingValues.map((rating) => (
      reviewQuery.where('rating', '==', rating).count().get()
    )),
  ]);
  const aggregateData = aggregateSnapshot.data();
  const aggregate = buildProductReviewAggregate({
    reviewCount: aggregateData.reviewCount,
    averageRating: aggregateData.averageRating,
    recommendedCount: recommendedSnapshot.data().count,
    ratingCounts: ratingValues.reduce<Partial<Record<ReviewRating, unknown>>>(
      (counts, rating, index) => {
        counts[rating] = ratingSnapshots[index]?.data().count;
        return counts;
      },
      {},
    ),
  });
  if (!isProductReviewAggregateConsistent(aggregate)) {
    throw new Error('Review aggregate snapshots are inconsistent; retry is required.');
  }
  const productRef = firestore.collection('products').doc(productId);

  await firestore.runTransaction(async (transaction) => {
    const productSnapshot = await transaction.get(productRef);
    if (!productSnapshot.exists) return;
    if (productSnapshot.data()?.reviewStatsRunToken !== runToken) return;

    transaction.update(productRef, {
      ...aggregate,
      reviewStatsEventTime: eventTime,
      reviewStatsRunToken: FieldValue.delete(),
      reviewStatsUpdatedAt: FieldValue.serverTimestamp(),
      reviewStatsVersion: FieldValue.delete(),
    });
  });
}

export const syncReviewProductStats = onDocumentWritten(
  {
    document: 'reviews/{reviewId}',
    region: 'asia-northeast1',
    memory: '256MiB',
    timeoutSeconds: 60,
    retry: true,
  },
  async (event) => {
    if (!event.data) return;

    const before = event.data.before.exists
      ? event.data.before.data() as ReviewStatsSource
      : null;
    const after = event.data.after.exists
      ? event.data.after.data() as ReviewStatsSource
      : null;
    const productIds = getAffectedReviewProductIds(before, after);
    if (productIds.length === 0) return;

    const eventTime = normalizeReviewStatsEventTime(event.time);
    const firestore = getFirestore();
    await Promise.all(productIds.map((productId) => (
      syncProductReviewStats(
        firestore,
        productId,
        eventTime,
        `${event.id}:${productId}`,
      )
    )));
  },
);
