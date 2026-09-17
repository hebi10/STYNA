const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');

function exists(relativePath) {
  return fs.existsSync(path.join(repoRoot, relativePath));
}

describe('repository hygiene', () => {
  test.each([
    '.next-dev.log',
    '.next-dev.err.log',
    '.playwright-cli',
    'artifacts',
    'constants/api.ts',
  ])('%s is not tracked as a repository artifact', (relativePath) => {
    expect(exists(relativePath)).toBe(false);
  });

  test('package metadata uses the STYNA project name', () => {
    const packageJson = require('../package.json');
    expect(packageJson.name).toBe('styna');
  });
});
