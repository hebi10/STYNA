const fs = require('fs');
const os = require('os');
const path = require('path');

const manifest = require('./event-image-refresh-manifest.json');

const COMMANDS = ['analyze', 'upload', 'verify-upload', 'apply', 'verify', 'rollback'];
const CACHE_CONTROL = 'public, max-age=31536000, immutable';
const CONTENT_TYPE = 'image/webp';
const EXPECTED_EVENT_COUNT = 22;
const EXPECTED_OBJECT_COUNT = EXPECTED_EVENT_COUNT * 2;
const IMAGE_FIELDS = ['bannerImage', 'detailImage', 'thumbnailImage'];

function parseCommand(argv) {
  const [command = 'analyze'] = argv;

  if (!COMMANDS.includes(command)) {
    throw new Error(`지원하지 않는 명령: ${command}`);
  }

  return command;
}

function buildStoragePlan(event, version) {
  return {
    wide: `events/banner/${event.id}-${version}-wide.webp`,
    card: `events/thumbnail/${event.id}-${version}-card.webp`,
  };
}

function createDownloadUrl(storagePath, bucketName) {
  return `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(
    bucketName,
  )}/o/${encodeURIComponent(storagePath)}?alt=media`;
}

function buildEventUpdate(storagePlan, bucketName) {
  const wideUrl = createDownloadUrl(storagePlan.wide, bucketName);

  return {
    bannerImage: wideUrl,
    detailImage: wideUrl,
    thumbnailImage: createDownloadUrl(storagePlan.card, bucketName),
  };
}

function assertFirebaseTargetConsistency({ projectId, bucket }) {
  const bucketName = bucket?.name;
  const allowedBucketNames = new Set([
    `${projectId}.firebasestorage.app`,
    `${projectId}.appspot.com`,
  ]);

  if (!projectId || !bucketName || !allowedBucketNames.has(bucketName)) {
    throw new Error('Firestore 프로젝트와 Storage 버킷이 일치하지 않습니다.');
  }

  return bucketName;
}

function assertManifestContract(candidate) {
  if (!candidate || candidate.version !== '20260714') {
    throw new Error('이벤트 이미지 매니페스트 버전이 20260714가 아닙니다.');
  }

  if (!Array.isArray(candidate.events) || candidate.events.length !== EXPECTED_EVENT_COUNT) {
    throw new Error(`이벤트 이미지 매니페스트에는 ${EXPECTED_EVENT_COUNT}개 이벤트가 필요합니다.`);
  }

  const ids = new Set();
  for (const event of candidate.events) {
    if (!event || typeof event.id !== 'string' || !/^[A-Za-z0-9-]+$/.test(event.id)) {
      throw new Error('이벤트 이미지 매니페스트에 안전하지 않은 이벤트 ID가 있습니다.');
    }
    if (ids.has(event.id)) {
      throw new Error(`이벤트 이미지 매니페스트에 중복 ID가 있습니다: ${event.id}`);
    }
    ids.add(event.id);

    const expectedWide = `public/events/2026-v2/${event.id}-wide.webp`;
    const expectedCard = `public/events/2026-v2/${event.id}-card.webp`;
    if (event.wideOutput !== expectedWide || event.cardOutput !== expectedCard) {
      throw new Error(`이벤트 ${event.id}의 로컬 이미지 경로가 규칙과 다릅니다.`);
    }
  }
}

function buildSyncEntries(candidate, cwd = process.cwd()) {
  assertManifestContract(candidate);

  return candidate.events.flatMap((event) => {
    const storagePlan = buildStoragePlan(event, candidate.version);
    return [
      {
        eventId: event.id,
        kind: 'wide',
        localPath: path.resolve(cwd, event.wideOutput),
        storagePath: storagePlan.wide,
      },
      {
        eventId: event.id,
        kind: 'card',
        localPath: path.resolve(cwd, event.cardOutput),
        storagePath: storagePlan.card,
      },
    ];
  });
}

