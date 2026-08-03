const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const {
  LEGACY_EVENT_IDS,
  PUBLICATION_VERSION,
  buildPublicationManifest,
  validatePublicationManifest,
} = require('./event-publication-manifest');
const {
  buildStorageObjectName,
  createDownloadUrl,
  validateImageDecisions,
} = require('./event-publication-assets');

const COMMANDS = Object.freeze(['analyze', 'stage', 'verify', 'publish', 'rollback']);
const EXPECTED_PROJECT_ID = 'hebimall';
const EXPECTED_EVENT_COUNT = 32;
const DECISIONS_PATH = path.resolve('scripts/event-publication-image-decisions.json');
const REPORT_ROOT = path.resolve(
  `migration-logs/event-publication/${PUBLICATION_VERSION}/reports`,
);
const BACKUP_ROOT = path.resolve(
  `migration-logs/event-publication/${PUBLICATION_VERSION}/backups`,
);

function parsePublicationCommand(argv) {
  const [command = 'analyze'] = argv;
  if (!COMMANDS.includes(command)) {
    throw new Error(`지원하지 않는 명령: ${command}`);
  }
  return command;
}

function serializeBackupValue(value) {
  if (value && typeof value.toDate === 'function') {
    return { __type: 'timestamp', value: value.toDate().toISOString() };
  }
  if (Array.isArray(value)) {
    return value.map(serializeBackupValue);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, serializeBackupValue(item)]),
    );
  }
  return value;
}

function deserializeBackupValue(value, timestampFactory) {
  if (
    value
    && typeof value === 'object'
    && !Array.isArray(value)
    && value.__type === 'timestamp'
    && typeof value.value === 'string'
  ) {
    return timestampFactory(value.value);
  }
  if (Array.isArray(value)) {
    return value.map(item => deserializeBackupValue(item, timestampFactory));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        deserializeBackupValue(item, timestampFactory),
      ]),
    );
  }
  return value;
}

function stableJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => (
      `${JSON.stringify(key)}:${stableJson(value[key])}`
    )).join(',')}}`;
  }
  return JSON.stringify(value);
}

function checksum(value) {
  return crypto.createHash('sha256').update(stableJson(value)).digest('hex');
}

function valueToIso(value) {
  if (value && typeof value.toDate === 'function') {
    return value.toDate().toISOString();
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : value;
  }
  return value;
}

function comparableValue(value) {
  if (value && typeof value.toDate === 'function') {
    return value.toDate().toISOString();
  }
  if (Array.isArray(value)) {
    return value.map(comparableValue);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, comparableValue(item)]),
    );
  }
  return value;
}

function buildImageUrls(eventDecision, bucketName) {
  const resolveRole = role => {
    const asset = eventDecision[role];
    if (asset.action === 'reuse') {
      return asset.sourceUrl;
    }
    return createDownloadUrl(
      buildStorageObjectName(eventDecision.id, role, PUBLICATION_VERSION),
      bucketName,
    );
  };
  const wide = resolveRole('wide');
  return {
    bannerImage: wide,
    detailImage: wide,
    thumbnailImage: resolveRole('card'),
  };
}

async function buildPublicationPlan(runtime, manifest, decisions) {
  validatePublicationManifest(manifest);
  validateImageDecisions(decisions, manifest);
  if (runtime.projectId !== EXPECTED_PROJECT_ID) {
    throw new Error(`프로젝트가 ${EXPECTED_PROJECT_ID}가 아닙니다.`);
  }

  const existing = await runtime.readEvents(manifest.events.map(event => event.id));
  const existingById = new Map(existing.map(document => [document.id, document.data]));
  for (const legacyId of LEGACY_EVENT_IDS) {
    if (!existingById.get(legacyId)) {
      throw new Error(`기존 이벤트가 누락되었습니다: ${legacyId}`);
    }
  }

  const reviewProductIds = [...new Set(
    manifest.events
      .filter(event => event.eligibilityType === 'review')
      .flatMap(event => event.targetProducts),
  )];
  if (reviewProductIds.length > 0 && runtime.readProducts) {
    const products = await runtime.readProducts(reviewProductIds);
    const productById = new Map(products.map(product => [product.id, product.data]));
    for (const productId of reviewProductIds) {
      if (productById.get(productId)?.status !== 'active') {
        throw new Error(`리뷰 대상 상품이 활성 상태가 아닙니다: ${productId}`);
      }
    }
  }

  const decisionsById = new Map(decisions.events.map(event => [event.id, event]));
  const now = runtime.timestampNow
    ? runtime.timestampNow()
    : new Date('2026-07-31T00:00:00.000Z');

  const documents = manifest.events.map(event => {
    const isLegacy = event.source === 'legacy';
    const existingDocument = existingById.get(event.id);
    if (
      !isLegacy
      && existingDocument
      && existingDocument.publicationVersion !== manifest.version
    ) {
      throw new Error(`신규 이벤트 ID가 기존 문서와 충돌합니다: ${event.id}`);
    }
    const imageUrls = buildImageUrls(decisionsById.get(event.id), runtime.bucketName);
    const data = {
      title: event.title,
      description: event.description,
      content: event.content,
      eventType: event.eventType,
      eligibilityType: event.eligibilityType,
      rewardType: event.rewardType,
      publicPolicyVerified: false,
      publicationVersion: manifest.version,
      startDate: runtime.timestampFromIso
        ? runtime.timestampFromIso(event.startDate)
        : event.startDate,
      endDate: runtime.timestampFromIso
        ? runtime.timestampFromIso(event.endDate)
        : event.endDate,
      isActive: true,
      hasMaxParticipants: false,
      ...(event.targetCategories ? { targetCategories: event.targetCategories } : {}),
      ...(event.targetProducts ? { targetProducts: event.targetProducts } : {}),
      ...imageUrls,
      updatedAt: now,
      ...(!isLegacy
        ? {
          participantCount: 0,
          createdAt: existingDocument?.createdAt ?? now,
        }
        : {}),
    };
    const deleteFields = isLegacy
      ? [
        ...(event.deleteFields || []),
        ...(!event.targetCategories ? ['targetCategories'] : []),
      ]
      : [];

    return {
      id: event.id,
      source: event.source,
      merge: isLegacy,
      data,
      deleteFields: [...new Set(deleteFields)],
    };
  });

  return {
    version: manifest.version,
    documents,
    reviewProductIds,
    generatedStoragePaths: decisions.events.flatMap(event => (
      ['wide', 'card']
        .filter(role => event[role].action === 'generate')
        .map(role => buildStorageObjectName(event.id, role, decisions.version))
    )),
  };
}

async function stagePublication(runtime, plan, backupPath) {
  if (runtime.projectId !== EXPECTED_PROJECT_ID) {
    throw new Error('프로젝트 확인에 실패했습니다.');
  }
  if (!plan || plan.version !== PUBLICATION_VERSION || plan.documents.length !== 32) {
    throw new Error('32개 publication plan이 필요합니다.');
  }

  if (runtime.storageObjectsExist && plan.generatedStoragePaths?.length > 0) {
    const storage = await runtime.storageObjectsExist(plan.generatedStoragePaths);
    if (storage.failed > 0) {
      throw new Error(`업로드되지 않은 이미지가 있습니다: ${storage.failed}`);
    }
  }

  const legacyIds = plan.documents
    .filter(document => document.source === 'legacy')
    .map(document => document.id);
  const currentLegacy = await runtime.readEvents(legacyIds);
  if (currentLegacy.some(document => !document.data)) {
    throw new Error('백업할 기존 이벤트가 누락되었습니다.');
  }
  const serializedDocuments = currentLegacy.map(document => ({
    id: document.id,
    data: serializeBackupValue(document.data),
  }));
  const backup = {
    projectId: runtime.projectId,
    version: plan.version,
    createdAt: new Date().toISOString(),
    documents: serializedDocuments,
  };
  backup.checksum = checksum(backup.documents);
  await runtime.writeBackup(backupPath, backup);

  const writes = plan.documents.map(document => ({
    id: document.id,
    merge: document.source === 'legacy',
    data: {
      ...document.data,
      publicPolicyVerified: false,
    },
    deleteFields: document.source === 'legacy' ? (document.deleteFields || []) : [],
  }));
  await runtime.commitWrites(writes);

  return {
    staged: writes.length,
    verifiedTrue: writes.filter(write => write.data.publicPolicyVerified === true).length,
    backupPath,
  };
}

async function verifyStagedPublication(runtime, plan, expectedVerified = false) {
  const current = await runtime.readEvents(plan.documents.map(document => document.id));
  const currentById = new Map(current.map(document => [document.id, document.data]));
  const invalid = [];

  for (const expected of plan.documents) {
    const actual = currentById.get(expected.id);
    if (!actual) {
      invalid.push({ id: expected.id, reason: 'missing_document' });
      continue;
    }
    if (actual.publicPolicyVerified !== expectedVerified) {
      invalid.push({ id: expected.id, reason: 'verification_flag' });
      continue;
    }
    if (actual.publicationVersion !== plan.version) {
      invalid.push({ id: expected.id, reason: 'publication_version' });
      continue;
    }
    for (const [key, expectedValue] of Object.entries(expected.data)) {
      if (key === 'updatedAt' || key === 'publicPolicyVerified') continue;
      const actualValue = comparableValue(actual[key]);
      const normalizedExpected = comparableValue(expectedValue);
      if (stableJson(actualValue) !== stableJson(normalizedExpected)) {
        invalid.push({ id: expected.id, reason: `field:${key}` });
        break;
      }
    }
  }

  return {
    events: plan.documents.length,
    validDocuments: plan.documents.length - invalid.length,
    verifiedFalse: current.filter(document => (
      document.data?.publicPolicyVerified === false
    )).length,
    verifiedTrue: current.filter(document => (
      document.data?.publicPolicyVerified === true
    )).length,
    invalid,
  };
}

async function publishPublication(runtime, plan, confirmations) {
  if (
    confirmations?.confirmProject !== EXPECTED_PROJECT_ID
    || runtime.projectId !== EXPECTED_PROJECT_ID
  ) {
    throw new Error('프로젝트 확인이 일치하지 않습니다.');
  }
  if (Number(confirmations?.confirmCount) !== EXPECTED_EVENT_COUNT) {
    throw new Error('이벤트 수 확인이 일치하지 않습니다.');
  }

  const verification = await verifyStagedPublication(runtime, plan, false);
  if (verification.invalid.length > 0) {
    throw new Error(`검증되지 않은 stage가 있습니다: ${verification.invalid.length}`);
  }
  await runtime.commitWrites(plan.documents.map(document => ({
    id: document.id,
    merge: true,
    data: { publicPolicyVerified: true },
    deleteFields: [],
  })));
  return { published: plan.documents.length };
}

async function rollbackPublication(runtime, backup, newIds) {
  if (runtime.projectId !== backup.projectId || backup.version !== PUBLICATION_VERSION) {
    throw new Error('rollback 백업 대상이 현재 프로젝트와 일치하지 않습니다.');
  }
  if (backup.checksum && backup.checksum !== checksum(backup.documents)) {
    throw new Error('rollback 백업 checksum이 일치하지 않습니다.');
  }
  const timestampFactory = value => (
    runtime.timestampFromIso ? runtime.timestampFromIso(value) : value
  );
  const restoreWrites = backup.documents.map(document => ({
    id: document.id,
    merge: false,
    data: deserializeBackupValue(document.data, timestampFactory),
    deleteFields: [],
  }));
  const disableWrites = newIds.map(id => ({
    id,
    merge: true,
    data: {
      publicPolicyVerified: false,
      isActive: false,
    },
    deleteFields: [],
  }));
  await runtime.commitWrites([...restoreWrites, ...disableWrites]);
  return {
    restored: restoreWrites.length,
    disabledNew: disableWrites.length,
    deleted: 0,
  };
}

function createAdminRuntime() {
  const { admin, db, projectId } = require('./util-firestore-admin');
  const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  if (!bucketName) {
    throw new Error('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET 설정이 필요합니다.');
  }
  const allowedBuckets = new Set([
    `${projectId}.firebasestorage.app`,
    `${projectId}.appspot.com`,
  ]);
  if (!allowedBuckets.has(bucketName)) {
    throw new Error('Firestore 프로젝트와 Storage 버킷이 일치하지 않습니다.');
  }
  const bucket = admin.storage().bucket(bucketName);

  return {
    projectId,
    bucketName,
    timestampFromIso: value => admin.firestore.Timestamp.fromDate(new Date(value)),
    timestampNow: () => admin.firestore.Timestamp.now(),
    async readEvents(ids) {
      const snapshots = await db.getAll(
        ...ids.map(id => db.collection('events').doc(id)),
      );
      return snapshots.map(snapshot => ({
        id: snapshot.id,
        data: snapshot.exists ? snapshot.data() : null,
      }));
    },
    async readProducts(ids) {
      const snapshots = await db.getAll(
        ...ids.map(id => db.collection('products').doc(id)),
      );
      return snapshots.map(snapshot => ({
        id: snapshot.id,
        data: snapshot.exists ? snapshot.data() : null,
      }));
    },
    async storageObjectsExist(storagePaths) {
      let verified = 0;
      for (const storagePath of storagePaths) {
        const [exists] = await bucket.file(storagePath).exists();
        if (exists) verified += 1;
      }
      return { verified, failed: storagePaths.length - verified };
    },
    async writeBackup(filePath, backup) {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, `${JSON.stringify(backup, null, 2)}\n`, 'utf8');
    },
    async commitWrites(writes) {
      const batch = db.batch();
      for (const write of writes) {
        const ref = db.collection('events').doc(write.id);
        const data = { ...write.data };
        for (const field of write.deleteFields || []) {
          data[field] = admin.firestore.FieldValue.delete();
        }
        batch.set(ref, data, { merge: write.merge });
      }
      await batch.commit();
    },
  };
}

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function parseFlags(argv) {
  return Object.fromEntries(
    argv
      .filter(argument => argument.startsWith('--') && argument.includes('='))
      .map(argument => {
        const [key, ...parts] = argument.slice(2).split('=');
        return [key, parts.join('=')];
      }),
  );
}

function parseExpectedPublic(flags) {
  const value = flags['expect-public'];
  if (value === undefined || value === 'false') return false;
  if (value === 'true') return true;
  throw new Error('--expect-public은 true 또는 false만 사용할 수 있습니다.');
}

function defaultBackupPath() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return path.join(BACKUP_ROOT, `${timestamp}.json`);
}

function writeReport(command, report) {
  fs.mkdirSync(REPORT_ROOT, { recursive: true });
  const reportPath = path.join(REPORT_ROOT, `${command}.json`);
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return reportPath;
}

async function runCli(argv = process.argv.slice(2)) {
  const command = parsePublicationCommand(argv);
  const flags = parseFlags(argv.slice(1));
  const runtime = createAdminRuntime();
  const manifest = buildPublicationManifest();
  const decisions = loadJson(DECISIONS_PATH);
  const plan = await buildPublicationPlan(runtime, manifest, decisions);

  if (command === 'analyze') {
    const localAssets = plan.documents.filter(document => (
      document.data.bannerImage && document.data.thumbnailImage
    )).length * 2;
    const report = {
      projectId: runtime.projectId,
      existingEvents: LEGACY_EVENT_IDS.length,
      newEvents: plan.documents.length - LEGACY_EVENT_IDS.length,
      totalEvents: plan.documents.length,
      activeReviewTargets: plan.reviewProductIds.length,
      imageAssets: localAssets,
      readyToStage: true,
    };
    writeReport(command, report);
    return report;
  }
  if (command === 'stage') {
    const result = await stagePublication(runtime, plan, defaultBackupPath());
    writeReport(command, result);
    return result;
  }
  if (command === 'verify') {
    const expectedPublic = parseExpectedPublic(flags);
    const result = await verifyStagedPublication(runtime, plan, expectedPublic);
    writeReport(command, result);
    if (result.invalid.length > 0) {
      throw new Error(`이벤트 공개 상태 검증 실패: invalid=${result.invalid.length}`);
    }
    return result;
  }
  if (command === 'publish') {
    return publishPublication(runtime, plan, {
      confirmProject: flags['confirm-project'],
      confirmCount: flags['confirm-count'],
    });
  }
  if (command === 'rollback') {
    if (flags['confirm-project'] !== EXPECTED_PROJECT_ID || !flags.backup) {
      throw new Error('rollback에는 --confirm-project와 --backup이 필요합니다.');
    }
    const backup = loadJson(path.resolve(flags.backup));
    const newIds = manifest.events
      .filter(event => event.source === 'new')
      .map(event => event.id);
    return rollbackPublication(runtime, backup, newIds);
  }
  throw new Error(`지원하지 않는 명령: ${command}`);
}

if (require.main === module) {
  runCli()
    .then(result => console.log(JSON.stringify(result, null, 2)))
    .catch(error => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
}

module.exports = {
  buildPublicationPlan,
  createAdminRuntime,
  deserializeBackupValue,
  parseExpectedPublic,
  parsePublicationCommand,
  publishPublication,
  rollbackPublication,
  runCli,
  serializeBackupValue,
  stagePublication,
  verifyStagedPublication,
};
