const imageRefreshManifest = require('./event-image-refresh-manifest.json');

const PUBLICATION_VERSION = '20260731';

const VALID_CATEGORY_SLUGS = new Set([
  'tops',
  'bottoms',
  'clothing',
  'bags',
  'shoes',
  'accessories',
  'sports',
]);

const UNSUPPORTED_PUBLIC_COPY =
  /자동\s*(발급|지급|적용)|생일\s*쿠폰|실시간\s*상담|상담.*쿠폰|추가\s*적립|적립금\s*(?:두\s*배|\d)|무료배송|최대\s*\d+%|당일\s*(?:출고|배송)/;

const CATEGORY_SLUGS = Object.freeze({
  상의: 'tops',
  하의: 'bottoms',
  아우터: 'clothing',
  가방: 'bags',
  신발: 'shoes',
  액세서리: 'accessories',
  스포츠: 'sports',
});

const LEGACY_TYPE_OVERRIDES = Object.freeze({
  'event-2026-01-welcome-coupon': 'special',
  'event-2026-03-white-day-coupon': 'special',
  'event-2026-04-styling-coupon': 'special',
  'event-2026-05-family-coupon': 'special',
  'event-2026-07-vacation-coupon': 'special',
  h1WITXqWE2BL3G0ACiza: 'special',
  PacCrKVG9TikHo7lambG: 'sale',
});

const LEGACY_EVENT_STATE = Object.freeze({
  PacCrKVG9TikHo7lambG: {
    eventType: 'coupon',
    startDate: '2025-08-11T07:36:00.000Z',
    endDate: '2028-12-31T07:36:00.000Z',
    targetCategories: ['전체'],
  },
  'event-2026-01-layering-sale': {
    eventType: 'sale',
    startDate: '2026-01-02T15:00:00.000Z',
    endDate: '2026-01-24T14:59:59.000Z',
    targetCategories: ['아우터', '상의'],
  },
  'event-2026-01-welcome-coupon': {
    eventType: 'coupon',
    startDate: '2026-01-09T15:00:00.000Z',
    endDate: '2026-01-31T14:59:59.000Z',
    targetCategories: [],
  },
  'event-2026-02-knit-review': {
    eventType: 'special',
    startDate: '2026-01-31T15:00:00.000Z',
    endDate: '2026-02-20T14:59:59.000Z',
    targetCategories: ['상의'],
  },
  'event-2026-02-spring-preview': {
    eventType: 'new',
    startDate: '2026-02-13T15:00:00.000Z',
    endDate: '2026-02-28T14:59:59.000Z',
    targetCategories: [],
  },
  'event-2026-03-photo-review': {
    eventType: 'special',
    startDate: '2026-03-17T15:00:00.000Z',
    endDate: '2026-03-31T14:59:59.000Z',
    targetCategories: [],
  },
  'event-2026-03-trench-week': {
    eventType: 'sale',
    startDate: '2026-02-28T15:00:00.000Z',
    endDate: '2026-03-16T14:59:59.000Z',
    targetCategories: ['아우터'],
  },
  'event-2026-03-white-day-coupon': {
    eventType: 'coupon',
    startDate: '2026-03-08T15:00:00.000Z',
    endDate: '2026-03-20T14:59:59.000Z',
    targetCategories: [],
  },
  'event-2026-04-office-look': {
    eventType: 'sale',
    startDate: '2026-04-11T15:00:00.000Z',
    endDate: '2026-04-27T14:59:59.000Z',
    targetCategories: ['상의', '하의', '아우터'],
  },
  'event-2026-04-shirt-collection': {
    eventType: 'new',
    startDate: '2026-03-31T15:00:00.000Z',
    endDate: '2026-04-14T14:59:59.000Z',
    targetCategories: ['상의'],
  },
  'event-2026-04-styling-coupon': {
    eventType: 'coupon',
    startDate: '2026-04-19T15:00:00.000Z',
    endDate: '2026-04-30T14:59:59.000Z',
    targetCategories: [],
  },
  'event-2026-05-best-review': {
    eventType: 'special',
    startDate: '2026-05-19T15:00:00.000Z',
    endDate: '2026-06-05T14:59:59.000Z',
    targetCategories: [],
  },
  'event-2026-05-denim-festival': {
    eventType: 'sale',
    startDate: '2026-04-30T15:00:00.000Z',
    endDate: '2026-05-18T14:59:59.000Z',
    targetCategories: ['하의', '상의'],
  },
  'event-2026-05-family-coupon': {
    eventType: 'coupon',
    startDate: '2026-05-09T15:00:00.000Z',
    endDate: '2026-05-31T14:59:59.000Z',
    targetCategories: [],
  },
  'event-2026-06-midyear-sale': {
    eventType: 'sale',
    startDate: '2026-06-09T15:00:00.000Z',
    endDate: '2026-06-30T14:59:59.000Z',
    targetCategories: [],
  },
  'event-2026-06-summer-linen': {
    eventType: 'new',
    startDate: '2026-05-31T15:00:00.000Z',
    endDate: '2026-06-20T14:59:59.000Z',
    targetCategories: ['상의', '하의'],
  },
  'event-2026-07-cool-touch': {
    eventType: 'sale',
    startDate: '2026-07-11T15:00:00.000Z',
    endDate: '2026-07-31T14:59:59.000Z',
    targetCategories: [],
  },
  'event-2026-07-summer-review': {
    eventType: 'special',
    startDate: '2026-07-19T15:00:00.000Z',
    endDate: '2026-08-05T14:59:59.000Z',
    targetCategories: [],
  },
  'event-2026-07-vacation-coupon': {
    eventType: 'coupon',
    startDate: '2026-06-30T15:00:00.000Z',
    endDate: '2026-07-15T14:59:59.000Z',
    targetCategories: [],
  },
  'event-2026-08-last-summer': {
    eventType: 'sale',
    startDate: '2026-08-14T15:00:00.000Z',
    endDate: '2026-08-31T14:59:59.000Z',
    targetCategories: [],
  },
  'event-2026-08-pre-fall': {
    eventType: 'new',
    startDate: '2026-07-31T15:00:00.000Z',
    endDate: '2026-08-18T14:59:59.000Z',
    targetCategories: [],
  },
  h1WITXqWE2BL3G0ACiza: {
    eventType: 'coupon',
    startDate: '2025-08-05T12:49:00.000Z',
    endDate: '2030-12-05T12:49:00.000Z',
    targetCategories: ['전체'],
  },
});

