const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const {
  PUBLICATION_VERSION,
  buildPublicationManifest,
  validatePublicationManifest,
} = require('./event-publication-manifest');

const ROLES = Object.freeze(['wide', 'card']);
const TARGETS = Object.freeze({
  wide: Object.freeze({ width: 1600, height: 900 }),
  card: Object.freeze({ width: 1000, height: 1250 }),
});
const CACHE_CONTROL = 'public, max-age=31536000, immutable';
const CONTENT_TYPE = 'image/webp';
const WORK_ROOT = path.resolve(
  `migration-logs/event-publication/${PUBLICATION_VERSION}`,
);
const SOURCE_ROOT = path.join(WORK_ROOT, 'source-images');
const CONTACT_SHEET_ROOT = path.join(WORK_ROOT, 'contact-sheets');
const DECISIONS_PATH = path.resolve('scripts/event-publication-image-decisions.json');
const IMAGE_MANIFEST_PATH = path.resolve('scripts/event-publication-image-manifest.json');
const SAFE_CURRENT_IMAGE_EVENT_IDS = new Set([
  'event-2026-02-spring-preview',
  'event-2026-06-summer-linen',
  'event-2026-08-pre-fall',
]);
const LOCAL_TEXT_FREE_SOURCE_EVENT_IDS = new Set([
  'event-2026-01-layering-sale',
  'event-2026-01-welcome-coupon',
  'event-2026-02-knit-review',
  'event-2026-02-spring-preview',
  'event-2026-03-photo-review',
  'event-2026-03-trench-week',
  'event-2026-03-white-day-coupon',
  'event-2026-04-office-look',
  'event-2026-04-shirt-collection',
  'event-2026-04-styling-coupon',
  'event-2026-05-best-review',
  'event-2026-05-denim-festival',
  'event-2026-05-family-coupon',
  'event-2026-06-midyear-sale',
  'event-2026-06-summer-linen',
  'event-2026-07-cool-touch',
  'event-2026-07-summer-review',
  'event-2026-07-vacation-coupon',
  'event-2026-08-last-summer',
  'event-2026-08-pre-fall',
]);

const GENERATED_SOURCE_THEMES = Object.freeze({
  h1WITXqWE2BL3G0ACiza:
    '미니멀한 로프트의 첫 쇼핑 패키지, 스마트폰과 접힌 니트, 코발트 블루와 오렌지 포인트',
  PacCrKVG9TikHo7lambG:
    '봄 꽃시장 골목의 혼성 모델 3인, 가벼운 재킷과 셔츠, 스프링 그린과 소프트 핑크',
  'event-2026-08-summer-sale-edit':
    '늦여름 도심 테라스의 셔츠와 팬츠 스타일링, 코럴과 샌드 베이지, 시원한 자연광',
  'event-2026-08-bag-accessory-sale':
    '가죽 숄더백, 나일론 백, 실버 액세서리를 정돈한 에디토리얼 정물, 웜 그레이와 버건디',
  'event-2026-09-active-sale':
    '러닝 트랙의 액티브웨어 혼성 모델과 러닝화, 차콜과 라임 포인트, 역동적인 아침빛',
  'event-2026-08-prefall-layering-new':
    '초가을 도심의 가벼운 재킷과 셔츠 레이어링, 올리브와 크림, 차분한 룩북',
  'event-2026-08-daily-bag-new':
    '출근용 토트백과 크로스백을 든 여성 모델, 건축적인 로비, 토프와 딥 브라운',
  'event-2026-09-city-shoes-new':
    '도심 보도 위 로퍼와 스니커즈 중심의 패션 에디토리얼, 네이비와 실버',
  'event-2026-08-late-summer-style':
    '늦여름 해질녘의 셔츠, 팬츠, 가방 데일리 룩, 세이지와 테라코타',
  'event-2026-09-back-to-city':
    '가을 출근길의 재킷, 와이드 팬츠, 구조적인 가방과 로퍼, 차콜과 카멜',
  'event-2026-08-summer-fit-review':
    '여름 셔츠 소재와 봉제 디테일, 착용 전신과 원단 클로즈업을 함께 보여 주는 리뷰 에디토리얼',
  'event-2026-09-prefall-fit-review':
    '프리폴 집업 재킷 착용 전신과 소재 디테일, 구매 후 착용감을 기록하는 차분한 리뷰 에디토리얼',
});

