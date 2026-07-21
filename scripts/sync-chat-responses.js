const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const defaultCommercePolicySourcePath = path.join(
  rootDir,
  "src",
  "shared",
  "constants",
  "commercePolicy.ts",
);
const defaultCommercePolicyTargetPath = path.join(
  rootDir,
  "functions",
  "src",
  "commercePolicy.ts",
);
const defaultSourcePath = path.join(
  rootDir,
  "src",
  "shared",
  "utils",
  "chatResponses.ts",
);
const defaultTargetPath = path.join(rootDir, "functions", "src", "chatResponses.ts");
const generatedCommercePolicyHeader =
  "// Generated from src/shared/constants/commercePolicy.ts. Run npm run sync:chat-responses:write after editing.\n";
const generatedChatResponsesHeader =
  "// Generated from src/shared/utils/chatResponses.ts. Run npm run sync:chat-responses:write after editing.\n";

function buildGeneratedCommercePolicy(source) {
  return `${generatedCommercePolicyHeader}${source}`;
}

function buildGeneratedChatResponses(source) {
  const functionsSource = source.replace(
    "@/shared/constants/commercePolicy",
    "./commercePolicy",
  );
  return `${generatedChatResponsesHeader}${functionsSource}`;
}

function getGeneratedTargets(paths = {}) {
  return [
    {
      label: "commerce policy",
      sourcePath: paths.commercePolicySourcePath ?? defaultCommercePolicySourcePath,
      targetPath: paths.commercePolicyTargetPath ?? defaultCommercePolicyTargetPath,
      transform: buildGeneratedCommercePolicy,
    },
    {
      label: "chat responses",
      sourcePath: paths.chatResponsesSourcePath ?? defaultSourcePath,
      targetPath: paths.chatResponsesTargetPath ?? defaultTargetPath,
      transform: buildGeneratedChatResponses,
    },
  ];
}

function buildGeneratedTarget(target) {
  return target.transform(fs.readFileSync(target.sourcePath, "utf8"));
}

function checkGeneratedTarget(target) {
  const expected = buildGeneratedTarget(target);

  if (!fs.existsSync(target.targetPath)) {
    throw new Error(
      `Generated ${target.label} are missing: ${target.targetPath}. ` +
        "Run npm run sync:chat-responses:write.",
    );
  }

  if (fs.readFileSync(target.targetPath, "utf8") !== expected) {
    throw new Error(
      `Generated ${target.label} are out of date: ${target.targetPath}. ` +
        "Run npm run sync:chat-responses:write.",
    );
  }

  return true;
}

function checkGeneratedCommerceSources(paths) {
  for (const target of getGeneratedTargets(paths)) {
    checkGeneratedTarget(target);
  }

  return true;
}

function writeGeneratedTargets(targets) {
  const stagedTargets = [];

  try {
    for (const target of targets) {
      const generated = buildGeneratedTarget(target);
      const targetExists = fs.existsSync(target.targetPath);
      if (targetExists && fs.readFileSync(target.targetPath, "utf8") === generated) {
        continue;
      }

      const uniqueSuffix = `${process.pid}.${Date.now()}`;
      const temporaryPath = path.join(
        path.dirname(target.targetPath),
        `.${path.basename(target.targetPath)}.${uniqueSuffix}.tmp`,
      );
      const backupPath = path.join(
        path.dirname(target.targetPath),
        `.${path.basename(target.targetPath)}.${uniqueSuffix}.backup`,
      );
      fs.writeFileSync(temporaryPath, generated, { encoding: "utf8", flag: "wx" });
      stagedTargets.push({
        temporaryPath,
        backupPath,
        targetPath: target.targetPath,
        targetExists,
        backupCreated: false,
        committed: false,
      });
    }
  } catch (error) {
    removeStagedTemporaryFiles(stagedTargets);
    throw error;
  }

  try {
    for (const stagedTarget of stagedTargets) {
      if (stagedTarget.targetExists) {
        fs.renameSync(stagedTarget.targetPath, stagedTarget.backupPath);
        stagedTarget.backupCreated = true;
      }

      fs.renameSync(stagedTarget.temporaryPath, stagedTarget.targetPath);
      stagedTarget.committed = true;
    }
  } catch (error) {
    const rollbackErrors = [];

    for (const stagedTarget of [...stagedTargets].reverse()) {
      try {
        if (stagedTarget.backupCreated) {
          if (fs.existsSync(stagedTarget.targetPath)) {
            fs.rmSync(stagedTarget.targetPath, { force: true });
          }
          fs.renameSync(stagedTarget.backupPath, stagedTarget.targetPath);
          stagedTarget.backupCreated = false;
          stagedTarget.committed = false;
        } else if (stagedTarget.committed && !stagedTarget.targetExists) {
          fs.rmSync(stagedTarget.targetPath, { force: true });
          stagedTarget.committed = false;
        }
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError);
      }
    }

    removeStagedTemporaryFiles(stagedTargets);

    if (rollbackErrors.length > 0) {
      throw new AggregateError(
        [error, ...rollbackErrors],
        "Generated source write failed and rollback was incomplete.",
      );
    }

    throw error;
  }

  for (const stagedTarget of stagedTargets) {
    if (stagedTarget.backupCreated) {
      fs.rmSync(stagedTarget.backupPath, { force: true });
      stagedTarget.backupCreated = false;
    }
  }
}

function removeStagedTemporaryFiles(stagedTargets) {
  for (const stagedTarget of stagedTargets) {
    if (fs.existsSync(stagedTarget.temporaryPath)) {
      fs.rmSync(stagedTarget.temporaryPath, { force: true });
    }
  }
}

function writeGeneratedCommerceSources(paths) {
  writeGeneratedTargets(getGeneratedTargets(paths));
}

function checkChatResponses(sourcePath = defaultSourcePath, targetPath = defaultTargetPath) {
  return checkGeneratedTarget({
    label: "chat responses",
    sourcePath,
    targetPath,
    transform: buildGeneratedChatResponses,
  });
}

function writeChatResponses(sourcePath = defaultSourcePath, targetPath = defaultTargetPath) {
  writeGeneratedTargets([{
    label: "chat responses",
    sourcePath,
    targetPath,
    transform: buildGeneratedChatResponses,
  }]);
}

function main(argv = process.argv.slice(2)) {
  const [command = "--check", ...extraArguments] = argv;

  if (extraArguments.length > 0 || !["--check", "--write"].includes(command)) {
    throw new Error(
      "Usage: node scripts/sync-chat-responses.js [--check|--write]",
    );
  }

  if (command === "--write") {
    writeGeneratedCommerceSources();
    console.log("Generated commerce sources updated.");
    return;
  }

  checkGeneratedCommerceSources();
  console.log("Generated commerce sources are up to date.");
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

module.exports = {
  buildGeneratedCommercePolicy,
  buildGeneratedChatResponses,
  checkGeneratedCommerceSources,
  writeGeneratedCommerceSources,
  checkChatResponses,
  writeChatResponses,
};