function getBackupPath(version = manifest.version) {
  return path.join(os.tmpdir(), `hebimall-event-image-backup-${version}.json`);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function assertRequiredImageFields(data, eventId) {
  for (const field of ['bannerImage', 'thumbnailImage']) {
    if (!isNonEmptyString(data?.[field])) {
      throw new Error(`이벤트 ${eventId}의 기존 ${field} 필드를 백업할 수 없습니다.`);
    }
  }
}

function pickCurrentImageFields(data, eventId) {
  assertRequiredImageFields(data, eventId);
  const hasDetailImage = Object.prototype.hasOwnProperty.call(data, 'detailImage');

  if (hasDetailImage && !isNonEmptyString(data.detailImage)) {
    throw new Error(`이벤트 ${eventId}의 기존 detailImage 필드를 백업할 수 없습니다.`);
  }

  return {
    bannerImage: data.bannerImage,
    detailImage: hasDetailImage ? data.detailImage : null,
    thumbnailImage: data.thumbnailImage,
  };
}

function pickBackupImageFields(data, eventId) {
  assertRequiredImageFields(data, eventId);
  const hasDetailImage = Object.prototype.hasOwnProperty.call(data, 'detailImage');

  if (!hasDetailImage || (data.detailImage !== null && !isNonEmptyString(data.detailImage))) {
    throw new Error(`이벤트 ${eventId}의 기존 detailImage 필드를 백업할 수 없습니다.`);
  }

  return {
    bannerImage: data.bannerImage,
    detailImage: data.detailImage,
    thumbnailImage: data.thumbnailImage,
  };
}

function getEventRefs(db, candidate) {
  const collection = db.collection('events');
  return candidate.events.map((event) => collection.doc(event.id));
}

async function loadEventDocuments(db, candidate) {
  const refs = getEventRefs(db, candidate);
  const docs = await db.getAll(...refs);
  const byId = new Map(docs.map((doc) => [doc.id, doc]));

  for (const event of candidate.events) {
    const doc = byId.get(event.id);
    if (!doc || !doc.exists) {
      throw new Error(`Firestore events 문서가 없습니다: ${event.id}`);
    }
  }

  return candidate.events.map((event) => byId.get(event.id));
}

async function countLocalAssets({ candidate, access = fs.promises.access, cwd = process.cwd() }) {
  const entries = buildSyncEntries(candidate, cwd);
  let count = 0;

  for (const entry of entries) {
    try {
      await access(entry.localPath, fs.constants.R_OK);
      count += 1;
    } catch {
      // analyze는 누락 개수를 보고하고, 쓰기 명령은 아래 별도 검사에서 중단한다.
    }
  }

  return count;
}

async function assertAllLocalAssets({ candidate, access = fs.promises.access, cwd = process.cwd() }) {
  const entries = buildSyncEntries(candidate, cwd);
  const missing = [];

  for (const entry of entries) {
    try {
      await access(entry.localPath, fs.constants.R_OK);
    } catch {
      missing.push(entry);
    }
  }

  if (missing.length > 0) {
    throw new Error(`로컬 WebP 44개 검사에 실패했습니다. 누락=${missing.length}`);
  }

  return entries;
}

async function analyzeEventImages({
  manifest: candidate,
  db,
  access = fs.promises.access,
  cwd = process.cwd(),
}) {
  assertManifestContract(candidate);
  const localAssetCount = await countLocalAssets({ candidate, access, cwd });
  const docs = await loadEventDocuments(db, candidate);

  return {
    events: docs.length,
    localAssets: localAssetCount,
    adminReady: true,
  };
}

async function uploadEventImages({
  manifest: candidate,
  bucket,
  projectId,
  access = fs.promises.access,
  cwd = process.cwd(),
  onStatus = () => {},
}) {
  assertFirebaseTargetConsistency({ projectId, bucket });
  const entries = await assertAllLocalAssets({ candidate, access, cwd });
  let uploaded = 0;
  let failed = 0;

  for (const entry of entries) {
    try {
      await bucket.upload(entry.localPath, {
        destination: entry.storagePath,
        resumable: false,
        preconditionOpts: {
          ifGenerationMatch: 0,
        },
        metadata: {
          contentType: CONTENT_TYPE,
          cacheControl: CACHE_CONTROL,
        },
      });
      uploaded += 1;
      onStatus({ eventId: entry.eventId, kind: entry.kind, success: true });
    } catch {
      failed += 1;
      onStatus({ eventId: entry.eventId, kind: entry.kind, success: false });
    }
  }

  return { uploaded, failed };
}

async function verifyStorageObjects({ manifest: candidate, bucket, onStatus = () => {} }) {
  const entries = buildSyncEntries(candidate);
  const results = [];

  for (const entry of entries) {
    let valid = false;
    try {
      const file = bucket.file(entry.storagePath);
      const [exists] = await file.exists();
      const [metadata] = exists ? await file.getMetadata() : [{}];
      valid =
        exists &&
        metadata.contentType === CONTENT_TYPE &&
        metadata.cacheControl === CACHE_CONTROL;
    } catch {
      valid = false;
    }

    results.push({
      eventId: entry.eventId,
      kind: entry.kind,
      success: valid,
    });
    onStatus(results[results.length - 1]);
  }

  return {
    verified: results.filter((result) => result.success).length,
    failed: results.filter((result) => !result.success).length,
  };
}

function assertStorageVerification(summary) {
  if (summary.verified !== EXPECTED_OBJECT_COUNT || summary.failed !== 0) {
    throw new Error(
      `44개 Storage 객체 검증이 완료되지 않아 Firestore batch를 중단합니다. verified=${summary.verified} failed=${summary.failed}`,
    );
  }
}

function imageFieldsEqual(left, right) {
  return IMAGE_FIELDS.every((field) => left?.[field] === right?.[field]);
}

function currentMatchesBackup(current, previous) {
  if (
    current?.bannerImage !== previous?.bannerImage ||
    current?.thumbnailImage !== previous?.thumbnailImage
  ) {
    return false;
  }

  if (previous.detailImage === null) {
    return !Object.prototype.hasOwnProperty.call(current, 'detailImage');
  }

  return current?.detailImage === previous.detailImage;
}

function classifyExistingBackupState({ candidate, docs, backup, bucketName }) {
  validateBackup(candidate, backup);
  const backupById = new Map(backup.events.map((event) => [event.id, event]));
  const states = docs.map((doc) => {
    const current = doc.data();
    const previous = backupById.get(doc.id);
    const expected = buildEventUpdate(
      buildStoragePlan({ id: doc.id }, candidate.version),
      bucketName,
    );
    const isOld = currentMatchesBackup(current, previous);
    const isNew = imageFieldsEqual(current, expected);

    if (isOld && !isNew) return 'old';
    if (isNew && !isOld) return 'new';
    return 'other';
  });

  if (states.every((state) => state === 'old')) return 'all-old';
  if (states.every((state) => state === 'new')) return 'all-new';
  return 'unsafe';
}

async function readBackupIfExists(readFile, backupPath) {
  try {
    return JSON.parse(await readFile(backupPath, 'utf8'));
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}

async function preserveOrReuseBackup({
  candidate,
  docs,
  bucketName,
  backupPath,
  readFile,
  writeFile,
}) {
  let existingBackup = await readBackupIfExists(readFile, backupPath);

  if (!existingBackup) {
    const backup = {
      version: candidate.version,
      events: docs.map((doc) => ({
        id: doc.id,
        ...pickCurrentImageFields(doc.data(), doc.id),
      })),
    };

    try {
      await writeFile(backupPath, `${JSON.stringify(backup, null, 2)}\n`, {
        encoding: 'utf8',
        flag: 'wx',
      });
      return { backup, state: 'created' };
    } catch (error) {
      if (error?.code !== 'EEXIST') throw error;
      existingBackup = await readBackupIfExists(readFile, backupPath);
      if (!existingBackup) throw error;
    }
  }

  const state = classifyExistingBackupState({
    candidate,
    docs,
    backup: existingBackup,
    bucketName,
  });

  if (state === 'unsafe') {
    throw new Error('기존 backup과 현재 문서가 안전하게 복구할 수 없는 상태입니다.');
  }

  return { backup: existingBackup, state };
}

async function applyEventUpdates({
  manifest: candidate,
  bucket,
  db,
  projectId,
  backupPath = getBackupPath(candidate.version),
  readFile = fs.promises.readFile,
  writeFile = fs.promises.writeFile,
}) {
  assertManifestContract(candidate);
  const bucketName = assertFirebaseTargetConsistency({ projectId, bucket });
  const storageSummary = await verifyStorageObjects({ manifest: candidate, bucket });
  assertStorageVerification(storageSummary);

  const docs = await loadEventDocuments(db, candidate);
  const backupResult = await preserveOrReuseBackup({
    candidate,
    docs,
    bucketName,
    backupPath,
    readFile,
    writeFile,
  });

  if (backupResult.state === 'all-new') {
    return { updated: docs.length, batchCommitted: true, recovery: 'already-applied' };
  }

  const batch = db.batch();
  for (const doc of docs) {
    const storagePlan = buildStoragePlan({ id: doc.id }, candidate.version);
    batch.update(doc.ref, buildEventUpdate(storagePlan, bucketName));
  }
  await batch.commit();

  if (backupResult.state === 'all-old') {
    return { updated: docs.length, batchCommitted: true, recovery: 'resumed' };
  }
  return { updated: docs.length, batchCommitted: true };
}

function validateBackup(candidate, backup) {
  if (backup?.version !== candidate.version || !Array.isArray(backup.events)) {
    throw new Error('rollback 백업 버전 또는 형식이 올바르지 않습니다.');
  }
  if (backup.events.length !== EXPECTED_EVENT_COUNT) {
    throw new Error(`rollback 백업에는 ${EXPECTED_EVENT_COUNT}개 이벤트가 필요합니다.`);
  }

  const expectedIds = new Set(candidate.events.map((event) => event.id));
  const seenIds = new Set();
  for (const event of backup.events) {
    if (!expectedIds.has(event.id) || seenIds.has(event.id)) {
      throw new Error('rollback 백업의 이벤트 ID가 매니페스트와 다릅니다.');
    }
    seenIds.add(event.id);
    pickBackupImageFields(event, event.id);
  }
}

async function rollbackEventUpdates({
  manifest: candidate,
  db,
  backupPath = getBackupPath(candidate.version),
  readFile = fs.promises.readFile,
  deleteSentinel,
}) {
  assertManifestContract(candidate);
  const backup = JSON.parse(await readFile(backupPath, 'utf8'));
  validateBackup(candidate, backup);
  const refsById = new Map(
    getEventRefs(db, candidate).map((ref, index) => [candidate.events[index].id, ref]),
  );
  const batch = db.batch();

  for (const event of backup.events) {
    const update = pickBackupImageFields(event, event.id);
    if (update.detailImage === null) {
      if (deleteSentinel === undefined) {
        throw new Error('detailImage 누락 복원을 위한 Firestore delete sentinel이 없습니다.');
      }
      update.detailImage = deleteSentinel;
    }
    batch.update(refsById.get(event.id), update);
  }
  await batch.commit();

  return { restored: backup.events.length, batchCommitted: true };
}

async function checkImageResponse(url, fetchImpl) {
  try {
    const response = await fetchImpl(url, {
      method: 'GET',
      headers: { Range: 'bytes=0-0' },
      redirect: 'follow',
    });
    const contentType = response.headers?.get?.('content-type') || '';
    const reachable = response.ok && contentType.toLowerCase().startsWith(CONTENT_TYPE);
    if (response.body?.cancel) {
      await response.body.cancel().catch(() => {});
    }
    return reachable;
  } catch {
    return false;
  }
}

async function verifyEventUpdates({
  manifest: candidate,
  db,
  bucketName,
  fetchImpl = global.fetch,
  onStatus = () => {},
}) {
  assertManifestContract(candidate);
  if (typeof fetchImpl !== 'function') {
    throw new Error('이미지 HTTP 응답을 검증할 fetch 구현이 없습니다.');
  }

  const docs = await loadEventDocuments(db, candidate);
  let validDocuments = 0;
  let reachableImages = 0;

  for (const doc of docs) {
    const expected = buildEventUpdate(
      buildStoragePlan({ id: doc.id }, candidate.version),
      bucketName,
    );
    const data = doc.data();
    const valid = IMAGE_FIELDS.every((field) => data[field] === expected[field]);
    if (valid) {
      validDocuments += 1;
    }
    onStatus({ eventId: doc.id, kind: 'firestore', success: valid });
  }

  for (const event of candidate.events) {
    const expected = buildEventUpdate(buildStoragePlan(event, candidate.version), bucketName);
    const checks = [
      ['wide', expected.bannerImage],
      ['card', expected.thumbnailImage],
    ];
    for (const [kind, url] of checks) {
      const reachable = await checkImageResponse(url, fetchImpl);
      if (reachable) {
        reachableImages += 1;
      }
      onStatus({ eventId: event.id, kind, success: reachable });
    }
  }

  return { events: docs.length, validDocuments, reachableImages };
}

function redactSensitiveMessage(message) {
  return String(message || '알 수 없는 오류')
    .replace(
      /-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----[\s\S]*?-----END (?:[A-Z ]+ )?PRIVATE KEY-----/g,
      '[PRIVATE_KEY_REDACTED]',
    )
    .replace(
      /("(?:access_token|refresh_token|private_key|api_key|token)"\s*:\s*)"[^"]*"/gi,
      '$1"[REDACTED]"',
    )
    .replace(/https?:\/\/[^\s"')]+/gi, '[URL_REDACTED]')
    .replace(/([?&](?:token|access_token|refresh_token|key)=)[^&\s]+/gi, '$1[REDACTED]')
    .replace(/(Bearer\s+)\S+/gi, '$1[REDACTED]');
}

function printStatus({ eventId, kind, success }) {
  console.log(`${eventId} ${kind} success=${success}`);
}

function getFirebaseRuntime({
  loadAdminContext = () => require('./util-firestore-admin'),
  env = process.env,
} = {}) {
  const { admin, db, projectId: resolvedProjectId } = loadAdminContext();
  const projectId = admin.app().options.projectId || resolvedProjectId;
  const configuredBucket =
    env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || `${projectId}.firebasestorage.app`;
  const bucket = admin.storage().bucket(configuredBucket);

  return {
    db,
    bucket,
    projectId,
    deleteSentinel: admin.firestore.FieldValue.delete(),
  };
}

async function main(argv = process.argv.slice(2)) {
  const command = parseCommand(argv);
  assertManifestContract(manifest);
  const { db, bucket, projectId, deleteSentinel } = getFirebaseRuntime();

  if (command === 'analyze') {
    const result = await analyzeEventImages({ manifest, db });
    console.log(
      `events=${result.events} localAssets=${result.localAssets} adminReady=${result.adminReady}`,
    );
    if (result.events !== EXPECTED_EVENT_COUNT || result.localAssets !== EXPECTED_OBJECT_COUNT) {
      process.exitCode = 1;
    }
    return;
  }

  if (command === 'upload') {
    const result = await uploadEventImages({
      manifest,
      bucket,
      projectId,
      onStatus: printStatus,
    });
    console.log(`uploaded=${result.uploaded} failed=${result.failed}`);
    if (result.failed !== 0 || result.uploaded !== EXPECTED_OBJECT_COUNT) {
      process.exitCode = 1;
    }
    return;
  }

  if (command === 'verify-upload') {
    const result = await verifyStorageObjects({ manifest, bucket, onStatus: printStatus });
    console.log(`verified=${result.verified} failed=${result.failed}`);
    if (result.failed !== 0 || result.verified !== EXPECTED_OBJECT_COUNT) {
      process.exitCode = 1;
    }
    return;
  }

  if (command === 'apply') {
    const result = await applyEventUpdates({
      manifest,
      bucket,
      db,
      projectId,
    });
    console.log(`updated=${result.updated} batchCommitted=${result.batchCommitted}`);
    return;
  }

  if (command === 'verify') {
    const result = await verifyEventUpdates({
      manifest,
      db,
      bucketName: bucket.name,
      onStatus: printStatus,
    });
    console.log(
      `events=${result.events} validDocuments=${result.validDocuments} reachableImages=${result.reachableImages}`,
    );
    if (
      result.events !== EXPECTED_EVENT_COUNT ||
      result.validDocuments !== EXPECTED_EVENT_COUNT ||
      result.reachableImages !== EXPECTED_OBJECT_COUNT
    ) {
      process.exitCode = 1;
    }
    return;
  }

  const result = await rollbackEventUpdates({ manifest, db, deleteSentinel });
  console.log(`restored=${result.restored} batchCommitted=${result.batchCommitted}`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`event image firebase sync failed: ${redactSensitiveMessage(error.message)}`);
    process.exitCode = 1;
  });
}

module.exports = {
  CACHE_CONTROL,
  CONTENT_TYPE,
  EXPECTED_EVENT_COUNT,
  EXPECTED_OBJECT_COUNT,
  analyzeEventImages,
  applyEventUpdates,
  assertFirebaseTargetConsistency,
  assertManifestContract,
  buildEventUpdate,
  buildStoragePlan,
  buildSyncEntries,
  createDownloadUrl,
  getBackupPath,
  getFirebaseRuntime,
  parseCommand,
  redactSensitiveMessage,
  rollbackEventUpdates,
  uploadEventImages,
  verifyEventUpdates,
  verifyStorageObjects,
};
