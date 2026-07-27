const fs = require("fs");
const path = require("path");

const MANIFEST_PATH = path.join(__dirname, "style-now-image-manifest.json");
const SEASON_CODES = {
  spring: "SPR",
  summer: "SUM",
  autumn: "AUT",
  winter: "WIN",
};
const ALLOWED_CATEGORIES = new Set([
  "clothing",
  "bottoms",
  "shoes",
  "bags",
  "accessories",
]);
const REQUIRED_SEASONS = ["spring", "summer", "autumn", "winter"];

function padProductNumber(index) {
  return String(index + 1).padStart(2, "0");
}

function buildProductSizeDetails(category, sizes) {
  return Object.fromEntries(
    sizes.map((size, index) => {
      if (category === "bottoms") {
        return [
          size,
          {
            waist: 68 + index * 4,
            thigh: 54 + index * 2,
            length: 99 + index,
          },
        ];
      }

      if (category === "shoes") {
        return [
          size,
          {
            width: Number((8.5 + index * 0.3).toFixed(1)),
            height: Number((5 + index * 0.2).toFixed(1)),
          },
        ];
      }

      if (category === "bags") {
        return [size, { width: 31, height: 24 }];
      }

      if (category === "accessories") {
        return [size, { width: 20 + index * 2, length: 70 + index * 5 }];
      }

      return [
        size,
        {
          chest: 96 + index * 4,
          length: 66 + index * 2,
          shoulder: 43 + index * 2,
        },
      ];
    }),
  );
}

function getProductPrecautions(category) {
  switch (category) {
    case "shoes":
      return "직사광선과 습기를 피해 보관하고 오염은 마른 천으로 닦아 주세요.";
    case "bags":
    case "accessories":
      return "마찰, 수분, 직사광선을 피해 형태를 유지해 보관해 주세요.";
    default:
      return "케어 라벨을 확인하고 중성세제로 단독 세탁하거나 전문 세탁을 이용해 주세요.";
  }
}

function buildHeroPrompt(season) {
  return [
    "Use case: photorealistic-natural.",
    "Asset type: 쇼핑몰 스타일나우 시즌 이벤트 대표 패션 화보.",
    `Primary request: ${season.label}의 분위기를 담은 고급 패션 캠페인 이미지를 제작한다.`,
    `Scene/backdrop: ${season.hero.scene}.`,
    `Subject: ${season.hero.subject}.`,
    "Style/medium: 실제 패션 매거진의 자연스럽고 정교한 에디토리얼 사진, 사실적인 피부와 직물 질감.",
    `Composition/framing: ${season.hero.composition}. 한 장의 초세로 이미지 안을 동일 높이의 위·가운데·아래 세 패널로 나눈 세로 3분할 트립틱으로 구성한다. 세 패널은 같은 장소에서 이어지는 하나의 연속된 장면이며, 동일한 모델과 스타일링을 유지한 채 걷기·정지·디테일처럼 서로 다른 순간을 보여준다. 건축선, 지면, 빛의 방향과 색이 패널 사이에서 자연스럽게 연결되어야 하고 눈에 띄는 테두리, 프레임, 흰 여백은 만들지 않는다. 최종 사용 비율은 가로 9, 세로 27이며 중요한 인물과 제품이 중앙 안전 영역 안에 모두 들어와야 한다.`,
    `Lighting/mood: ${season.hero.lighting}.`,
    `Color palette: ${season.palette}.`,
    "Constraints: 모델의 손과 얼굴, 의류 구조를 자연스럽게 표현하고 쇼핑몰 이벤트 페이지에 바로 사용할 수 있는 완성도로 제작한다.",
    "Avoid: 이미지 안에 텍스트, 글자, 숫자, 가격, 로고, 브랜드 마크, 간판, 워터마크를 넣지 않는다. 과도한 보정, 왜곡된 신체, 잘린 발, 반복 인물을 피한다.",
  ].join(" ");
}

