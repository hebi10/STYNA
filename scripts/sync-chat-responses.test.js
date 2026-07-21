/** @jest-environment node */

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const repositoryRoot = path.resolve(__dirname, "..");
const scriptPath = path.join(__dirname, "sync-chat-responses.js");
const temporaryRoots = [];

let syncChatResponses;

beforeAll(() => {
  jest.resetModules();

  const originalWriteFileSync = fs.writeFileSync;
  const attemptedWrites = [];

  fs.writeFileSync = (...args) => {
    attemptedWrites.push(args[0]);
    throw new Error(`module import attempted to write ${args[0]}`);
  };

  try {
    syncChatResponses = require("./sync-chat-responses");
  } finally {
    fs.writeFileSync = originalWriteFileSync;
  }

  expect(attemptedWrites).toEqual([]);
});

afterEach(() => {
  while (temporaryRoots.length > 0) {
    const temporaryRoot = temporaryRoots.pop();
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
});

function createTemporaryPaths(source = "export const response = 'hello';\n", target) {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "hebimall-chat-sync-"));
  temporaryRoots.push(temporaryRoot);

  const sourcePath = path.join(temporaryRoot, "src", "shared", "utils", "chatResponses.ts");
  const targetPath = path.join(temporaryRoot, "functions", "src", "chatResponses.ts");

  fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(sourcePath, source, "utf8");

  if (target !== undefined) {
    fs.writeFileSync(targetPath, target, "utf8");
  }

  return { temporaryRoot, sourcePath, targetPath, source };
}

function createCliFixture(source, target) {
  const fixture = createTemporaryPaths(source, target);
  const copiedScriptPath = path.join(fixture.temporaryRoot, "scripts", "sync-chat-responses.js");
  const policySourcePath = path.join(
    fixture.temporaryRoot,
    "src",
    "shared",
    "constants",
    "commercePolicy.ts",
  );
  const policyTargetPath = path.join(
    fixture.temporaryRoot,
    "functions",
    "src",
    "commercePolicy.ts",
  );
  const policySource = "export const policy = 'canonical';\n";

  fs.mkdirSync(path.dirname(copiedScriptPath), { recursive: true });
  fs.mkdirSync(path.dirname(policySourcePath), { recursive: true });
  fs.copyFileSync(scriptPath, copiedScriptPath);
  fs.writeFileSync(policySourcePath, policySource, "utf8");
  fs.writeFileSync(
    policyTargetPath,
    "// Generated from src/shared/constants/commercePolicy.ts. Run npm run sync:chat-responses:write after editing.\n" +
      policySource,
    "utf8",
  );

  return { ...fixture, copiedScriptPath, policySourcePath, policyTargetPath, policySource };
}

function createGeneratedCommerceFixture({
  policyTarget = "generated",
  chatTarget = "generated",
} = {}) {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "hebimall-commerce-sync-"));
  temporaryRoots.push(temporaryRoot);

  const commercePolicySourcePath = path.join(
    temporaryRoot,
    "src",
    "shared",
    "constants",
    "commercePolicy.ts",
  );
  const commercePolicyTargetPath = path.join(
    temporaryRoot,
    "functions",
    "src",
    "commercePolicy.ts",
  );
  const chatResponsesSourcePath = path.join(
    temporaryRoot,
    "src",
    "shared",
    "utils",
    "chatResponses.ts",
  );
  const chatResponsesTargetPath = path.join(
    temporaryRoot,
    "functions",
    "src",
    "chatResponses.ts",
  );
  const commercePolicySource = "export const policy = 'canonical';\n";
  const chatResponsesSource =
    "import { policy } from '@/shared/constants/commercePolicy';\nexport const response = policy;\n";

  fs.mkdirSync(path.dirname(commercePolicySourcePath), { recursive: true });
  fs.mkdirSync(path.dirname(commercePolicyTargetPath), { recursive: true });
  fs.mkdirSync(path.dirname(chatResponsesSourcePath), { recursive: true });
  fs.writeFileSync(commercePolicySourcePath, commercePolicySource, "utf8");
  fs.writeFileSync(chatResponsesSourcePath, chatResponsesSource, "utf8");
  fs.writeFileSync(
    commercePolicyTargetPath,
    policyTarget === "generated"
      ? syncChatResponses.buildGeneratedCommercePolicy(commercePolicySource)
      : policyTarget,
    "utf8",
  );
  fs.writeFileSync(
    chatResponsesTargetPath,
    chatTarget === "generated"
      ? syncChatResponses.buildGeneratedChatResponses(chatResponsesSource)
      : chatTarget,
    "utf8",
  );

  return {
    commercePolicySourcePath,
    commercePolicyTargetPath,
    chatResponsesSourcePath,
    chatResponsesTargetPath,
    commercePolicySource,
    chatResponsesSource,
  };
}