const SUMMER_REVIEW_PRODUCTS = Object.freeze([
  'cool-touch-oversized-shirt',
  'linen-like-half-shirt',
  'seersucker-half-jacket',
]);

const PREFALL_REVIEW_PRODUCTS = Object.freeze([
  'light-zip-up-jacket',
  'style-now-autumn-01',
  'style-now-autumn-08',
]);

const NEW_EVENT_DEFINITIONS = Object.freeze([
  {
    id: 'event-2026-08-summer-sale-edit',
    title: '라스트 서머 세일 셀렉션',
    eventType: 'sale',
    start: '2026-08-01',
    end: '2026-08-23',
    targetCategories: ['tops', 'bottoms'],
    guidance: '상품별 할인가와 재고',
  },
  {
    id: 'event-2026-08-bag-accessory-sale',
    title: '데일리 백 & 액세서리 세일',
    eventType: 'sale',
    start: '2026-08-08',
    end: '2026-09-06',
    targetCategories: ['bags', 'accessories'],
    guidance: '상품별 할인가와 재고',
  },
  {
    id: 'event-2026-09-active-sale',
    title: '액티브 라이프 세일',
    eventType: 'sale',
    start: '2026-09-01',
    end: '2026-09-30',
    targetCategories: ['sports', 'shoes'],
    guidance: '상품별 할인가와 재고',
  },
  {
    id: 'event-2026-08-prefall-layering-new',
    title: '프리폴 레이어링 신상',
    eventType: 'new',
    start: '2026-08-01',
    end: '2026-08-31',
    targetCategories: ['clothing', 'tops'],
    guidance: '새로 등록된 상품과 재고',
  },
  {
    id: 'event-2026-08-daily-bag-new',
    title: '데일리 백 신상품',
    eventType: 'new',
    start: '2026-08-15',
    end: '2026-09-15',
    targetCategories: ['bags'],
    guidance: '새로 등록된 상품과 재고',
  },
  {
    id: 'event-2026-09-city-shoes-new',
    title: '시티 슈즈 신상품',
    eventType: 'new',
    start: '2026-09-01',
    end: '2026-09-30',
    targetCategories: ['shoes'],
    guidance: '새로 등록된 상품과 재고',
  },
  {
    id: 'event-2026-08-late-summer-style',
    title: '늦여름 데일리 리셋',
    eventType: 'special',
    start: '2026-08-05',
    end: '2026-08-31',
    targetCategories: ['tops', 'bottoms', 'bags'],
    guidance: '늦여름 추천 상품',
  },
  {
    id: 'event-2026-09-back-to-city',
    title: '가을 출근룩 큐레이션',
    eventType: 'special',
    start: '2026-08-24',
    end: '2026-09-30',
    targetCategories: ['clothing', 'bottoms', 'bags', 'shoes'],
    guidance: '가을 출근룩 추천 상품',
  },
  {
    id: 'event-2026-08-summer-fit-review',
    title: '여름 소재 구매 인증 리뷰',
    eventType: 'special',
    variant: 'review',
    start: '2026-08-01',
    end: '2026-08-31',
    targetProducts: SUMMER_REVIEW_PRODUCTS,
    guidance: '대상 상품의 구매 인증 리뷰 참여 조건',
  },
  {
    id: 'event-2026-09-prefall-fit-review',
    title: '프리폴 착용 구매 인증 리뷰',
    eventType: 'special',
    variant: 'review',
    start: '2026-09-01',
    end: '2026-09-30',
    targetProducts: PREFALL_REVIEW_PRODUCTS,
    guidance: '대상 상품의 구매 인증 리뷰 참여 조건',
  },
]);

