const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

sharp.cache(false);

const {
  FORMATS,
  getRawPath,
  getOutputPath,
  validateManifestContract,
  normalizeAsset,
  validateAsset,
  buildContactSheets,
  runCli,
} = require('./event-image-refresh-assets');

const temporaryDirectories = [];
const temporaryRawPaths = [];

function createTemporaryDirectory() {
  const parent = path.resolve('tmp/event-image-refresh/tests');
  fs.mkdirSync(parent, { recursive: true });
  const directory = fs.mkdtempSync(path.join(parent, 'assets-'));
  temporaryDirectories.push(directory);
  return directory;
}

function createManifest(directory) {
  return {
    version: '20260714',
    formats: FORMATS,
    events: Array.from({ length: 22 }, (_, index) => {
      const id = `event-${String(22 - index).padStart(2, '0')}`;
      return {
        id,
        wideOutput: path.join(directory, `${id}-wide.webp`),
        cardOutput: path.join(directory, `${id}-card.webp`),
      };
    }),
  };
}

afterEach(() => {
  for (const rawPath of temporaryRawPaths.splice(0)) {
    fs.rmSync(rawPath, { force: true });
  }
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 50,
    });
  }
});

test('builds deterministic raw and output paths', () => {
  const event = {
    id: 'event-1',
    wideOutput: 'public/events/2026-v2/event-1-wide.webp',
    cardOutput: 'public/events/2026-v2/event-1-card.webp',
  };

  expect(getRawPath(event, 'wide')).toBe(
    path.resolve('tmp/event-image-refresh/raw/event-1-wide.png'),
  );
  expect(getOutputPath(event, 'card')).toBe(
    path.resolve('public/events/2026-v2/event-1-card.webp'),
  );
});

test('requires exactly 22 events and 44 unique outputs', () => {
  expect(() => validateManifestContract({ events: [] })).toThrow(
    '이벤트 22개가 필요합니다.',
  );

  const manifest = createManifest(createTemporaryDirectory());
  manifest.events[1].wideOutput = manifest.events[0].wideOutput;
  expect(() => validateManifestContract(manifest)).toThrow(
    '서로 다른 출력 경로 44개가 필요합니다.',
  );
});

test('normalizes a PNG to the exact WebP dimensions', async () => {
  const directory = createTemporaryDirectory();
  const event = {
    id: `test-${process.pid}-${Date.now()}`,
    wideOutput: path.join(directory, 'normalized-wide.webp'),
    cardOutput: path.join(directory, 'normalized-card.webp'),
  };
  const rawPath = getRawPath(event, 'wide');
  temporaryRawPaths.push(rawPath);
  fs.mkdirSync(path.dirname(rawPath), { recursive: true });
  await sharp({
    create: { width: 80, height: 80, channels: 3, background: '#336699' },
  })
    .png()
    .toFile(rawPath);

  await normalizeAsset(event, 'wide');

  const metadata = await sharp(getOutputPath(event, 'wide')).metadata();
  expect(metadata).toMatchObject({ format: 'webp', width: 1600, height: 820 });
});

test('rejects an output with the wrong image format', async () => {
  const directory = createTemporaryDirectory();
  const event = {
    id: 'invalid-output',
    wideOutput: path.join(directory, 'invalid-wide.webp'),
    cardOutput: path.join(directory, 'invalid-card.webp'),
  };
  await sharp({
    create: { width: 20, height: 30, channels: 3, background: '#ffffff' },
  })
    .png()
    .toFile(event.wideOutput);

  await expect(validateAsset(event, 'wide')).rejects.toThrow(
    'WebP 형식이어야 합니다.',
  );
});

test('rejects an output with the wrong dimensions', async () => {
  const directory = createTemporaryDirectory();
  const event = {
    id: 'invalid-dimensions',
    wideOutput: path.join(directory, 'invalid-wide.webp'),
    cardOutput: path.join(directory, 'invalid-card.webp'),
  };
  await sharp({
    create: { width: 20, height: 30, channels: 3, background: '#ffffff' },
  })
    .webp()
    .toFile(event.wideOutput);

  await expect(validateAsset(event, 'wide')).rejects.toThrow(
    '1600x820 크기여야 합니다.',
  );
});

test('rejects an output that is 5MB or larger', async () => {
  const directory = createTemporaryDirectory();
  const event = {
    id: 'oversized-output',
    wideOutput: path.join(directory, 'oversized-wide.webp'),
    cardOutput: path.join(directory, 'oversized-card.webp'),
  };
  fs.writeFileSync(event.wideOutput, Buffer.alloc(5 * 1024 * 1024));

  await expect(validateAsset(event, 'wide')).rejects.toThrow(
    '파일 크기는 5MB 미만이어야 합니다.',
  );
});

test('builds separate contact sheets in event ID order', async () => {
  const directory = createTemporaryDirectory();
  const manifest = createManifest(directory);
  const source = await sharp({
    create: { width: 2, height: 2, channels: 3, background: '#224466' },
  })
    .webp()
    .toBuffer();

  for (const event of manifest.events) {
    fs.writeFileSync(event.wideOutput, source);
    fs.writeFileSync(event.cardOutput, source);
  }

  const result = await buildContactSheets(manifest, {
    outputDirectory: path.join(directory, 'contact-sheets'),
  });

  expect(result.eventIds).toEqual(
    manifest.events.map((event) => event.id).sort((a, b) => a.localeCompare(b)),
  );
  await expect(sharp(result.wide).metadata()).resolves.toMatchObject({ format: 'webp' });
  await expect(sharp(result.card).metadata()).resolves.toMatchObject({ format: 'webp' });
});

test('allows only the three documented CLI commands', async () => {
  await expect(runCli('unknown')).rejects.toThrow(
    '지원하지 않는 명령입니다: unknown',
  );
});
