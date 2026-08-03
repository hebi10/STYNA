const {
  PUBLICATION_VERSION,
  buildPublicationManifest,
  validatePublicationManifest,
} = require('./event-publication-manifest');
const {
  validateImageDecisions,
} = require('./event-publication-assets');

const imageDecisions = require('./event-publication-image-decisions.json');

function generatedOutputToPublicPath(output) {
  return `/${output.replace(/\\/g, '/').replace(/^public\//, '')}`;
}

function collectTargetProductIds(manifest) {
  return [...new Set(manifest.events.flatMap(event => event.targetProducts ?? []))];
}

function decodeFirestoreValue(value, runtime = {}) {
  if ('stringValue' in value) return value.stringValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return Number(value.doubleValue);
  if ('nullValue' in value) return null;
  if ('timestampValue' in value) {
    return runtime.timestampFromIso
      ? runtime.timestampFromIso(value.timestampValue)
      : value.timestampValue;
  }
  if ('arrayValue' in value) {
    return (value.arrayValue.values ?? []).map(item => (
      decodeFirestoreValue(item, runtime)
    ));
  }
  if ('mapValue' in value) {
    return decodeFirestoreFields(value.mapValue.fields ?? {}, runtime);
  }
  if ('referenceValue' in value) return value.referenceValue;
  if ('bytesValue' in value) return Buffer.from(value.bytesValue, 'base64');
  if ('geoPointValue' in value) return value.geoPointValue;
  throw new Error(`지원하지 않는 Firestore 값 형식입니다: ${Object.keys(value).join(', ')}`);
}

function decodeFirestoreFields(fields, runtime = {}) {
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [
    key,
    decodeFirestoreValue(value, runtime),
  ]));
}

function buildEmulatorDocuments(manifest, decisions, runtime = {}) {
  validatePublicationManifest(manifest);
  validateImageDecisions(decisions, manifest);
  const decisionsById = new Map(decisions.events.map(event => [event.id, event]));
  const timestampFromIso = runtime.timestampFromIso || (value => value);
  const createdAt = timestampFromIso('2026-07-31T00:00:00.000Z');

  return manifest.events.map(event => {
    const decision = decisionsById.get(event.id);
    const resolveImage = (role, legacySuffix) => (
      decision[role].action === 'reuse'
        ? `/events/2026/${event.id}-${legacySuffix}.webp`
        : generatedOutputToPublicPath(decision[role].output)
    );
    const bannerImage = resolveImage('wide', 'banner');

    return {
      id: event.id,
      data: {
        title: event.title,
        description: event.description,
        content: event.content,
        eventType: event.eventType,
        eligibilityType: event.eligibilityType,
        rewardType: 'none',
        publicPolicyVerified: true,
        publicationVersion: PUBLICATION_VERSION,
        startDate: timestampFromIso(event.startDate),
        endDate: timestampFromIso(event.endDate),
        isActive: true,
        bannerImage,
        detailImage: bannerImage,
        thumbnailImage: resolveImage('card', 'thumb'),
        participantCount: 0,
        hasMaxParticipants: false,
        ...(event.targetCategories ? { targetCategories: event.targetCategories } : {}),
        ...(event.targetProducts ? { targetProducts: event.targetProducts } : {}),
        createdAt,
        updatedAt: createdAt,
      },
    };
  });
}

async function seedPublicationFixture(runtime, manifest, decisions) {
  if (!runtime?.isEmulator) {
    throw new Error('Firestore Emulator runtime에서만 seed할 수 있습니다.');
  }
  const documents = buildEmulatorDocuments(manifest, decisions, runtime);
  await runtime.commitWrites(documents.map(document => ({
    ...document,
    collection: 'events',
    merge: false,
  })));
  const targetProductIds = collectTargetProductIds(manifest);
  const products = await runtime.loadSourceProducts(targetProductIds);
  if (products.length !== targetProductIds.length) {
    throw new Error(
      `대상 상품 ${targetProductIds.length}개 중 ${products.length}개만 불러왔습니다.`,
    );
  }
  await runtime.commitWrites(products.map(product => ({
    ...product,
    collection: 'products',
    merge: false,
  })));
  return {
    seeded: documents.length,
    seededProducts: products.length,
    verified: documents.filter(document => (
      document.data.publicPolicyVerified === true
    )).length,
  };
}

function createEmulatorRuntime() {
  const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;
  if (!emulatorHost) {
    throw new Error('FIRESTORE_EMULATOR_HOST가 필요합니다.');
  }
  const admin = require('firebase-admin');
  const projectId = process.env.EVENT_PUBLICATION_EMULATOR_PROJECT_ID || 'hebimall';
  const appName = `event-publication-emulator-${Date.now()}`;
  const app = admin.initializeApp({ projectId }, appName);
  const db = app.firestore();

  return {
    isEmulator: true,
    timestampFromIso: value => admin.firestore.Timestamp.fromDate(new Date(value)),
    async loadSourceProducts(ids) {
      return Promise.all(ids.map(async id => {
        const url = [
          'https://firestore.googleapis.com/v1/projects',
          projectId,
          'databases/(default)/documents/products',
          encodeURIComponent(id),
        ].join('/');
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`운영 상품 ${id} 조회 실패 (${response.status})`);
        }
        const document = await response.json();
        return {
          id,
          data: decodeFirestoreFields(document.fields ?? {}, {
            timestampFromIso: value => admin.firestore.Timestamp.fromDate(new Date(value)),
          }),
        };
      }));
    },
    async commitWrites(writes) {
      const batch = db.batch();
      for (const write of writes) {
        batch.set(db.collection(write.collection).doc(write.id), write.data, {
          merge: write.merge,
        });
      }
      await batch.commit();
    },
  };
}

async function main() {
  const result = await seedPublicationFixture(
    createEmulatorRuntime(),
    buildPublicationManifest(),
    imageDecisions,
  );
  console.log(JSON.stringify(result, null, 2));
  return result;
}

if (require.main === module) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}

module.exports = {
  buildEmulatorDocuments,
  collectTargetProductIds,
  createEmulatorRuntime,
  decodeFirestoreFields,
  seedPublicationFixture,
};
