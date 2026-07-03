const fs = require("fs");
const path = require("path");
const { admin, db, projectId } = require("./util-firestore-admin");
const {
  buildWebpStoragePath,
  convertStorageImageToWebp,
  parseFirebaseStorageUrl,
  writeMigrationLog,
} = require("./webp-migration-utils");

const DEFAULT_OPTIONS = {
  collection: "products",
  execute: false,
  deleteOriginals: false,
  limit: 0,
  productId: "",
  quality: 75,
  logDir: "migration-logs",
  logPath: "",
  latestLog: false,
};

function parseArgs(argv) {
  const [command = "analyze", ...flags] = argv;
  const options = { ...DEFAULT_OPTIONS };

  flags.forEach((flag) => {
    if (flag === "--execute") {
      options.execute = true;
      return;
    }

    if (flag === "--delete-originals") {
      options.deleteOriginals = true;
      return;
    }

    if (!flag.startsWith("--")) {
      return;
    }

    const [key, rawValue] = flag.slice(2).split("=");
    const value = rawValue === undefined ? true : rawValue;

    switch (key) {
      case "collection":
        options.collection = String(value);
        break;
      case "limit":
        options.limit = Number(value) || 0;
        break;
      case "product-id":
        options.productId = String(value);
        break;
      case "quality":
        options.quality = Math.min(100, Math.max(1, Number(value) || DEFAULT_OPTIONS.quality));
        break;
      case "log-dir":
        options.logDir = String(value);
        break;
      case "log":
        options.logPath = String(value);
        break;
      case "latest-log":
        options.latestLog = true;
        break;
      default:
        break;
    }
  });

  return { command, options };
}

function collectProductImageUrls(productData) {
  const urls = [];
  const seen = new Set();
  const candidates = [
    ...(Array.isArray(productData.images) ? productData.images : []),
    productData.mainImage,
  ];

  candidates.forEach((candidate) => {
    if (typeof candidate !== "string" || candidate.trim() === "") {
      return;
    }

    if (!seen.has(candidate)) {
      seen.add(candidate);
      urls.push(candidate);
    }
  });

  return urls;
}

function getProductIdFromProductImagePath(storagePath) {
  const parts = storagePath.split("/");
  if (parts.length < 4 || parts[0] !== "images") {
    return "";
  }

  return parts[2] || "";
}

async function loadHistoricalConvertedImageUrlsByProductId(logDir) {
  const absoluteLogDir = path.resolve(process.cwd(), logDir);
  const byProductId = new Map();

  let entries = [];
  try {
    entries = await fs.promises.readdir(absoluteLogDir, { withFileTypes: true });
  } catch (error) {
    return byProductId;
  }

  const migrationLogs = entries
    .filter((entry) => entry.isFile() && /^product-image-webp-\d+\.json$/.test(entry.name))
    .map((entry) => path.join(absoluteLogDir, entry.name));

  for (const logPath of migrationLogs) {
    try {
      const log = JSON.parse(await fs.promises.readFile(logPath, "utf8"));

      for (const conversion of log.conversions || []) {
        if (conversion.status !== "converted" || !conversion.newUrl || !conversion.targetPath) {
          continue;
        }

        const productId = getProductIdFromProductImagePath(conversion.targetPath);
        if (productId && !byProductId.has(productId)) {
          byProductId.set(productId, conversion.newUrl);
        }
      }
    } catch (error) {
      continue;
    }
  }

  return byProductId;
}

function replaceProductImageUrls(
  productData,
  replacements,
  failedUrls = new Set(),
  fallbackMainImage = ""
) {
  const nextImages = Array.isArray(productData.images)
    ? [
        ...new Set(
          productData.images.map((imageUrl) => {
            if (replacements.has(imageUrl)) {
              return replacements.get(imageUrl);
            }

            if (failedUrls.has(imageUrl) && fallbackMainImage) {
              return fallbackMainImage;
            }

            return imageUrl;
          })
        ),
      ]
    : productData.images;
  let nextMainImage =
    typeof productData.mainImage === "string"
      ? replacements.get(productData.mainImage) || productData.mainImage
      : productData.mainImage;

  if (typeof productData.mainImage === "string" && failedUrls.has(productData.mainImage)) {
    const firstImage = Array.isArray(nextImages) && nextImages.length > 0 ? nextImages[0] : "";
    const fallback = firstImage || fallbackMainImage;

    if (fallback && fallback !== productData.mainImage) {
      nextMainImage = fallback;
    }
  }

  const update = {};
  if (Array.isArray(productData.images) && nextImages.some((url, index) => url !== productData.images[index])) {
    update.images = nextImages;
  }

  if (nextMainImage !== productData.mainImage) {
    update.mainImage = nextMainImage;
  }

  return update;
}

