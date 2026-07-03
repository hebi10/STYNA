const { admin, db, projectId } = require("./util-firestore-admin");

const DEFAULT_OPTIONS = {
  sourceCollection: "categories",
  sourceSubcollection: "products",
  destinationCollection: "products",
  execute: false,
  normalizeOrders: true,
  failOnExistingDestination: true,
  sampleLimit: 20,
};

function parseArgs(argv) {
  const [command = "analyze", ...flags] = argv;
  const options = { ...DEFAULT_OPTIONS };

  for (const flag of flags) {
    if (flag === "--execute") {
      options.execute = true;
      continue;
    }

    if (flag === "--skip-order-normalization") {
      options.normalizeOrders = false;
      continue;
    }

    if (flag === "--allow-existing-destination") {
      options.failOnExistingDestination = false;
      continue;
    }

    if (!flag.startsWith("--")) {
      continue;
    }

    const [key, rawValue] = flag.slice(2).split("=");
    const value = rawValue === undefined ? true : rawValue;

    switch (key) {
      case "dest":
        options.destinationCollection = value;
        break;
      case "sample-limit":
        options.sampleLimit = Number(value) || DEFAULT_OPTIONS.sampleLimit;
        break;
      default:
        break;
    }
  }

  return { command, options };
}

async function getCategories() {
  const snapshot = await db.collection("categories").get();
  return snapshot.docs.map((doc) => ({ id: doc.id, data: doc.data(), ref: doc.ref }));
}

async function analyzeStructure(options) {
  const categories = await getCategories();
  const sourceByCategory = {};
  const seenProductIds = new Map();
  const duplicateProductIds = [];
  const sampleProducts = [];
  let sourceProductCount = 0;

  for (const category of categories) {
    const productsSnapshot = await category.ref.collection(options.sourceSubcollection).get();
    sourceByCategory[category.id] = productsSnapshot.size;
    sourceProductCount += productsSnapshot.size;

    for (const productDoc of productsSnapshot.docs) {
      const productId = productDoc.id;
      const sourcePath = productDoc.ref.path;

      if (seenProductIds.has(productId)) {
        duplicateProductIds.push({
          productId,
          firstPath: seenProductIds.get(productId),
          secondPath: sourcePath,
        });
      } else {
        seenProductIds.set(productId, sourcePath);
      }

      if (sampleProducts.length < options.sampleLimit) {
        const data = productDoc.data();
        sampleProducts.push({
          id: productId,
          categoryId: category.id,
          name: data.name || null,
          status: data.status || null,
          sourcePath,
        });
      }
    }
  }

  const destinationProbe = await db.collection(options.destinationCollection).limit(5).get();
  const destinationExists = !destinationProbe.empty;

  return {
    projectId,
    sourceCollection: options.sourceCollection,
    sourceSubcollection: options.sourceSubcollection,
    destinationCollection: options.destinationCollection,
    categories: categories.length,
    sourceProductCount,
    sourceByCategory,
    duplicateProductIds,
    destinationExists,
    destinationSamplePaths: destinationProbe.docs.map((doc) => doc.ref.path),
    sampleProducts,
  };
}

function printAnalyzeReport(report) {
  console.log("");
  console.log("Firestore product migration analysis");
  console.log("-----------------------------------");
  console.log(`Project: ${report.projectId}`);
  console.log(`Source: ${report.sourceCollection}/{categoryId}/${report.sourceSubcollection}/{productId}`);
  console.log(`Destination: ${report.destinationCollection}/{productId}`);
  console.log(`Categories: ${report.categories}`);
  console.log(`Source products: ${report.sourceProductCount}`);
  console.log(`Destination exists: ${report.destinationExists}`);

  if (report.destinationSamplePaths.length > 0) {
    console.log("Destination sample documents:");
    report.destinationSamplePaths.forEach((path) => console.log(`  - ${path}`));
  }

  console.log("Products by category:");
  Object.entries(report.sourceByCategory).forEach(([categoryId, count]) => {
    console.log(`  - ${categoryId}: ${count}`);
  });

  if (report.duplicateProductIds.length > 0) {
    console.log("Duplicate product IDs detected:");
    report.duplicateProductIds.slice(0, 20).forEach((item) => {
      console.log(`  - ${item.productId}`);
      console.log(`    first:  ${item.firstPath}`);
      console.log(`    second: ${item.secondPath}`);
    });
  } else {
    console.log("Duplicate product IDs: none");
  }
}

