const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

sharp.cache(false);

const sourceManifest = require('./event-image-refresh-manifest.json');
const manifest = require('./event-editorial-image-manifest.json');
const {
  EDITORIAL_ROLES,
  TARGET,
  getRawPath,
  getOutputPath,
  validateManifestContract,
  normalizeAsset,
  validateAsset,
  buildContactSheets,
  runCli,
} = require('./event-editorial-image-assets');

const temporaryDirectories = [];
const temporaryRawPaths = [];
const workspaceDirectory = process.cwd();
const TEXT_ONLY_CONSTRAINTS = Object.freeze([
  '이미지 내 텍스트는 Text (verbatim)의 문구만 사용',
  '그 외 한글·영문·의미 없는 문구 금지',
  '타사 브랜드·로고·워터마크 금지',
]);
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

function createTemporaryDirectory() {
  const parent = path.resolve('tmp/event-editorial-images/tests');
  fs.mkdirSync(parent, { recursive: true });
  const directory = fs.mkdtempSync(path.join(parent, 'assets-'));
  temporaryDirectories.push(directory);
  return directory;
}

function createManifest() {
  return JSON.parse(JSON.stringify(manifest));
}

afterEach(() => {
  process.chdir(workspaceDirectory);
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

test('defines 22 source-aligned campaigns and 66 role images', () => {
  expect(manifest.events).toHaveLength(22);
  expect(manifest.events.flatMap((event) => event.images)).toHaveLength(66);
  expect(EDITORIAL_ROLES).toEqual(['benefit', 'styling', 'product']);
  expect(TARGET).toEqual({ width: 1000, height: 1500 });
  expect(manifest.target).toEqual(TARGET);

  const outputs = manifest.events.flatMap((event) =>
    event.images.map((image) => image.output),
  );
  expect(new Set(outputs).size).toBe(66);

  for (const [index, event] of manifest.events.entries()) {
    const source = sourceManifest.events[index];
    expect(event).toMatchObject({
      id: source.id,
      title: source.title,
      benefit: source.benefit,
      referenceImage: source.wideOutput,
    });
    expect(event.campaignCommand).toContain(source.palette);
    expect(event.images.map((image) => image.role)).toEqual(EDITORIAL_ROLES);

    for (const image of event.images) {
      expect(image.prompt).toContain(`"${event.title}"`);
      expect(image.prompt).toContain('정확한 한글');
      expect(image.prompt).toContain('로고');
      expect(image.prompt).toContain('워터마크');
      expect(image.prompt).toContain('없음');
      for (const constraint of TEXT_ONLY_CONSTRAINTS) {
        expect(image.prompt).toContain(constraint);
      }
      for (const constraint of VERTICAL_DETAIL_CONSTRAINTS) {
        expect(image.prompt).toContain(constraint);
      }
      expect(image.prompt).not.toContain('16:9');
      expect(image.prompt).not.toContain('중앙 안전 영역 80%');
      for (const flow of ROLE_VERTICAL_FLOWS[image.role]) {
        expect(image.prompt).toContain(flow);
      }
      expect(image.prompt).toContain('세로 콘텐츠');
      expect(image.prompt).toContain('Section purpose:');
      expect(image.prompt).toContain(
        '이전 이미지와 동일한 구도나 같은 모델 클로즈업을 반복하지 않는다',
      );
      expect(image.story.purpose).toBeTruthy();
      expect(image.story.scenes).toHaveLength(3);
      expect(image.story.texts).toContain(event.title);
      expect(image.story.texts.length).toBeGreaterThanOrEqual(3);
      expect(image.story.texts.length).toBeLessThanOrEqual(4);
      for (const text of image.story.texts) {
        expect(image.prompt).toContain(`"${text}"`);
      }
      const verbatimLine = image.prompt
        .split('\n')
        .find((line) => line.startsWith('Text (verbatim):'));
      const copyCount = verbatimLine.match(/"[^"]+"/g)?.length ?? 0;
      expect(copyCount).toBeGreaterThanOrEqual(3);
      expect(copyCount).toBeLessThanOrEqual(4);
      expect(image.output).toBe(
        `public/events/2026-editorial/${event.id}-20260715-${image.role}.webp`,
      );
    }

    const eventSpecificTexts = event.images.flatMap((image) =>
      image.story.texts.filter((text) => text !== event.title),
    );
    expect(new Set(eventSpecificTexts).size).toBeGreaterThanOrEqual(6);
  }

  expect(() => validateManifestContract(manifest)).not.toThrow();
});

test('rejects missing vertical detail instructions, role flow, or excessive copy', () => {
  for (const constraint of VERTICAL_DETAIL_CONSTRAINTS) {
    const missingConstraint = createManifest();
    missingConstraint.events[0].images[0].prompt =
      missingConstraint.events[0].images[0].prompt.replace(constraint, '');
    expect(() => validateManifestContract(missingConstraint)).toThrow(
      '프롬프트 세로 상세 계약이 올바르지 않습니다.',
    );
  }

  const missingRoleFlow = createManifest();
  missingRoleFlow.events[0].images[1].prompt =
    missingRoleFlow.events[0].images[1].prompt.replace('중단 스타일 조합', '');
  expect(() => validateManifestContract(missingRoleFlow)).toThrow(
    '프롬프트 세로 상세 계약이 올바르지 않습니다.',
  );

  const missingStoryPurpose = createManifest();
  missingStoryPurpose.events[0].images[0].story.purpose = '';
  expect(() => validateManifestContract(missingStoryPurpose)).toThrow(
    '프롬프트 세로 상세 계약이 올바르지 않습니다.',
  );

  const tooFewStoryTexts = createManifest();
  tooFewStoryTexts.events[0].images[0].story.texts = ['윈터 레이어링 세일'];
  expect(() => validateManifestContract(tooFewStoryTexts)).toThrow(
    '프롬프트 세로 상세 계약이 올바르지 않습니다.',
  );

  const excessiveCopy = createManifest();
  excessiveCopy.events[0].images[2].prompt =
    excessiveCopy.events[0].images[2].prompt.replace(
      '"퀼팅 패딩"',
      '"퀼팅 패딩", "추가 카피 하나", "추가 카피 둘", "추가 카피 셋"',
    );
  expect(() => validateManifestContract(excessiveCopy)).toThrow(
    '프롬프트 세로 상세 계약이 올바르지 않습니다.',
  );

  const excessiveScenes = createManifest();
  excessiveScenes.events[0].images[0].prompt +=
    '\nAdditional instruction: 사진 장면 4개로 구성';
  expect(() => validateManifestContract(excessiveScenes)).toThrow(
    '프롬프트 세로 상세 계약이 올바르지 않습니다.',
  );

  const contradictoryAspectRatio = createManifest();
  contradictoryAspectRatio.events[0].images[0].prompt +=
    '\nAdditional instruction: 16:9 가로 포스터로 구성';
  expect(() => validateManifestContract(contradictoryAspectRatio)).toThrow(
    '프롬프트 세로 상세 계약이 올바르지 않습니다.',
  );

  const contradictoryFullLook = createManifest();
  contradictoryFullLook.events[0].images[1].prompt =
    contradictoryFullLook.events[0].images[1].prompt.replace(
      '전신 워킹 룩',
      '반신 장면',
    );
  expect(() => validateManifestContract(contradictoryFullLook)).toThrow(
    '프롬프트 세로 상세 계약이 올바르지 않습니다.',
  );

  const contradictoryVerticalFlow = createManifest();
  contradictoryVerticalFlow.events[0].images[1].prompt +=
    '\nAdditional instruction: 세로 스냅 세 장을 가로로 배열';
  expect(() => validateManifestContract(contradictoryVerticalFlow)).toThrow(
    '프롬프트 세로 상세 계약이 올바르지 않습니다.',
  );
});

test('rejects an invalid event count, role order, duplicate output, or Korean prompt contract', () => {
  expect(() => validateManifestContract({ ...manifest, events: [] })).toThrow(
    '이벤트 22개가 필요합니다.',
  );

  const wrongRoleOrder = createManifest();
  wrongRoleOrder.events[0].images.reverse();
  expect(() => validateManifestContract(wrongRoleOrder)).toThrow(
    '이미지 역할 순서는 benefit, styling, product여야 합니다.',
  );

  const duplicateOutput = createManifest();
  duplicateOutput.events[0].images[1].output =
    duplicateOutput.events[0].images[0].output;
  expect(() => validateManifestContract(duplicateOutput)).toThrow(
    '서로 다른 출력 경로 66개가 필요합니다.',
  );

  const invalidPrompt = createManifest();
  invalidPrompt.events[0].images[0].prompt = '행사명이 없는 프롬프트';
  expect(() => validateManifestContract(invalidPrompt)).toThrow(
    '프롬프트 한글 계약이 올바르지 않습니다.',
  );
});

test('rejects prompts missing the text-only contract or contradicting it', () => {
  const missingConstraint = createManifest();
  missingConstraint.events[0].images[0].prompt =
    missingConstraint.events[0].images[0].prompt.replace(
      TEXT_ONLY_CONSTRAINTS[0],
      '',
    );
  expect(() => validateManifestContract(missingConstraint)).toThrow(
    '프롬프트 텍스트 제한 계약이 올바르지 않습니다.',
  );

  const contradictoryPrompt = createManifest();
  contradictoryPrompt.events[0].images[0].prompt +=
    '\nAdditional instruction: Text (verbatim) 외 영문 카피 추가 허용';
  expect(() => validateManifestContract(contradictoryPrompt)).toThrow(
    '프롬프트 텍스트 제한 계약이 올바르지 않습니다.',
  );
});

test('rejects outputs outside the dedicated versioned editorial path', () => {
  const legacyOutput = createManifest();
  legacyOutput.events[0].images[0].output =
    'public/events/2026-v2/event-2026-01-layering-sale-benefit.webp';
  expect(() => validateManifestContract(legacyOutput)).toThrow(
    '에디토리얼 출력 경로가 계약과 일치하지 않습니다.',
  );

  const wrongEditorialName = createManifest();
  wrongEditorialName.events[0].images[0].output =
    'public/events/2026-editorial/unrelated-20260715-benefit.webp';
  expect(() => validateManifestContract(wrongEditorialName)).toThrow(
    '에디토리얼 출력 경로가 계약과 일치하지 않습니다.',
  );
});

test('builds deterministic raw and output paths', () => {
  const event = { id: 'event-1' };
  const image = {
    role: 'product',
    output: 'public/events/2026-editorial/event-1-20260715-product.webp',
  };

  expect(getRawPath(event, 'benefit')).toBe(
    path.resolve('tmp/event-editorial-images/raw/event-1-benefit.png'),
  );
  expect(getOutputPath(image)).toBe(path.resolve(image.output));
  expect(() => getRawPath(event, 'unknown')).toThrow(
    '지원하지 않는 에디토리얼 역할입니다: unknown',
  );
});

test('normalizes a PNG to an exact 1000x1500 WebP', async () => {
  const directory = createTemporaryDirectory();
  const event = { id: `test-${process.pid}-${Date.now()}` };
  const image = {
    role: 'benefit',
    output: path.join(directory, 'normalized-benefit.webp'),
  };
  const rawPath = getRawPath(event, image.role);
  temporaryRawPaths.push(rawPath);
  fs.mkdirSync(path.dirname(rawPath), { recursive: true });
  await sharp({
    create: { width: 80, height: 60, channels: 3, background: '#336699' },
  })
    .png()
    .toFile(rawPath);

  await normalizeAsset(event, image);

  const metadata = await sharp(getOutputPath(image)).metadata();
  expect(metadata).toMatchObject({ format: 'webp', ...TARGET });
});

test('rejects an output with the wrong image format', async () => {
  const directory = createTemporaryDirectory();
  const event = { id: 'invalid-output' };
  const image = {
    role: 'product',
    output: path.join(directory, 'invalid-product.webp'),
  };
  await sharp({
    create: { width: 1000, height: 1500, channels: 3, background: '#ffffff' },
  })
    .png()
    .toFile(image.output);

  await expect(validateAsset(event, image)).rejects.toThrow(
    'WebP 형식이어야 합니다.',
  );
});

test('rejects an output with the wrong dimensions', async () => {
  const directory = createTemporaryDirectory();
  const event = { id: 'invalid-dimensions' };
  const image = {
    role: 'styling',
    output: path.join(directory, 'invalid-styling.webp'),
  };
  await sharp({
    create: { width: 20, height: 30, channels: 3, background: '#ffffff' },
  })
    .webp()
    .toFile(image.output);

  await expect(validateAsset(event, image)).rejects.toThrow(
    '1000x1500 크기여야 합니다.',
  );
});

test('rejects an output that is 5MB or larger', async () => {
  const directory = createTemporaryDirectory();
  const event = { id: 'oversized-output' };
  const image = {
    role: 'benefit',
    output: path.join(directory, 'oversized-benefit.webp'),
  };
  fs.writeFileSync(image.output, Buffer.alloc(5 * 1024 * 1024));

  await expect(validateAsset(event, image)).rejects.toThrow(
    '파일 크기는 5MB 미만이어야 합니다.',
  );
});

test('builds three role sheets and 22 event strips in event ID order', async () => {
  const directory = createTemporaryDirectory();
  const temporaryManifest = createManifest();
  const source = await sharp({
    create: { width: 2, height: 2, channels: 3, background: '#224466' },
  })
    .webp()
    .toBuffer();

  process.chdir(directory);
  for (const event of temporaryManifest.events) {
    for (const image of event.images) {
      const output = getOutputPath(image);
      fs.mkdirSync(path.dirname(output), { recursive: true });
      fs.writeFileSync(output, source);
    }
  }

  const result = await buildContactSheets(temporaryManifest, {
    outputDirectory: path.join(directory, 'contact-sheets'),
  });
  const sortedEventIds = temporaryManifest.events
    .map((event) => event.id)
    .sort((left, right) => left.localeCompare(right));

  expect(result.eventIds).toEqual(sortedEventIds);
  expect(Object.keys(result.roles)).toEqual(EDITORIAL_ROLES);
  expect(Object.keys(result.events)).toEqual(sortedEventIds);
  for (const output of Object.values(result.roles)) {
    await expect(sharp(output).metadata()).resolves.toMatchObject({
      format: 'webp',
      width: 1000,
      height: 1500,
    });
  }
  for (const output of Object.values(result.events)) {
    await expect(sharp(output).metadata()).resolves.toMatchObject({
      format: 'webp',
      width: 600,
      height: 300,
    });
  }
});

test('allows only the three documented CLI commands', async () => {
  await expect(runCli('unknown')).rejects.toThrow(
    '지원하지 않는 명령입니다: unknown',
  );
});