describe("chat response generator", () => {
  test("builds the generated file without reading or writing files", () => {
    const source = "export const response = 'hello';\n";

    expect(syncChatResponses.buildGeneratedChatResponses(source)).toBe(
      "// Generated from src/shared/utils/chatResponses.ts. Run npm run sync:chat-responses:write after editing.\n" +
        source,
    );
  });

  test("accepts an identical target without modifying it", () => {
    const source = "export const response = 'same';\n";
    const generated = syncChatResponses.buildGeneratedChatResponses(source);
    const { sourcePath, targetPath } = createTemporaryPaths(source, generated);
    const before = fs.statSync(targetPath);

    expect(syncChatResponses.checkChatResponses(sourcePath, targetPath)).toBe(true);

    expect(fs.readFileSync(targetPath, "utf8")).toBe(generated);
    expect(fs.statSync(targetPath).mtimeMs).toBe(before.mtimeMs);
  });

  test("rejects a stale target without rewriting it", () => {
    const { sourcePath, targetPath } = createTemporaryPaths(
      "export const response = 'new';\n",
      "stale target\n",
    );

    expect(() => syncChatResponses.checkChatResponses(sourcePath, targetPath)).toThrow(
      /out of date.*sync:chat-responses:write/i,
    );
    expect(fs.readFileSync(targetPath, "utf8")).toBe("stale target\n");
  });

  test("rejects a missing target without creating it", () => {
    const { sourcePath, targetPath } = createTemporaryPaths();

    expect(() => syncChatResponses.checkChatResponses(sourcePath, targetPath)).toThrow(
      /missing.*sync:chat-responses:write/i,
    );
    expect(fs.existsSync(targetPath)).toBe(false);
  });

  test("updates the target only through the explicit writer", () => {
    const source = "export const response = 'updated';\n";
    const { sourcePath, targetPath } = createTemporaryPaths(source, "stale target\n");

    syncChatResponses.writeChatResponses(sourcePath, targetPath);

    expect(fs.readFileSync(targetPath, "utf8")).toBe(
      syncChatResponses.buildGeneratedChatResponses(source),
    );
    expect(fs.readdirSync(path.dirname(targetPath))).toEqual(["chatResponses.ts"]);
  });
});

