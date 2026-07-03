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
  execute: false,
  logDir: "migration-logs",
  logPath: "",
  latestLog: false,
  quality: 75,
};

const DEFAULT_TARGETS = [
  { collection: "categories", fields: ["image", "imageUrl"] },
  { collection: "events", fields: ["bannerImage", "thumbnailImage", "detailImage"] },
  { collection: "reviews", fields: ["images"] },
  { collection: "qna", fields: ["images"] },
];

function getConfiguredTargets() {
  return DEFAULT_TARGETS.map((target) => ({
    collection: target.collection,
    fields: [...target.fields],
  }));
}

function parseArgs(argv) {
  const [command = "analyze", ...flags] = argv;
  const options = { ...DEFAULT_OPTIONS };

  flags.forEach((flag) => {
    if (flag === "--execute") {
      options.execute = true;
      return;
    }

    if (!flag.startsWith("--")) {
      return;
    }

    const [key, rawValue] = flag.slice(2).split("=");
    const value = rawValue === undefined ? true : rawValue;

    switch (key) {
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

function collectConfiguredImageUrls(data, fields) {
  const urls = [];
  const seen = new Set();

  fields.forEach((field) => {
    const value = data[field];
    const candidates = Array.isArray(value) ? value : [value];

    candidates.forEach((candidate) => {
      if (typeof candidate !== "string" || candidate.trim() === "" || seen.has(candidate)) {
        return;
      }

      seen.add(candidate);
      urls.push(candidate);
    });
  });

  return urls;
}

function buildFieldUpdate(data, fields, replacements) {
  const update = {};

  fields.forEach((field) => {
    const value = data[field];

    if (typeof value === "string" && replacements.has(value)) {
      update[field] = replacements.get(value);
      return;
    }

    if (Array.isArray(value)) {
      const nextValue = value.map((item) => replacements.get(item) || item);
      const changed = nextValue.some((item, index) => item !== value[index]);
      if (changed) {
        update[field] = nextValue;
      }
    }
  });

  return update;
}

function isConvertibleStorageUrl(imageUrl) {
  const parsed = parseFirebaseStorageUrl(imageUrl);
  return Boolean(parsed && !parsed.path.toLowerCase().endsWith("_q75.webp"));
}

async function getTargetDocs(target) {
  const snapshot = await db.collection(target.collection).get();
  return snapshot.docs;
}

async function analyzeContentImages(options = DEFAULT_OPTIONS) {
  const collectionReports = [];
  let scannedDocuments = 0;
  let uniqueImageUrlCount = 0;
  let convertibleImageUrlCount = 0;
  let alreadyWebpUrlCount = 0;
  let nonFirebaseUrlCount = 0;
  const uniqueUrls = new Set();

  for (const target of DEFAULT_TARGETS) {
    const docs = await getTargetDocs(target);
    const report = {
      collection: target.collection,
      documents: docs.length,
      convertibleImageUrlCount: 0,
      alreadyWebpUrlCount: 0,
      nonFirebaseUrlCount: 0,
      sampleConvertibleUrls: [],
    };

    scannedDocuments += docs.length;

    docs.forEach((doc) => {
      collectConfiguredImageUrls(doc.data(), target.fields).forEach((url) => {
        uniqueUrls.add(url);
        const parsed = parseFirebaseStorageUrl(url);

        if (!parsed) {
          report.nonFirebaseUrlCount += 1;
          nonFirebaseUrlCount += 1;
          return;
        }

        if (parsed.path.toLowerCase().endsWith("_q75.webp")) {
          report.alreadyWebpUrlCount += 1;
          alreadyWebpUrlCount += 1;
          return;
        }

        report.convertibleImageUrlCount += 1;
        convertibleImageUrlCount += 1;
        if (report.sampleConvertibleUrls.length < 5) {
          report.sampleConvertibleUrls.push(url);
        }
      });
    });

    collectionReports.push(report);
  }

  uniqueImageUrlCount = uniqueUrls.size;

  return {
    projectId,
    scannedDocuments,
    uniqueImageUrlCount,
    convertibleImageUrlCount,
    alreadyWebpUrlCount,
    nonFirebaseUrlCount,
    collections: collectionReports,
  };
}

function printAnalyzeReport(report) {
  console.log("");
  console.log("Content image WebP migration analysis");
  console.log("------------------------------------");
  console.log(`Project: ${report.projectId}`);
  console.log(`Documents scanned: ${report.scannedDocuments}`);
  console.log(`Unique image URLs: ${report.uniqueImageUrlCount}`);
  console.log(`Convertible Firebase image URLs: ${report.convertibleImageUrlCount}`);
  console.log(`Already WebP URLs: ${report.alreadyWebpUrlCount}`);
  console.log(`Non-Firebase URLs: ${report.nonFirebaseUrlCount}`);
  report.collections.forEach((collection) => {
    console.log(`- ${collection.collection}: ${collection.convertibleImageUrlCount} convertible`);
    collection.sampleConvertibleUrls.forEach((url) => console.log(`  - ${url}`));
  });
}

async function convertImageUrl(imageUrl, options) {
  return convertStorageImageToWebp(admin, imageUrl, options);
}

async function migrateContentImages(options = DEFAULT_OPTIONS) {
  const conversionResults = new Map();
  const replacements = new Map();
  const documentUpdates = [];

  for (const target of DEFAULT_TARGETS) {
    const docs = await getTargetDocs(target);

    for (const doc of docs) {
      const data = doc.data();
      const urls = collectConfiguredImageUrls(data, target.fields).filter(isConvertibleStorageUrl);

      for (const url of urls) {
        if (conversionResults.has(url)) {
          continue;
        }

        if (!options.execute) {
          const parsed = parseFirebaseStorageUrl(url);
          conversionResults.set(url, {
            status: "dry-run",
            oldUrl: url,
            bucket: parsed.bucket,
            sourcePath: parsed.path,
            targetPath: buildWebpStoragePath(parsed.path),
          });
          continue;
        }

        const result = await convertImageUrl(url, options);
        conversionResults.set(url, result);
        if (result.status === "converted") {
          replacements.set(url, result.newUrl);
        }
      }

      if (options.execute) {
        const update = buildFieldUpdate(data, target.fields, replacements);
        if (Object.keys(update).length > 0) {
          await doc.ref.update(update);
          documentUpdates.push({
            collection: target.collection,
            documentId: doc.id,
            update,
          });
        }
      }
    }
  }

  const summary = {
    projectId,
    execute: options.execute,
    quality: options.quality,
    conversions: Array.from(conversionResults.values()),
    documentsUpdated: documentUpdates.length,
    documentUpdates,
  };

  summary.logPath = await writeMigrationLog(options.logDir, summary, "content-image-webp");

  console.log("");
  console.log(options.execute ? "Content image WebP migration completed" : "Content image WebP migration dry-run");
  console.log("---------------------------------------");
  console.log(`Conversions tracked: ${summary.conversions.length}`);
  console.log(`Documents updated: ${summary.documentsUpdated}`);
  console.log(`Failed conversions: ${summary.conversions.filter((item) => item.status === "failed").length}`);
  console.log(`Log: ${summary.logPath}`);

  return summary;
}

async function validateContentImages(options = DEFAULT_OPTIONS) {
  const nonWebpImages = [];

  for (const target of DEFAULT_TARGETS) {
    const docs = await getTargetDocs(target);

    docs.forEach((doc) => {
      collectConfiguredImageUrls(doc.data(), target.fields).forEach((url) => {
        const parsed = parseFirebaseStorageUrl(url);
        if (parsed && !parsed.path.toLowerCase().endsWith("_q75.webp")) {
          nonWebpImages.push({
            collection: target.collection,
            documentId: doc.id,
            path: parsed.path,
          });
        }
      });
    });
  }

  console.log("");
  console.log("Content image WebP validation");
  console.log("-----------------------------");
  console.log(`Non-WebP Firebase image URLs: ${nonWebpImages.length}`);
  nonWebpImages.slice(0, 30).forEach((item) => {
    console.log(`  - ${item.collection}/${item.documentId}: ${item.path}`);
  });

  if (nonWebpImages.length > 0) {
    process.exitCode = 1;
  }

  return { projectId, nonWebpImages };
}

async function deleteOriginalsFromLog(options = DEFAULT_OPTIONS) {
  let latestLogPath = options.logPath ? path.resolve(process.cwd(), options.logPath) : "";
  if (!latestLogPath && options.latestLog) {
    const absoluteLogDir = path.resolve(process.cwd(), options.logDir);
    const entries = await fs.promises.readdir(absoluteLogDir, { withFileTypes: true });
    const logs = entries
      .filter((entry) => entry.isFile() && /^content-image-webp-\d+\.json$/.test(entry.name))
      .map((entry) => path.join(absoluteLogDir, entry.name))
      .sort();
    latestLogPath = logs.at(-1) || "";
  }

  if (!latestLogPath) {
    throw new Error("delete-originals requires --log=<path> or --latest-log.");
  }

  const log = JSON.parse(await fs.promises.readFile(latestLogPath, "utf8"));
  const validation = await validateContentImages(options);
  const referencedPaths = new Set(validation.nonWebpImages.map((item) => item.path));
  const deletedOriginals = [];
  const skippedOriginals = [];
  const deleteFailures = [];

  for (const conversion of log.conversions || []) {
    if (conversion.status !== "converted") {
      continue;
    }

    if (referencedPaths.has(conversion.sourcePath)) {
      skippedOriginals.push({ sourcePath: conversion.sourcePath, reason: "still referenced" });
      continue;
    }

    try {
      await admin.storage().bucket(conversion.bucket).file(conversion.sourcePath).delete({
        ignoreNotFound: true,
      });
      deletedOriginals.push({ sourcePath: conversion.sourcePath });
    } catch (error) {
      deleteFailures.push({ sourcePath: conversion.sourcePath, error: error.message });
    }
  }

  const summary = {
    projectId,
    sourceLogPath: latestLogPath,
    deletedOriginals,
    skippedOriginals,
    deleteFailures,
  };
  summary.logPath = await writeMigrationLog(options.logDir, summary, "content-image-webp-delete-originals");

  console.log("");
  console.log("Content image original deletion completed");
  console.log("-----------------------------------------");
  console.log(`Deleted originals: ${deletedOriginals.length}`);
  console.log(`Skipped originals: ${skippedOriginals.length}`);
  console.log(`Delete failures: ${deleteFailures.length}`);
  console.log(`Log: ${summary.logPath}`);

  return summary;
}

async function main() {
  const { command, options } = parseArgs(process.argv.slice(2));

  switch (command) {
    case "analyze":
      printAnalyzeReport(await analyzeContentImages(options));
      break;
    case "migrate":
      await migrateContentImages(options);
      break;
    case "validate":
      await validateContentImages(options);
      break;
    case "delete-originals":
      await deleteOriginalsFromLog(options);
      break;
    default:
      console.log("Usage:");
      console.log("  node scripts/content-image-webp-migration.js analyze");
      console.log("  node scripts/content-image-webp-migration.js migrate");
      console.log("  node scripts/content-image-webp-migration.js migrate --execute");
      console.log("  node scripts/content-image-webp-migration.js validate");
      console.log("  node scripts/content-image-webp-migration.js delete-originals");
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
  analyzeContentImages,
  buildFieldUpdate,
  collectConfiguredImageUrls,
  getConfiguredTargets,
  migrateContentImages,
  parseFirebaseStorageUrl,
  validateContentImages,
};
