const manifest = require('./event-image-refresh-manifest.json');
const editorialManifest = require('./event-editorial-image-manifest.json');

const EXPECTED_EVENTS = [
  { id: 'event-2026-01-layering-sale', title: '윈터 레이어링 세일', benefit: '상품별 할인가 확인' },
  { id: 'event-2026-01-welcome-coupon', title: '새해 웰컴 안내', benefit: '가입 완료 시 5,000P' },
  { id: 'event-2026-02-knit-review', title: '니트 착용 리뷰', benefit: '구매 인증 리뷰 안내' },
  { id: 'event-2026-02-spring-preview', title: '스프링 프리뷰', benefit: '봄 신상품 선공개' },
  { id: 'event-2026-03-trench-week', title: '트렌치 위크', benefit: '상품별 할인가 확인' },
  { id: 'event-2026-03-photo-review', title: '포토 리뷰 챌린지', benefit: '구매 인증 리뷰 안내' },
  { id: 'event-2026-03-white-day-coupon', title: '화이트데이 선물 안내', benefit: '선물 상품 살펴보기' },
  { id: 'event-2026-04-shirt-collection', title: '셔츠 컬렉션 런칭', benefit: '신상품 상세 확인' },
  { id: 'event-2026-04-office-look', title: '오피스룩 기획전', benefit: '상품별 할인가 확인' },
  { id: 'event-2026-04-styling-coupon', title: '스타일링 조합 안내', benefit: '상품 조합 살펴보기' },
  { id: 'event-2026-05-denim-festival', title: '데님 페스티벌', benefit: '상품별 할인가 확인' },
  { id: 'event-2026-05-family-coupon', title: '패밀리 먼스 안내', benefit: '가족 선물 상품 안내' },
  { id: 'event-2026-05-best-review', title: '리뷰 작성 안내', benefit: '구매 인증 리뷰 안내' },
  { id: 'event-2026-06-midyear-sale', title: '미드이어 세일', benefit: '상품별 할인가 확인' },
  { id: 'event-2026-06-summer-linen', title: '썸머 리넨 컬렉션', benefit: '시원한 리넨 신상' },
  { id: 'event-2026-07-vacation-coupon', title: '바캉스 스타일 안내', benefit: '휴가 상품 안내' },
  { id: 'event-2026-07-cool-touch', title: '쿨터치 데일리 세일', benefit: '상품별 할인가 확인' },
  { id: 'event-2026-07-summer-review', title: '여름 착용 리뷰', benefit: '구매 인증 리뷰 안내' },
  { id: 'event-2026-08-pre-fall', title: '프리폴 컬렉션', benefit: '가을 신상품 선공개' },
  { id: 'event-2026-08-last-summer', title: '라스트 썸머 클리어런스', benefit: '상품별 할인가 확인' },
  { id: 'h1WITXqWE2BL3G0ACiza', title: '신규 회원 가입 이벤트', benefit: '가입 완료 시 5,000P' },
  { id: 'PacCrKVG9TikHo7lambG', title: '봄맞이 특가 세일', benefit: '상품별 할인가 확인' },
];

