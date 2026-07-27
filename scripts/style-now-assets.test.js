const {
  buildAssetPlan,
  validateAssetInspection,
} = require("./style-now-assets");
const { loadStyleNowManifest } = require("./style-now-manifest");

describe("style now asset processing", () => {
  test("builds an exact normalization plan for all requested assets", () => {
    const plan = buildAssetPlan(loadStyleNowManifest());

    expect(plan).toHaveLength(84);
    expect(plan[0]).toMatchObject({
      kind: "hero",
      outputPath:
        "public/style-now/spring/style-now-spring-main.webp",
      sourceStemPath: expect.stringMatching(
        /style-now-source[\\/]spring[\\/]style-now-spring-main-triptych$/,
      ),
      width: 900,
      height: 2700,
    });
    expect(plan.at(-1)).toMatchObject({
      kind: "product",
      outputPath:
        "public/style-now/winter/style-now-winter-product-20.webp",
      width: 1200,
      height: 1200,
    });
  });

  test("rejects missing, non-WebP, wrongly sized, and duplicated assets", () => {
    const inspection = [
      {
        fileName: "missing.webp",
        exists: false,
        format: null,
        width: null,
        height: null,
        hash: null,
        expectedWidth: 1200,
        expectedHeight: 1200,
      },
      {
        fileName: "wrong-format.webp",
        exists: true,
        format: "png",
        width: 1200,
        height: 1200,
        hash: "same",
        expectedWidth: 1200,
        expectedHeight: 1200,
      },
      {
        fileName: "wrong-size.webp",
        exists: true,
        format: "webp",
        width: 1000,
        height: 1200,
        hash: "same",
        expectedWidth: 1200,
        expectedHeight: 1200,
      },
    ];

    expect(() => validateAssetInspection(inspection)).toThrow(
      "스타일나우 이미지 검증 실패: 누락 1, 형식 1, 규격 1, 해시 중복 1",
    );
  });

  test("summarizes a complete set of unique normalized assets", () => {
    const plan = buildAssetPlan(loadStyleNowManifest());
    const inspection = plan.map((asset, index) => ({
      fileName: asset.fileName,
      exists: true,
      format: "webp",
      width: asset.width,
      height: asset.height,
      hash: `hash-${index}`,
      expectedWidth: asset.width,
      expectedHeight: asset.height,
    }));

    expect(validateAssetInspection(inspection)).toEqual({
      total: 84,
      webp: 84,
      hero: 4,
      products: 80,
      uniqueHashes: 84,
    });
  });
});