function ensureMigrationPreconditions(report, options) {
  if (report.duplicateProductIds.length > 0) {
    throw new Error(
      `Cannot flatten products to ${options.destinationCollection}: duplicate product IDs exist across categories.`
    );
  }

  if (options.failOnExistingDestination && report.destinationExists) {
    throw new Error(
      `Destination collection ${options.destinationCollection} already contains documents. ` +
        "Use --allow-existing-destination only after you verify it is safe."
    );
  }
}

async function createRunDocument(options, report) {
  const runId = `products_v2_${Date.now()}`;
  const runRef = db.collection("migrationRuns").doc(runId);

  await runRef.set({
    type: "products_v2",
    status: "running",
    startedAt: admin.firestore.FieldValue.serverTimestamp(),
    config: {
      destinationCollection: options.destinationCollection,
      normalizeOrders: options.normalizeOrders,
    },
    snapshot: {
      categories: report.categories,
      sourceProductCount: report.sourceProductCount,
    },
  });

  return { runId, runRef };
}

async function migrateProducts(options) {
  const report = await analyzeStructure(options);
  printAnalyzeReport(report);
  ensureMigrationPreconditions(report, options);

  if (!options.execute) {
    console.log("");
    console.log("Dry-run only. No documents were written.");
    return { dryRun: true, report };
  }

  const { runId, runRef } = await createRunDocument(options, report);
  const writer = db.bulkWriter();
  const categories = await getCategories();
  let copiedProducts = 0;
  let normalizedOrders = 0;

  writer.onWriteError((error) => {
    if (error.failedAttempts < 3) {
      return true;
    }

    console.error("BulkWriter permanent failure:", error.documentRef.path, error.message);
    return false;
  });

  try {
    for (const category of categories) {
      const productsSnapshot = await category.ref.collection(options.sourceSubcollection).get();

      writer.set(
        category.ref,
        {
          productCount: productsSnapshot.size,
          slug: category.data.slug || category.id,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      for (const productDoc of productsSnapshot.docs) {
        const productData = productDoc.data();
        const destinationRef = db.collection(options.destinationCollection).doc(productDoc.id);

        writer.set(destinationRef, {
          ...productData,
          categoryId: category.id,
          category: productData.category || category.id,
          legacyPath: productDoc.ref.path,
          schemaVersion: 2,
          migration: {
            runId,
            sourcePath: productDoc.ref.path,
            migratedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
        });

        copiedProducts += 1;
      }
    }

    if (options.normalizeOrders) {
      const ordersSnapshot = await db.collection("orders").get();

      for (const orderDoc of ordersSnapshot.docs) {
        const order = orderDoc.data();

        if (order.deliveryAddress && !order.shippingAddress) {
          writer.set(
            orderDoc.ref,
            {
              shippingAddress: order.deliveryAddress,
              addressSchemaVersion: 2,
              migration: {
                orderAddressNormalizedBy: runId,
                normalizedAt: admin.firestore.FieldValue.serverTimestamp(),
              },
            },
            { merge: true }
          );
          normalizedOrders += 1;
        }
      }
    }

    await writer.close();

    await runRef.set(
      {
        status: "completed",
        copiedProducts,
        normalizedOrders,
        finishedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    console.log("");
    console.log("Migration completed");
    console.log(`Run ID: ${runId}`);
    console.log(`Copied products: ${copiedProducts}`);
    console.log(`Normalized orders: ${normalizedOrders}`);

    return {
      dryRun: false,
      runId,
      copiedProducts,
      normalizedOrders,
      report,
    };
  } catch (error) {
    await runRef.set(
      {
        status: "failed",
        error: error.message,
        finishedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    throw error;
  }
}

async function validateMigration(options) {
  const categories = await getCategories();
  const missingProducts = [];
  const mismatchedCategories = [];
  const mismatchedFields = [];
  const sourceIds = new Set();
  let sourceProductCount = 0;
  let destinationMatchedCount = 0;
  let normalizedOrders = 0;

  const destinationSnapshot = await db.collection(options.destinationCollection).get();

  for (const category of categories) {
    const productsSnapshot = await category.ref.collection(options.sourceSubcollection).get();
    sourceProductCount += productsSnapshot.size;

    for (const productDoc of productsSnapshot.docs) {
      sourceIds.add(productDoc.id);
      const destinationDoc = await db.collection(options.destinationCollection).doc(productDoc.id).get();

      if (!destinationDoc.exists) {
        missingProducts.push(productDoc.ref.path);
        continue;
      }

      destinationMatchedCount += 1;

      const destinationData = destinationDoc.data();
      const destinationCategoryId = destinationData.categoryId || destinationData.category;

      if (destinationCategoryId !== category.id) {
        mismatchedCategories.push({
          productId: productDoc.id,
          expected: category.id,
          actual: destinationCategoryId,
        });
      }

      const sourceData = productDoc.data();
      const fieldsToCompare = ["name", "price", "stock", "status", "brand"];

      fieldsToCompare.forEach((field) => {
        if (sourceData[field] !== destinationData[field]) {
          mismatchedFields.push({
            productId: productDoc.id,
            field,
            source: sourceData[field],
            destination: destinationData[field],
          });
        }
      });
    }
  }

  const ordersSnapshot = await db.collection("orders").get();
  ordersSnapshot.docs.forEach((doc) => {
    const order = doc.data();
    if (order.shippingAddress) {
      normalizedOrders += 1;
    }
  });

  const summary = {
    sourceProductCount,
    destinationProductCount: destinationSnapshot.size,
    destinationMatchedCount,
    missingProducts,
    mismatchedCategories,
    mismatchedFields,
    orphanDestinationProducts: destinationSnapshot.docs
      .map((doc) => doc.id)
      .filter((id) => !sourceIds.has(id)),
    normalizedOrders,
  };

  console.log("");
  console.log("Migration validation");
  console.log("--------------------");
  console.log(`Source products: ${summary.sourceProductCount}`);
  console.log(`Destination products: ${summary.destinationProductCount}`);
  console.log(`Matched destination products: ${summary.destinationMatchedCount}`);
  console.log(`Orders with shippingAddress: ${summary.normalizedOrders}`);
  console.log(`Missing destination products: ${summary.missingProducts.length}`);
  console.log(`Mismatched categoryId fields: ${summary.mismatchedCategories.length}`);
  console.log(`Mismatched core fields: ${summary.mismatchedFields.length}`);
  console.log(`Orphan destination products: ${summary.orphanDestinationProducts.length}`);

  if (summary.missingProducts.length > 0) {
    summary.missingProducts.slice(0, 20).forEach((path) => console.log(`  - missing: ${path}`));
  }

  if (summary.mismatchedCategories.length > 0) {
    summary.mismatchedCategories.slice(0, 20).forEach((item) => {
      console.log(
        `  - category mismatch: ${item.productId}, expected=${item.expected}, actual=${item.actual}`
      );
    });
  }

  if (summary.mismatchedFields.length > 0) {
    summary.mismatchedFields.slice(0, 20).forEach((item) => {
      console.log(
        `  - field mismatch: ${item.productId}, field=${item.field}, source=${item.source}, destination=${item.destination}`
      );
    });
  }

  if (summary.orphanDestinationProducts.length > 0) {
    summary.orphanDestinationProducts.slice(0, 20).forEach((id) => {
      console.log(`  - orphan destination: ${options.destinationCollection}/${id}`);
    });
  }

  if (
    summary.missingProducts.length > 0 ||
    summary.mismatchedCategories.length > 0 ||
    summary.mismatchedFields.length > 0 ||
    summary.orphanDestinationProducts.length > 0
  ) {
    process.exitCode = 1;
  }

  return summary;
}

async function main() {
  const { command, options } = parseArgs(process.argv.slice(2));

  switch (command) {
    case "analyze":
      printAnalyzeReport(await analyzeStructure(options));
      break;
    case "migrate":
      await migrateProducts(options);
      break;
    case "validate":
      await validateMigration(options);
      break;
    default:
      console.log("Usage:");
      console.log("  node scripts/firestore-products-v2-migration.js analyze");
      console.log("  node scripts/firestore-products-v2-migration.js migrate");
      console.log("  node scripts/firestore-products-v2-migration.js migrate --execute");
      console.log("  node scripts/firestore-products-v2-migration.js validate");
      process.exitCode = 1;
      break;
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = {
  analyzeStructure,
  migrateProducts,
  validateMigration,
};
