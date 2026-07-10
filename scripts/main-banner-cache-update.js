const STORAGE_BUCKET = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'hebimall.firebasestorage.app';

const MAIN_BANNER_CACHE_CONTROL = 'public, max-age=86400, stale-while-revalidate=604800';

const MAIN_BANNER_PATHS = [
  'images/main-banner/cool-touch-oversized-shirt/banner.webp',
  'images/main-banner/cool-touch-wide-banding-pants/banner.webp',
  'images/main-banner/linen-like-half-shirt/banner.webp',
  'images/main-banner/linen-like-bermuda-shorts/banner.webp',
  'images/main-banner/mesh-low-profile-sneakers/banner.webp',
  'images/main-banner/nylon-string-crossbody-bag/banner.webp',
  'images/main-banner/seersucker-half-jacket/banner.webp',
  'images/main-banner/utility-big-tote-bag/banner.webp',
  'images/main-banner/light-zip-up-jacket/banner.webp',
  'images/main-banner/washed-wide-denim-pants/banner.webp',
];

function parseCommand(argv) {
  const [command = 'validate'] = argv;

  if (!['execute', 'validate'].includes(command)) {
    throw new Error('사용법: node scripts/main-banner-cache-update.js [execute|validate]');
  }

  return command;
}

function getBucket() {
  const { admin } = require('./util-firestore-admin');
  return admin.storage().bucket(STORAGE_BUCKET);
}

async function inspectBannerCache() {
  const bucket = getBucket();
  const results = [];

  for (const objectPath of MAIN_BANNER_PATHS) {
    const file = bucket.file(objectPath);
    const [exists] = await file.exists();
    const [metadata] = exists ? await file.getMetadata() : [{}];

    results.push({
      objectPath,
      exists,
      cacheControl: metadata.cacheControl || null,
      valid: exists && metadata.cacheControl === MAIN_BANNER_CACHE_CONTROL,
    });
  }

  return results;
}

async function updateBannerCache() {
  const bucket = getBucket();
  const results = [];

  for (const objectPath of MAIN_BANNER_PATHS) {
    const file = bucket.file(objectPath);
    const [exists] = await file.exists();

    if (!exists) {
      results.push({ objectPath, exists: false, updated: false });
      continue;
    }

    await file.setMetadata({ cacheControl: MAIN_BANNER_CACHE_CONTROL });
    const [metadata] = await file.getMetadata();
    const valid = metadata.cacheControl === MAIN_BANNER_CACHE_CONTROL;

    if (!valid) {
      throw new Error(`${objectPath} 캐시 메타데이터 검증에 실패했습니다.`);
    }

    results.push({ objectPath, exists: true, updated: true, cacheControl: metadata.cacheControl });
  }

  return results;
}

async function main() {
  const command = parseCommand(process.argv.slice(2));
  const results = command === 'execute' ? await updateBannerCache() : await inspectBannerCache();
  results.forEach((result) => console.log(JSON.stringify(result)));

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
  MAIN_BANNER_CACHE_CONTROL,
  MAIN_BANNER_PATHS,
  inspectBannerCache,
  updateBannerCache,
};
