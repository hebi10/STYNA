const {
  PUBLICATION_VERSION,
  buildPublicationManifest,
  validatePublicationManifest,
} = require('./event-publication-manifest');

const EXPECTED_NEW_EVENT_IDS = [
  'event-2026-08-summer-sale-edit',
  'event-2026-08-bag-accessory-sale',
  'event-2026-09-active-sale',
  'event-2026-08-prefall-layering-new',
  'event-2026-08-daily-bag-new',
  'event-2026-09-city-shoes-new',
  'event-2026-08-late-summer-style',
  'event-2026-09-back-to-city',
  'event-2026-08-summer-fit-review',
  'event-2026-09-prefall-fit-review',
];

describe('event publication manifest', () => {
  test('기존 22개와 신규 10개를 하나의 버전으로 구성한다', () => {
    const manifest = buildPublicationManifest();

    expect(manifest.version).toBe(PUBLICATION_VERSION);
    expect(manifest.events).toHaveLength(32);
    expect(manifest.events.filter(event => event.source === 'legacy')).toHaveLength(22);
    expect(manifest.events.filter(event => event.source === 'new')).toHaveLength(10);
    expect(
      manifest.events.filter(event => event.source === 'new').map(event => event.id),
    ).toEqual(EXPECTED_NEW_EVENT_IDS);
    expect(validatePublicationManifest(manifest)).toEqual({
      eventCount: 32,
      legacyCount: 22,
      newCount: 10,
    });
  });

  test('공개 문구에 구현되지 않은 혜택을 포함하지 않는다', () => {
    const copy = JSON.stringify(buildPublicationManifest());

    expect(copy).not.toMatch(
      /자동\s*(발급|지급|적용)|생일\s*쿠폰|실시간\s*상담|상담.*쿠폰|추가\s*적립|적립금\s*(?:두\s*배|\d)|무료배송|최대\s*\d+%|당일\s*(?:출고|배송)/,
    );
  });

  test('32개 모두 보상 없음 계약을 사용하고 리뷰 이벤트만 대상 상품을 갖는다', () => {
    for (const event of buildPublicationManifest().events) {
      expect(event.rewardType).toBe('none');
      expect(event).not.toHaveProperty('rewardCouponId');

      if (event.eligibilityType === 'review') {
        expect(event.targetProducts.length).toBeGreaterThan(0);
      } else {
        expect(event.eligibilityType).toBe('none');
        expect(event).not.toHaveProperty('targetProducts');
      }
    }
  });

  test('잘못된 카테고리와 중복 ID를 이벤트 ID가 포함된 오류로 거부한다', () => {
    const invalidCategory = buildPublicationManifest();
    invalidCategory.events.find(event => event.id === EXPECTED_NEW_EVENT_IDS[0])
      .targetCategories = ['상의'];
    expect(() => validatePublicationManifest(invalidCategory))
      .toThrow(/event-2026-08-summer-sale-edit.*카테고리/);

    const duplicateId = buildPublicationManifest();
    duplicateId.events[31].id = duplicateId.events[0].id;
    expect(() => validatePublicationManifest(duplicateId))
      .toThrow(/중복.*event-2026-01-layering-sale/);
  });

  test('신규 날짜는 KST의 시작일 00시와 종료일 23시 59분 59초를 사용한다', () => {
    const event = buildPublicationManifest().events.find(
      item => item.id === 'event-2026-08-summer-sale-edit',
    );

    expect(event.startDate).toBe('2026-07-31T15:00:00.000Z');
    expect(event.endDate).toBe('2026-08-23T14:59:59.000Z');
  });
});
