const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const manifest = require('./event-editorial-image-manifest.json');
const sourceManifest = require('./event-image-refresh-manifest.json');

const EDITORIAL_ROLES = Object.freeze(['benefit', 'styling', 'product']);
const TARGET = Object.freeze({ width: 1000, height: 1500 });
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const PROMPT_TEXT_CONSTRAINTS = Object.freeze([
  '이미지 내 텍스트는 Text (verbatim)의 문구만 사용',
  '그 외 한글·영문·의미 없는 문구 금지',
  '타사 브랜드·로고·워터마크 금지',
]);
const CONTRADICTORY_TEXT_PERMISSION =
  /(?:Text \(verbatim\).{0,40}외|추가|그 외).{0,40}(?:문구|텍스트|한글|영문|카피).{0,40}(?:허용|사용 가능|표시 가능)|(?:문구|텍스트|한글|영문|카피).{0,40}(?:추가 허용|사용 가능|표시 가능)/u;
const CONTRADICTORY_BRAND_PERMISSION =
  /(?:타사 브랜드|로고|워터마크).{0,30}(?:허용|사용 가능|표시 가능)/u;
const VERTICAL_DETAIL_CONSTRAINTS = Object.freeze([
  '세로 2:3',
  '단일 포스터 금지',
  '위에서 아래로 자연스럽게 이어지는 사진 장면 2~3개',
  '사진 장면 3개 이하',
  '제목 포함 한글 카피 4개 이하',
  '가로 중앙 안전 영역 88%',
]);
const ROLE_VERTICAL_FLOWS = Object.freeze({
  benefit: Object.freeze([
    '상단 캠페인 오프닝',
    '중단 핵심 혜택',
    '하단 기간/참여 안내',
  ]),
  styling: Object.freeze([
    '상단 전신 룩',
    '중단 스타일 조합',
    '하단 소재 디테일',
  ]),
  product: Object.freeze([
    '상단 제품 정물',
    '중단 소재 클로즈업',
    '하단 추천 상품 연결',
  ]),
});
const EXCESSIVE_SCENE_INSTRUCTION = /사진 장면 (?:[4-9]|[1-9]\d+)개/u;
const CONTRADICTORY_LANDSCAPE_INSTRUCTION =
  /16:9|중앙 안전 영역 80%|가로로 배열|반신 장면/u;
const DEFAULT_CONTACT_SHEET_DIRECTORY = path.resolve(
  'tmp/event-editorial-images/contact-sheets',
);
const ROLE_SHEET_LAYOUT = Object.freeze({
  columns: 5,
  thumbnailWidth: 200,
  thumbnailHeight: 300,
});
const EVENT_STRIP_LAYOUT = Object.freeze({
  columns: 3,
  thumbnailWidth: 200,
  thumbnailHeight: 300,
});

function assertRole(role) {
  if (!EDITORIAL_ROLES.includes(role)) {
    throw new Error(`지원하지 않는 에디토리얼 역할입니다: ${role}`);
  }
}

function getRawPath(event, role) {
  assertRole(role);
  return path.resolve(`tmp/event-editorial-images/raw/${event.id}-${role}.png`);
}

function getOutputPath(image) {
  return path.resolve(image.output);
}

