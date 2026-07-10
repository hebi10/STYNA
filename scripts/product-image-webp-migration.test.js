const {
  buildWebpStoragePath,
  getWebpCacheControl,
  collectProductImageUrls,
  isConvertibleProductImageUrl,
  parseFirebaseStorageUrl,
  replaceProductImageUrls,
} = require("./product-image-webp-migration");

describe("product image WebP migration helpers", () => {
  test("marks migrated versioned WebP objects as immutable cacheable resources", () => {
    expect(getWebpCacheControl()).toBe("public, max-age=31536000, immutable");
  });

  test("parses Firebase Storage download URLs into bucket and object path", () => {
    const parsed = parseFirebaseStorageUrl(
      "https://firebasestorage.googleapis.com/v0/b/hebimall.firebasestorage.app/o/images%2Ftops%2Fp1%2F1710000000000_0.jpg?alt=media&token=abc"
    );

    expect(parsed).toEqual({
      bucket: "hebimall.firebasestorage.app",
      path: "images/tops/p1/1710000000000_0.jpg",
    });
  });

  test("builds a q75 WebP sibling path without overwriting the source", () => {
    expect(buildWebpStoragePath("images/tops/p1/1710000000000_0.jpg")).toBe(
      "images/tops/p1/1710000000000_0_q75.webp"
    );
    expect(buildWebpStoragePath("images/tops/p1/1710000000000_0.webp")).toBe(
      "images/tops/p1/1710000000000_0_q75.webp"
    );
  });

  test("skips already optimized q75 WebP product images", () => {
    expect(
      isConvertibleProductImageUrl(
        "https://firebasestorage.googleapis.com/v0/b/hebimall.firebasestorage.app/o/images%2Ftops%2Fp1%2F1710000000000_0.jpg?alt=media&token=abc"
      )
    ).toBe(true);
    expect(
      isConvertibleProductImageUrl(
        "https://firebasestorage.googleapis.com/v0/b/hebimall.firebasestorage.app/o/images%2Ftops%2Fp1%2F1710000000000_0_q75.webp?alt=media&token=abc"
      )
    ).toBe(false);
  });

  test("collects unique product image URLs from images and mainImage", () => {
    const urls = collectProductImageUrls({
      images: ["https://example.com/a.jpg", "https://example.com/a.jpg"],
      detailImages: ["https://example.com/detail.jpg"],
      mainImage: "https://example.com/b.jpg",
    });

    expect(urls).toEqual([
      "https://example.com/a.jpg",
      "https://example.com/detail.jpg",
      "https://example.com/b.jpg",
    ]);
  });

  test("replaces product images and mainImage using the migration map", () => {
    const product = {
      images: ["old-a", "old-b"],
      detailImages: ["old-detail"],
      mainImage: "old-b",
      name: "테스트 상품",
    };

    const replaced = replaceProductImageUrls(product, new Map([
      ["old-b", "new-b"],
      ["old-detail", "new-detail"],
    ]));

    expect(replaced).toEqual({
      images: ["old-a", "new-b"],
      detailImages: ["new-detail"],
      mainImage: "new-b",
    });
  });

  test("falls back a missing mainImage to the first replaced product image", () => {
    const product = {
      images: ["old-product-image"],
      mainImage: "missing-main-image",
    };

    const replaced = replaceProductImageUrls(
      product,
      new Map([["old-product-image", "new-product-image"]]),
      new Set(["missing-main-image"])
    );

    expect(replaced).toEqual({
      images: ["new-product-image"],
      mainImage: "new-product-image",
    });
  });

  test("falls back a missing mainImage to an existing first WebP image", () => {
    const product = {
      images: ["existing-q75.webp"],
      mainImage: "missing-main-image",
    };

    const replaced = replaceProductImageUrls(
      product,
      new Map(),
      new Set(["missing-main-image"])
    );

    expect(replaced).toEqual({
      mainImage: "existing-q75.webp",
    });
  });

  test("falls back a missing mainImage to a historical converted image URL", () => {
    const product = {
      images: [],
      mainImage: "missing-main-image",
    };

    const replaced = replaceProductImageUrls(
      product,
      new Map(),
      new Set(["missing-main-image"]),
      "historical-q75.webp"
    );

    expect(replaced).toEqual({
      mainImage: "historical-q75.webp",
    });
  });

  test("falls back a missing images entry to a historical converted image URL", () => {
    const product = {
      images: ["missing-main-image"],
      mainImage: "missing-main-image",
    };

    const replaced = replaceProductImageUrls(
      product,
      new Map(),
      new Set(["missing-main-image"]),
      "historical-q75.webp"
    );

    expect(replaced).toEqual({
      images: ["historical-q75.webp"],
      mainImage: "historical-q75.webp",
    });
  });
});
