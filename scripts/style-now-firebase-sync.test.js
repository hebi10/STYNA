const {
  assertFirebaseTargetConsistency,
  buildStyleNowSyncEntries,
  uploadStyleNowAssets,
  applyDraftProducts,
  activateStyleNowProducts,
} = require("./style-now-firebase-sync");
const { loadStyleNowManifest } = require("./style-now-manifest");

function makeFirestore() {
  const create = jest.fn();
  const update = jest.fn();
  const commit = jest.fn().mockResolvedValue(undefined);
  const batch = { create, update, commit };
  const doc = jest.fn((id) => ({ id, path: `products/${id}` }));
  const collection = jest.fn(() => ({ doc }));

  return {
    db: {
      batch: jest.fn(() => batch),
      collection,
    },
    batch,
    create,
    update,
    commit,
  };
}

describe("style now Firebase sync", () => {
  test("refuses mismatched Firebase projects and buckets before writing", () => {
    expect(() =>
      assertFirebaseTargetConsistency({
        projectId: "another-project",
        bucketName: "hebimall.firebasestorage.app",
        configuredProjectId: "hebimall",
        configuredBucketName: "hebimall.firebasestorage.app",
      }),
    ).toThrow("Firebase 프로젝트가 일치하지 않습니다.");

    expect(() =>
      assertFirebaseTargetConsistency({
        projectId: "hebimall",
        bucketName: "another-bucket",
        configuredProjectId: "hebimall",
        configuredBucketName: "hebimall.firebasestorage.app",
      }),
    ).toThrow("Firebase Storage 버킷이 일치하지 않습니다.");
  });

  test("connects eighty existing-schema products to eighty-four immutable asset paths", () => {
    const entries = buildStyleNowSyncEntries(
      loadStyleNowManifest(),
      "hebimall.firebasestorage.app",
    );

    expect(entries.assets).toHaveLength(84);
    expect(entries.products).toHaveLength(80);
    expect(entries.products[0]).toMatchObject({
      id: "style-now-spring-01",
      data: {
        status: "draft",
        images: [
          "https://firebasestorage.googleapis.com/v0/b/hebimall.firebasestorage.app/o/images%2Fclothing%2Fstyle-now-spring-01%2Fstyle-now-spring-product-01.webp?alt=media",
        ],
        mainImage:
          "https://firebasestorage.googleapis.com/v0/b/hebimall.firebasestorage.app/o/images%2Fclothing%2Fstyle-now-spring-01%2Fstyle-now-spring-product-01.webp?alt=media",
      },
    });
    expect(entries.assets[0].storagePath).toBe(
      "images/style-now/spring/style-now-spring-main.webp",
    );
  });

  test("uploads every asset with a create-only generation precondition", async () => {
    const upload = jest.fn().mockResolvedValue(undefined);
    const entries = buildStyleNowSyncEntries(
      loadStyleNowManifest(),
      "hebimall.firebasestorage.app",
    );

    await uploadStyleNowAssets(entries.assets.slice(0, 2), {
      upload,
    });

    expect(upload).toHaveBeenCalledTimes(2);
    expect(upload).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("public"),
      expect.objectContaining({
        destination:
          "images/style-now/spring/style-now-spring-main.webp",
        preconditionOpts: { ifGenerationMatch: 0 },
        metadata: {
          contentType: "image/webp",
          cacheControl: "public,max-age=31536000,immutable",
        },
      }),
    );
  });

  test("creates all draft products without merging or overwriting documents", async () => {
    const firestore = makeFirestore();
    const entries = buildStyleNowSyncEntries(
      loadStyleNowManifest(),
      "hebimall.firebasestorage.app",
    );
    const timestamp = { seconds: 1, nanoseconds: 0 };

    await applyDraftProducts(entries.products, {
      db: firestore.db,
      timestamp,
    });

    expect(firestore.create).toHaveBeenCalledTimes(80);
    expect(firestore.update).not.toHaveBeenCalled();
    expect(firestore.create).toHaveBeenCalledWith(
      { id: "style-now-spring-01", path: "products/style-now-spring-01" },
      expect.objectContaining({
        status: "draft",
        createdAt: timestamp,
        updatedAt: timestamp,
      }),
    );
    expect(firestore.commit).toHaveBeenCalledTimes(1);
  });

  test("activates only after an exact verified draft summary", async () => {
    const firestore = makeFirestore();
    const entries = buildStyleNowSyncEntries(
      loadStyleNowManifest(),
      "hebimall.firebasestorage.app",
    );

    await expect(
      activateStyleNowProducts(entries.products, {
        db: firestore.db,
        timestamp: { seconds: 2, nanoseconds: 0 },
        verifiedDraftSummary: {
          total: 79,
          productsBySeason: {
            spring: 20,
            summer: 20,
            autumn: 20,
            winter: 19,
          },
        },
      }),
    ).rejects.toThrow("검증된 draft 상품이 정확히 80개가 아닙니다.");

    await activateStyleNowProducts(entries.products, {
      db: firestore.db,
      timestamp: { seconds: 3, nanoseconds: 0 },
      verifiedDraftSummary: {
        total: 80,
        productsBySeason: {
          spring: 20,
          summer: 20,
          autumn: 20,
          winter: 20,
        },
      },
    });

    expect(firestore.update).toHaveBeenCalledTimes(80);
    expect(firestore.create).not.toHaveBeenCalled();
    expect(firestore.update).toHaveBeenCalledWith(
      { id: "style-now-spring-01", path: "products/style-now-spring-01" },
      expect.objectContaining({ status: "active" }),
    );
  });

  test("does not expose destructive deletion or rollback operations", () => {
    const exported = require("./style-now-firebase-sync");

    expect(exported.deleteStyleNowAssets).toBeUndefined();
    expect(exported.deleteStyleNowProducts).toBeUndefined();
    expect(exported.rollbackStyleNowSync).toBeUndefined();
  });
});