function buildStorageObjectName(eventId, role, version = PUBLICATION_VERSION) {
  if (!/^[A-Za-z0-9-]+$/.test(eventId) || !ROLES.includes(role)) {
    throw new Error(`안전하지 않은 이미지 경로 입력입니다: ${eventId}/${role}`);
  }
  return `events/publication/${eventId}-${version}-${role}.webp`;
}

function buildGenerationPrompt(event) {
  const theme = GENERATED_SOURCE_THEMES[event.id];
  if (!theme) {
    throw new Error(`생성 이미지 테마가 없습니다: ${event.id}`);
  }
  return [
    'Use case: ads-marketing',
    'Asset type: 패션 쇼핑몰 이벤트 캠페인 원본',
    `Primary request: ${theme}`,
    'Style/medium: 실제 한국 패션 쇼핑몰의 고급 에디토리얼 사진',
    'Composition/framing: 주요 피사체를 중앙 안전 영역에 두고, 16:9 와이드와 4:5 세로 중앙 크롭에 모두 사용할 수 있도록 사방에 충분한 배경을 둔다.',
    'Lighting/mood: 자연스럽고 세련된 상업 사진, 실제 원단 질감',
    'Constraints: 이미지 안 글자 없음, 타사 브랜드·로고·워터마크·가격·할인율·쿠폰·적립·무료배송 표현 없음, 가짜 UI 없음.',
    'Avoid: 잘린 얼굴과 손, 왜곡된 신체, 반복된 인물, 읽을 수 없는 글자, 과도한 장식.',
  ].join('\n');
}

function buildImagePreparationManifests(publicationManifest, sourceIndex) {
  validatePublicationManifest(publicationManifest);
  if (
    !sourceIndex
    || sourceIndex.version !== publicationManifest.version
    || !Array.isArray(sourceIndex.assets)
  ) {
    throw new Error('기존 이미지 source index가 올바르지 않습니다.');
  }

  const sourceUrls = new Map(
    sourceIndex.assets.map(asset => [`${asset.eventId}:${asset.role}`, asset.sourceUrl]),
  );
  const decisions = {
    version: publicationManifest.version,
    events: [],
  };
  const imageManifest = {
    version: publicationManifest.version,
    prompts: [],
    assets: [],
  };
  let reusedCurrentAssets = 0;
  let derivedFromExistingAssets = 0;
  let generatedSourceEvents = 0;

  for (const event of publicationManifest.events) {
    const decision = { id: event.id, source: event.source };
    const shouldReuseCurrent =
      event.source === 'legacy' && SAFE_CURRENT_IMAGE_EVENT_IDS.has(event.id);
    const hasLocalTextFreeSource =
      event.source === 'legacy' && LOCAL_TEXT_FREE_SOURCE_EVENT_IDS.has(event.id);
    const raw = hasLocalTextFreeSource
      ? `public/events/2026/${event.id}-source.png`
      : `public/events/2026-publication/raw/${event.id}-${PUBLICATION_VERSION}-source.png`;

    if (!shouldReuseCurrent && !hasLocalTextFreeSource) {
      imageManifest.prompts.push({
        id: event.id,
        title: event.title,
        raw,
        prompt: buildGenerationPrompt(event),
      });
      generatedSourceEvents += 1;
    }

    for (const role of ROLES) {
      if (shouldReuseCurrent) {
        const sourceUrl = sourceUrls.get(`${event.id}:${role}`);
        if (!sourceUrl) {
          throw new Error(`${event.id}/${role}: 안전한 운영 이미지 URL이 없습니다.`);
        }
        decision[role] = {
          action: 'reuse',
          sourceUrl,
          reason: 'verified_safe_current_asset',
        };
        reusedCurrentAssets += 1;
        continue;
      }

      const output =
        `public/events/2026-publication/${event.id}-${PUBLICATION_VERSION}-${role}.webp`;
      decision[role] = {
        action: 'generate',
        output,
        reason: hasLocalTextFreeSource
          ? 'derived_from_existing_text_free_source'
          : 'generated_text_free_campaign_source',
      };
      imageManifest.assets.push({
        id: event.id,
        role,
        raw,
        output,
        position: hasLocalTextFreeSource && role === 'card' ? 'east' : 'centre',
      });
      if (hasLocalTextFreeSource) {
        derivedFromExistingAssets += 1;
      }
    }
    decisions.events.push(decision);
  }

  return {
    decisions,
    imageManifest,
    summary: {
      reusedCurrentAssets,
      derivedFromExistingAssets,
      generatedSourceEvents,
      uploadedAssets: imageManifest.assets.length,
    },
  };
}

