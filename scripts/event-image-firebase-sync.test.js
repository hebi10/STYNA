const {
  CACHE_CONTROL,
  applyEventUpdates,
  assertFirebaseTargetConsistency,
  buildStoragePlan,
  buildEventUpdate,
  getFirebaseRuntime,
  parseCommand,
  redactSensitiveMessage,
  rollbackEventUpdates,
  uploadEventImages,
} = require('./event-image-firebase-sync');

function createManifest(eventCount = 22) {
  return {
    version: '20260714',
    events: Array.from({ length: eventCount }, (_, index) => {
      const id = `event-${String(index + 1).padStart(2, '0')}`;
      return {
        id,
        wideOutput: `public/events/2026-v2/${id}-wide.webp`,
        cardOutput: `public/events/2026-v2/${id}-card.webp`,
      };
    }),
  };
}

function createVerifiedBucket() {
  return {
    name: 'bucket-example.firebasestorage.app',
    file: jest.fn(() => ({
      exists: jest.fn().mockResolvedValue([true]),
      getMetadata: jest.fn().mockResolvedValue([
        {
          contentType: 'image/webp',
          cacheControl: CACHE_CONTROL,
        },
      ]),
    })),
  };
}

function createBackup(manifest) {
  return {
    version: manifest.version,
    events: manifest.events.map((event) => ({
      id: event.id,
      bannerImage: `old-banner-${event.id}`,
      detailImage: `old-detail-${event.id}`,
      thumbnailImage: `old-thumbnail-${event.id}`,
    })),
  };
}

function createFirestoreFixture(manifest, dataById, commit = jest.fn().mockResolvedValue(undefined)) {
  const refs = manifest.events.map((event) => ({ id: event.id }));
  const docs = manifest.events.map((event, index) => ({
    id: event.id,
    exists: true,
    ref: refs[index],
    data: () => dataById.get(event.id),
  }));
  const update = jest.fn();
  const batch = { update, commit };
  const db = {
    collection: jest.fn(() => ({
      doc: jest.fn((id) => refs.find((ref) => ref.id === id)),
    })),
    getAll: jest.fn().mockResolvedValue(docs),
    batch: jest.fn(() => batch),
  };

  return { db, update, commit };
}

function createOldDataById(backup) {
  return new Map(
    backup.events.map((event) => [
      event.id,
      {
        bannerImage: event.bannerImage,
        detailImage: event.detailImage,
        thumbnailImage: event.thumbnailImage,
      },
    ]),
  );
}

function createNewDataById(manifest, bucketName) {
  return new Map(
    manifest.events.map((event) => [
      event.id,
      buildEventUpdate(buildStoragePlan(event, manifest.version), bucketName),
    ]),
  );
}

test('loads admin configuration before resolving the configured storage bucket', () => {
  const env = {};
  const bucket = { name: 'configured-project.firebasestorage.app' };
  const deleteSentinel = { operation: 'delete-field' };
  const bucketFactory = jest.fn(() => bucket);
  const admin = {
    app: jest.fn(() => ({ options: { projectId: 'configured-project' } })),
    storage: jest.fn(() => ({ bucket: bucketFactory })),
    firestore: {
      FieldValue: {
        delete: jest.fn(() => deleteSentinel),
      },
    },
  };
  const db = {};
  const loadAdminContext = jest.fn(() => {
    env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = 'configured-project.firebasestorage.app';
    return { admin, db, projectId: 'configured-project' };
  });

  const runtime = getFirebaseRuntime({ loadAdminContext, env });

  expect(loadAdminContext).toHaveBeenCalledTimes(1);
  expect(bucketFactory).toHaveBeenCalledWith('configured-project.firebasestorage.app');
  expect(runtime).toEqual({
    db,
    bucket,
    projectId: 'configured-project',
    deleteSentinel,
  });
});

test('rejects a storage bucket that does not belong to the firestore project', () => {
  expect(() =>
    assertFirebaseTargetConsistency({
      projectId: 'firestore-project',
      bucket: { name: 'different-project.firebasestorage.app' },
    }),
  ).toThrow('프로젝트와 Storage 버킷이 일치하지 않습니다');
});

