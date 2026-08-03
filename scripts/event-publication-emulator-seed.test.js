const {
  buildEmulatorDocuments,
  collectTargetProductIds,
  decodeFirestoreFields,
  seedPublicationFixture,
} = require('./event-publication-emulator-seed');
const {
  buildPublicationManifest,
} = require('./event-publication-manifest');
const imageDecisions = require('./event-publication-image-decisions.json');

describe('event publication emulator seed', () => {
  test('32개 공개 이벤트와 로컬 이미지 경로를 구성한다', () => {
    const documents = buildEmulatorDocuments(
      buildPublicationManifest(),
      imageDecisions,
    );

    expect(documents).toHaveLength(32);
    expect(documents.every(document => (
      document.data.publicPolicyVerified === true
      && document.data.isActive === true
      && document.data.bannerImage.startsWith('/events/')
      && document.data.thumbnailImage.startsWith('/events/')
    ))).toBe(true);
  });

  test('Emulator runtime에만 32개를 기록한다', async () => {
    const writes = [];
    const productIds = collectTargetProductIds(buildPublicationManifest());
    const runtime = {
      isEmulator: true,
      async commitWrites(nextWrites) {
        writes.push(...nextWrites);
      },
      async loadSourceProducts(ids) {
        return ids.map(id => ({
          id,
          data: { name: `상품 ${id}`, status: 'active' },
        }));
      },
    };

    const result = await seedPublicationFixture(
      runtime,
      buildPublicationManifest(),
      imageDecisions,
    );

    expect(result).toEqual({
      seeded: 32,
      seededProducts: productIds.length,
      verified: 32,
    });
    expect(writes.filter(write => write.collection === 'events')).toHaveLength(32);
    expect(writes.filter(write => write.collection === 'products')).toHaveLength(productIds.length);
  });

  test('Emulator가 아닌 runtime은 거부한다', async () => {
    await expect(seedPublicationFixture(
      { isEmulator: false, commitWrites: jest.fn() },
      buildPublicationManifest(),
      imageDecisions,
    )).rejects.toThrow(/Emulator/);
  });

  test('대상 상품 ID를 중복 없이 수집하고 Firestore REST 필드를 변환한다', () => {
    expect(collectTargetProductIds(buildPublicationManifest())).toEqual([
      'cool-touch-oversized-shirt',
      'linen-like-half-shirt',
      'seersucker-half-jacket',
      'light-zip-up-jacket',
      'style-now-autumn-01',
      'style-now-autumn-08',
    ]);

    expect(decodeFirestoreFields({
      name: { stringValue: '리넨 셔츠' },
      price: { integerValue: '39000' },
      rating: { doubleValue: 4.7 },
      isNew: { booleanValue: true },
      createdAt: { timestampValue: '2026-07-01T00:00:00.000Z' },
      colors: {
        arrayValue: {
          values: [{ stringValue: '오프화이트' }, { stringValue: '네이비' }],
        },
      },
    }, {
      timestampFromIso: value => `timestamp:${value}`,
    })).toEqual({
      name: '리넨 셔츠',
      price: 39000,
      rating: 4.7,
      isNew: true,
      createdAt: 'timestamp:2026-07-01T00:00:00.000Z',
      colors: ['오프화이트', '네이비'],
    });
  });
});
