const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const STORAGE_BUCKET = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'hebimall.firebasestorage.app';
const CATEGORY_IMAGE_VERSION = '20260710';
const CACHE_CONTROL = 'public, max-age=31536000, immutable';
const QUALITY = 75;

const CATEGORY_IMAGE_SOURCES = [
  { categoryId: 'tops', sourceFileName: 'main_category01.png' },
  { categoryId: 'bottoms', sourceFileName: 'main_category02.png' },
  { categoryId: 'shoes', sourceFileName: 'main_category03.png' },
  { categoryId: 'sports', sourceFileName: 'main_category04.png' },
];

function buildCategoryImageStoragePath(categoryId) {
  return `categories/main-category-${categoryId}-v${CATEGORY_IMAGE_VERSION}_q75.webp`;
}

function createDownloadUrl(storagePath) {
  return `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(STORAGE_BUCKET)}/o/${encodeURIComponent(storagePath)}?alt=media`;
}

function parseCommand(argv) {
  const [command = 'analyze'] = argv;

  if (!['analyze', 'execute', 'validate'].includes(command)) {
    throw new Error('사용법: node scripts/category-image-webp-migration.js [analyze|execute|validate]');
  }

  return command;
}

function getSourcePath(sourceFileName) {
  return path.resolve(process.cwd(), 'public', 'category', sourceFileName);
}

async function analyzeCategoryImages() {
  const results = [];

  for (const source of CATEGORY_IMAGE_SOURCES) {
    const sourcePath = getSourcePath(source.sourceFileName);
    const originalBuffer = await fs.promises.readFile(sourcePath);
    const optimizedBuffer = await sharp(originalBuffer).rotate().webp({ quality: QUALITY }).toBuffer();
    const metadata = await sharp(optimizedBuffer).metadata();

    results.push({
      ...source,
      sourcePath,
      targetPath: buildCategoryImageStoragePath(source.categoryId),
      downloadUrl: createDownloadUrl(buildCategoryImageStoragePath(source.categoryId)),
      originalBytes: originalBuffer.length,
      webpBytes: optimizedBuffer.length,
      width: metadata.width || null,
      height: metadata.height || null,
    });
  }

  return results;
}

function getBucket() {
  const { admin } = require('./util-firestore-admin');
  return admin.storage().bucket(STORAGE_BUCKET);
}

async function uploadCategoryImages() {
  const bucket = getBucket();
  const results = await analyzeCategoryImages();

  for (const result of results) {
    const targetFile = bucket.file(result.targetPath);
    const [alreadyExists] = await targetFile.exists();

    if (alreadyExists) {
      result.status = 'skipped';
      continue;
    }

    const optimizedBuffer = await sharp(result.sourcePath).rotate().webp({ quality: QUALITY }).toBuffer();
    await targetFile.save(optimizedBuffer, {
      resumable: false,
      metadata: {
        contentType: 'image/webp',
        cacheControl: CACHE_CONTROL,
        metadata: {
          sourceFile: result.sourceFileName,
          migratedAt: new Date().toISOString(),
        },
      },
    });

    const [metadata] = await targetFile.getMetadata();
    if (metadata.contentType !== 'image/webp' || metadata.cacheControl !== CACHE_CONTROL) {
      throw new Error(`${result.targetPath} 메타데이터 검증에 실패했습니다.`);
    }

    result.status = 'uploaded';
  }

  return results;
}

async function validateCategoryImages() {
  const bucket = getBucket();
  const results = [];

  for (const source of CATEGORY_IMAGE_SOURCES) {
    const targetPath = buildCategoryImageStoragePath(source.categoryId);
    const targetFile = bucket.file(targetPath);
    const [exists] = await targetFile.exists();
    const [metadata] = exists ? await targetFile.getMetadata() : [{}];

    results.push({
      categoryId: source.categoryId,
      targetPath,
      exists,
      contentType: metadata.contentType || null,
      cacheControl: metadata.cacheControl || null,
      valid: exists && metadata.contentType === 'image/webp' && metadata.cacheControl === CACHE_CONTROL,
    });
  }

  return results;
}

function printResults(results) {
  results.forEach((result) => {
    console.log(JSON.stringify(result));
  });
}

async function main() {
  const command = parseCommand(process.argv.slice(2));
  const results = command === 'analyze'
    ? await analyzeCategoryImages()
    : command === 'execute'
      ? await uploadCategoryImages()
      : await validateCategoryImages();

  printResults(results);

  if (command === 'validate' && results.some((result) => !result.valid)) {
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = {
  CATEGORY_IMAGE_SOURCES,
  CACHE_CONTROL,
  analyzeCategoryImages,
  buildCategoryImageStoragePath,
  validateCategoryImages,
};