const SUBJECT_TYPES = ['female-solo', 'male-solo', 'mixed-group', 'product-only'];
const FORBIDDEN_ELEMENTS = ['가짜 로고', '워터마크', '다른 글자', '둥근 스티커', '장식성 그림자'];
const UNSUPPORTED_CLAIMS = /(?:최대|추가|첫 구매|신상품|리뷰 작성 시)\s*\d[\d,]*(?:천|만)?(?:%|원|P)|쿠폰\s*\d+\s*종|리뷰[^.\n"]{0,24}(?:적립금|리워드|보상|혜택)|(?:당일|오늘|익일)\s*(?:발송|출고)|\d+\s*(?:시간|분)\s*내/;
const UNSUPPORTED_PROMOTIONAL_CONTENT = /첫 구매 쿠폰|쿠폰\s*(?:티켓|카드|팩)|리뷰[^.\n"]{0,24}(?:리워드|보상|혜택)|후기로 받는 혜택|상담\s*(?:혜택|조건)|MD\s*(?:추천|픽|룩|스타일링)/;
const UNSUPPORTED_SOCIAL_PROOF = /실제 사용자가 남긴 듯한|실제 후기 화면|실제 사용자|후기 화면 UI|리뷰가 잘 나오는|베스트 리뷰|인기 리뷰 상품|별점 받은 아이템|상반기 베스트|베스트 아이템|지금 담아야 할 가격|리뷰 어워즈|리뷰어 초이스|UGC/;

function getRefreshNarrative() {
  return manifest.events.flatMap((event) => [
    event.title,
    event.benefit,
    event.concept,
    event.widePrompt,
    event.cardPrompt,
  ]).join('\n');
}

function getEditorialNarrative() {
  return editorialManifest.events.flatMap((event) => [
    event.title,
    event.benefit,
    event.campaignCommand,
    ...event.images.flatMap((image) => [
      image.story.purpose,
      ...image.story.scenes,
      ...image.story.texts,
      image.prompt,
    ]),
  ]).join('\n');
}

describe('event image refresh manifest', () => {
  test('uses the exact manifest version and output formats', () => {
    expect(manifest.version).toBe('20260721');
    expect(manifest.formats).toEqual({
      wide: { width: 1600, height: 820 },
      card: { width: 1000, height: 1250 },
    });
  });

  test('keeps the exact 22 event IDs, titles, and benefits', () => {
    expect(manifest.events.map(({ id, title, benefit }) => ({ id, title, benefit }))).toEqual(EXPECTED_EVENTS);
    expect(new Set(manifest.events.map((event) => event.id)).size).toBe(22);
  });

  test('keeps complete art direction, prompt constraints, and versioned output paths', () => {
    for (const event of manifest.events) {
      expect(event.concept).toEqual(expect.stringMatching(/\S/));
      expect(event.palette).toEqual(expect.stringMatching(/\S/));

      for (const prompt of [event.widePrompt, event.cardPrompt]) {
        expect(prompt).toContain(`행사명: "${event.title}"`);
        expect(prompt).toContain(`혜택 문구: "${event.benefit}"`);
        for (const forbiddenElement of FORBIDDEN_ELEMENTS) {
          expect(prompt).toContain(forbiddenElement);
        }
      }

      expect(event.wideOutput).toBe(`public/events/2026-v3/${event.id}-20260721-wide.webp`);
      expect(event.cardOutput).toBe(`public/events/2026-v3/${event.id}-20260721-card.webp`);
    }
  });

  test('assigns every event a supported subject type and includes the required visual mix', () => {
    for (const event of manifest.events) {
      expect(SUBJECT_TYPES).toContain(event.subjectType);
    }
    expect(new Set(manifest.events.map((event) => event.subjectType))).toEqual(new Set(SUBJECT_TYPES));
  });

  test('keeps supported signup-point and purchase-review guidance while rejecting unsupported claims', () => {
    const narrative = getRefreshNarrative();

    expect(narrative).toContain('가입 완료 시 5,000P');
    expect(narrative).toContain('구매 인증 리뷰 안내');
    expect(narrative).not.toMatch(UNSUPPORTED_CLAIMS);
    expect(narrative).not.toMatch(UNSUPPORTED_PROMOTIONAL_CONTENT);
    expect(narrative).not.toMatch(UNSUPPORTED_SOCIAL_PROOF);
  });

  test('regenerates neutral editorial stories into new immutable output paths', () => {
    const narrative = getEditorialNarrative();

    expect(editorialManifest.version).toBe('20260721');
    expect(editorialManifest.events).toHaveLength(22);
    expect(narrative).toContain('가입 완료 시 5,000P');
    expect(narrative).toContain('구매 인증 리뷰 안내');
    expect(narrative).not.toMatch(UNSUPPORTED_CLAIMS);
    expect(narrative).not.toMatch(UNSUPPORTED_PROMOTIONAL_CONTENT);
    expect(narrative).not.toMatch(UNSUPPORTED_SOCIAL_PROOF);
    expect(narrative).not.toContain('5,000P을');

    for (const event of editorialManifest.events) {
      const sourceEvent = manifest.events.find((candidate) => candidate.id === event.id);
      expect(event.referenceImage).toBe(sourceEvent.wideOutput);
      for (const image of event.images) {
        expect(image.output).toBe(
          `public/events/2026-editorial/${event.id}-20260721-${image.role}.webp`,
        );
      }
    }
  });
});