test('checks project and bucket consistency before any storage or firestore access in apply', async () => {
  const manifest = createManifest();
  const bucket = createVerifiedBucket();
  const db = {
    collection: jest.fn(),
    getAll: jest.fn(),
    batch: jest.fn(),
  };

  await expect(
    applyEventUpdates({
      manifest,
      bucket,
      db,
      projectId: 'different-project',
      backupPath: 'C:/temp/event-backup.json',
    }),
  ).rejects.toThrow('프로젝트와 Storage 버킷이 일치하지 않습니다');

  expect(bucket.file).not.toHaveBeenCalled();
  expect(db.collection).not.toHaveBeenCalled();
  expect(db.getAll).not.toHaveBeenCalled();
  expect(db.batch).not.toHaveBeenCalled();
});

test('maps one event to two storage objects and three firestore fields', () => {
  const event = {
    id: 'event-1',
    wideOutput: 'public/events/2026-v2/event-1-wide.webp',
    cardOutput: 'public/events/2026-v2/event-1-card.webp',
  };
  const plan = buildStoragePlan(event, '20260714');

  expect(plan).toEqual({
    wide: 'events/banner/event-1-20260714-wide.webp',
    card: 'events/thumbnail/event-1-20260714-card.webp',
  });
  expect(buildEventUpdate(plan, 'bucket.example')).toEqual({
    bannerImage:
      'https://firebasestorage.googleapis.com/v0/b/bucket.example/o/events%2Fbanner%2Fevent-1-20260714-wide.webp?alt=media',
    detailImage:
      'https://firebasestorage.googleapis.com/v0/b/bucket.example/o/events%2Fbanner%2Fevent-1-20260714-wide.webp?alt=media',
    thumbnailImage:
      'https://firebasestorage.googleapis.com/v0/b/bucket.example/o/events%2Fthumbnail%2Fevent-1-20260714-card.webp?alt=media',
  });
});

test('rejects unknown commands', () => {
  expect(() => parseCommand(['delete'])).toThrow('지원하지 않는 명령');
});

test('accepts the non-destructive migration commands', () => {
  for (const command of ['analyze', 'upload', 'verify-upload', 'apply', 'verify', 'rollback']) {
    expect(parseCommand([command])).toBe(command);
  }
});

test('redacts full URLs, JSON tokens, and private keys from command errors', () => {
  const message = [
    'request failed at https://example.test/image.webp?token=url-secret',
    '{"access_token":"json-secret"}',
    '-----BEGIN PRIVATE KEY-----private-secret-----END PRIVATE KEY-----',
  ].join('\n');

  const redacted = redactSensitiveMessage(message);

  expect(redacted).not.toContain('https://');
  expect(redacted).not.toContain('url-secret');
  expect(redacted).not.toContain('json-secret');
  expect(redacted).not.toContain('private-secret');
});

test('uploads all 44 local files with immutable WebP metadata', async () => {
  const manifest = createManifest();
  const bucket = {
    name: 'bucket-example.firebasestorage.app',
    upload: jest.fn().mockResolvedValue([]),
  };
  const access = jest.fn().mockResolvedValue(undefined);

  const result = await uploadEventImages({
    manifest,
    bucket,
    projectId: 'bucket-example',
    access,
    cwd: 'C:/workspace',
  });

  expect(access).toHaveBeenCalledTimes(44);
  expect(bucket.upload).toHaveBeenCalledTimes(44);
  expect(bucket.upload).toHaveBeenNthCalledWith(
    1,
    expect.stringMatching(/event-01-wide\.webp$/),
    {
      destination: 'events/banner/event-01-20260714-wide.webp',
      resumable: false,
      preconditionOpts: {
        ifGenerationMatch: 0,
      },
      metadata: {
        contentType: 'image/webp',
        cacheControl: CACHE_CONTROL,
      },
    },
  );
  expect(result).toEqual({ uploaded: 44, failed: 0 });
});