function validateImageDecisions(decisions, publicationManifest) {
  validatePublicationManifest(publicationManifest);
  if (
    !decisions
    || decisions.version !== publicationManifest.version
    || !Array.isArray(decisions.events)
    || decisions.events.length !== publicationManifest.events.length
  ) {
    throw new Error('이미지 결정 manifest의 버전 또는 이벤트 수가 올바르지 않습니다.');
  }

  const publicationById = new Map(
    publicationManifest.events.map(event => [event.id, event]),
  );
  const seen = new Set();
  let reusedAssets = 0;
  let generatedAssets = 0;

  for (const decision of decisions.events) {
    const event = publicationById.get(decision.id);
    if (!event || seen.has(decision.id) || decision.source !== event.source) {
      throw new Error(`이미지 결정 이벤트가 올바르지 않습니다: ${decision.id}`);
    }
    seen.add(decision.id);

    for (const role of ROLES) {
      const asset = decision[role];
      if (!asset || !['reuse', 'generate'].includes(asset.action)) {
        throw new Error(`${decision.id}/${role}: 이미지 결정이 없습니다.`);
      }
      if (event.source === 'new' && asset.action === 'reuse') {
        throw new Error(`신규 이벤트 ${decision.id}에는 reuse 결정을 사용할 수 없습니다.`);
      }

      if (asset.action === 'reuse') {
        if (
          typeof asset.sourceUrl !== 'string'
          || !/^https:\/\/firebasestorage\.googleapis\.com\//.test(asset.sourceUrl)
        ) {
          throw new Error(`${decision.id}/${role}: 재사용 URL이 올바르지 않습니다.`);
        }
        reusedAssets += 1;
      } else {
        const expectedOutput =
          `public/events/2026-publication/${decision.id}-${PUBLICATION_VERSION}-${role}.webp`;
        if (asset.output !== expectedOutput) {
          throw new Error(`${decision.id}/${role}: 생성 출력 경로가 올바르지 않습니다.`);
        }
        generatedAssets += 1;
      }
    }
  }

  return {
    events: decisions.events.length,
    reusedAssets,
    generatedAssets,
  };
}

function buildUploadPlan(decisions, publicationManifest) {
  validateImageDecisions(decisions, publicationManifest);
  const entries = [];

  for (const event of decisions.events) {
    for (const role of ROLES) {
      const asset = event[role];
      if (asset.action !== 'generate') continue;

      entries.push({
        eventId: event.id,
        role,
        localPath: path.resolve(asset.output),
        storagePath: buildStorageObjectName(event.id, role, decisions.version),
      });
    }
  }

  return entries;
}

function createDownloadUrl(storagePath, bucketName) {
  return `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(
    bucketName,
  )}/o/${encodeURIComponent(storagePath)}?alt=media`;
}

function parseFirebaseStorageObjectName(sourceUrl) {
  const url = new URL(sourceUrl);
  const marker = '/o/';
  const markerIndex = url.pathname.indexOf(marker);
  if (
    url.hostname !== 'firebasestorage.googleapis.com'
    || markerIndex < 0
    || markerIndex + marker.length >= url.pathname.length
  ) {
    throw new Error('Firebase Storage URL 형식이 올바르지 않습니다.');
  }
  return decodeURIComponent(url.pathname.slice(markerIndex + marker.length));
}

function getFirebaseRuntime() {
  const { admin, db, projectId } = require('./util-firestore-admin');
  const configuredBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  if (!configuredBucket) {
    throw new Error('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET 설정이 필요합니다.');
  }
  const allowedBuckets = new Set([
    `${projectId}.firebasestorage.app`,
    `${projectId}.appspot.com`,
  ]);
  if (!allowedBuckets.has(configuredBucket)) {
    throw new Error('Firestore 프로젝트와 Storage 버킷이 일치하지 않습니다.');
  }

  return {
    db,
    projectId,
    bucket: admin.storage().bucket(configuredBucket),
  };
}

