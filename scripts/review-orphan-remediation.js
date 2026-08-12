function requireRuntime(runtime) {
  if (!runtime || !runtime.db || !runtime.projectId) {
    throw new Error('A Firestore migration runtime must be explicitly provided.');
  }
  if (runtime.targetProjectVerified !== true) {
    throw new Error('Firestore migration target project is not verified.');
  }
  return runtime;
}

function normalizeCreatedAt(value) {
  const seconds = Number(value?.seconds);
  const nanoseconds = Number(value?.nanoseconds);
  if (!Number.isSafeInteger(seconds) || !Number.isInteger(nanoseconds)) return null;
  const date = new Date(seconds * 1000);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.toISOString().slice(0, 19)}.${String(nanoseconds).padStart(3, '0').slice(0, 3)}Z`;
}

function isCanonicalProductId(value) {
  return typeof value === 'string' && value.trim().length > 0 && value === value.trim();
}

async function getReviewInventory(runtime) {
  const { db } = requireRuntime(runtime);
  const [productsSnapshot, reviewsSnapshot] = await Promise.all([
    db.collection('products').get(),
    db.collection('reviews').get(),
  ]);
  return {
    productIds: new Set(productsSnapshot.docs.map((document) => document.id)),
    reviews: reviewsSnapshot.docs,
  };
}

function findOrphanReviewDocuments(inventory) {
  return inventory.reviews.filter((reviewDocument) => {
    const productId = reviewDocument.data()?.productId;
    return isCanonicalProductId(productId) && !inventory.productIds.has(productId);
  });
}

async function analyzeReviewOrphans(runtime) {
  const safeRuntime = requireRuntime(runtime);
  const inventory = await getReviewInventory(safeRuntime);
  const orphanReviews = findOrphanReviewDocuments(inventory)
    .map((reviewDocument) => {
      const review = reviewDocument.data();
      return {
        id: reviewDocument.id,
        productId: review.productId,
        createdAt: normalizeCreatedAt(review.createdAt),
      };
    })
    .sort((left, right) => left.id.localeCompare(right.id));

  return {
    projectId: safeRuntime.projectId,
    orphanReviewCount: orphanReviews.length,
    orphanReviews,
  };
}

async function runReviewOrphanRemediation(options, runtime) {
  if (options.command === 'analyze') return analyzeReviewOrphans(runtime);
  if (options.command !== 'delete' || options.execute !== true || options.ids.length === 0) {
    throw new Error('Deletion requires exact review ids and --execute.');
  }

  const safeRuntime = requireRuntime(runtime);
  if (typeof safeRuntime.db.batch !== 'function') {
    throw new Error('The Firestore Admin runtime is required for delete mode.');
  }
  const inventory = await getReviewInventory(safeRuntime);
  const orphanDocumentsById = new Map(
    findOrphanReviewDocuments(inventory).map((reviewDocument) => [reviewDocument.id, reviewDocument]),
  );
  const missingOrNonOrphanIds = options.ids.filter((id) => !orphanDocumentsById.has(id));
  if (missingOrNonOrphanIds.length > 0) {
    throw new Error(`Selected reviews are not current orphan reviews: ${missingOrNonOrphanIds.join(', ')}`);
  }

  const batch = safeRuntime.db.batch();
  for (const id of options.ids) batch.delete(orphanDocumentsById.get(id).ref);
  await batch.commit();
  return {
    projectId: safeRuntime.projectId,
    deletedReviewIds: [...options.ids],
  };
}

function parseArgs(argv) {
  const [command = 'analyze', ...flags] = argv;
  if (!['analyze', 'delete'].includes(command)) throw new Error(`Unknown command: ${command}`);
  if (command === 'analyze') {
    if (flags.length > 0) throw new Error('Analyze does not accept arguments.');
    return { command, execute: false, ids: [] };
  }

  let execute = false;
  let ids = null;
  for (let index = 0; index < flags.length; index += 1) {
    const flag = flags[index];
    if (flag === '--execute') {
      execute = true;
      continue;
    }
    if (flag === '--ids' && ids === null) {
      const value = flags[index + 1];
      if (!value) throw new Error('--ids requires a comma-separated review id list.');
      ids = value.split(',').map((id) => id.trim()).filter(Boolean);
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${flag}`);
  }
  if (!ids || ids.length === 0) throw new Error('delete requires --ids.');
  if (new Set(ids).size !== ids.length) throw new Error('--ids must not contain duplicate review ids.');
  if (!execute) throw new Error('delete requires --execute.');
  return { command, execute, ids };
}

function printReport(report) {
  console.log(JSON.stringify(report, null, 2));
}

async function main(argv = process.argv.slice(2), runtime) {
  const options = parseArgs(argv);
  const migrationRuntime = runtime || require('./firestore-migration-runtime')
    .loadFirestoreMigrationRuntime();
  const report = await runReviewOrphanRemediation(options, migrationRuntime);
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
  analyzeReviewOrphans,
  parseArgs,
  runReviewOrphanRemediation,
};