test('checks project and bucket consistency before reading or uploading local assets', async () => {
  const manifest = createManifest();
  const bucket = {
    name: 'different-project.firebasestorage.app',
    upload: jest.fn(),
  };
  const access = jest.fn();

  await expect(
    uploadEventImages({
      manifest,
      bucket,
      projectId: 'firestore-project',
      access,
      cwd: 'C:/workspace',
    }),
  ).rejects.toThrow('프로젝트와 Storage 버킷이 일치하지 않습니다');

  expect(access).not.toHaveBeenCalled();
  expect(bucket.upload).not.toHaveBeenCalled();
});

test('refuses to create a firestore batch until all 44 storage objects verify', async () => {
  const manifest = createManifest();
  const bucket = createVerifiedBucket();
  bucket.file.mockImplementationOnce(() => ({
    exists: jest.fn().mockResolvedValue([false]),
    getMetadata: jest.fn(),
  }));
  const db = {
    batch: jest.fn(),
    collection: jest.fn(),
    getAll: jest.fn(),
  };
  const writeFile = jest.fn();

  await expect(
    applyEventUpdates({
      manifest,
      bucket,
      db,
      projectId: 'bucket-example',
      backupPath: 'C:/temp/event-backup.json',
      writeFile,
    }),
  ).rejects.toThrow('44개 Storage 객체 검증');

  expect(db.getAll).not.toHaveBeenCalled();
  expect(db.batch).not.toHaveBeenCalled();
  expect(writeFile).not.toHaveBeenCalled();
});

test.each([
  ['contentType', { contentType: 'image/png', cacheControl: CACHE_CONTROL }],
  ['cacheControl', { contentType: 'image/webp', cacheControl: 'public, max-age=60' }],
])('keeps firestore untouched when storage %s verification fails', async (_, metadata) => {
  const manifest = createManifest();
  const bucket = createVerifiedBucket();
  bucket.file.mockImplementationOnce(() => ({
    exists: jest.fn().mockResolvedValue([true]),
    getMetadata: jest.fn().mockResolvedValue([metadata]),
  }));
  const db = {
    collection: jest.fn(),
    getAll: jest.fn(),
    batch: jest.fn(),
  };
  const readFile = jest.fn();
  const writeFile = jest.fn();

  await expect(
    applyEventUpdates({
      manifest,
      bucket,
      db,
      projectId: 'bucket-example',
      backupPath: 'C:/temp/event-backup.json',
      readFile,
      writeFile,
    }),
  ).rejects.toThrow('44개 Storage 객체 검증');

  expect(db.collection).not.toHaveBeenCalled();
  expect(db.getAll).not.toHaveBeenCalled();
  expect(db.batch).not.toHaveBeenCalled();
  expect(readFile).not.toHaveBeenCalled();
  expect(writeFile).not.toHaveBeenCalled();
});