async function downloadExistingEventImages(runtime, publicationManifest) {
  validatePublicationManifest(publicationManifest);
  fs.mkdirSync(SOURCE_ROOT, { recursive: true });

  const legacyEvents = publicationManifest.events.filter(event => event.source === 'legacy');
  const results = [];

  for (const event of legacyEvents) {
    const snapshot = await runtime.db.collection('events').doc(event.id).get();
    if (!snapshot.exists) {
      throw new Error(`기존 이벤트 문서를 찾을 수 없습니다: ${event.id}`);
    }
    const data = snapshot.data();
    const sources = {
      wide: data.bannerImage,
      card: data.thumbnailImage,
    };

    for (const role of ROLES) {
      const sourceUrl = sources[role];
      if (typeof sourceUrl !== 'string' || !sourceUrl.startsWith('https://')) {
        throw new Error(`${event.id}/${role}: 기존 이미지 URL이 없습니다.`);
      }
      const output = path.join(SOURCE_ROOT, `${event.id}-${role}.webp`);
      const storagePath = parseFirebaseStorageObjectName(sourceUrl);
      await runtime.bucket.file(storagePath).download({ destination: output });
      results.push({ eventId: event.id, role, output, sourceUrl });
    }
  }

  const index = {
    version: publicationManifest.version,
    projectId: runtime.projectId,
    assets: results,
  };
  fs.writeFileSync(
    path.join(SOURCE_ROOT, 'index.json'),
    `${JSON.stringify(index, null, 2)}\n`,
    'utf8',
  );
  return { events: legacyEvents.length, assets: results.length, directory: SOURCE_ROOT };
}

async function buildContactSheet(events, role) {
  const layout = role === 'wide'
    ? { columns: 4, width: 320, height: 180 }
    : { columns: 5, width: 200, height: 250 };
  const rows = Math.ceil(events.length / layout.columns);
  const composites = [];

  for (const [index, event] of events.entries()) {
    const inputPath = path.join(SOURCE_ROOT, `${event.id}-${role}.webp`);
    const input = await sharp(inputPath)
      .resize(layout.width, layout.height, { fit: 'cover', position: 'centre' })
      .toBuffer();
    composites.push({
      input,
      left: (index % layout.columns) * layout.width,
      top: Math.floor(index / layout.columns) * layout.height,
    });
  }

  fs.mkdirSync(CONTACT_SHEET_ROOT, { recursive: true });
  const output = path.join(CONTACT_SHEET_ROOT, `${role}-contact-sheet.webp`);
  await sharp({
    create: {
      width: layout.columns * layout.width,
      height: rows * layout.height,
      channels: 3,
      background: '#ffffff',
    },
  })
    .composite(composites)
    .webp({ quality: 84 })
    .toFile(output);

  return output;
}

async function buildExistingContactSheets(publicationManifest) {
  const events = publicationManifest.events
    .filter(event => event.source === 'legacy')
    .sort((left, right) => left.id.localeCompare(right.id));
  const wide = await buildContactSheet(events, 'wide');
  const card = await buildContactSheet(events, 'card');
  const indexPath = path.join(CONTACT_SHEET_ROOT, 'index.json');
  fs.writeFileSync(
    indexPath,
    `${JSON.stringify(events.map((event, index) => ({
      tile: index + 1,
      id: event.id,
      title: event.title,
    })), null, 2)}\n`,
    'utf8',
  );
  return { wide, card, indexPath, events: events.length };
}

async function normalizeGeneratedImages(imageManifest) {
  if (
    !imageManifest
    || imageManifest.version !== PUBLICATION_VERSION
    || !Array.isArray(imageManifest.assets)
  ) {
    throw new Error('생성 이미지 manifest가 올바르지 않습니다.');
  }

  const outputs = [];
  for (const asset of imageManifest.assets) {
    if (!ROLES.includes(asset.role) || !asset.raw || !asset.output) {
      throw new Error(`생성 이미지 항목이 올바르지 않습니다: ${asset.id || 'unknown'}`);
    }
    const target = TARGETS[asset.role];
    const raw = path.resolve(asset.raw);
    const output = path.resolve(asset.output);
    fs.mkdirSync(path.dirname(output), { recursive: true });
    await sharp(raw)
      .resize(target.width, target.height, {
        fit: 'cover',
        position: asset.position || 'centre',
      })
      .webp({ quality: 88 })
      .toFile(output);
    outputs.push(output);
  }
  return outputs;
}

