const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const sharp = require("sharp");

function getWebpCacheControl() {
  return "public, max-age=31536000, immutable";
}

function parseFirebaseStorageUrl(imageUrl) {
  try {
    const url = new URL(imageUrl);
    if (url.hostname !== "firebasestorage.googleapis.com") {
      return null;
    }

    const match = url.pathname.match(/^\/v0\/b\/([^/]+)\/o\/(.+)$/);
    if (!match) {
      return null;
    }

    return {
      bucket: decodeURIComponent(match[1]),
      path: decodeURIComponent(match[2]),
    };
  } catch (error) {
    return null;
  }
}

function buildWebpStoragePath(sourcePath) {
  if (sourcePath.toLowerCase().endsWith("_q75.webp")) {
    return sourcePath;
  }

  const parsed = path.posix.parse(sourcePath);
  return path.posix.join(parsed.dir, `${parsed.name}_q75.webp`);
}

function createDownloadUrl(bucketName, objectPath, token) {
  return `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(
    bucketName
  )}/o/${encodeURIComponent(objectPath)}?alt=media&token=${token}`;
}

async function convertStorageImageToWebp(admin, imageUrl, options, config = {}) {
  const parsed = parseFirebaseStorageUrl(imageUrl);
  if (!parsed || (config.pathPrefix && !parsed.path.startsWith(config.pathPrefix))) {
    return {
      status: "skipped",
      reason: config.invalidReason || "not Firebase Storage URL",
      oldUrl: imageUrl,
    };
  }

  const bucket = admin.storage().bucket(parsed.bucket);
  const sourceFile = bucket.file(parsed.path);
  const targetPath = buildWebpStoragePath(parsed.path);
  const targetFile = bucket.file(targetPath);

  const [sourceExists] = await sourceFile.exists();
  if (!sourceExists) {
    return { status: "failed", reason: "source object not found", oldUrl: imageUrl, sourcePath: parsed.path };
  }

  const [sourceMetadata] = await sourceFile.getMetadata();
  const [sourceBuffer] = await sourceFile.download();
  const webpBuffer = await sharp(sourceBuffer).rotate().webp({ quality: options.quality }).toBuffer();
  const webpMetadata = await sharp(webpBuffer).metadata();
  const token = crypto.randomUUID();

  await targetFile.save(webpBuffer, {
    resumable: false,
    metadata: {
      contentType: "image/webp",
      cacheControl: getWebpCacheControl(),
      metadata: {
        firebaseStorageDownloadTokens: token,
        migratedFrom: parsed.path,
        migratedQuality: String(options.quality),
      },
    },
  });

  const [targetExists] = await targetFile.exists();
  if (!targetExists || webpMetadata.format !== "webp" || webpBuffer.length === 0) {
    return { status: "failed", reason: "target verification failed", oldUrl: imageUrl, sourcePath: parsed.path };
  }

  return {
    status: "converted",
    oldUrl: imageUrl,
    newUrl: createDownloadUrl(parsed.bucket, targetPath, token),
    bucket: parsed.bucket,
    sourcePath: parsed.path,
    targetPath,
    originalBytes: Number(sourceMetadata.size || sourceBuffer.length),
    webpBytes: webpBuffer.length,
    width: webpMetadata.width || null,
    height: webpMetadata.height || null,
  };
}

async function writeMigrationLog(logDir, payload, prefix) {
  const absoluteLogDir = path.resolve(process.cwd(), logDir);
  await fs.promises.mkdir(absoluteLogDir, { recursive: true });
  const filePath = path.join(absoluteLogDir, `${prefix}-${Date.now()}.json`);
  await fs.promises.writeFile(filePath, JSON.stringify(payload, null, 2), "utf8");
  return filePath;
}

module.exports = {
  buildWebpStoragePath,
  convertStorageImageToWebp,
  getWebpCacheControl,
  parseFirebaseStorageUrl,
  writeMigrationLog,
};