test('backs up three fields and commits all 22 firestore updates once', async () => {
  const manifest = createManifest();
  const bucket = createVerifiedBucket();
  const refs = manifest.events.map((event) => ({ id: event.id }));
  const docs = manifest.events.map((event, index) => ({
    id: event.id,
    exists: true,
    ref: refs[index],
    data: () => ({
      bannerImage: `old-banner-${event.id}`,
      detailImage: `old-detail-${event.id}`,
      thumbnailImage: `old-thumbnail-${event.id}`,
      title: '보존되어야 하는 필드',
    }),
  }));
  const update = jest.fn();
  const commit = jest.fn().mockResolvedValue(undefined);
  const db = {
    collection: jest.fn(() => ({
      doc: jest.fn((id) => refs.find((ref) => ref.id === id)),
    })),
    getAll: jest.fn().mockResolvedValue(docs),
    batch: jest.fn(() => ({ update, commit })),
  };
  const writeFile = jest.fn().mockResolvedValue(undefined);
  const missingBackup = Object.assign(new Error('missing'), { code: 'ENOENT' });
  const readFile = jest.fn().mockRejectedValue(missingBackup);

  const result = await applyEventUpdates({
    manifest,
    bucket,
    db,
    projectId: 'bucket-example',
    backupPath: 'C:/temp/event-backup.json',
    readFile,
    writeFile,
  });

  expect(writeFile).toHaveBeenCalledTimes(1);
  const [backupPath, backupJson, writeOptions] = writeFile.mock.calls[0];
  expect(backupPath).toBe('C:/temp/event-backup.json');
  expect(writeOptions).toEqual({ encoding: 'utf8', flag: 'wx' });
  const backup = JSON.parse(backupJson);
  expect(backup.version).toBe('20260714');
  expect(backup.events).toHaveLength(22);
  expect(backup.events[0]).toEqual({
    id: 'event-01',
    bannerImage: 'old-banner-event-01',
    detailImage: 'old-detail-event-01',
    thumbnailImage: 'old-thumbnail-event-01',
  });
  expect(update).toHaveBeenCalledTimes(22);
  expect(update.mock.calls[0][1]).toEqual({
    bannerImage:
      'https://firebasestorage.googleapis.com/v0/b/bucket-example.firebasestorage.app/o/events%2Fbanner%2Fevent-01-20260714-wide.webp?alt=media',
    detailImage:
      'https://firebasestorage.googleapis.com/v0/b/bucket-example.firebasestorage.app/o/events%2Fbanner%2Fevent-01-20260714-wide.webp?alt=media',
    thumbnailImage:
      'https://firebasestorage.googleapis.com/v0/b/bucket-example.firebasestorage.app/o/events%2Fthumbnail%2Fevent-01-20260714-card.webp?alt=media',
  });
  expect(commit).toHaveBeenCalledTimes(1);
  expect(result).toEqual({ updated: 22, batchCommitted: true });
});

test('serializes an absent current detailImage as null and commits apply', async () => {
  const manifest = createManifest();
  const bucket = createVerifiedBucket();
  const backup = createBackup(manifest);
  const dataById = createOldDataById(backup);
  delete dataById.get(manifest.events[0].id).detailImage;
  const { db, commit } = createFirestoreFixture(manifest, dataById);
  const missingBackup = Object.assign(new Error('missing'), { code: 'ENOENT' });
  const readFile = jest.fn().mockRejectedValue(missingBackup);
  const writeFile = jest.fn().mockResolvedValue(undefined);

  const result = await applyEventUpdates({
    manifest,
    bucket,
    db,
    projectId: 'bucket-example',
    backupPath: 'C:/temp/event-backup.json',
    readFile,
    writeFile,
  });

  const savedBackup = JSON.parse(writeFile.mock.calls[0][1]);
  expect(savedBackup.events[0]).toEqual({
    id: 'event-01',
    bannerImage: 'old-banner-event-01',
    detailImage: null,
    thumbnailImage: 'old-thumbnail-event-01',
  });
  expect(commit).toHaveBeenCalledTimes(1);
  expect(result).toEqual({ updated: 22, batchCommitted: true });
});

test('rejects an explicit null current detailImage instead of treating it as absent', async () => {
  const manifest = createManifest();
  const bucket = createVerifiedBucket();
  const backup = createBackup(manifest);
  const dataById = createOldDataById(backup);
  dataById.get(manifest.events[0].id).detailImage = null;
  const { db } = createFirestoreFixture(manifest, dataById);
  const missingBackup = Object.assign(new Error('missing'), { code: 'ENOENT' });
  const readFile = jest.fn().mockRejectedValue(missingBackup);
  const writeFile = jest.fn();

  await expect(
    applyEventUpdates({
      manifest,
      bucket,
      db,
      projectId: 'bucket-example',
      backupPath: 'C:/temp/event-backup.json',
      readFile,
      writeFile,
    }),
  ).rejects.toThrow('기존 detailImage 필드를 백업할 수 없습니다');

  expect(writeFile).not.toHaveBeenCalled();
  expect(db.batch).not.toHaveBeenCalled();
});