async function validateGeneratedImages(decisions, publicationManifest) {
  const summary = validateImageDecisions(decisions, publicationManifest);
  const uploadPlan = buildUploadPlan(decisions, publicationManifest);
  const invalid = [];

  for (const entry of uploadPlan) {
    try {
      const stats = fs.statSync(entry.localPath);
      const metadata = await sharp(entry.localPath).metadata();
      const target = TARGETS[entry.role];
      if (
        stats.size >= 5 * 1024 * 1024
        || metadata.format !== 'webp'
        || metadata.width !== target.width
        || metadata.height !== target.height
      ) {
        invalid.push(entry);
      }
    } catch {
      invalid.push(entry);
    }
  }

  if (invalid.length > 0) {
    throw new Error(`생성 이미지 검증 실패: invalid=${invalid.length}`);
  }
  return {
    ...summary,
    assets: summary.reusedAssets + summary.generatedAssets,
    invalid: 0,
  };
}

async function uploadPublicationImages(plan, runtime) {
  const uploaded = [];
  for (const entry of plan) {
    await runtime.bucket.upload(entry.localPath, {
      destination: entry.storagePath,
      resumable: false,
      preconditionOpts: { ifGenerationMatch: 0 },
      metadata: {
        contentType: CONTENT_TYPE,
        cacheControl: CACHE_CONTROL,
      },
    });
    uploaded.push(entry);
  }
  return { uploaded: uploaded.length, failed: 0 };
}

async function verifyUploadedImages(plan, runtime) {
  let verified = 0;
  for (const entry of plan) {
    const file = runtime.bucket.file(entry.storagePath);
    const [exists] = await file.exists();
    const [metadata] = exists ? await file.getMetadata() : [{}];
    if (
      exists
      && metadata.contentType === CONTENT_TYPE
      && metadata.cacheControl === CACHE_CONTROL
    ) {
      verified += 1;
    }
  }
  return { verified, failed: plan.length - verified };
}

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

async function runCli(command) {
  const publicationManifest = buildPublicationManifest();

  if (command === 'download-existing') {
    return downloadExistingEventImages(getFirebaseRuntime(), publicationManifest);
  }
  if (command === 'contact-sheet') {
    return buildExistingContactSheets(publicationManifest);
  }
  if (command === 'prepare') {
    const sourceIndex = loadJson(path.join(SOURCE_ROOT, 'index.json'));
    const prepared = buildImagePreparationManifests(publicationManifest, sourceIndex);
    fs.mkdirSync(path.dirname(DECISIONS_PATH), { recursive: true });
    fs.mkdirSync(path.resolve('public/events/2026-publication/raw'), { recursive: true });
    fs.writeFileSync(
      DECISIONS_PATH,
      `${JSON.stringify(prepared.decisions, null, 2)}\n`,
      'utf8',
    );
    fs.writeFileSync(
      IMAGE_MANIFEST_PATH,
      `${JSON.stringify(prepared.imageManifest, null, 2)}\n`,
      'utf8',
    );
    return prepared.summary;
  }
  if (command === 'normalize-generated') {
    return normalizeGeneratedImages(loadJson(IMAGE_MANIFEST_PATH));
  }

  const decisions = loadJson(DECISIONS_PATH);
  if (command === 'validate') {
    return validateGeneratedImages(decisions, publicationManifest);
  }
  const runtime = getFirebaseRuntime();
  const plan = buildUploadPlan(decisions, publicationManifest);
  if (command === 'upload') {
    return uploadPublicationImages(plan, runtime);
  }
  if (command === 'verify-upload') {
    return verifyUploadedImages(plan, runtime);
  }
  throw new Error(`지원하지 않는 명령입니다: ${command}`);
}

if (require.main === module) {
  runCli(process.argv[2])
    .then(result => console.log(JSON.stringify(result, null, 2)))
    .catch(error => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
}

module.exports = {
  TARGETS,
  buildExistingContactSheets,
  buildImagePreparationManifests,
  buildStorageObjectName,
  buildUploadPlan,
  createDownloadUrl,
  downloadExistingEventImages,
  normalizeGeneratedImages,
  parseFirebaseStorageObjectName,
  runCli,
  uploadPublicationImages,
  validateGeneratedImages,
  validateImageDecisions,
  verifyUploadedImages,
};