function validateManifestContract(input) {
  if (!Array.isArray(input?.events) || input.events.length !== 22) {
    throw new Error('이벤트 22개가 필요합니다.');
  }
  if (
    input.target?.width !== TARGET.width ||
    input.target?.height !== TARGET.height
  ) {
    throw new Error('이미지 규격이 매니페스트 계약과 일치하지 않습니다.');
  }

  for (const [index, event] of input.events.entries()) {
    const source = sourceManifest.events[index];
    if (
      event.id !== source?.id ||
      event.title !== source.title ||
      event.benefit !== source.benefit ||
      event.referenceImage !== source.wideOutput
    ) {
      throw new Error('원본 이벤트 매니페스트와 캠페인 정보가 일치하지 않습니다.');
    }
    if (
      typeof event.campaignCommand !== 'string' ||
      !event.campaignCommand.includes(source.palette)
    ) {
      throw new Error('캠페인 명령어에 원본 팔레트가 필요합니다.');
    }

    const roles = event.images?.map((image) => image.role);
    if (
      !Array.isArray(event.images) ||
      roles.length !== EDITORIAL_ROLES.length ||
      roles.some((role, roleIndex) => role !== EDITORIAL_ROLES[roleIndex])
    ) {
      throw new Error(
        '이미지 역할 순서는 benefit, styling, product여야 합니다.',
      );
    }
  }

  const images = input.events.flatMap((event) => event.images);
  const outputs = images.map((image) => image.output);
  if (
    images.length !== 66 ||
    outputs.some(
      (output) =>
        typeof output !== 'string' ||
        output.length === 0 ||
        path.extname(output).toLowerCase() !== '.webp',
    ) ||
    new Set(outputs.map((output) => path.resolve(output))).size !== 66
  ) {
    throw new Error('서로 다른 출력 경로 66개가 필요합니다.');
  }

  for (const event of input.events) {
    for (const image of event.images) {
      const expectedOutput =
        `public/events/2026-editorial/${event.id}-20260715-${image.role}.webp`;
      if (image.output !== expectedOutput) {
        throw new Error('에디토리얼 출력 경로가 계약과 일치하지 않습니다.');
      }
    }
  }

  for (const event of input.events) {
    for (const image of event.images) {
      const hasRequiredKorean =
        typeof image.prompt === 'string' &&
        /[가-힣]/.test(image.prompt) &&
        image.prompt.includes(`"${event.title}"`) &&
        image.story?.texts?.includes(event.title) &&
        image.prompt.includes('정확한 한글') &&
        image.prompt.includes('로고') &&
        image.prompt.includes('워터마크') &&
        image.prompt.includes('없음');
      const hasBenefit =
        image.role !== 'benefit' || image.prompt.includes(event.benefit);
      if (!hasRequiredKorean || !hasBenefit) {
        throw new Error('프롬프트 한글 계약이 올바르지 않습니다.');
      }
      if (
        PROMPT_TEXT_CONSTRAINTS.some(
          (constraint) => !image.prompt.includes(constraint),
        ) ||
        CONTRADICTORY_TEXT_PERMISSION.test(image.prompt) ||
        CONTRADICTORY_BRAND_PERMISSION.test(image.prompt)
      ) {
        throw new Error('프롬프트 텍스트 제한 계약이 올바르지 않습니다.');
      }
      const verbatimLine = image.prompt
        .split('\n')
        .find((line) => line.startsWith('Text (verbatim):'));
      const copyCount = verbatimLine?.match(/"[^"]+"/g)?.length ?? 0;
      const storyTexts = image.story?.texts;
      const hasStoryContract =
        typeof image.story?.purpose === 'string' &&
        image.story.purpose.length > 0 &&
        Array.isArray(image.story?.scenes) &&
        image.story.scenes.length === 3 &&
        Array.isArray(storyTexts) &&
        storyTexts.length >= 3 &&
        storyTexts.length <= 4 &&
        storyTexts.every(
          (text) =>
            typeof text === 'string' &&
            text.length > 0 &&
            image.prompt.includes(`"${text}"`),
        ) &&
        image.prompt.includes(`Section purpose: ${image.story.purpose}`) &&
        image.prompt.includes(
          '이전 이미지와 동일한 구도나 같은 모델 클로즈업을 반복하지 않는다',
        );
      if (
        !hasStoryContract ||
        !image.prompt.includes('세로 콘텐츠') ||
        VERTICAL_DETAIL_CONSTRAINTS.some(
          (constraint) => !image.prompt.includes(constraint),
        ) ||
        ROLE_VERTICAL_FLOWS[image.role].some(
          (flow) => !image.prompt.includes(flow),
        ) ||
        copyCount < 1 ||
        copyCount > 4 ||
        EXCESSIVE_SCENE_INSTRUCTION.test(image.prompt) ||
        CONTRADICTORY_LANDSCAPE_INSTRUCTION.test(image.prompt)
      ) {
        throw new Error('프롬프트 세로 상세 계약이 올바르지 않습니다.');
      }
    }

    const eventSpecificTexts = event.images.flatMap((image) =>
      image.story.texts.filter((text) => text !== event.title),
    );
    if (new Set(eventSpecificTexts).size < 6) {
      throw new Error('이벤트별 에디토리얼 문구가 충분히 다르지 않습니다.');
    }
  }

  return input;
}

async function normalizeAsset(event, image) {
  assertRole(image.role);
  const output = getOutputPath(image);
  fs.mkdirSync(path.dirname(output), { recursive: true });

  await sharp(getRawPath(event, image.role))
    .resize(TARGET.width, TARGET.height, { fit: 'cover', position: 'centre' })
    .webp({ quality: 88 })
    .toFile(output);

  return output;
}

async function normalizeAssets(input = manifest) {
  validateManifestContract(input);
  const outputs = [];

  for (const event of input.events) {
    for (const image of event.images) {
      outputs.push(await normalizeAsset(event, image));
    }
  }

  return outputs;
}

async function validateAsset(event, image) {
  assertRole(image.role);
  const output = getOutputPath(image);
  const stats = fs.statSync(output);

  if (stats.size >= MAX_FILE_SIZE) {
    throw new Error(`${output}: 파일 크기는 5MB 미만이어야 합니다.`);
  }

  const metadata = await sharp(output).metadata();
  if (metadata.format !== 'webp') {
    throw new Error(`${output}: WebP 형식이어야 합니다.`);
  }
  if (metadata.width !== TARGET.width || metadata.height !== TARGET.height) {
    throw new Error(
      `${output}: ${TARGET.width}x${TARGET.height} 크기여야 합니다.`,
    );
  }

  return {
    eventId: event.id,
    role: image.role,
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
    for (const image of event.images) {
      results.push(await validateAsset(event, image));
    }
  }

  return results;
}

async function buildSheet(items, layout, output) {
  const rows = Math.ceil(items.length / layout.columns);
  const composites = [];

  for (const [index, item] of items.entries()) {
    const input = await sharp(item.path)
      .resize(layout.thumbnailWidth, layout.thumbnailHeight, { fit: 'cover' })
      .toBuffer();
    composites.push({
      input,
      left: (index % layout.columns) * layout.thumbnailWidth,
      top: Math.floor(index / layout.columns) * layout.thumbnailHeight,
    });
  }

  fs.mkdirSync(path.dirname(output), { recursive: true });
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
  const roles = {};
  const eventStrips = {};

  for (const role of EDITORIAL_ROLES) {
    const items = events.map((event) => ({
      path: getOutputPath(
        event.images.find((image) => image.role === role),
      ),
    }));
    roles[role] = await buildSheet(
      items,
      ROLE_SHEET_LAYOUT,
      path.join(outputDirectory, `${role}-contact-sheet.webp`),
    );
  }

  for (const event of events) {
    const items = event.images.map((image) => ({ path: getOutputPath(image) }));
    eventStrips[event.id] = await buildSheet(
      items,
      EVENT_STRIP_LAYOUT,
      path.join(outputDirectory, 'events', `${event.id}-strip.webp`),
    );
  }

  return {
    roles,
    events: eventStrips,
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
  EDITORIAL_ROLES,
  TARGET,
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