test('reuses a valid backup and resumes commit when all documents still have old values', async () => {
  const manifest = createManifest();
  const bucket = createVerifiedBucket();
  const backup = createBackup(manifest);
  const dataById = createOldDataById(backup);
  const { db, commit } = createFirestoreFixture(manifest, dataById);
  const readFile = jest.fn().mockResolvedValue(JSON.stringify(backup));
  const writeFile = jest.fn();

  const result = await applyEventUpdates({
    manifest,
    bucket,
    db,
    projectId: 'bucket-example',
    backupPath: 'C:/temp/event-backup.json',
    readFile,
    writeFile,
  });

  expect(writeFile).not.toHaveBeenCalled();
  expect(commit).toHaveBeenCalledTimes(1);
  expect(result).toEqual({ updated: 22, batchCommitted: true, recovery: 'resumed' });
});

test('resumes all-old state when backup detailImage is null and current fields are absent', async () => {
  const manifest = createManifest();
  const bucket = createVerifiedBucket();
  const backup = createBackup(manifest);
  for (const event of backup.events) {
    event.detailImage = null;
  }
  const dataById = createOldDataById(backup);
  for (const data of dataById.values()) {
    delete data.detailImage;
  }
  const { db, commit } = createFirestoreFixture(manifest, dataById);
  const readFile = jest.fn().mockResolvedValue(JSON.stringify(backup));
  const writeFile = jest.fn();

  const result = await applyEventUpdates({
    manifest,
    bucket,
    db,
    projectId: 'bucket-example',
    backupPath: 'C:/temp/event-backup.json',
    readFile,
    writeFile,
  });

  expect(writeFile).not.toHaveBeenCalled();
  expect(commit).toHaveBeenCalledTimes(1);
  expect(result).toEqual({ updated: 22, batchCommitted: true, recovery: 'resumed' });
});

test('treats all-new documents as success without overwriting backup or recommitting', async () => {
  const manifest = createManifest();
  const bucket = createVerifiedBucket();
  const backup = createBackup(manifest);
  const dataById = createNewDataById(manifest, bucket.name);
  const { db } = createFirestoreFixture(manifest, dataById);
  const readFile = jest.fn().mockResolvedValue(JSON.stringify(backup));
  const writeFile = jest.fn();

  const result = await applyEventUpdates({
    manifest,
    bucket,
    db,
    projectId: 'bucket-example',
    backupPath: 'C:/temp/event-backup.json',
    readFile,
    writeFile,
  });

  expect(writeFile).not.toHaveBeenCalled();
  expect(db.batch).not.toHaveBeenCalled();
  expect(result).toEqual({ updated: 22, batchCommitted: true, recovery: 'already-applied' });
});

test.each([
  ['mixed', (manifest, backup, dataById, bucketName) => {
    dataById.set(
      manifest.events[0].id,
      createNewDataById(manifest, bucketName).get(manifest.events[0].id),
    );
  }],
  ['third', (manifest, backup, dataById) => {
    dataById.set(manifest.events[0].id, {
      ...dataById.get(manifest.events[0].id),
      bannerImage: 'unexpected-third-value',
    });
  }],
])('stops apply for %s document state when a backup already exists', async (_, mutate) => {
  const manifest = createManifest();
  const bucket = createVerifiedBucket();
  const backup = createBackup(manifest);
  const dataById = createOldDataById(backup);
  mutate(manifest, backup, dataById, bucket.name);
  const { db } = createFirestoreFixture(manifest, dataById);
  const readFile = jest.fn().mockResolvedValue(JSON.stringify(backup));
  const writeFile = jest.fn();

  await expect(
    applyEventUpdates({
      manifest,
      bucket,
      db,
      projectId: 'bucket-example',
      backupPath: 'C:/temp/event-backup.json',
      readFile,
      writeFile,
    }),
  ).rejects.toThrow('안전하게 복구할 수 없는 상태');

  expect(writeFile).not.toHaveBeenCalled();
  expect(db.batch).not.toHaveBeenCalled();
});

