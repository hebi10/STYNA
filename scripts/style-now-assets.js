const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const {
  loadStyleNowManifest,
  validateStyleNowManifest,
} = require("./style-now-manifest");

const SOURCE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp"];

function buildAssetPlan(manifest, cwd = process.cwd()) {
  validateStyleNowManifest(manifest);

  return manifest.seasons.flatMap((season) => {
    const assets = [season.hero, ...season.products.map((product) => product.asset)];

    return assets.map((asset) => {
      const sourceStem = `${path.posix.basename(asset.fileName, ".webp")}${
        asset.kind === "hero" ? "-triptych" : ""
      }`;
      return {
        ...asset,
        outputPath: asset.localPath,
        absoluteOutputPath: path.resolve(cwd, asset.localPath),
        sourceStemPath: path.resolve(
          cwd,
          "tmp",
          "style-now-source",
          season.key,
          sourceStem,
        ),
      };
    });
  });
}

function resolveSourcePath(asset, existsSync = fs.existsSync) {
  for (const extension of SOURCE_EXTENSIONS) {
    const candidate = `${asset.sourceStemPath}${extension}`;
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    `${asset.fileName} 생성 원본을 찾을 수 없습니다: ${asset.sourceStemPath}{${SOURCE_EXTENSIONS.join(",")}}`,
  );
}

async function normalizeAsset(asset, dependencies = {}) {
  const existsSync = dependencies.existsSync || fs.existsSync;
  const mkdir = dependencies.mkdir || fs.promises.mkdir;
  const sharpFactory = dependencies.sharpFactory || sharp;
  const sourcePath = resolveSourcePath(asset, existsSync);

  if (existsSync(asset.absoluteOutputPath)) {
    throw new Error(
      `${asset.outputPath} 파일이 이미 있어 덮어쓰지 않습니다.`,
    );
  }

  await mkdir(path.dirname(asset.absoluteOutputPath), { recursive: true });
  await sharpFactory(sourcePath)
    .rotate()
    .resize(asset.width, asset.height, {
      fit: "contain",
      background: asset.backgroundColor,
      withoutEnlargement: false,
    })
    .webp({ quality: 90, effort: 6 })
    .toFile(asset.absoluteOutputPath);

  return asset.absoluteOutputPath;
}

async function normalizeAssets(plan, dependencies = {}) {
  const normalized = [];
  for (const asset of plan) {
    normalized.push(await normalizeAsset(asset, dependencies));
  }
  return normalized;
}

async function inspectAsset(asset, dependencies = {}) {
  const existsSync = dependencies.existsSync || fs.existsSync;
  const readFile = dependencies.readFile || fs.promises.readFile;
  const sharpFactory = dependencies.sharpFactory || sharp;

  if (!existsSync(asset.absoluteOutputPath)) {
    return {
      fileName: asset.fileName,
      exists: false,
      format: null,
      width: null,
      height: null,
      hash: null,
      expectedWidth: asset.width,
      expectedHeight: asset.height,
    };
  }

  const [metadata, file] = await Promise.all([
    sharpFactory(asset.absoluteOutputPath).metadata(),
    readFile(asset.absoluteOutputPath),
  ]);

  return {
    fileName: asset.fileName,
    exists: true,
    format: metadata.format || null,
    width: metadata.width || null,
    height: metadata.height || null,
    hash: crypto.createHash("sha256").update(file).digest("hex"),
    expectedWidth: asset.width,
    expectedHeight: asset.height,
  };
}

async function inspectAssets(plan, dependencies = {}) {
  return Promise.all(
    plan.map((asset) => inspectAsset(asset, dependencies)),
  );
}

function validateAssetInspection(inspection) {
  const missingCount = inspection.filter((asset) => !asset.exists).length;
  const formatCount = inspection.filter(
    (asset) => asset.exists && asset.format !== "webp",
  ).length;
  const dimensionCount = inspection.filter(
    (asset) =>
      asset.exists &&
      (asset.width !== asset.expectedWidth ||
        asset.height !== asset.expectedHeight),
  ).length;
  const hashes = inspection
    .filter((asset) => asset.exists && asset.hash)
    .map((asset) => asset.hash);
  const duplicateHashCount = hashes.length - new Set(hashes).size;

  if (
    missingCount > 0 ||
    formatCount > 0 ||
    dimensionCount > 0 ||
    duplicateHashCount > 0
  ) {
    throw new Error(
      `스타일나우 이미지 검증 실패: 누락 ${missingCount}, 형식 ${formatCount}, 규격 ${dimensionCount}, 해시 중복 ${duplicateHashCount}`,
    );
  }

  const heroCount = inspection.filter(
    (asset) =>
      asset.expectedWidth === 900 && asset.expectedHeight === 2700,
  ).length;

  return {
    total: inspection.length,
    webp: inspection.filter((asset) => asset.format === "webp").length,
    hero: heroCount,
    products: inspection.length - heroCount,
    uniqueHashes: new Set(hashes).size,
  };
}

async function main(argv = process.argv.slice(2)) {
  const command = argv[0] || "validate";
  const manifest = loadStyleNowManifest();
  const plan = buildAssetPlan(manifest);

  if (command === "normalize") {
    const normalized = await normalizeAssets(plan);
    console.log(
      JSON.stringify({ normalized: normalized.length }, null, 2),
    );
    return;
  }

  if (command === "validate") {
    const inspection = await inspectAssets(plan);
    console.log(
      JSON.stringify(validateAssetInspection(inspection), null, 2),
    );
    return;
  }

  throw new Error(`지원하지 않는 명령입니다: ${command}`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(
      error instanceof Error ? error.message : "이미지 처리에 실패했습니다.",
    );
    process.exitCode = 1;
  });
}

module.exports = {
  SOURCE_EXTENSIONS,
  buildAssetPlan,
  resolveSourcePath,
  normalizeAsset,
  normalizeAssets,
  inspectAsset,
  inspectAssets,
  validateAssetInspection,
};
