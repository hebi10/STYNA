const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const {
  loadStyleNowManifest,
  validateStyleNowManifest,
} = require("./style-now-manifest");
const {
  buildAssetPlan,
  inspectAssets,
  validateAssetInspection,
} = require("./style-now-assets");

const EXPECTED_PROJECT_ID = "hebimall";
const EXPECTED_BUCKET_NAME = "hebimall.firebasestorage.app";
const SEASON_KEYS = ["spring", "summer", "autumn", "winter"];

function createDownloadUrl(storagePath, bucketName) {
  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(storagePath)}?alt=media`;
}

function assertFirebaseTargetConsistency({
  projectId,
  bucketName,
  configuredProjectId = EXPECTED_PROJECT_ID,
  configuredBucketName = EXPECTED_BUCKET_NAME,
}) {
  if (projectId !== configuredProjectId) {
    throw new Error(
      `Firebase 프로젝트가 일치하지 않습니다. expected=${configuredProjectId} actual=${projectId}`,
    );
  }
  if (bucketName !== configuredBucketName) {
    throw new Error(
      `Firebase Storage 버킷이 일치하지 않습니다. expected=${configuredBucketName} actual=${bucketName}`,
    );
  }
}

function buildStyleNowSyncEntries(manifest, bucketName, cwd = process.cwd()) {
  validateStyleNowManifest(manifest);
  const products = [];
  const assets = [];

  for (const season of manifest.seasons) {
    assets.push({
      ...season.hero,
      absoluteLocalPath: path.resolve(cwd, season.hero.localPath),
      downloadUrl: createDownloadUrl(
        season.hero.storagePath,
        bucketName,
      ),
    });

    for (const product of season.products) {
      const imageUrl = createDownloadUrl(
        product.asset.storagePath,
        bucketName,
      );
      const { asset, ...productData } = product;
      assets.push({
        ...asset,
        absoluteLocalPath: path.resolve(cwd, asset.localPath),
        downloadUrl: imageUrl,
      });
      products.push({
        id: product.id,
        season: season.key,
        seasonTag: season.tag,
        asset,
        data: {
          ...productData,
          images: [imageUrl],
          mainImage: imageUrl,
        },
      });
    }
  }

  return { assets, products };
}

async function uploadStyleNowAssets(assets, dependencies) {
  const upload =
    dependencies.upload ||
    dependencies.bucket?.upload?.bind(dependencies.bucket);
  if (typeof upload !== "function") {
    throw new Error("Firebase Storage upload 함수가 없습니다.");
  }

  for (const asset of assets) {
    await upload(asset.absoluteLocalPath, {
      destination: asset.storagePath,
      resumable: false,
      validation: "crc32c",
      preconditionOpts: { ifGenerationMatch: 0 },
      metadata: {
        contentType: "image/webp",
        cacheControl: "public,max-age=31536000,immutable",
      },
    });
  }

  return { uploaded: assets.length };
}

async function applyDraftProducts(products, { db, timestamp }) {
  const batch = db.batch();

  for (const product of products) {
    const productRef = db.collection("products").doc(product.id);
    batch.create(productRef, {
      ...product.data,
      status: "draft",
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }

  await batch.commit();
  return { created: products.length, status: "draft" };
}

function assertVerifiedDraftSummary(summary) {
  const countsMatch =
    summary &&
    summary.total === 80 &&
    SEASON_KEYS.every(
      (season) => summary.productsBySeason?.[season] === 20,
    );

  if (!countsMatch) {
    throw new Error("검증된 draft 상품이 정확히 80개가 아닙니다.");
  }
}

async function activateStyleNowProducts(
  products,
  { db, timestamp, verifiedDraftSummary },
) {
  assertVerifiedDraftSummary(verifiedDraftSummary);
  const batch = db.batch();

  for (const product of products) {
    const productRef = db.collection("products").doc(product.id);
    batch.update(productRef, {
      status: "active",
      updatedAt: timestamp,
    });
  }

  await batch.commit();
  return { activated: products.length, status: "active" };
}

async function inspectFirebaseConflicts(entries, { db, bucket }) {
  const productRefs = entries.products.map((product) =>
    db.collection("products").doc(product.id),
  );
  const [productSnapshots, storageStates] = await Promise.all([
    db.getAll(...productRefs),
    Promise.all(
      entries.assets.map(async (asset) => {
        const [exists] = await bucket.file(asset.storagePath).exists();
        return { storagePath: asset.storagePath, exists };
      }),
    ),
  ]);

  const existingProductIds = productSnapshots
    .filter((snapshot) => snapshot.exists)
    .map((snapshot) => snapshot.id);
  const existingStoragePaths = storageStates
    .filter((entry) => entry.exists)
    .map((entry) => entry.storagePath);

  return {
    products: entries.products.length,
    assets: entries.assets.length,
    productConflicts: existingProductIds.length,
    storageConflicts: existingStoragePaths.length,
    existingProductIds,
    existingStoragePaths,
  };
}

function assertNoFirebaseConflicts(summary) {
  if (summary.productConflicts > 0 || summary.storageConflicts > 0) {
    throw new Error(
      `기존 Firebase 데이터와 충돌합니다: 상품 ${summary.productConflicts}, Storage ${summary.storageConflicts}`,
    );
  }
}

async function getFileHash(filePath) {
  const file = await fs.promises.readFile(filePath);
  return crypto.createHash("sha256").update(file).digest("hex");
}

async function verifyStorageAssets(assets, { bucket }) {
  const results = await Promise.all(
    assets.map(async (asset) => {
      const remoteFile = bucket.file(asset.storagePath);
      const [[exists], localHash] = await Promise.all([
        remoteFile.exists(),
        getFileHash(asset.absoluteLocalPath),
      ]);

      if (!exists) {
        return {
          storagePath: asset.storagePath,
          valid: false,
          reason: "missing",
        };
      }

      const [[metadata], [remoteBuffer]] = await Promise.all([
        remoteFile.getMetadata(),
        remoteFile.download(),
      ]);
      const remoteHash = crypto
        .createHash("sha256")
        .update(remoteBuffer)
        .digest("hex");
      const valid =
        metadata.contentType === "image/webp" &&
        Number(metadata.size) > 0 &&
        remoteHash === localHash;

      return {
        storagePath: asset.storagePath,
        valid,
        reason: valid ? null : "metadata-or-hash",
      };
    }),
  );
  const invalid = results.filter((result) => !result.valid);
  if (invalid.length > 0) {
    throw new Error(
      `Storage 검증에 실패했습니다: ${invalid.length}/${assets.length}`,
    );
  }

  return { total: assets.length, verified: results.length };
}

function getExpectedSeasonCounts() {
  return {
    spring: 20,
    summer: 20,
    autumn: 20,
    winter: 20,
  };
}

async function verifyProductDocuments(products, { db, expectedStatus }) {
  const refs = products.map((product) =>
    db.collection("products").doc(product.id),
  );
  const snapshots = await db.getAll(...refs);
  const productsBySeason = Object.fromEntries(
    SEASON_KEYS.map((season) => [season, 0]),
  );
  const issues = [];

  snapshots.forEach((snapshot, index) => {
    const expected = products[index];
    if (!snapshot.exists) {
      issues.push(`${expected.id}:missing`);
      return;
    }

    const data = snapshot.data();
    const matches =
      data.status === expectedStatus &&
      data.sku === expected.data.sku &&
      data.name === expected.data.name &&
      data.mainImage === expected.data.mainImage &&
      Array.isArray(data.images) &&
      data.images.length === 1 &&
      data.images[0] === expected.data.mainImage &&
      Array.isArray(data.tags) &&
      data.tags.includes("style-now") &&
      data.tags.includes(expected.seasonTag) &&
      data.createdAt &&
      data.updatedAt;

    if (!matches) {
      issues.push(`${expected.id}:fields`);
      return;
    }
    productsBySeason[expected.season] += 1;
  });

  if (
    issues.length > 0 ||
    !SEASON_KEYS.every((season) => productsBySeason[season] === 20)
  ) {
    throw new Error(
      `${expectedStatus} 상품 검증에 실패했습니다: issues=${issues.length} counts=${JSON.stringify(productsBySeason)}`,
    );
  }

  return {
    total: snapshots.length,
    productsBySeason,
    status: expectedStatus,
  };
}

async function verifyImageResponses(assets, fetchImpl = globalThis.fetch) {
  if (typeof fetchImpl !== "function") {
    throw new Error("이미지 URL 확인에 사용할 fetch가 없습니다.");
  }

  const results = [];
  for (const asset of assets) {
    const response = await fetchImpl(asset.downloadUrl, {
      method: "GET",
      headers: { Range: "bytes=0-0" },
    });
    results.push({
      url: asset.downloadUrl,
      ok: response.ok || response.status === 206,
      status: response.status,
    });
  }

  const failed = results.filter((result) => !result.ok);
  if (failed.length > 0) {
    throw new Error(
      `이미지 URL 응답 검증에 실패했습니다: ${failed.length}/${assets.length}`,
    );
  }
  return { total: assets.length, reachable: results.length };
}

function loadFirebaseRuntime() {
  require("dotenv").config({
    path: path.resolve(process.cwd(), ".env.local"),
  });
  const {
    admin,
    db,
    projectId,
  } = require("./util-firestore-admin");
  const configuredProjectId =
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || EXPECTED_PROJECT_ID;
  const configuredBucketName =
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
    EXPECTED_BUCKET_NAME;
  const bucket = admin.storage().bucket(configuredBucketName);

  assertFirebaseTargetConsistency({
    projectId,
    bucketName: bucket.name,
    configuredProjectId,
    configuredBucketName,
  });

  return {
    admin,
    db,
    projectId,
    bucket,
    bucketName: bucket.name,
  };
}

async function getValidatedLocalEntries(runtime) {
  const manifest = loadStyleNowManifest();
  const plan = buildAssetPlan(manifest);
  const inspection = await inspectAssets(plan);
  const localAssets = validateAssetInspection(inspection);
  const entries = buildStyleNowSyncEntries(
    manifest,
    runtime.bucketName,
  );

  return { manifest, entries, localAssets };
}

async function main(argv = process.argv.slice(2)) {
  const command = argv[0] || "analyze";
  const runtime = loadFirebaseRuntime();
  const { entries, localAssets } = await getValidatedLocalEntries(runtime);

  if (command === "analyze") {
    const conflicts = await inspectFirebaseConflicts(entries, runtime);
    console.log(JSON.stringify({ localAssets, ...conflicts }, null, 2));
    assertNoFirebaseConflicts(conflicts);
    return;
  }

  if (command === "upload") {
    const conflicts = await inspectFirebaseConflicts(entries, runtime);
    assertNoFirebaseConflicts(conflicts);
    console.log(
      JSON.stringify(
        await uploadStyleNowAssets(entries.assets, {
          bucket: runtime.bucket,
        }),
        null,
        2,
      ),
    );
    return;
  }

  if (command === "verify-upload") {
    console.log(
      JSON.stringify(
        await verifyStorageAssets(entries.assets, runtime),
        null,
        2,
      ),
    );
    return;
  }

  if (command === "apply-draft") {
    await verifyStorageAssets(entries.assets, runtime);
    const conflicts = await inspectFirebaseConflicts(entries, runtime);
    if (conflicts.productConflicts > 0) {
      throw new Error(
        `기존 상품 문서와 충돌합니다: ${conflicts.productConflicts}`,
      );
    }
    console.log(
      JSON.stringify(
        await applyDraftProducts(entries.products, {
          db: runtime.db,
          timestamp: runtime.admin.firestore.Timestamp.now(),
        }),
        null,
        2,
      ),
    );
    return;
  }

  if (command === "verify-draft") {
    console.log(
      JSON.stringify(
        await verifyProductDocuments(entries.products, {
          db: runtime.db,
          expectedStatus: "draft",
        }),
        null,
        2,
      ),
    );
    return;
  }

  if (command === "activate") {
    const verifiedDraftSummary = await verifyProductDocuments(
      entries.products,
      {
        db: runtime.db,
        expectedStatus: "draft",
      },
    );
    console.log(
      JSON.stringify(
        await activateStyleNowProducts(entries.products, {
          db: runtime.db,
          timestamp: runtime.admin.firestore.Timestamp.now(),
          verifiedDraftSummary,
        }),
        null,
        2,
      ),
    );
    return;
  }

  if (command === "verify") {
    const [storage, products, responses] = await Promise.all([
      verifyStorageAssets(entries.assets, runtime),
      verifyProductDocuments(entries.products, {
        db: runtime.db,
        expectedStatus: "active",
      }),
      verifyImageResponses(entries.assets),
    ]);
    console.log(
      JSON.stringify({ storage, products, responses }, null, 2),
    );
    return;
  }

  throw new Error(`지원하지 않는 명령입니다: ${command}`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(
      error instanceof Error
        ? error.message
        : "스타일나우 Firebase 동기화에 실패했습니다.",
    );
    process.exitCode = 1;
  });
}

module.exports = {
  EXPECTED_PROJECT_ID,
  EXPECTED_BUCKET_NAME,
  createDownloadUrl,
  assertFirebaseTargetConsistency,
  buildStyleNowSyncEntries,
  uploadStyleNowAssets,
  applyDraftProducts,
  activateStyleNowProducts,
  inspectFirebaseConflicts,
  assertNoFirebaseConflicts,
  verifyStorageAssets,
  verifyProductDocuments,
  verifyImageResponses,
};
