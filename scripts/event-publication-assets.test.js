const {
  buildStorageObjectName,
  buildImagePreparationManifests,
  buildUploadPlan,
  parseFirebaseStorageObjectName,
  validateImageDecisions,
} = require('./event-publication-assets');
const {
  buildPublicationManifest,
  PUBLICATION_VERSION,
} = require('./event-publication-manifest');

function createDecisionFixture(events) {
  return {
    version: PUBLICATION_VERSION,
    events: events.map(event => {
      const isLegacy = event.source === 'legacy';
      const asset = role => isLegacy
        ? {
          action: 'reuse',
          sourceUrl:
            `https://firebasestorage.googleapis.com/v0/b/hebimall.firebasestorage.app/` +
            `o/${event.id}-${role}.webp?alt=media`,
          reason: 'safe_copy_and_crop',
        }
        : {
          action: 'generate',
          output: `public/events/2026-publication/${event.id}-${PUBLICATION_VERSION}-${role}.webp`,
          reason: 'new_event',
        };

      return {
        id: event.id,
        source: event.source,
        wide: asset('wide'),
        card: asset('card'),
      };
    }),
  };
}

describe('event publication assets', () => {
  test('32개 이벤트에 wide와 card 결정을 각각 요구한다', () => {
    const manifest = buildPublicationManifest();
    const decisions = createDecisionFixture(manifest.events);

    expect(validateImageDecisions(decisions, manifest)).toEqual({
      events: 32,
      reusedAssets: 44,
      generatedAssets: 20,
    });
  });

  test('신규 이벤트는 기존 이미지를 재사용할 수 없다', () => {
    const manifest = buildPublicationManifest();
    const decisions = createDecisionFixture(manifest.events);
    decisions.events.find(event => event.source === 'new').wide = {
      action: 'reuse',
      sourceUrl:
        'https://firebasestorage.googleapis.com/v0/b/hebimall.firebasestorage.app/o/legacy.webp?alt=media',
      reason: 'invalid',
    };

    expect(() => validateImageDecisions(decisions, manifest))
      .toThrow(/신규 이벤트.*reuse/);
  });

  test('생성 파일을 덮어쓰지 않는 버전 경로에 매핑한다', () => {
    expect(buildStorageObjectName('event-1', 'wide', '20260731')).toBe(
      'events/publication/event-1-20260731-wide.webp',
    );
  });

  test('Firebase 다운로드 URL에서 인코딩된 객체 경로만 추출한다', () => {
    expect(parseFirebaseStorageObjectName(
      'https://firebasestorage.googleapis.com/v0/b/hebimall.firebasestorage.app/' +
      'o/events%2Fbanner%2Fevent-1.webp?alt=media&token=hidden',
    )).toBe('events/banner/event-1.webp');
  });

  test('업로드 계획에는 생성 판정 자산만 포함한다', () => {
    const manifest = buildPublicationManifest();
    const decisions = createDecisionFixture(manifest.events);
    const plan = buildUploadPlan(decisions, manifest);

    expect(plan).toHaveLength(20);
    expect(plan[0]).toMatchObject({
      eventId: 'event-2026-08-summer-sale-edit',
      role: 'wide',
      storagePath:
        'events/publication/event-2026-08-summer-sale-edit-20260731-wide.webp',
    });
  });

  test('안전한 운영 이미지 6개와 글자 없는 기존 원본 34개를 우선 재사용한다', () => {
    const manifest = buildPublicationManifest();
    const sourceIndex = {
      version: PUBLICATION_VERSION,
      assets: manifest.events
        .filter(event => event.source === 'legacy')
        .flatMap(event => ['wide', 'card'].map(role => ({
          eventId: event.id,
          role,
          sourceUrl:
            `https://firebasestorage.googleapis.com/v0/b/hebimall.firebasestorage.app/` +
            `o/${event.id}-${role}.webp?alt=media`,
        }))),
    };

    const prepared = buildImagePreparationManifests(manifest, sourceIndex);

    expect(prepared.summary).toEqual({
      reusedCurrentAssets: 6,
      derivedFromExistingAssets: 34,
      generatedSourceEvents: 12,
      uploadedAssets: 58,
    });
    expect(prepared.imageManifest.prompts).toHaveLength(12);
    expect(
      prepared.imageManifest.prompts.map(item => item.id),
    ).toEqual(expect.arrayContaining([
      'h1WITXqWE2BL3G0ACiza',
      'PacCrKVG9TikHo7lambG',
      'event-2026-08-summer-sale-edit',
      'event-2026-09-prefall-fit-review',
    ]));
    expect(prepared.imageManifest.assets.find(asset => (
      asset.id === 'event-2026-01-layering-sale' && asset.role === 'card'
    ))).toMatchObject({ position: 'east' });
    expect(prepared.imageManifest.assets.find(asset => (
      asset.id === 'event-2026-08-summer-sale-edit' && asset.role === 'card'
    ))).toMatchObject({ position: 'centre' });
  });
});