function isConvertibleProductImageUrl(imageUrl) {
  const parsed = parseFirebaseStorageUrl(imageUrl);
  return Boolean(
    parsed &&
      parsed.path.startsWith("images/") &&
      !parsed.path.toLowerCase().endsWith("_q75.webp")
  );
}

async function getProductDocs(options) {
  if (options.productId) {
    const snapshot = await db.collection(options.collection).doc(options.productId).get();
    return snapshot.exists ? [snapshot] : [];
  }

  let ref = db.collection(options.collection).orderBy(admin.firestore.FieldPath.documentId());
  if (options.limit > 0) {
    ref = ref.limit(options.limit);
  }

  const snapshot = await ref.get();
  return snapshot.docs;
}

async function analyzeProducts(options) {
  const docs = await getProductDocs(options);
  const uniqueUrls = new Set();
  const convertibleUrls = new Set();
  const alreadyWebpUrls = new Set();
  const nonFirebaseUrls = new Set();

  docs.forEach((doc) => {
    collectProductImageUrls(doc.data()).forEach((url) => {
      uniqueUrls.add(url);
      const parsed = parseFirebaseStorageUrl(url);

      if (!parsed) {
        nonFirebaseUrls.add(url);
        return;
      }

      if (parsed.path.toLowerCase().endsWith(".webp")) {
        alreadyWebpUrls.add(url);
      }

      if (isConvertibleProductImageUrl(url)) {
        convertibleUrls.add(url);
      }
    });
  });

  return {
    projectId,
    collection: options.collection,
    productCount: docs.length,
    uniqueImageUrlCount: uniqueUrls.size,
    convertibleImageUrlCount: convertibleUrls.size,
    alreadyWebpUrlCount: alreadyWebpUrls.size,
    nonFirebaseUrlCount: nonFirebaseUrls.size,
    sampleConvertibleUrls: Array.from(convertibleUrls).slice(0, 10),
  };
}

function printAnalyzeReport(report) {
  console.log("");
  console.log("Product image WebP migration analysis");
  console.log("------------------------------------");
  console.log(`Project: ${report.projectId}`);
  console.log(`Collection: ${report.collection}`);
  console.log(`Products scanned: ${report.productCount}`);
  console.log(`Unique image URLs: ${report.uniqueImageUrlCount}`);
  console.log(`Convertible Firebase product image URLs: ${report.convertibleImageUrlCount}`);
  console.log(`Already WebP URLs: ${report.alreadyWebpUrlCount}`);
  console.log(`Non-Firebase URLs: ${report.nonFirebaseUrlCount}`);

  if (report.sampleConvertibleUrls.length > 0) {
    console.log("Sample convertible URLs:");
    report.sampleConvertibleUrls.forEach((url) => console.log(`  - ${url}`));
  }
}

async function convertImageUrl(imageUrl, options) {
  return convertStorageImageToWebp(admin, imageUrl, options, {
    pathPrefix: "images/",
    invalidReason: "not a product Firebase Storage image",
  });
}

async function findLatestMigrationLogPath(logDir) {
  const absoluteLogDir = path.resolve(process.cwd(), logDir);
  const entries = await fs.promises.readdir(absoluteLogDir, { withFileTypes: true });
  const candidates = await Promise.all(
    entries
      .filter((entry) => entry.isFile() && /^product-image-webp-\d+\.json$/.test(entry.name))
      .map(async (entry) => {
        const filePath = path.join(absoluteLogDir, entry.name);
        const stats = await fs.promises.stat(filePath);
        return { filePath, mtimeMs: stats.mtimeMs };
      })
  );

  candidates.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return candidates[0]?.filePath || "";
}