const LEGACY_EVENT_IDS = Object.freeze(
  imageRefreshManifest.events.map(event => event.id),
);

function toKstBoundaryIso(date, boundary) {
  const time = boundary === 'start' ? '00:00:00' : '23:59:59';
  return new Date(`${date}T${time}+09:00`).toISOString();
}

function normalizeLegacyCategories(categories) {
  return [...new Set(
    (categories || [])
      .map(category => CATEGORY_SLUGS[category])
      .filter(Boolean),
  )];
}

function buildSafeLegacyCopy({ title, benefit }) {
  return {
    title,
    description:
      `${title}의 상품과 이용 정보를 확인해 보세요. ` +
      `${benefit} 항목은 연결된 상품 화면을 기준으로 안내합니다.`,
    content:
      `<h2>${title}</h2>` +
      '<p>기존 기획전 기록을 안전한 데모 안내로 다시 제공합니다.</p>' +
      '<h3>이용 안내</h3><ul>' +
      `<li>${benefit}</li>` +
      '<li>가격과 재고는 연결된 상품 화면에서 확인할 수 있습니다.</li>' +
      '<li>실제 결제와 배송은 진행되지 않는 포트폴리오 데모입니다.</li>' +
      '</ul>',
  };
}

function buildNewEventCopy({ title, guidance }) {
  return {
    description: `${title}에서 ${guidance} 항목을 확인해 보세요.`,
    content:
      `<h2>${title}</h2><p>${guidance}</p>` +
      '<h3>이용 안내</h3><ul>' +
      '<li>가격과 재고는 연결된 상품 화면을 기준으로 합니다.</li>' +
      '<li>참여 가능 여부는 로그인 후 실제 주문과 리뷰 기록으로 확인합니다.</li>' +
      '<li>별도 쿠폰이나 적립금 보상은 제공하지 않습니다.</li>' +
      '</ul>',
  };
}

function buildLegacyEvents() {
  return imageRefreshManifest.events.map(imageEvent => {
    const state = LEGACY_EVENT_STATE[imageEvent.id];
    if (!state) {
      throw new Error(`기존 이벤트 상태가 없습니다: ${imageEvent.id}`);
    }

    const targetCategories = normalizeLegacyCategories(state.targetCategories);

    return {
      id: imageEvent.id,
      source: 'legacy',
      ...buildSafeLegacyCopy(imageEvent),
      eventType: LEGACY_TYPE_OVERRIDES[imageEvent.id] || state.eventType,
      eligibilityType: 'none',
      rewardType: 'none',
      publicPolicyVerified: false,
      startDate: state.startDate,
      endDate: state.endDate,
      isActive: true,
      ...(targetCategories.length > 0 ? { targetCategories } : {}),
      imageStrategy: { wide: 'review', card: 'review' },
      deleteFields: [
        'couponType',
        'couponCode',
        'discountRate',
        'discountAmount',
        'rewardCouponId',
        'targetProducts',
      ],
    };
  });
}

function buildNewEvents() {
  return NEW_EVENT_DEFINITIONS.map(definition => {
    const isReview = definition.variant === 'review';
    const copy = buildNewEventCopy(definition);

    return {
      id: definition.id,
      source: 'new',
      title: definition.title,
      ...copy,
      eventType: definition.eventType,
      eligibilityType: isReview ? 'review' : 'none',
      rewardType: 'none',
      publicPolicyVerified: false,
      startDate: toKstBoundaryIso(definition.start, 'start'),
      endDate: toKstBoundaryIso(definition.end, 'end'),
      isActive: true,
      participantCount: 0,
      hasMaxParticipants: false,
      ...(definition.targetCategories
        ? { targetCategories: [...definition.targetCategories] }
        : {}),
      ...(definition.targetProducts
        ? { targetProducts: [...definition.targetProducts] }
        : {}),
      imageStrategy: { wide: 'generate', card: 'generate' },
    };
  });
}

