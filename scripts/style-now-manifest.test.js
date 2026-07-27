const {
  loadStyleNowManifest,
  validateStyleNowManifest,
} = require("./style-now-manifest");

describe("style now image manifest", () => {
  test("keeps four seasons with one hero and twenty products each", () => {
    const manifest = loadStyleNowManifest();
    const summary = validateStyleNowManifest(manifest);

    expect(summary).toEqual({
      seasons: 4,
      heroAssets: 4,
      productAssets: 80,
      totalAssets: 84,
      productsBySeason: {
        spring: 20,
        summer: 20,
        autumn: 20,
        winter: 20,
      },
      uniqueProductIds: 80,
      uniqueSkus: 80,
      uniqueLocalPaths: 84,
      uniqueStoragePaths: 84,
      uniquePrompts: 84,
    });
  });

  test("uses the existing product schema and deterministic style-now identifiers", () => {
    const manifest = loadStyleNowManifest();
    const products = manifest.seasons.flatMap((season) => season.products);

    expect(products[0]).toMatchObject({
      id: "style-now-spring-01",
      sku: "STN-SPR-001",
      category: "clothing",
      categoryId: "clothing",
      status: "draft",
      schemaVersion: 2,
      rating: 0,
      reviewCount: 0,
      tags: expect.arrayContaining(["style-now", "style-now-spring"]),
    });
    expect(products.at(-1)).toMatchObject({
      id: "style-now-winter-20",
      sku: "STN-WIN-020",
      status: "draft",
      tags: expect.arrayContaining(["style-now", "style-now-winter"]),
    });

    for (const product of products) {
      expect(product.images).toEqual([]);
      expect(product.mainImage).toBe("");
      expect(product.detailImages).toBeUndefined();
      expect(product.legacyPath).toBeUndefined();
      expect(product.migration).toBeUndefined();
      expect(product.details).toEqual({
        material: expect.any(String),
        origin: expect.any(String),
        manufacturer: expect.any(String),
        precautions: expect.any(String),
        sizes: expect.any(Object),
      });
    }
  });

  test("writes a distinct no-text generation prompt for every requested asset", () => {
    const manifest = loadStyleNowManifest();
    const assets = manifest.seasons.flatMap((season) => [
      season.hero,
      ...season.products.map((product) => product.asset),
    ]);

    for (const asset of assets) {
      expect(asset.prompt.length).toBeGreaterThan(180);
      expect(asset.prompt).toContain("텍스트");
      expect(asset.prompt).toContain("로고");
      expect(asset.prompt).toContain("워터마크");
      expect(asset.localPath).toMatch(
        /^public\/style-now\/(spring|summer|autumn|winter)\/style-now-[a-z]+-(main|product-\d{2})\.webp$/,
      );
      expect(asset.storagePath).toMatch(/^images\//);
    }
  });

  test("builds every seasonal hero as one continuous three-panel editorial", () => {
    const manifest = loadStyleNowManifest();

    for (const { hero } of manifest.seasons) {
      expect(hero.prompt).toContain("세로 3분할 트립틱");
      expect(hero.prompt).toContain("하나의 연속된 장면");
      expect(hero.prompt).toContain("패널 사이");
      expect(hero.prompt).toContain("서로 다른 순간");
    }
  });

  test("keeps sale price, list price, and sale rate mathematically consistent", () => {
    const manifest = loadStyleNowManifest();
    const products = manifest.seasons.flatMap((season) => season.products);

    for (const product of products) {
      if (!product.isSale) {
        expect(product.originalPrice).toBeUndefined();
        expect(product.saleRate).toBe(0);
        continue;
      }

      expect(product.originalPrice).toBeGreaterThan(product.price);
      expect(product.saleRate).toBe(
        Math.round(
          ((product.originalPrice - product.price) / product.originalPrice) *
            100,
        ),
      );
    }
  });
});
