const fs = require('fs');
const path = require('path');

const repositoryRoot = path.resolve(__dirname, '..');
const sourceDir = path.join(repositoryRoot, '.next');
const destinationDir = path.join(repositoryRoot, 'functions', '.next');
const expectedDestinationDir = path.resolve(repositoryRoot, 'functions', '.next');

function shouldCopyNextEntry(entryPath) {
  const relativePath = path.relative(sourceDir, entryPath);
  if (relativePath === 'cache' || relativePath.startsWith(`cache${path.sep}`)) {
    return false;
  }

  return true;
}

function copyNextBuild() {
  if (path.resolve(destinationDir) !== expectedDestinationDir) {
    throw new Error(`Unsafe Next build destination: ${destinationDir}`);
  }

  if (!fs.existsSync(sourceDir)) {
    throw new Error(`Source build directory not found: ${sourceDir}`);
  }

  fs.rmSync(destinationDir, { recursive: true, force: true });
  fs.cpSync(sourceDir, destinationDir, {
    recursive: true,
    filter: shouldCopyNextEntry,
  });

  console.log(`Copied ${sourceDir} -> ${destinationDir} without build cache`);
}

if (require.main === module) {
  try {
    copyNextBuild();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

module.exports = { copyNextBuild, shouldCopyNextEntry };
