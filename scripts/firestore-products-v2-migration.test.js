/** @jest-environment node */

const path = require("path");
const { spawnSync } = require("child_process");

const migrationPath = path.join(__dirname, "firestore-products-v2-migration.js");
const runtimePath = path.join(__dirname, "firestore-migration-runtime.js");

const options = {
  sourceCollection: "categories",
  sourceSubcollection: "products",
  destinationCollection: "products",
  execute: false,
  normalizeOrders: true,
  failOnExistingDestination: true,
  sampleLimit: 20,
};

let migration;

beforeAll(() => {
  const importProbe = `
    const Module = require("module");
    const originalLoad = Module._load;
    const forbidden = ["util-firestore-admin", "firebase-admin", "dotenv"];
    Module._load = function(request, parent, isMain) {
      if (forbidden.some((name) => String(request).includes(name))) {
        throw new Error("forbidden import: " + request);
      }
      return originalLoad.call(this, request, parent, isMain);
    };
    console.log = () => { throw new Error("import logged to stdout"); };
    console.error = () => { throw new Error("import logged to stderr"); };
    process.exit = () => { throw new Error("import called process.exit"); };
    require(${JSON.stringify(runtimePath)});
    require(${JSON.stringify(migrationPath)});
  `;
  const result = spawnSync(process.execPath, ["-e", importProbe], {
    cwd: path.resolve(__dirname, ".."),
    encoding: "utf8",
  });

  if (result.status !== 0) {
    throw new Error(`migration import is not side-effect free:\n${result.stderr || result.stdout}`);
  }

  jest.resetModules();
  migration = require("./firestore-products-v2-migration");
});

function createProductDocument(id = "product-1") {
  return {
    id,
    ref: { path: `categories/tops/products/${id}` },
    data: () => ({
      name: "Test Product",
      price: 10000,
      stock: 5,
      status: "active",
      brand: "STYNA",
    }),
  };
}

function createInjectedRuntime() {
  const productDocument = createProductDocument();
  const productsSnapshot = { size: 1, docs: [productDocument] };
  const categoryRef = {
    path: "categories/tops",
    collection: jest.fn(() => ({ get: jest.fn().mockResolvedValue(productsSnapshot) })),
  };
  const categoryDocument = {
    id: "tops",
    ref: categoryRef,
    data: () => ({ slug: "tops" }),
  };
  const destinationDocument = {
    id: productDocument.id,
    ref: { path: `products/${productDocument.id}` },
    exists: true,
    data: () => ({
      ...productDocument.data(),
      categoryId: "tops",
    }),
  };
  const collection = jest.fn((name) => {
    if (name === "categories") {
      return {
        get: jest.fn().mockResolvedValue({ docs: [categoryDocument] }),
      };
    }

    if (name === "products") {
      return {
        limit: jest.fn(() => ({
          get: jest.fn().mockResolvedValue({
            empty: true,
            docs: [],
          }),
        })),
        get: jest.fn().mockResolvedValue({
          size: 1,
          docs: [destinationDocument],
        }),
        doc: jest.fn(() => ({
          get: jest.fn().mockResolvedValue(destinationDocument),
        })),
      };
    }

    if (name === "orders") {
      return {
        get: jest.fn().mockResolvedValue({
          docs: [{ data: () => ({ shippingAddress: { city: "Seoul" } }) }],
        }),
      };
    }

    throw new Error(`Unexpected collection: ${name}`);
  });

  return {
    admin: {
      firestore: {
        FieldValue: {
          serverTimestamp: jest.fn(() => "server-timestamp"),
        },
      },
    },
    db: { collection },
    projectId: "injected-project",
  };
}

test("runtime loader imports the Admin helper only when explicitly called", () => {
  const loaderProbe = `
    const Module = require("module");
    const originalLoad = Module._load;
    const sentinel = { admin: {}, db: {}, projectId: "injected" };
    let helperLoads = 0;
    Module._load = function(request, parent, isMain) {
      if (request === "./util-firestore-admin" && parent.filename === ${JSON.stringify(runtimePath)}) {
        helperLoads += 1;
        return sentinel;
      }
      if (["firebase-admin", "dotenv"].includes(request)) {
        throw new Error("unexpected eager dependency: " + request);
      }
      return originalLoad.call(this, request, parent, isMain);
    };
    const runtimeModule = require(${JSON.stringify(runtimePath)});
    if (helperLoads !== 0) throw new Error("helper loaded during import");
    if (runtimeModule.loadFirestoreMigrationRuntime() !== sentinel) {
      throw new Error("loader did not return the helper runtime");
    }
    if (helperLoads !== 1) throw new Error("helper load count: " + helperLoads);
  `;
  const result = spawnSync(process.execPath, ["-e", loaderProbe], {
    cwd: path.resolve(__dirname, ".."),
    encoding: "utf8",
  });

  expect(result.status).toBe(0);
  expect(result.stderr).toBe("");
});

test("preserves the analyze/migrate/validate CLI option contract", () => {
  expect(migration.parseArgs([])).toEqual({
    command: "analyze",
    options,
  });
  expect(
    migration.parseArgs([
      "migrate",
      "--execute",
      "--skip-order-normalization",
      "--allow-existing-destination",
      "--dest=products-v2",
      "--sample-limit=7",
    ]),
  ).toEqual({
    command: "migrate",
    options: {
      ...options,
      destinationCollection: "products-v2",
      execute: true,
      normalizeOrders: false,
      failOnExistingDestination: false,
      sampleLimit: 7,
    },
  });
});

test("analyzes only through the explicitly injected runtime", async () => {
  const runtime = createInjectedRuntime();

  const report = await migration.analyzeStructure(options, runtime);

  expect(report).toMatchObject({
    projectId: "injected-project",
    categories: 1,
    sourceProductCount: 1,
    sourceByCategory: { tops: 1 },
    destinationExists: false,
  });
  expect(runtime.db.collection).toHaveBeenCalledWith("categories");
  expect(runtime.db.collection).toHaveBeenCalledWith("products");
});

test("fails clearly when a database helper has no injected runtime", async () => {
  await expect(migration.analyzeStructure(options)).rejects.toThrow(/runtime/i);
  await expect(migration.migrateProducts(options)).rejects.toThrow(/runtime/i);
  await expect(migration.validateMigration(options)).rejects.toThrow(/runtime/i);
});

test("keeps migrate dry-run write-free with an injected runtime", async () => {
  const runtime = createInjectedRuntime();
  const log = jest.spyOn(console, "log").mockImplementation(() => {});

  try {
    await expect(migration.migrateProducts(options, runtime)).resolves.toMatchObject({
      dryRun: true,
      report: { projectId: "injected-project", sourceProductCount: 1 },
    });
  } finally {
    log.mockRestore();
  }

  expect(runtime.db.bulkWriter).toBeUndefined();
  expect(runtime.admin.firestore.FieldValue.serverTimestamp).not.toHaveBeenCalled();
});

test("validates only through the explicitly injected runtime", async () => {
  const runtime = createInjectedRuntime();
  const log = jest.spyOn(console, "log").mockImplementation(() => {});

  let summary;
  try {
    summary = await migration.validateMigration(options, runtime);
  } finally {
    log.mockRestore();
  }

  expect(summary).toEqual({
    sourceProductCount: 1,
    destinationProductCount: 1,
    destinationMatchedCount: 1,
    missingProducts: [],
    mismatchedCategories: [],
    mismatchedFields: [],
    orphanDestinationProducts: [],
    normalizedOrders: 1,
  });
  expect(runtime.db.collection).toHaveBeenCalledWith("orders");
});
