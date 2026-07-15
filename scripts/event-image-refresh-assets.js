const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const manifest = require('./event-image-refresh-manifest.json');

const FORMATS = Object.freeze({
  wide: Object.freeze({ width: 1600, height: 820 }),
  card: Object.freeze({ width: 1000, height: 1250 }),
});
const FORMAT_NAMES = Object.freeze(Object.keys(FORMATS));
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const DEFAULT_CONTACT_SHEET_DIRECTORY = path.resolve(
  'tmp/event-image-refresh/contact-sheets',
);
const CONTACT_SHEET_LAYOUTS = Object.freeze({
  wide: Object.freeze({ columns: 4, thumbnailWidth: 320, thumbnailHeight: 164 }),
  card: Object.freeze({ columns: 5, thumbnailWidth: 200, thumbnailHeight: 250 }),
});

function assertFormat(format) {
  if (!FORMAT_NAMES.includes(format)) {
    throw new Error(`지원하지 않는 이미지 형식입니다: ${format}`);
  }
}

function getRawPath(event, format) {
  assertFormat(format);
  return path.resolve(`tmp/event-image-refresh/raw/${event.id}-${format}.png`);
}

function getOutputPath(event, format) {
  assertFormat(format);
  return path.resolve(format === 'wide' ? event.wideOutput : event.cardOutput);
}

function validateManifestContract(input) {
  if (!Array.isArray(input?.events) || input.events.length !== 22) {
    throw new Error('이벤트 22개가 필요합니다.');
  }

  if (
    FORMAT_NAMES.some(
      (format) =>
        input.formats?.[format]?.width !== FORMATS[format].width ||
        input.formats?.[format]?.height !== FORMATS[format].height,
    )
  ) {
    throw new Error('이미지 규격이 매니페스트 계약과 일치하지 않습니다.');
  }

  const eventIds = input.events.map((event) => event.id);
  if (eventIds.some((id) => typeof id !== 'string' || id.length === 0)) {
    throw new Error('모든 이벤트에 ID가 필요합니다.');
  }
  if (new Set(eventIds).size !== 22) {
    throw new Error('서로 다른 이벤트 ID 22개가 필요합니다.');
  }

  const outputs = input.events.flatMap((event) => [event.wideOutput, event.cardOutput]);
  if (
    outputs.some((output) => typeof output !== 'string' || output.length === 0) ||
    new Set(outputs.map((output) => path.resolve(output))).size !== 44
  ) {
    throw new Error('서로 다른 출력 경로 44개가 필요합니다.');
  }

  return input;
}

async function normalizeAsset(event, format) {
  assertFormat(format);
  const target = FORMATS[format];
  const output = getOutputPath(event, format);
  fs.mkdirSync(path.dirname(output), { recursive: true });

  await sharp(getRawPath(event, format))
    .resize(target.width, target.height, { fit: 'cover', position: 'centre' })
    .webp({ quality: 86 })
    .toFile(output);

  return output;
}

async function normalizeAssets(input = manifest) {
  validateManifestContract(input);
  const outputs = [];

  for (const event of input.events) {
    for (const format of FORMAT_NAMES) {
      outputs.push(await normalizeAsset(event, format));
    }
  }

  return outputs;
}

async function validateAsset(event, format) {
  assertFormat(format);
  const target = FORMATS[format];
  const output = getOutputPath(event, format);
  const stats = fs.statSync(output);

  if (stats.size >= MAX_FILE_SIZE) {
    throw new Error(`${output}: 파일 크기는 5MB 미만이어야 합니다.`);
  }

  const metadata = await sharp(output).metadata();
  if (metadata.format !== 'webp') {
    throw new Error(`${output}: WebP 형식이어야 합니다.`);
  }
  if (metadata.width !== target.width || metadata.height !== target.height) {
    throw new Error(
      `${output}: ${target.width}x${target.height} 크기여야 합니다.`,
    );
  }

  return {
    path: output,
    format: metadata.format,
    width: metadata.width,
    height: metadata.height,
    size: stats.size,
  };
}

async function validateAssets(input = manifest) {
  validateManifestContract(input);
  const results = [];

  for (const event of input.events) {
    for (const format of FORMAT_NAMES) {
      results.push(await validateAsset(event, format));
    }
  }

  return results;
}

async function buildContactSheet(events, format, outputDirectory) {
  const layout = CONTACT_SHEET_LAYOUTS[format];
  const rows = Math.ceil(events.length / layout.columns);
  const composites = [];

  for (const [index, event] of events.entries()) {
    const input = await sharp(getOutputPath(event, format))
      .resize(layout.thumbnailWidth, layout.thumbnailHeight, { fit: 'cover' })
      .toBuffer();
    composites.push({
      input,
      left: (index % layout.columns) * layout.thumbnailWidth,
      top: Math.floor(index / layout.columns) * layout.thumbnailHeight,
    });
  }

  fs.mkdirSync(outputDirectory, { recursive: true });
  const output = path.join(outputDirectory, `${format}-contact-sheet.webp`);
  await sharp({
    create: {
      width: layout.columns * layout.thumbnailWidth,
      height: rows * layout.thumbnailHeight,
      channels: 3,
      background: '#ffffff',
    },
  })
    .composite(composites)
    .webp({ quality: 82 })
    .toFile(output);

  return output;
}

async function buildContactSheets(
  input = manifest,
  { outputDirectory = DEFAULT_CONTACT_SHEET_DIRECTORY } = {},
) {
  validateManifestContract(input);
  const events = [...input.events].sort((left, right) =>
    left.id.localeCompare(right.id),
  );
  const wide = await buildContactSheet(events, 'wide', outputDirectory);
  const card = await buildContactSheet(events, 'card', outputDirectory);

  return {
    wide,
    card,
    eventIds: events.map((event) => event.id),
  };
}

async function runCli(command) {
  if (command === 'normalize') {
    return normalizeAssets();
  }
  if (command === 'validate') {
    return validateAssets();
  }
  if (command === 'contact-sheet') {
    return buildContactSheets();
  }
  throw new Error(`지원하지 않는 명령입니다: ${command}`);
}

if (require.main === module) {
  runCli(process.argv[2])
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
    })
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}

module.exports = {
  FORMATS,
  getRawPath,
  getOutputPath,
  validateManifestContract,
  normalizeAsset,
  normalizeAssets,
  validateAsset,
  validateAssets,
  buildContactSheets,
  runCli,
};