async function migrateProducts(options) {
  if (options.deleteOriginals && !options.execute) {
    throw new Error("--delete-originals requires --execute.");
  }

  const docs = await getProductDocs(options);
  const conversionResults = new Map();
  const replacementMap = new Map();
  const productUpdates = [];
  const failedProductIds = new Set();
  const historicalConvertedUrlsByProductId = await loadHistoricalConvertedImageUrlsByProductId(
    options.logDir
  );

  for (const doc of docs) {
    const productData = doc.data();
    const productUrls = collectProductImageUrls(productData).filter(isConvertibleProductImageUrl);
    const failedUrls = new Set();

    for (const imageUrl of productUrls) {
      if (!conversionResults.has(imageUrl)) {
        if (options.execute) {
          const result = await convertImageUrl(imageUrl, options);
          conversionResults.set(imageUrl, result);

          if (result.status === "converted") {
            replacementMap.set(imageUrl, result.newUrl);
          }
        } else {
          const parsed = parseFirebaseStorageUrl(imageUrl);
          conversionResults.set(imageUrl, {
            status: "dry-run",
            oldUrl: imageUrl,
            bucket: parsed.bucket,
            sourcePath: parsed.path,
            targetPath: buildWebpStoragePath(parsed.path),
          });
        }
      }

      const result = conversionResults.get(imageUrl);
      if (result.status === "failed") {
        failedProductIds.add(doc.id);
        failedUrls.add(imageUrl);
      }
    }

    if (options.execute) {
      const update = replaceProductImageUrls(
        productData,
        replacementMap,
        failedUrls,
        historicalConvertedUrlsByProductId.get(doc.id) || ""
      );
      if (Object.keys(update).length > 0) {
        await doc.ref.update(update);
        productUpdates.push({ productId: doc.id, update });
      }
    }
  }

  const deletedOriginals = [];
  const deleteFailures = [];

  if (options.execute && options.deleteOriginals) {
    const failedOldUrls = new Set();
    failedProductIds.forEach((productId) => {
      const doc = docs.find((candidate) => candidate.id === productId);
      if (!doc) {
        return;
      }
      collectProductImageUrls(doc.data()).forEach((url) => failedOldUrls.add(url));
    });

    for (const result of conversionResults.values()) {
      if (result.status !== "converted" || failedOldUrls.has(result.oldUrl)) {
        continue;
      }

      try {
        await admin.storage().bucket(result.bucket).file(result.sourcePath).delete({ ignoreNotFound: true });
        deletedOriginals.push({ oldUrl: result.oldUrl, sourcePath: result.sourcePath });
      } catch (error) {
        deleteFailures.push({
          oldUrl: result.oldUrl,
          sourcePath: result.sourcePath,
          error: error.message,
        });
      }
    }
  }

  const summary = {
    projectId,
    collection: options.collection,
    execute: options.execute,
    deleteOriginals: options.deleteOriginals,
    quality: options.quality,
    productsScanned: docs.length,
    productsUpdated: productUpdates.length,
    failedProducts: Array.from(failedProductIds),
    conversions: Array.from(conversionResults.values()),
    deletedOriginals,
    deleteFailures,
  };

  const logPath = await writeMigrationLog(options.logDir, summary, "product-image-webp");
  summary.logPath = logPath;

  console.log("");
  console.log(options.execute ? "Product image WebP migration completed" : "Product image WebP migration dry-run");
  console.log("------------------------------------------");
  console.log(`Products scanned: ${summary.productsScanned}`);
  console.log(`Products updated: ${summary.productsUpdated}`);
  console.log(`Conversions tracked: ${summary.conversions.length}`);
  console.log(`Failed products: ${summary.failedProducts.length}`);
  console.log(`Deleted originals: ${summary.deletedOriginals.length}`);
  console.log(`Delete failures: ${summary.deleteFailures.length}`);
  console.log(`Log: ${summary.logPath}`);

  return summary;
}

async function validateProducts(options) {
  const docs = await getProductDocs(options);
  const nonWebpProductImages = [];

  docs.forEach((doc) => {
    collectProductImageUrls(doc.data()).forEach((imageUrl) => {
      const parsed = parseFirebaseStorageUrl(imageUrl);
      if (parsed && parsed.path.startsWith("images/") && !parsed.path.toLowerCase().endsWith(".webp")) {
        nonWebpProductImages.push({
          productId: doc.id,
          imageUrl,
          path: parsed.path,
        });
      }
    });
  });

  const summary = {
    projectId,
    collection: options.collection,
    productsScanned: docs.length,
    nonWebpProductImageCount: nonWebpProductImages.length,
    samples: nonWebpProductImages.slice(0, 20),
  };

  console.log("");
  console.log("Product image WebP validation");
  console.log("-----------------------------");
  console.log(`Products scanned: ${summary.productsScanned}`);
  console.log(`Non-WebP Firebase product image URLs: ${summary.nonWebpProductImageCount}`);
  summary.samples.forEach((item) => {
    console.log(`  - ${item.productId}: ${item.path}`);
  });

  if (summary.nonWebpProductImageCount > 0) {
    process.exitCode = 1;
  }

  return summary;
}