test('resumes from the preserved backup after a rejected commit leaves all documents old', async () => {
  const manifest = createManifest();
  const bucket = createVerifiedBucket();
  const backup = createBackup(manifest);
  const dataById = createOldDataById(backup);
  let backupJson;
  const missingBackup = Object.assign(new Error('missing'), { code: 'ENOENT' });
  const readFile = jest.fn(async () => {
    if (!backupJson) throw missingBackup;
    return backupJson;
  });
  const writeFile = jest.fn(async (_path, contents) => {
    if (backupJson) {
      const error = new Error('exists');
      error.code = 'EEXIST';
      throw error;
    }
    backupJson = contents;
  });
  const firstCommit = jest.fn().mockRejectedValue(new Error('commit rejected'));
  const secondCommit = jest.fn().mockResolvedValue(undefined);
  const fixture = createFirestoreFixture(manifest, dataById);
  fixture.db.batch
    .mockImplementationOnce(() => ({ update: jest.fn(), commit: firstCommit }))
    .mockImplementationOnce(() => ({ update: jest.fn(), commit: secondCommit }));

  await expect(
    applyEventUpdates({
      manifest,
      bucket,
      db: fixture.db,
      projectId: 'bucket-example',
      backupPath: 'C:/temp/event-backup.json',
      readFile,
      writeFile,
    }),
  ).rejects.toThrow('commit rejected');

  const result = await applyEventUpdates({
    manifest,
    bucket,
    db: fixture.db,
    projectId: 'bucket-example',
    backupPath: 'C:/temp/event-backup.json',
    readFile,
    writeFile,
  });

  expect(writeFile).toHaveBeenCalledTimes(1);
  expect(firstCommit).toHaveBeenCalledTimes(1);
  expect(secondCommit).toHaveBeenCalledTimes(1);
  expect(result).toEqual({ updated: 22, batchCommitted: true, recovery: 'resumed' });
});

test('accepts all-new state without recommitting after a commit response is lost', async () => {
  const manifest = createManifest();
  const bucket = createVerifiedBucket();
  const backup = createBackup(manifest);
  const dataById = createOldDataById(backup);
  let backupJson;
  const missingBackup = Object.assign(new Error('missing'), { code: 'ENOENT' });
  const readFile = jest.fn(async () => {
    if (!backupJson) throw missingBackup;
    return backupJson;
  });
  const writeFile = jest.fn(async (_path, contents) => {
    backupJson = contents;
  });
  const lostResponseCommit = jest.fn(async () => {
    const newDataById = createNewDataById(manifest, bucket.name);
    for (const event of manifest.events) {
      dataById.set(event.id, newDataById.get(event.id));
    }
    throw new Error('commit response lost');
  });
  const fixture = createFirestoreFixture(manifest, dataById);
  fixture.db.batch.mockImplementationOnce(() => ({
    update: jest.fn(),
    commit: lostResponseCommit,
  }));

  await expect(
    applyEventUpdates({
      manifest,
      bucket,
      db: fixture.db,
      projectId: 'bucket-example',
      backupPath: 'C:/temp/event-backup.json',
      readFile,
      writeFile,
    }),
  ).rejects.toThrow('commit response lost');

  const result = await applyEventUpdates({
    manifest,
    bucket,
    db: fixture.db,
    projectId: 'bucket-example',
    backupPath: 'C:/temp/event-backup.json',
    readFile,
    writeFile,
  });

  expect(writeFile).toHaveBeenCalledTimes(1);
  expect(fixture.db.batch).toHaveBeenCalledTimes(1);
  expect(result).toEqual({ updated: 22, batchCommitted: true, recovery: 'already-applied' });
});

