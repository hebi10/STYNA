const { randomUUID } = require('node:crypto');

const REVIEW_SUMMARY_SCHEMA_VERSION = 1;
const REVIEW_RATINGS = Object.freeze([5, 4, 3, 2, 1]);

function normalizeFirestoreTimestamp(value) {
  const seconds = Number(value?.seconds);
  const nanoseconds = Number(value?.nanoseconds);
  if (
    !Number.isSafeInteger(seconds)
    || !Number.isInteger(nanoseconds)
    || nanoseconds < 0
    || nanoseconds >= 1_000_000_000
  ) {
    throw new Error('Firestore server timestamp is invalid.');
  }
  const date = new Date(seconds * 1000);
  if (Number.isNaN(date.getTime())) {
    throw new Error('Firestore server timestamp is outside the supported range.');
  }
  return `${date.toISOString().slice(0, 19)}.${String(nanoseconds).padStart(9, '0')}Z`;
}

function isValidReviewData(review) {
  return Boolean(
    review
    && typeof review.productId === 'string'
    && review.productId.trim()
    && review.productId === review.productId.trim()
    && Number.isInteger(review.rating)
    && review.rating >= 1
    && review.rating <= 5
    && typeof review.isRecommended === 'boolean'
  );
}

function buildReviewSummary(reviews) {
  const reviewCount = reviews.length;
  const ratingDistribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  let ratingTotal = 0;
  let recommendedCount = 0;

  for (const review of reviews) {
    ratingDistribution[review.rating] += 1;
    ratingTotal += review.rating;
    if (review.isRecommended) recommendedCount += 1;
  }

  const rating = reviewCount > 0
    ? Math.round((ratingTotal / reviewCount) * 10) / 10
    : 0;
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

function buildReviewSummaryFromAggregates({
  reviewCount: rawReviewCount,
  averageRating: rawAverageRating,
  recommendedCount: rawRecommendedCount,
  ratingCounts,
}) {
  const reviewCount = Number.isFinite(Number(rawReviewCount))
    ? Math.max(0, Math.floor(Number(rawReviewCount)))
    : 0;
  const boundedRating = Number.isFinite(Number(rawAverageRating))
    ? Math.min(5, Math.max(0, Number(rawAverageRating)))
    : 0;
  const rating = Math.round(boundedRating * 10) / 10;
  const safeCount = (value) => Number.isFinite(Number(value))
    ? Math.min(reviewCount, Math.max(0, Math.floor(Number(value))))
    : 0;
  const recommendedCount = safeCount(rawRecommendedCount);
  const ratingDistribution = REVIEW_RATINGS.reduce((distribution, reviewRating) => {
    distribution[reviewRating] = safeCount(ratingCounts[reviewRating]);
    return distribution;
  }, { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 });

  return {
    reviewCount,
    rating,
    reviewSummary: {
      schemaVersion: REVIEW_SUMMARY_SCHEMA_VERSION,
      totalReviews: reviewCount,
      averageRating: rating,
      recommendedCount,
      recommendationRate: reviewCount > 0
        ? Math.round((recommendedCount / reviewCount) * 100)
        : 0,
      ratingDistribution,
    },
  };
}

function hasCurrentSummary(product, expected) {
  const currentSummary = product.reviewSummary;
  const currentDistribution = currentSummary && currentSummary.ratingDistribution;
  const expectedSummary = expected.reviewSummary;
  return product.rating === expected.rating
    && product.reviewCount === expected.reviewCount
    && currentSummary
    && currentSummary.schemaVersion === expectedSummary.schemaVersion
    && currentSummary.totalReviews === expectedSummary.totalReviews
    && currentSummary.averageRating === expectedSummary.averageRating
    && currentSummary.recommendedCount === expectedSummary.recommendedCount
    && currentSummary.recommendationRate === expectedSummary.recommendationRate
    && currentDistribution
    && REVIEW_RATINGS.every((rating) => (
      currentDistribution[rating] === expectedSummary.ratingDistribution[rating]
    ));
}

function hasConsistentAggregate(aggregate) {
  const distributionTotal = REVIEW_RATINGS.reduce(
    (total, rating) => total + aggregate.reviewSummary.ratingDistribution[rating],
    0,
  );
  return distributionTotal === aggregate.reviewCount
    && (aggregate.reviewCount === 0 ? aggregate.rating === 0 : aggregate.rating >= 1);
}

function requireRuntime(runtime) {
  if (!runtime || !runtime.db || !runtime.projectId) {
    throw new Error('A Firestore migration runtime must be explicitly provided.');
  }
  if (runtime.targetProjectVerified !== true) {
    throw new Error('Firestore migration target project is not verified.');
  }
  return runtime;
}

async function analyzeReviewSummaryBackfill(runtime) {
  const { db, projectId } = requireRuntime(runtime);
  const [productsSnapshot, reviewsSnapshot] = await Promise.all([
    db.collection('products').get(),
    db.collection('reviews').get(),
  ]);
  const productIds = new Set(productsSnapshot.docs.map((document) => document.id));
  const reviewsByProduct = new Map();
  const invalidReviewIds = [];
  const orphanProductIds = new Set();
  let orphanReviewCount = 0;

  for (const reviewDocument of reviewsSnapshot.docs) {
    const review = reviewDocument.data();
    if (!isValidReviewData(review)) {
      invalidReviewIds.push(reviewDocument.id);
      continue;
    }
    const productId = review.productId;
    if (!productIds.has(productId)) {
      orphanProductIds.add(productId);
      orphanReviewCount += 1;
      continue;
    }
    const productReviews = reviewsByProduct.get(productId) || [];
    productReviews.push(review);
    reviewsByProduct.set(productId, productReviews);
  }

  const plans = productsSnapshot.docs.map((productDocument) => {
    const expected = buildReviewSummary(reviewsByProduct.get(productDocument.id) || []);
    return {
      productId: productDocument.id,
      needsUpdate: !hasCurrentSummary(productDocument.data(), expected),
      expected,
    };
  });

  return {
    projectId,
    dryRun: true,
    productCount: productsSnapshot.docs.length,
    reviewCount: reviewsSnapshot.docs.length,
    staleProductCount: plans.filter((plan) => plan.needsUpdate).length,
    invalidReviewCount: invalidReviewIds.length,
    invalidReviewIds,
    orphanReviewCount,
    orphanProductIds: Array.from(orphanProductIds).sort(),
    plans,
  };
}

function ensureBackfillPreconditions(report) {
  if (report.invalidReviewCount > 0 || report.orphanReviewCount > 0) {
    throw new Error(
      `Backfill preconditions failed: invalid reviews=${report.invalidReviewCount}, `
      + `orphan reviews=${report.orphanReviewCount}. Resolve them before execute.`,
    );
  }
}

async function reconcileProductReviewSummary(
  runtime,
  productId,
  eventTime,
  runToken,
) {
  const { admin, db } = requireRuntime(runtime);
  if (!admin || !admin.firestore) {
    throw new Error('The Firestore Admin runtime is required for execute mode.');
  }
  const productRef = db.collection('products').doc(productId);
  const claimed = await db.runTransaction(async (transaction) => {
    const productSnapshot = await transaction.get(productRef);
    if (!productSnapshot.exists) return false;
    const currentEventTime = productSnapshot.data().reviewStatsEventTime;
    if (typeof currentEventTime === 'string' && eventTime < currentEventTime) return false;
    transaction.update(productRef, {
      reviewStatsEventTime: eventTime,
      reviewStatsRunToken: runToken,
    });
    return true;
  });
  if (!claimed) return false;

  const reviewQuery = db.collection('reviews').where('productId', '==', productId);
  const [aggregateSnapshot, recommendedSnapshot, ...ratingSnapshots] = await Promise.all([
    reviewQuery.aggregate({
      reviewCount: admin.firestore.AggregateField.count(),
      averageRating: admin.firestore.AggregateField.average('rating'),
    }).get(),
    reviewQuery.where('isRecommended', '==', true).count().get(),
    ...REVIEW_RATINGS.map((rating) => reviewQuery.where('rating', '==', rating).count().get()),
  ]);
  const aggregateData = aggregateSnapshot.data();
  const aggregate = buildReviewSummaryFromAggregates({
    reviewCount: aggregateData.reviewCount,
    averageRating: aggregateData.averageRating,
    recommendedCount: recommendedSnapshot.data().count,
    ratingCounts: REVIEW_RATINGS.reduce((counts, rating, index) => {
      counts[rating] = ratingSnapshots[index].data().count;
      return counts;
    }, {}),
  });
  if (!hasConsistentAggregate(aggregate)) {
    throw new Error('Review aggregate snapshots are inconsistent; rerun is required.');
  }

  return db.runTransaction(async (transaction) => {
    const productSnapshot = await transaction.get(productRef);
    if (!productSnapshot.exists) return false;
    if (productSnapshot.data().reviewStatsRunToken !== runToken) return false;
    transaction.update(productRef, {
      ...aggregate,
      reviewStatsEventTime: eventTime,
      reviewStatsRunToken: admin.firestore.FieldValue.delete(),
      reviewStatsUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      reviewStatsVersion: admin.firestore.FieldValue.delete(),
    });
    return true;
  });
}

async function resolveFirestoreServerClock(runtime, runId) {
  const { admin, db, projectId } = requireRuntime(runtime);
  if (typeof admin?.firestore?.FieldValue?.serverTimestamp !== 'function') {
    throw new Error('The Firestore Admin runtime is required for execute mode.');
  }
  const runRef = db.collection('migrationRuns').doc(`review_summary_${runId}`);
  await runRef.set({
    type: 'review_summary_backfill',
    status: 'running',
    targetProjectId: projectId,
    startedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  const runSnapshot = await runRef.get();
  const startedAt = runSnapshot.exists ? runSnapshot.data()?.startedAt : null;
  return {
    eventTime: normalizeFirestoreTimestamp(startedAt),
    runRef,
  };
}

async function runReviewSummaryBackfill(
  options,
  runtime,
  reconcile = reconcileProductReviewSummary,
  resolveServerClock = resolveFirestoreServerClock,
) {
  const report = await analyzeReviewSummaryBackfill(runtime);
  if (!options.execute) return report;
  ensureBackfillPreconditions(report);

  const runId = randomUUID();
  const { eventTime, runRef } = await resolveServerClock(runtime, runId);
  let reconciledProductCount = 0;
  const serverTimestamp = runtime.admin?.firestore?.FieldValue?.serverTimestamp;
  try {
    for (const plan of report.plans) {
      if (!plan.needsUpdate) continue;
      const reconciled = await reconcile(
        runtime,
        plan.productId,
        eventTime,
        `backfill:${runId}:${plan.productId}`,
      );
      if (reconciled) reconciledProductCount += 1;
    }

    await runRef.set({
      status: 'completed',
      reconciledProductCount,
      ...(serverTimestamp ? { finishedAt: serverTimestamp() } : {}),
    }, { merge: true });
    return {
      ...report,
      dryRun: false,
      runId,
      reconciledProductCount,
    };
  } catch (error) {
    await runRef.set({
      status: 'failed',
      ...(serverTimestamp ? { finishedAt: serverTimestamp() } : {}),
    }, { merge: true }).catch(() => undefined);
    throw error;
  }
}

function parseArgs(argv) {
  const [command = 'analyze', ...flags] = argv;
  if (!['analyze', 'backfill'].includes(command)) {
    throw new Error(`Unknown command: ${command}`);
  }
  for (const flag of flags) {
    if (flag !== '--execute') throw new Error(`Unknown argument: ${flag}`);
  }
  const execute = flags.includes('--execute');
  if (command === 'analyze' && execute) {
    throw new Error('--execute is only valid with backfill.');
  }
  return { command, execute };
}

function printReport(report) {
  console.log(JSON.stringify({
    projectId: report.projectId,
    dryRun: report.dryRun,
    productCount: report.productCount,
    reviewCount: report.reviewCount,
    staleProductCount: report.staleProductCount,
    invalidReviewCount: report.invalidReviewCount,
    invalidReviewIds: report.invalidReviewIds.slice(0, 20),
    orphanReviewCount: report.orphanReviewCount,
    orphanProductIds: report.orphanProductIds.slice(0, 20),
    ...(report.runId ? { runId: report.runId } : {}),
    ...(Number.isInteger(report.reconciledProductCount)
      ? { reconciledProductCount: report.reconciledProductCount }
      : {}),
  }, null, 2));
}

async function main(argv = process.argv.slice(2), runtime, reconcile) {
  const options = parseArgs(argv);
  const migrationRuntime = runtime || require('./firestore-migration-runtime')
    .loadFirestoreMigrationRuntime();
  const report = options.command === 'analyze'
    ? await analyzeReviewSummaryBackfill(migrationRuntime)
    : await runReviewSummaryBackfill(options, migrationRuntime, reconcile);
  printReport(report);
  return report;
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}

module.exports = {
  analyzeReviewSummaryBackfill,
  buildReviewSummary,
  ensureBackfillPreconditions,
  main,
  normalizeFirestoreTimestamp,
  parseArgs,
  reconcileProductReviewSummary,
  resolveFirestoreServerClock,
  runReviewSummaryBackfill,
};