async function deleteOriginalsFromLog(options) {
  if (!options.latestLog && !options.logPath) {
    throw new Error("Migration log not found. Pass --log=<path> or --latest-log.");
  }

  const logPath = options.latestLog
    ? await findLatestMigrationLogPath(options.logDir)
    : path.resolve(process.cwd(), options.logPath);

  if (!logPath) {
    throw new Error("Migration log not found. Pass --log=<path> or --latest-log.");
  }

  const log = JSON.parse(await fs.promises.readFile(logPath, "utf8"));
  const docs = await getProductDocs(options);
  const referencedUrls = new Set();
  docs.forEach((doc) => {
    collectProductImageUrls(doc.data()).forEach((url) => referencedUrls.add(url));
  });

  const deletedOriginals = [];
  const skippedOriginals = [];
  const deleteFailures = [];

  for (const conversion of log.conversions || []) {
    if (conversion.status !== "converted") {
      continue;
    }

    if (referencedUrls.has(conversion.oldUrl)) {
      skippedOriginals.push({
        oldUrl: conversion.oldUrl,
        sourcePath: conversion.sourcePath,
        reason: "old URL is still referenced by a product",
      });
      continue;
    }

    if (!referencedUrls.has(conversion.newUrl)) {
      skippedOriginals.push({
        oldUrl: conversion.oldUrl,
        sourcePath: conversion.sourcePath,
        reason: "new URL is not referenced by any scanned product",
      });
      continue;
    }

    try {
      await admin.storage().bucket(conversion.bucket).file(conversion.sourcePath).delete({
        ignoreNotFound: true,
      });
      deletedOriginals.push({
        oldUrl: conversion.oldUrl,
        sourcePath: conversion.sourcePath,
      });
    } catch (error) {
      deleteFailures.push({
        oldUrl: conversion.oldUrl,
        sourcePath: conversion.sourcePath,
        error: error.message,
      });
    }
  }

  const summary = {
    projectId,
    collection: options.collection,
    sourceLogPath: logPath,
    productsScanned: docs.length,
    deletedOriginals,
    skippedOriginals,
    deleteFailures,
  };
  const deletionLogPath = await writeMigrationLog(
    options.logDir,
    {
      type: "delete-originals",
      ...summary,
    },
    "product-image-webp-delete-originals"
  );

  console.log("");
  console.log("Product image original deletion completed");
  console.log("-----------------------------------------");
  console.log(`Source log: ${logPath}`);
  console.log(`Products scanned: ${summary.productsScanned}`);
  console.log(`Deleted originals: ${summary.deletedOriginals.length}`);
  console.log(`Skipped originals: ${summary.skippedOriginals.length}`);
  console.log(`Delete failures: ${summary.deleteFailures.length}`);
  console.log(`Deletion log: ${deletionLogPath}`);

  return { ...summary, deletionLogPath };
}

async function main() {
  const { command, options } = parseArgs(process.argv.slice(2));

  switch (command) {
    case "analyze":
      printAnalyzeReport(await analyzeProducts(options));
      break;
    case "migrate":
      await migrateProducts(options);
      break;
    case "validate":
      await validateProducts(options);
      break;
    case "delete-originals":
      await deleteOriginalsFromLog(options);
      break;
    default:
      console.log("Usage:");
      console.log("  node scripts/product-image-webp-migration.js analyze");
      console.log("  node scripts/product-image-webp-migration.js migrate");
      console.log("  node scripts/product-image-webp-migration.js migrate --execute");
      console.log("  node scripts/product-image-webp-migration.js migrate --execute --delete-originals");
      console.log("  node scripts/product-image-webp-migration.js validate");
      console.log("  node scripts/product-image-webp-migration.js delete-originals --latest-log");
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
  analyzeProducts,
  buildWebpStoragePath,
  collectProductImageUrls,
  deleteOriginalsFromLog,
  getProductIdFromProductImagePath,
  loadHistoricalConvertedImageUrlsByProductId,
  migrateProducts,
  parseFirebaseStorageUrl,
  replaceProductImageUrls,
  validateProducts,
  isConvertibleProductImageUrl,
};