test('rolls back only the three backed-up fields without touching storage', async () => {
  const manifest = createManifest();
  const refs = manifest.events.map((event) => ({ id: event.id }));
  const backup = {
    version: manifest.version,
    events: manifest.events.map((event) => ({
      id: event.id,
      bannerImage: `old-banner-${event.id}`,
      detailImage: `old-detail-${event.id}`,
      thumbnailImage: `old-thumbnail-${event.id}`,
      ignored: '이 필드는 복원하면 안 됨',
    })),
  };
  const update = jest.fn();
  const commit = jest.fn().mockResolvedValue(undefined);
  const db = {
    collection: jest.fn(() => ({
      doc: jest.fn((id) => refs.find((ref) => ref.id === id)),
    })),
    batch: jest.fn(() => ({ update, commit })),
  };
  const readFile = jest.fn().mockResolvedValue(JSON.stringify(backup));

  const result = await rollbackEventUpdates({
    manifest,
    db,
    backupPath: 'C:/temp/event-backup.json',
    readFile,
  });

  expect(update).toHaveBeenCalledTimes(22);
  expect(update.mock.calls[0][1]).toEqual({
    bannerImage: 'old-banner-event-01',
    detailImage: 'old-detail-event-01',
    thumbnailImage: 'old-thumbnail-event-01',
  });
  expect(commit).toHaveBeenCalledTimes(1);
  expect(result).toEqual({ restored: 22, batchCommitted: true });
});

test('converts null backup detailImage to an injected firestore delete sentinel on rollback', async () => {
  const manifest = createManifest();
  const backup = createBackup(manifest);
  backup.events[0].detailImage = null;
  const dataById = createOldDataById(createBackup(manifest));
  const { db, update, commit } = createFirestoreFixture(manifest, dataById);
  const readFile = jest.fn().mockResolvedValue(JSON.stringify(backup));
  const deleteSentinel = { operation: 'delete-field' };

  const result = await rollbackEventUpdates({
    manifest,
    db,
    backupPath: 'C:/temp/event-backup.json',
    readFile,
    deleteSentinel,
  });

  expect(update.mock.calls[0][1]).toEqual({
    bannerImage: 'old-banner-event-01',
    detailImage: deleteSentinel,
    thumbnailImage: 'old-thumbnail-event-01',
  });
  expect(commit).toHaveBeenCalledTimes(1);
  expect(result).toEqual({ restored: 22, batchCommitted: true });
});

test.each([
  ['missing detailImage', (event) => delete event.detailImage],
  ['empty detailImage', (event) => { event.detailImage = ''; }],
  ['whitespace detailImage', (event) => { event.detailImage = '   '; }],
  ['non-string detailImage', (event) => { event.detailImage = 42; }],
  ['missing bannerImage', (event) => delete event.bannerImage],
  ['null bannerImage', (event) => { event.bannerImage = null; }],
  ['empty bannerImage', (event) => { event.bannerImage = ''; }],
  ['whitespace bannerImage', (event) => { event.bannerImage = '   '; }],
  ['non-string bannerImage', (event) => { event.bannerImage = 42; }],
  ['missing thumbnailImage', (event) => delete event.thumbnailImage],
  ['null thumbnailImage', (event) => { event.thumbnailImage = null; }],
  ['empty thumbnailImage', (event) => { event.thumbnailImage = ''; }],
  ['whitespace thumbnailImage', (event) => { event.thumbnailImage = '   '; }],
  ['non-string thumbnailImage', (event) => { event.thumbnailImage = 42; }],
])('rejects invalid backup field: %s', async (_, mutate) => {
  const manifest = createManifest();
  const backup = createBackup(manifest);
  mutate(backup.events[0]);
  const dataById = createOldDataById(createBackup(manifest));
  const { db } = createFirestoreFixture(manifest, dataById);
  const readFile = jest.fn().mockResolvedValue(JSON.stringify(backup));

  await expect(
    rollbackEventUpdates({
      manifest,
      db,
      backupPath: 'C:/temp/event-backup.json',
      readFile,
      deleteSentinel: { operation: 'delete-field' },
    }),
  ).rejects.toThrow('백업할 수 없습니다');

  expect(db.batch).not.toHaveBeenCalled();
});
