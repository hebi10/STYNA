const manifest = require('./event-image-refresh-manifest.json');

const EXPECTED_EVENTS = [
  { id: 'event-2026-01-layering-sale', title: '윈터 레이어링 세일', benefit: '최대 45% 혜택' },
  { id: 'event-2026-01-welcome-coupon', title: '새해 웰컴 쿠폰', benefit: '첫 구매 20% 쿠폰' },
  { id: 'event-2026-02-knit-review', title: '니트 리뷰 리워드', benefit: '리뷰 작성 시 2천원' },
  { id: 'event-2026-02-spring-preview', title: '스프링 프리뷰', benefit: '봄 신상품 선공개' },
  { id: 'event-2026-03-trench-week', title: '트렌치 위크', benefit: '아우터 최대 35%' },
  { id: 'event-2026-03-photo-review', title: '포토 리뷰 챌린지', benefit: '최대 5천원 적립' },
  { id: 'event-2026-03-white-day-coupon', title: '화이트데이 쿠폰', benefit: '선물 아이템 15%' },
  { id: 'event-2026-04-shirt-collection', title: '셔츠 컬렉션 런칭', benefit: '런칭 한정 혜택' },
  { id: 'event-2026-04-office-look', title: '오피스룩 기획전', benefit: '출근룩 최대 40%' },
  { id: 'event-2026-04-styling-coupon', title: '스타일링 상담 쿠폰', benefit: '3만원 쿠폰' },
  { id: 'event-2026-05-denim-festival', title: '데님 페스티벌', benefit: '데님 최대 50%' },
  { id: 'event-2026-05-family-coupon', title: '패밀리 먼스 쿠폰', benefit: '추가 10% 쿠폰' },
  { id: 'event-2026-05-best-review', title: '베스트 리뷰 어워즈', benefit: '베스트 리뷰 1만원' },
  { id: 'event-2026-06-midyear-sale', title: '미드이어 세일', benefit: '베스트 최대 60%' },
  { id: 'event-2026-06-summer-linen', title: '썸머 리넨 컬렉션', benefit: '시원한 리넨 신상' },
  { id: 'event-2026-07-vacation-coupon', title: '바캉스 쿠폰팩', benefit: '휴가룩 쿠폰 3종' },
  { id: 'event-2026-07-cool-touch', title: '쿨터치 데일리 세일', benefit: '최대 35% 할인' },
  { id: 'event-2026-07-summer-review', title: '여름 착용 리뷰', benefit: '리뷰 적립금 2배' },
  { id: 'event-2026-08-pre-fall', title: '프리폴 컬렉션', benefit: '가을 신상품 선공개' },
  { id: 'event-2026-08-last-summer', title: '라스트 썸머 클리어런스', benefit: '마지막 최대 70%' },
  { id: 'h1WITXqWE2BL3G0ACiza', title: '신규 회원 가입 이벤트', benefit: '첫 구매 20% 쿠폰' },
  { id: 'PacCrKVG9TikHo7lambG', title: '봄맞이 특가 세일', benefit: '봄 신상품 최대 50%' },
];

const SUBJECT_TYPES = ['female-solo', 'male-solo', 'mixed-group', 'product-only'];
const FORBIDDEN_ELEMENTS = ['가짜 로고', '워터마크', '다른 글자', '둥근 스티커', '장식성 그림자'];

describe('event image refresh manifest', () => {
  test('uses the exact manifest version and output formats', () => {
    expect(manifest.version).toBe('20260714');
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

      expect(event.wideOutput).toBe(`public/events/2026-v2/${event.id}-wide.webp`);
      expect(event.cardOutput).toBe(`public/events/2026-v2/${event.id}-card.webp`);
    }
  });

  test('assigns every event a supported subject type and includes the required visual mix', () => {
    for (const event of manifest.events) {
      expect(SUBJECT_TYPES).toContain(event.subjectType);
    }
    expect(new Set(manifest.events.map((event) => event.subjectType))).toEqual(new Set(SUBJECT_TYPES));
  });
});