function buildPublicationManifest() {
  return {
    version: PUBLICATION_VERSION,
    events: [...buildLegacyEvents(), ...buildNewEvents()],
  };
}

function assertEvent(condition, eventId, message) {
  if (!condition) {
    throw new Error(`${eventId}: ${message}`);
  }
}

function validatePublicationManifest(manifest) {
  if (!manifest || manifest.version !== PUBLICATION_VERSION || !Array.isArray(manifest.events)) {
    throw new Error('publication manifest 형식 또는 버전이 올바르지 않습니다.');
  }

  const ids = new Set();
  for (const event of manifest.events) {
    if (ids.has(event.id)) {
      throw new Error(`중복 이벤트 ID: ${event.id}`);
    }
    ids.add(event.id);

    assertEvent(typeof event.title === 'string' && event.title.trim(), event.id, '제목이 없습니다.');
    assertEvent(
      typeof event.description === 'string' && typeof event.content === 'string',
      event.id,
      '공개 문구가 없습니다.',
    );
    assertEvent(
      !UNSUPPORTED_PUBLIC_COPY.test(`${event.title} ${event.description} ${event.content}`),
      event.id,
      '지원하지 않는 공개 혜택 문구가 있습니다.',
    );
    assertEvent(
      ['sale', 'coupon', 'special', 'new'].includes(event.eventType),
      event.id,
      '이벤트 유형이 올바르지 않습니다.',
    );
    assertEvent(event.rewardType === 'none' && !('rewardCouponId' in event), event.id, '보상 계약이 올바르지 않습니다.');

    const startDate = new Date(event.startDate);
    const endDate = new Date(event.endDate);
    assertEvent(
      Number.isFinite(startDate.getTime()) && Number.isFinite(endDate.getTime())
        && startDate < endDate,
      event.id,
      '기간이 올바르지 않습니다.',
    );

    for (const category of event.targetCategories || []) {
      assertEvent(VALID_CATEGORY_SLUGS.has(category), event.id, `카테고리가 올바르지 않습니다: ${category}`);
    }

    if (event.eligibilityType === 'review') {
      assertEvent(
        Array.isArray(event.targetProducts) && event.targetProducts.length > 0,
        event.id,
        '리뷰 대상 상품이 없습니다.',
      );
    } else {
      assertEvent(event.eligibilityType === 'none', event.id, '참여 자격이 올바르지 않습니다.');
      assertEvent(!('targetProducts' in event), event.id, '탐색형 이벤트에 대상 상품이 남아 있습니다.');
    }

    assertEvent(
      ['review', 'generate'].includes(event.imageStrategy?.wide)
        && ['review', 'generate'].includes(event.imageStrategy?.card),
      event.id,
      '이미지 전략이 올바르지 않습니다.',
    );
  }

  const legacyCount = manifest.events.filter(event => event.source === 'legacy').length;
  const newCount = manifest.events.filter(event => event.source === 'new').length;

  if (manifest.events.length !== 32 || legacyCount !== 22 || newCount !== 10) {
    throw new Error(
      `이벤트 수가 올바르지 않습니다: total=${manifest.events.length} legacy=${legacyCount} new=${newCount}`,
    );
  }

  for (const legacyId of LEGACY_EVENT_IDS) {
    if (!ids.has(legacyId)) {
      throw new Error(`기존 이벤트가 누락되었습니다: ${legacyId}`);
    }
  }

  return { eventCount: 32, legacyCount: 22, newCount: 10 };
}

function main(argv = process.argv.slice(2)) {
  const [command = 'validate', ...flags] = argv;
  if (command !== 'validate' || flags.length > 0) {
    throw new Error('validate 명령만 지원합니다.');
  }

  const result = validatePublicationManifest(buildPublicationManifest());
  console.log(
    `event publication manifest PASS: events=${result.eventCount} legacy=${result.legacyCount} new=${result.newCount}`,
  );
  return result;
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

module.exports = {
  CATEGORY_SLUGS,
  LEGACY_EVENT_IDS,
  NEW_EVENT_DEFINITIONS,
  PREFALL_REVIEW_PRODUCTS,
  PUBLICATION_VERSION,
  SUMMER_REVIEW_PRODUCTS,
  UNSUPPORTED_PUBLIC_COPY,
  buildPublicationManifest,
  validatePublicationManifest,
};
