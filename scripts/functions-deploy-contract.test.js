/** @jest-environment node */

const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  verifyFunctionsNextChatBoundary,
} = require('./verify-functions-next-chat-boundary');
const { shouldCopyNextEntry } = require('./copy-next-to-functions');

const repositoryRoot = path.resolve(__dirname, '..');

describe('Firebase Functions deployment contract', () => {
  test('always rebuilds and verifies Next before compiling Functions', () => {
    const firebaseConfig = JSON.parse(
      fs.readFileSync(path.join(repositoryRoot, 'firebase.json'), 'utf8'),
    );
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(repositoryRoot, 'package.json'), 'utf8'),
    );
    const copyScript = fs.readFileSync(
      path.join(repositoryRoot, 'scripts', 'copy-next-to-functions.js'),
      'utf8',
    );

    expect(firebaseConfig.functions[0].predeploy).toEqual([
      'npm --prefix "$RESOURCE_DIR/.." run deploy:prep',
      'npm --prefix "$RESOURCE_DIR/.." run functions:build',
    ]);
    expect(packageJson.scripts['deploy:prep']).toBe(
      'npm run build && node scripts/copy-next-to-functions.js && node scripts/verify-functions-next-chat-boundary.js',
    );
    expect(packageJson.scripts['deploy:firebase']).toBe('npm run verify && firebase deploy');
    expect(packageJson.scripts['deploy:functions']).toBe('firebase deploy --only functions');
    expect(packageJson.scripts['functions:deploy']).toBe('firebase deploy --only functions');
    expect(copyScript).toContain('fs.cpSync(sourceDir, destinationDir, {');
    expect(copyScript).toContain('filter: shouldCopyNextEntry');
  });

  test('copies runtime output while excluding the Next build cache', () => {
    const nextDirectory = path.join(repositoryRoot, '.next');

    expect(shouldCopyNextEntry(nextDirectory)).toBe(true);
    expect(shouldCopyNextEntry(path.join(nextDirectory, 'server', 'app.js'))).toBe(true);
    expect(shouldCopyNextEntry(path.join(nextDirectory, 'cache'))).toBe(false);
    expect(shouldCopyNextEntry(path.join(nextDirectory, 'cache', 'webpack', 'index.pack')))
      .toBe(false);
  });
});

describe('generated Next chat boundary verification', () => {
  let temporaryRoot;

  beforeEach(() => {
    temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hebimall-next-boundary-'));
  });

  afterEach(() => {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  });

  function writeServerBundle(relativePath, content) {
    const filePath = path.join(temporaryRoot, 'server', relativePath);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, 'utf8');
  }

  test('accepts a generated proxy route without direct provider references', () => {
    writeServerBundle(
      path.join('app', 'api', 'chat', 'route.js'),
      'exports.POST = async function proxyChat() { return fetch(process.env.CHAT_API_URL); };',
    );

    expect(() => verifyFunctionsNextChatBoundary(temporaryRoot)).not.toThrow();
  });

  test.each([
    ['provider endpoint', 'fetch("https://api.openai.com/v1/chat/completions")'],
    ['provider key', 'process.env.OPENAI_API_KEY'],
  ])('rejects a generated bundle containing a direct %s', (_name, content) => {
    writeServerBundle(path.join('app', 'api', 'chat', 'route.js'), content);

    expect(() => verifyFunctionsNextChatBoundary(temporaryRoot))
      .toThrow('direct OpenAI reference');
  });

  test('rejects a missing generated chat route', () => {
    fs.mkdirSync(path.join(temporaryRoot, 'server'), { recursive: true });

    expect(() => verifyFunctionsNextChatBoundary(temporaryRoot))
      .toThrow('chat route');
  });
});