function buildProductPrompt(rawProduct, season, productNumber) {
  return [
    "Use case: product-mockup.",
    "Asset type: 패션 쇼핑몰 정사각형 상품 대표 사진.",
    `Primary request: ${season.label} 상품 ${productNumber}, ${rawProduct.name} 한 점을 주인공으로 촬영한다.`,
    `Scene/backdrop: ${rawProduct.background}. 다른 판매 상품이나 장식품은 두지 않는다.`,
    `Subject: ${rawProduct.color} 색상의 ${rawProduct.material} 소재 ${rawProduct.name}, ${rawProduct.design}.`,
    "Style/medium: 실제 온라인 패션몰의 고해상도 카탈로그 제품 사진, 사실적인 봉제선과 소재 표면.",
    `Composition/framing: ${rawProduct.angle}. 정사각형 1:1 프레임 안에 상품 전체가 잘리지 않게 들어오고 사방에 후처리용 안전 여백을 둔다.`,
    `Lighting/mood: ${rawProduct.lighting}.`,
    `Color palette: ${season.palette} 중 상품 색상을 중심으로 절제한다.`,
    `Materials/textures: ${rawProduct.material}의 고유한 결, 두께, 광택을 정확하게 표현한다.`,
    `Distinctive feature: ${rawProduct.design}이 다른 상품과 명확히 구별되도록 한다.`,
    "Constraints: 한 이미지에는 지정 상품만 표현하며 판매 가능한 실제 제품 비율과 구조를 유지한다.",
    "Avoid: 이미지 안에 텍스트, 글자, 숫자, 가격, 로고, 브랜드 마크, 라벨 문구, 워터마크를 넣지 않는다. 사람 얼굴, 손, 옷걸이 글자, 중복 상품, 잘린 상품, 비현실적 부품을 피한다.",
  ].join(" ");
}

function buildReviewSummary() {
  return {
    schemaVersion: 1,
    totalReviews: 0,
    averageRating: 0,
    recommendedCount: 0,
    recommendationRate: 0,
    ratingDistribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
  };
}

function expandSeason(rawSeason) {
  const seasonCode = SEASON_CODES[rawSeason.key];
  const heroFileName = `style-now-${rawSeason.key}-main.webp`;
  const hero = {
    kind: "hero",
    season: rawSeason.key,
    fileName: heroFileName,
    localPath: `public/style-now/${rawSeason.key}/${heroFileName}`,
    storagePath: `images/style-now/${rawSeason.key}/${heroFileName}`,
    prompt: buildHeroPrompt(rawSeason),
    width: 900,
    height: 2700,
    backgroundColor: rawSeason.hero.backgroundColor,
  };

  const products = rawSeason.products.map((rawProduct, index) => {
    const displayNumber = padProductNumber(index);
    const numericNumber = index + 1;
    const id = `style-now-${rawSeason.key}-${displayNumber}`;
    const fileName = `style-now-${rawSeason.key}-product-${displayNumber}.webp`;
    const isSale =
      Number.isFinite(rawProduct.listPrice) &&
      rawProduct.listPrice > rawProduct.price;
    const saleRate = isSale
      ? Math.round(
          ((rawProduct.listPrice - rawProduct.price) /
            rawProduct.listPrice) *
            100,
        )
      : 0;
    const asset = {
      kind: "product",
      season: rawSeason.key,
      productId: id,
      fileName,
      localPath: `public/style-now/${rawSeason.key}/${fileName}`,
      storagePath: `images/${rawProduct.category}/${id}/${fileName}`,
      prompt: buildProductPrompt(rawProduct, rawSeason, displayNumber),
      width: 1200,
      height: 1200,
      backgroundColor: rawSeason.hero.backgroundColor,
    };

    return {
      id,
      name: rawProduct.name,
      description: `${rawProduct.material} 소재와 ${rawProduct.design}이 특징인 ${rawSeason.label} 시즌 상품입니다.`,
      price: rawProduct.price,
      ...(isSale ? { originalPrice: rawProduct.listPrice } : {}),
      brand: rawProduct.brand,
      category: rawProduct.category,
      categoryId: rawProduct.category,
      images: [],
      mainImage: "",
      sizes: [...rawProduct.sizes],
      colors: [rawProduct.color],
      stock: rawProduct.stock,
      rating: 0,
      reviewCount: 0,
      reviewSummary: buildReviewSummary(),
      isNew: true,
      isSale,
      saleRate,
      tags: [
        "style-now",
        rawSeason.tag,
        rawSeason.label,
        rawProduct.color,
        rawProduct.material,
        ...rawProduct.tags,
      ],
      status: "draft",
      sku: `STN-${seasonCode}-${String(numericNumber).padStart(3, "0")}`,
      schemaVersion: 2,
      details: {
        material: rawProduct.material,
        origin: "대한민국",
        manufacturer: rawProduct.brand,
        precautions: getProductPrecautions(rawProduct.category),
        sizes: buildProductSizeDetails(
          rawProduct.category,
          rawProduct.sizes,
        ),
      },
      asset,
    };
  });

  return {
    key: rawSeason.key,
    label: rawSeason.label,
    title: rawSeason.title,
    description: rawSeason.description,
    tag: rawSeason.tag,
    palette: rawSeason.palette,
    hero,
    products,
  };
}