describe("generated commerce sources", () => {
  test("transforms only the canonical policy import for Functions", () => {
    const source =
      "import { policy } from '@/shared/constants/commercePolicy';\nexport const response = policy;\n";

    expect(syncChatResponses.buildGeneratedChatResponses(source)).toContain(
      "from './commercePolicy'",
    );
    expect(syncChatResponses.buildGeneratedCommercePolicy("export const policy = 1;\n")).toBe(
      "// Generated from src/shared/constants/commercePolicy.ts. Run npm run sync:chat-responses:write after editing.\n" +
        "export const policy = 1;\n",
    );
  });

  test("checks policy and chat targets without writing either file", () => {
    const paths = createGeneratedCommerceFixture();
    const writeFileSync = jest.spyOn(fs, "writeFileSync");

    try {
      expect(() => syncChatResponses.checkGeneratedCommerceSources(paths)).not.toThrow();
      expect(writeFileSync).not.toHaveBeenCalled();
    } finally {
      writeFileSync.mockRestore();
    }
  });

  test("rejects a stale generated policy target", () => {
    const paths = createGeneratedCommerceFixture({ policyTarget: "stale policy\n" });
    const chatBefore = fs.readFileSync(paths.chatResponsesTargetPath, "utf8");

    expect(() => syncChatResponses.checkGeneratedCommerceSources(paths)).toThrow(
      /commerce policy.*out of date/i,
    );
    expect(fs.readFileSync(paths.commercePolicyTargetPath, "utf8")).toBe("stale policy\n");
    expect(fs.readFileSync(paths.chatResponsesTargetPath, "utf8")).toBe(chatBefore);
  });

  test("updates both generated targets only through the explicit writer", () => {
    const paths = createGeneratedCommerceFixture({
      policyTarget: "stale policy\n",
      chatTarget: "stale chat\n",
    });

    syncChatResponses.writeGeneratedCommerceSources(paths);

    expect(fs.readFileSync(paths.commercePolicyTargetPath, "utf8")).toBe(
      syncChatResponses.buildGeneratedCommercePolicy(paths.commercePolicySource),
    );
    expect(fs.readFileSync(paths.chatResponsesTargetPath, "utf8")).toBe(
      syncChatResponses.buildGeneratedChatResponses(paths.chatResponsesSource),
    );
  });

  test("rolls back the first target when the second generated target rename fails", () => {
    const originalPolicy = "original policy\n";
    const originalChat = "original chat\n";
    const paths = createGeneratedCommerceFixture({
      policyTarget: originalPolicy,
      chatTarget: originalChat,
    });
    const originalRenameSync = fs.renameSync.bind(fs);
    let generatedTargetRenameCount = 0;
    const renameSync = jest.spyOn(fs, "renameSync").mockImplementation((from, to) => {
      if (String(from).endsWith(".tmp")) {
        generatedTargetRenameCount += 1;
        if (generatedTargetRenameCount === 2) {
          throw new Error("injected second generated target rename failure");
        }
      }

      return originalRenameSync(from, to);
    });

    try {
      expect(() => syncChatResponses.writeGeneratedCommerceSources(paths)).toThrow(
        /injected second generated target rename failure/,
      );
    } finally {
      renameSync.mockRestore();
    }

    expect(fs.readFileSync(paths.commercePolicyTargetPath, "utf8")).toBe(originalPolicy);
    expect(fs.readFileSync(paths.chatResponsesTargetPath, "utf8")).toBe(originalChat);
    expect(fs.readdirSync(path.dirname(paths.commercePolicyTargetPath)).sort()).toEqual([
      "chatResponses.ts",
      "commercePolicy.ts",
    ]);
  });
});

describe("chat response sync CLI", () => {
  test.each([
    { label: "the default command", args: [] },
    { label: "--check", args: ["--check"] },
  ])(
    "runs compare-only for $label",
    ({ args }) => {
      const fixture = createCliFixture(
        "export const response = 'new';\n",
        "stale target\n",
      );

      const result = spawnSync(process.execPath, [fixture.copiedScriptPath, ...args], {
        cwd: fixture.temporaryRoot,
        encoding: "utf8",
      });

      expect(result.status).toBe(1);
      expect(`${result.stdout}\n${result.stderr}`).toMatch(/out of date/i);
      expect(fs.readFileSync(fixture.targetPath, "utf8")).toBe("stale target\n");
    },
  );

  test("writes only when --write is explicit", () => {
    const source = "export const response = 'new';\n";
    const fixture = createCliFixture(source, "stale target\n");

    const result = spawnSync(process.execPath, [fixture.copiedScriptPath, "--write"], {
      cwd: fixture.temporaryRoot,
      encoding: "utf8",
    });

    expect(result.status).toBe(0);
    expect(fs.readFileSync(fixture.targetPath, "utf8")).toBe(
      syncChatResponses.buildGeneratedChatResponses(source),
    );
  });
});

test("package quality gates keep sync compare-only and include Rules Emulator tests", () => {
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(repositoryRoot, "package.json"), "utf8"),
  );

  expect(packageJson.scripts["sync:chat-responses"]).toBe(
    "node scripts/sync-chat-responses.js --check",
  );
  expect(packageJson.scripts["sync:chat-responses:write"]).toBe(
    "node scripts/sync-chat-responses.js --write",
  );
  expect(packageJson.scripts["functions:build"]).toBe(
    "npm run sync:chat-responses && cd functions && npm run build",
  );
  expect(packageJson.scripts.ci).toBe(
    "npm run typecheck && npm run lint && npm run test && npm run test:rules && npm run functions:build",
  );
  expect(packageJson.scripts.verify).toBe(
    "npm run typecheck && npm run lint -- --max-warnings=0 && npm run test && npm run test:rules && npm run functions:build && npm run build",
  );
});