function loadStyleNowManifest(manifestPath = MANIFEST_PATH) {
  const rawManifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

  return {
    version: rawManifest.version,
    seasons: rawManifest.seasons.map(expandSeason),
  };
}

function assertUnique(values, label) {
  const uniqueValues = new Set(values);
  if (uniqueValues.size !== values.length) {
    throw new Error(`${label}에 중복 값이 있습니다.`);
  }
  return uniqueValues.size;
}

function assertNonEmptyString(value, label) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label}은(는) 비어 있지 않은 문자열이어야 합니다.`);
  }
}

function validateProduct(product, season) {
  assertNonEmptyString(product.id, "상품 ID");
  assertNonEmptyString(product.name, `${product.id} 상품명`);
  assertNonEmptyString(product.description, `${product.id} 상품 설명`);
  assertNonEmptyString(product.brand, `${product.id} 브랜드`);
  assertNonEmptyString(product.sku, `${product.id} SKU`);
  if (!ALLOWED_CATEGORIES.has(product.category)) {
    throw new Error(`${product.id}의 카테고리가 활성 허용 목록에 없습니다.`);
  }
  if (product.category !== product.categoryId) {
    throw new Error(`${product.id}의 category와 categoryId가 다릅니다.`);
  }
  if (product.status !== "draft") {
    throw new Error(`${product.id}의 초기 상태는 draft여야 합니다.`);
  }
  if (!product.tags.includes("style-now") || !product.tags.includes(season.tag)) {
    throw new Error(`${product.id}의 스타일나우 태그가 누락되었습니다.`);
  }
  if (product.images.length !== 0 || product.mainImage !== "") {
    throw new Error(`${product.id}의 이미지 URL은 업로드 전 비어 있어야 합니다.`);
  }
  if (
    !product.details ||
    !product.details.material ||
    !product.details.origin ||
    !product.details.manufacturer ||
    !product.details.precautions ||
    Object.keys(product.details.sizes).length === 0
  ) {
    throw new Error(`${product.id}의 상세 정보가 완전하지 않습니다.`);
  }
  if (product.isSale) {
    const expectedSaleRate = Math.round(
      ((product.originalPrice - product.price) / product.originalPrice) * 100,
    );
    if (
      product.originalPrice <= product.price ||
      product.saleRate !== expectedSaleRate
    ) {
      throw new Error(`${product.id}의 할인 가격이 일치하지 않습니다.`);
    }
  } else if (
    Object.prototype.hasOwnProperty.call(product, "originalPrice") ||
    product.saleRate !== 0
  ) {
    throw new Error(`${product.id}의 비할인 가격 필드가 일치하지 않습니다.`);
  }
}

function validateAsset(asset) {
  assertNonEmptyString(asset.prompt, `${asset.fileName} 프롬프트`);
  if (asset.prompt.length <= 180) {
    throw new Error(`${asset.fileName} 프롬프트가 너무 짧습니다.`);
  }
  for (const requiredPhrase of ["텍스트", "로고", "워터마크"]) {
    if (!asset.prompt.includes(requiredPhrase)) {
      throw new Error(
        `${asset.fileName} 프롬프트에 ${requiredPhrase} 금지 조건이 없습니다.`,
      );
    }
  }
  if (!/^[a-z0-9-]+\.webp$/.test(asset.fileName)) {
    throw new Error(`${asset.fileName} 파일명 규칙이 올바르지 않습니다.`);
  }
  if (!asset.localPath.startsWith("public/style-now/")) {
    throw new Error(`${asset.fileName}의 로컬 경로가 올바르지 않습니다.`);
  }
  if (!asset.storagePath.startsWith("images/")) {
    throw new Error(`${asset.fileName}의 Storage 경로가 올바르지 않습니다.`);
  }
}

function validateStyleNowManifest(manifest) {
  if (!manifest || !Array.isArray(manifest.seasons)) {
    throw new Error("스타일나우 매니페스트에 seasons 배열이 없습니다.");
  }

  const seasonKeys = manifest.seasons.map((season) => season.key);
  if (JSON.stringify(seasonKeys) !== JSON.stringify(REQUIRED_SEASONS)) {
    throw new Error(
      `시즌 순서는 ${REQUIRED_SEASONS.join(", ")}여야 합니다.`,
    );
  }

  const productsBySeason = {};
  const allProducts = [];
  const allAssets = [];

  for (const season of manifest.seasons) {
    if (season.products.length !== 20) {
      throw new Error(`${season.key} 상품은 정확히 20개여야 합니다.`);
    }
    productsBySeason[season.key] = season.products.length;
    validateAsset(season.hero);
    allAssets.push(season.hero);

    for (const product of season.products) {
      validateProduct(product, season);
      validateAsset(product.asset);
      allProducts.push(product);
      allAssets.push(product.asset);
    }
  }

  return {
    seasons: manifest.seasons.length,
    heroAssets: manifest.seasons.length,
    productAssets: allProducts.length,
    totalAssets: allAssets.length,
    productsBySeason,
    uniqueProductIds: assertUnique(
      allProducts.map((product) => product.id),
      "상품 ID",
    ),
    uniqueSkus: assertUnique(
      allProducts.map((product) => product.sku),
      "SKU",
    ),
    uniqueLocalPaths: assertUnique(
      allAssets.map((asset) => asset.localPath),
      "로컬 경로",
    ),
    uniqueStoragePaths: assertUnique(
      allAssets.map((asset) => asset.storagePath),
      "Storage 경로",
    ),
    uniquePrompts: assertUnique(
      allAssets.map((asset) => asset.prompt),
      "이미지 프롬프트",
    ),
  };
}

function main(argv = process.argv.slice(2)) {
  const command = argv[0] || "validate";
  if (command !== "validate") {
    throw new Error(`지원하지 않는 명령입니다: ${command}`);
  }

  const manifest = loadStyleNowManifest();
  const summary = validateStyleNowManifest(manifest);
  console.log(JSON.stringify(summary, null, 2));
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : "매니페스트 검증에 실패했습니다.",
    );
    process.exitCode = 1;
  }
}

module.exports = {
  MANIFEST_PATH,
  loadStyleNowManifest,
  validateStyleNowManifest,
  buildHeroPrompt,
  buildProductPrompt,
};
