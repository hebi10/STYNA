# Event Safe Republication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기존 이벤트 22개를 안전한 콘텐츠로 재사용하고 신규 이벤트 10개를 추가하며, `/events/`를 진행·예정/종료 탭으로 분리해 검증 후 단계적으로 공개한다.

**Architecture:** UI는 날짜 상태 탭과 기존 유형 필터를 조합하고, 상품 선택기는 이벤트 유형에 맞는 실제 상품만 남긴다. 데이터는 32개 canonical manifest와 이미지 결정 manifest를 원본으로 삼고, 별도 CLI가 분석·이미지 준비·비공개 stage·검증·최종 publish·비파괴 rollback을 담당한다. 운영 Firestore는 코드 배포 승인 전까지 `publicPolicyVerified: false`를 유지한다.

**Tech Stack:** Next.js 15, React 19, TypeScript, Jest 30, Firebase Firestore/Storage/Admin SDK, Sharp, PowerShell, Browser QA, built-in image generation

## Global Constraints

- 기존 Firestore 이벤트 문서 22개와 기존 Storage 객체를 삭제하거나 덮어쓰지 않는다.
- 기존 이미지 44개는 시각 검수 후 안전한 자산을 우선 재사용한다.
- 신규 이벤트는 세일 3개, 신상품 3개, 시즌 기획전 2개, 구매 인증 리뷰 2개로 고정한다.
- 32개 이벤트 모두 `rewardType: none`을 사용하고 `rewardCouponId`를 남기지 않는다.
- 운영 stage는 `publicPolicyVerified: false`로만 반영한다.
- 최종 publish와 배포는 해비님의 별도 승인 전에는 실행하지 않는다.
- 신규 문서는 rollback 시 삭제하지 않고 `publicPolicyVerified: false`, `isActive: false`로 보존한다.
- 이미지 생성은 SVG 수작업이 아니라 built-in image generation을 사용한다.
- 현재 작업 트리의 기존 CSS 및 테스트 변경사항을 되돌리거나 덮어쓰지 않는다.
- 커밋, 푸시, 브랜치·worktree·stash 생성은 하지 않는다.
- 모든 PowerShell과 파일 입출력은 UTF-8을 사용한다.

---

### Task 1: 날짜 상태 탭과 목록 분류

**Files:**
- Create: `src/app/events/_components/eventListStatus.ts`
- Create: `src/app/events/_components/eventListStatus.test.ts`
- Modify: `src/app/events/_components/EventList.tsx`
- Modify: `src/app/events/_components/EventList.test.tsx`
- Modify: `src/app/events/_components/EventList.module.css`

**Interfaces:**
- Consumes: `getEventStatus(event: Event, referenceDate?: Date): EventRuntimeStatus`
- Produces: `EventStatusTab`, `filterEventsByStatusTab(events, tab, referenceDate?)`, `countEventsByStatusTab(events, tab, referenceDate?)`

- [ ] **Step 1: 날짜 상태 분류 테스트 작성**

```ts
import { Event } from '@/shared/types/event';
import {
  countEventsByStatusTab,
  filterEventsByStatusTab,
} from './eventListStatus';

const referenceDate = new Date('2026-07-31T12:00:00+09:00');

test('groups ongoing and upcoming events in the current tab', () => {
  const events = [
    event({ id: 'ongoing', startDate: new Date('2026-07-01'), endDate: new Date('2026-08-01') }),
    event({ id: 'upcoming', startDate: new Date('2026-08-10'), endDate: new Date('2026-08-20') }),
    event({ id: 'ended', startDate: new Date('2026-06-01'), endDate: new Date('2026-06-30') }),
  ];

  expect(filterEventsByStatusTab(events, 'current', referenceDate).map(item => item.id))
    .toEqual(['ongoing', 'upcoming']);
  expect(countEventsByStatusTab(events, 'ended', referenceDate)).toBe(1);
});
```

- [ ] **Step 2: 테스트가 helper 미구현으로 실패하는지 확인**

Run:

```powershell
npm test -- --runTestsByPath src/app/events/_components/eventListStatus.test.ts
```

Expected: `Cannot find module './eventListStatus'`

- [ ] **Step 3: 순수 상태 분류 helper 구현**

```ts
import { getEventStatus } from '@/shared/services/eventService';
import { Event } from '@/shared/types/event';

export type EventStatusTab = 'current' | 'ended';

export function filterEventsByStatusTab(
  events: Event[],
  tab: EventStatusTab,
  referenceDate: Date = new Date(),
): Event[] {
  return events.filter((event) => {
    const status = getEventStatus(event, referenceDate);
    return tab === 'ended' ? status === 'ended' : status !== 'ended';
  });
}

export function countEventsByStatusTab(
  events: Event[],
  tab: EventStatusTab,
  referenceDate: Date = new Date(),
): number {
  return filterEventsByStatusTab(events, tab, referenceDate).length;
}
```

- [ ] **Step 4: EventList에 상태 탭 UI 테스트 추가**

`EventList.test.tsx`의 `getEventStatus` mock은 ID로 상태를 구분하게 바꾼다.

```ts
const mockGetEventStatus = jest.fn((event: Event) =>
  event.id.startsWith('ended-') ? 'ended' : 'ongoing'
);

jest.mock('@/shared/services/eventService', () => ({
  getEventStatus: (event: Event) => mockGetEventStatus(event),
  getFeaturedEvent: (events: Event[]) => events[0],
}));
```

다음 동작을 검증한다.

```ts
test('separates current and ended events and resets pagination on tab change', () => {
  const setCurrentPage = jest.fn();
  const events = [
    baseEvent({ id: 'current-event', title: '진행 이벤트' }),
    baseEvent({ id: 'ended-event', title: '종료 이벤트' }),
  ];
  useEvent.mockReturnValue(createEventContext({ events, filteredEvents: events, setCurrentPage }));

  render(<EventList />);
  expect(screen.getByRole('button', { name: '진행·예정 이벤트 1' }))
    .toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByText('진행 이벤트')).toBeInTheDocument();
  expect(screen.queryByText('종료 이벤트')).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: '종료된 이벤트 1' }));
  expect(setCurrentPage).toHaveBeenCalledWith(1);
  expect(screen.getByText('종료 이벤트')).toBeInTheDocument();
  expect(screen.queryByText('진행 이벤트')).not.toBeInTheDocument();
});
```

- [ ] **Step 5: EventList에 탭 상태와 필터 조합 구현**

```tsx
const [statusTab, setStatusTab] = useState<EventStatusTab>('current');
const publicEvents = filteredEvents.filter(isPublicEventReady);
const statusFilteredEvents = filterEventsByStatusTab(publicEvents, statusTab);
const displayedEvents = statusFilteredEvents.slice(startIndex, endIndex);

const handleStatusTabChange = (nextTab: EventStatusTab) => {
  setStatusTab(nextTab);
  setCurrentPage(1);
};
```

탭은 유형 필터 위에 렌더링하고 접근 가능한 이름에 각 수량을 포함한다.

```tsx
<div className={styles.statusTabs} aria-label="이벤트 상태 필터">
  <button
    type="button"
    aria-pressed={statusTab === 'current'}
    onClick={() => handleStatusTabChange('current')}
  >
    진행·예정 이벤트 {countEventsByStatusTab(publicEvents, 'current')}
  </button>
  <button
    type="button"
    aria-pressed={statusTab === 'ended'}
    onClick={() => handleStatusTabChange('ended')}
  >
    종료된 이벤트 {countEventsByStatusTab(publicEvents, 'ended')}
  </button>
</div>
```

`totalPages`, 빈 상태, 이벤트 수와 페이지네이션은 모두 `statusFilteredEvents`를 기준으로 계산한다. 상태 탭은 기존 낮은 radius·무그림자 스타일을 유지한다.

- [ ] **Step 6: 목록 관련 테스트 통과 확인**

Run:

```powershell
npm test -- --runTestsByPath src/app/events/_components/eventListStatus.test.ts src/app/events/_components/EventList.test.tsx src/context/eventProvider.test.tsx
```

Expected: 모든 테스트 PASS

---

### Task 2: 이벤트 유형에 맞는 상품만 선택

**Files:**
- Modify: `src/app/events/[eventId]/eventProductSelection.ts`
- Modify: `src/app/events/[eventId]/eventProductSelection.test.ts`

**Interfaces:**
- Consumes: `Product.isSale`, `Product.isNew`, `EventUiVariant`
- Produces: `matchesEventVariant(product, variant): boolean`

- [ ] **Step 1: 세일·신상품 카테고리 필터 테스트 작성**

`createProduct`가 `Partial<Product>`를 받을 수 있게 바꾼다.

```ts
const createProduct = (
  id: string,
  status: Product['status'],
  overrides: Partial<Product> = {},
): Product => ({
  ...baseProductFields,
  id,
  status,
  ...overrides,
});
```

다음 테스트를 추가한다.

```ts
test('keeps only sale products from event categories before fallback', async () => {
  const service = createProductLoader({
    categories: {
      tops: [
        createProduct('sale-top', 'active', { isSale: true }),
        createProduct('regular-top', 'active', { isSale: false }),
      ],
    },
    fallback: [createProduct('sale-fallback', 'active', { isSale: true })],
  });

  const products = await loadEventProducts({
    event: createEvent({ targetCategories: ['tops'] }),
    variant: 'sale',
    service,
  });

  expect(products.map(product => product.id)).toEqual(['sale-top', 'sale-fallback']);
});

test('keeps only new products from event categories before fallback', async () => {
  const service = createProductLoader({
    categories: {
      bags: [
        createProduct('new-bag', 'active', { isNew: true }),
        createProduct('old-bag', 'active', { isNew: false }),
      ],
    },
    fallback: [createProduct('new-fallback', 'active', { isNew: true })],
  });

  const products = await loadEventProducts({
    event: createEvent({ targetCategories: ['bags'] }),
    variant: 'new',
    service,
  });

  expect(products.map(product => product.id)).toEqual(['new-bag', 'new-fallback']);
});
```

- [ ] **Step 2: 기존 구현에서 테스트 실패 확인**

Run:

```powershell
npm test -- --runTestsByPath "src/app/events/[eventId]/eventProductSelection.test.ts"
```

Expected: 정상가·기존 상품이 결과에 섞여 FAIL

- [ ] **Step 3: 유형 predicate 구현 및 카테고리 결과에 적용**

```ts
export const matchesEventVariant = (
  product: Product,
  variant: EventUiVariant,
): boolean => {
  if (variant === 'sale') return product.isSale === true;
  if (variant === 'new') return product.isNew === true;
  return true;
};
```

카테고리 조회 결과를 추가하기 전에 필터링한다.

```ts
const categoryProducts = await service.getProductsByCategory(category, limit);
appendUnique(
  products,
  categoryProducts.filter(product => matchesEventVariant(product, variant)),
  limit,
);
```

- [ ] **Step 4: 상품 선택 테스트 통과 확인**

Run:

```powershell
npm test -- --runTestsByPath "src/app/events/[eventId]/eventProductSelection.test.ts"
```

Expected: 모든 테스트 PASS

---

### Task 3: 32개 canonical 이벤트 manifest와 정책 검증기

**Files:**
- Create: `scripts/event-publication-manifest.js`
- Create: `scripts/event-publication-manifest.test.js`
- Modify: `package.json`

**Interfaces:**
- Consumes: `scripts/event-image-refresh-manifest.json`
- Produces:
  - `PUBLICATION_VERSION = '20260731'`
  - `LEGACY_EVENT_IDS: readonly string[]`
  - `NEW_EVENT_DEFINITIONS: readonly object[]`
  - `buildPublicationManifest(): PublicationManifest`
  - `validatePublicationManifest(manifest): { eventCount: 32; legacyCount: 22; newCount: 10 }`

- [ ] **Step 1: manifest 계약 테스트 작성**

```js
const {
  PUBLICATION_VERSION,
  buildPublicationManifest,
  validatePublicationManifest,
} = require('./event-publication-manifest');

test('builds exactly 22 reusable and 10 new events', () => {
  const manifest = buildPublicationManifest();
  expect(manifest.version).toBe(PUBLICATION_VERSION);
  expect(manifest.events).toHaveLength(32);
  expect(manifest.events.filter(event => event.source === 'legacy')).toHaveLength(22);
  expect(manifest.events.filter(event => event.source === 'new')).toHaveLength(10);
  expect(validatePublicationManifest(manifest)).toEqual({
    eventCount: 32,
    legacyCount: 22,
    newCount: 10,
  });
});

test('contains no unsupported public claims', () => {
  const copy = JSON.stringify(buildPublicationManifest());
  expect(copy).not.toMatch(
    /자동\s*(발급|지급|적용)|생일\s*쿠폰|실시간\s*상담|상담.*쿠폰|추가\s*적립|적립금\s*(?:두\s*배|\d)|무료배송|최대\s*\d+%|당일\s*(?:출고|배송)/,
  );
});

test('uses canonical no-reward fields and valid review targets', () => {
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
```

- [ ] **Step 2: 테스트가 module 미구현으로 실패하는지 확인**

Run:

```powershell
npm test -- --runTestsByPath scripts/event-publication-manifest.test.js
```

Expected: `Cannot find module './event-publication-manifest'`

- [ ] **Step 3: 기존 22개 안전 문구 builder 구현**

`event-image-refresh-manifest.json`의 22개 `id`, `title`, `benefit`을 canonical 제목과 핵심 안내로 재사용한다.

```js
const LEGACY_TYPE_OVERRIDES = Object.freeze({
  'event-2026-01-welcome-coupon': 'special',
  'event-2026-03-white-day-coupon': 'special',
  'event-2026-04-styling-coupon': 'special',
  'event-2026-05-family-coupon': 'special',
  'event-2026-07-vacation-coupon': 'special',
  h1WITXqWE2BL3G0ACiza: 'special',
  PacCrKVG9TikHo7lambG: 'sale',
});

function buildSafeLegacyCopy({ title, benefit }) {
  return {
    title,
    description: `${title}의 상품과 이용 정보를 확인해 보세요. ${benefit} 항목은 연결된 상품 화면을 기준으로 안내합니다.`,
    content:
      `<h2>${title}</h2>` +
      `<p>기존 기획전 기록을 안전한 데모 안내로 다시 제공합니다.</p>` +
      `<h3>이용 안내</h3><ul>` +
      `<li>${benefit}</li>` +
      `<li>가격과 재고는 연결된 상품 화면에서 확인할 수 있습니다.</li>` +
      `<li>실제 결제와 배송은 진행되지 않는 포트폴리오 데모입니다.</li>` +
      `</ul>`,
  };
}
```

기존 review 제목 4개도 종료 기록으로 재사용하므로 `eligibilityType: 'none'`, `rewardType: 'none'`으로 만든다. 기존 `couponType`, `couponCode`, `discountRate`, `discountAmount`, `rewardCouponId`, `targetProducts`는 `deleteFields`에 기록한다. 한국어 카테고리는 다음 slug로 정규화한다.

```js
const CATEGORY_SLUGS = Object.freeze({
  상의: 'tops',
  하의: 'bottoms',
  아우터: 'clothing',
  가방: 'bags',
  신발: 'shoes',
  액세서리: 'accessories',
  스포츠: 'sports',
});
```

- [ ] **Step 4: 신규 10개 정의 구현**

설계 문서의 고정 ID·제목·기간·카테고리를 그대로 배열에 작성한다. 리뷰 대상은 다음 값으로 고정한다.

```js
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
```

모든 신규 문서는 아래 공통 필드를 갖는다.

```js
{
  source: 'new',
  eligibilityType: variant === 'review' ? 'review' : 'none',
  rewardType: 'none',
  publicPolicyVerified: false,
  isActive: true,
  participantCount: 0,
  hasMaxParticipants: false,
}
```

description과 content는 허위 혜택 없이 다음 builder로 생성한다.

```js
function buildNewEventCopy({ title, guidance }) {
  return {
    description: `${title}에서 ${guidance} 항목을 확인해 보세요.`,
    content:
      `<h2>${title}</h2><p>${guidance}</p>` +
      `<h3>이용 안내</h3><ul>` +
      `<li>가격과 재고는 연결된 상품 화면을 기준으로 합니다.</li>` +
      `<li>참여 가능 여부는 로그인 후 실제 주문과 리뷰 기록으로 확인합니다.</li>` +
      `<li>별도 쿠폰이나 적립금 보상은 제공하지 않습니다.</li>` +
      `</ul>`,
  };
}
```

- [ ] **Step 5: validator 구현**

validator는 고유 ID, 22/10 수량, 금지 문구, 날짜 순서, 카테고리 slug, review target, no-reward 계약과 이미지 전략 필드를 검사하고 첫 오류에서 이벤트 ID를 포함해 예외를 던진다.

```js
const VALID_CATEGORY_SLUGS = new Set([
  'tops', 'bottoms', 'clothing', 'bags', 'shoes', 'accessories', 'sports',
]);
const UNSUPPORTED_PUBLIC_COPY =
  /자동\s*(발급|지급|적용)|생일\s*쿠폰|실시간\s*상담|상담.*쿠폰|추가\s*적립|적립금\s*(?:두\s*배|\d)|무료배송|최대\s*\d+%|당일\s*(?:출고|배송)/;
```

- [ ] **Step 6: package scripts 추가**

```json
"events:publication:validate-manifest": "node scripts/event-publication-manifest.js validate",
"events:publication:analyze": "node scripts/event-publication.js analyze",
"events:publication:stage": "node scripts/event-publication.js stage",
"events:publication:verify": "node scripts/event-publication.js verify",
"events:publication:publish": "node scripts/event-publication.js publish",
"events:publication:rollback": "node scripts/event-publication.js rollback"
```

`event-publication-manifest.js` CLI는 `validate`만 지원하며 Firestore를 불러오지 않는다.

- [ ] **Step 7: manifest 테스트와 CLI 통과 확인**

Run:

```powershell
npm test -- --runTestsByPath scripts/event-publication-manifest.test.js
npm run events:publication:validate-manifest
```

Expected: 32개 manifest 검증 PASS

---

### Task 4: 기존 이미지 감사와 교체 이미지 준비

**Files:**
- Create: `scripts/event-publication-assets.js`
- Create: `scripts/event-publication-assets.test.js`
- Create: `scripts/event-publication-image-manifest.json`
- Create after visual review: `scripts/event-publication-image-decisions.json`
- Create generated images: `public/events/2026-publication/*.webp`
- Modify: `package.json`

**Interfaces:**
- Consumes: 현재 Firestore 22개 이미지 URL, `event-publication-manifest.js`
- Produces:
  - `downloadExistingEventImages(runtime)`
  - `buildExistingContactSheet(inputDirectory, outputPath)`
  - `validateImageDecisions(decisions, publicationManifest)`
  - `buildUploadPlan(decisions, publicationManifest)`
  - `uploadPublicationImages(plan, runtime)`

- [ ] **Step 1: 이미지 결정 계약 테스트 작성**

```js
test('requires one wide and one card decision for every event', () => {
  const manifest = buildPublicationManifest();
  const decisions = createDecisionFixture(manifest.events);
  expect(validateImageDecisions(decisions, manifest)).toEqual({
    events: 32,
    reusedAssets: 44,
    generatedAssets: 20,
  });
});

test('rejects reuse for a new event', () => {
  const manifest = buildPublicationManifest();
  const decisions = createDecisionFixture(manifest.events);
  decisions.events.find(event => event.source === 'new').wide.action = 'reuse';
  expect(() => validateImageDecisions(decisions, manifest))
    .toThrow(/신규 이벤트.*reuse/);
});

test('maps generated files to immutable storage paths', () => {
  expect(buildStorageObjectName('event-1', 'wide', '20260731')).toBe(
    'events/publication/event-1-20260731-wide.webp',
  );
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run:

```powershell
npm test -- --runTestsByPath scripts/event-publication-assets.test.js
```

Expected: module 미구현으로 FAIL

- [ ] **Step 3: 읽기 전용 이미지 download와 contact sheet 구현**

이미지는 `migration-logs/event-publication/20260731/source-images/`에 저장한다. URL query string과 토큰은 로그에 출력하지 않는다. 파일명은 `{eventId}-{wide|card}.webp`로 고정한다. Sharp contact sheet는 wide와 card를 별도 PNG로 만들고 각 셀에 이벤트 ID만 표시한다.

Commands:

```json
"events:publication:download-images": "node scripts/event-publication-assets.js download-existing",
"events:publication:contact-sheet": "node scripts/event-publication-assets.js contact-sheet",
"events:publication:validate-images": "node scripts/event-publication-assets.js validate",
"events:publication:upload-images": "node scripts/event-publication-assets.js upload",
"events:publication:verify-images": "node scripts/event-publication-assets.js verify-upload"
```

- [ ] **Step 4: 기존 이미지 44개 시각 감사**

Run:

```powershell
npm run events:publication:download-images
npm run events:publication:contact-sheet
```

접촉 시트를 실제로 열어 각 이미지에서 다음을 확인한다.

- 허위 쿠폰·적립·무료배송·상담 문구 없음
- 깨진 한글 없음
- 타사 로고·워터마크 없음
- canonical 제목·benefit과 충돌 없음
- 목록·상세 crop에서 피사체 보존

각 자산은 `reuse` 또는 `generate`로 기록한다.

```json
{
  "version": "20260731",
  "events": [
    {
      "id": "event-2026-01-layering-sale",
      "source": "legacy",
      "wide": { "action": "reuse", "reason": "safe_copy_and_crop" },
      "card": { "action": "generate", "reason": "unsupported_embedded_copy" }
    }
  ]
}
```

- [ ] **Step 5: 신규 20개와 교체 판정 이미지를 built-in image generation으로 생성**

먼저 `imagegen` 스킬을 읽는다. `event-publication-image-manifest.json`에는 각 생성 대상별 `id`, `role`, `prompt`, `output`을 기록한다. 모든 prompt는 다음 제약을 포함한다.

```text
실제 한국 패션 쇼핑몰의 에디토리얼 캠페인 이미지.
타사 브랜드·로고·워터마크·가격·할인율·쿠폰·적립·무료배송 문구 없음.
이미지 안 글자는 이벤트 제목과 "상품별 가격 확인", "신상품 확인",
"상품 큐레이션", "구매 인증 리뷰 안내" 중 해당하는 한 문구만 사용.
정확한 한글, 가짜 UI 컨트롤 없음, 주요 피사체는 중앙 안전 영역에 배치.
wide는 16:9, card는 4:5 구도.
```

신규 이벤트 10개는 wide/card 20개를 모두 생성한다. 기존 22개는 decisions에서 `generate`인 역할만 생성한다. 출력은 `public/events/2026-publication/{eventId}-20260731-{wide|card}.webp`로 저장한다.

- [ ] **Step 6: 이미지 규격·수량 검증**

wide는 WebP 1600×900, card는 WebP 1000×1250을 요구한다. 모든 생성 이미지가 manifest에 있고 중복 output이 없으며, reuse URL과 generated path가 32개 이벤트에 각각 2개씩 존재해야 한다.

Run:

```powershell
npm run events:publication:validate-images
```

Expected: `events=32 assets=64 invalid=0`

- [ ] **Step 7: 이미지 단위 테스트 통과 확인**

Run:

```powershell
npm test -- --runTestsByPath scripts/event-publication-assets.test.js
```

Expected: 모든 테스트 PASS

---

### Task 5: Firestore 비공개 stage·검증·publish·rollback CLI

**Files:**
- Create: `scripts/event-publication.js`
- Create: `scripts/event-publication.test.js`
- Modify: `src/shared/types/event.ts`
- Modify: `src/shared/libs/firebase/firebase.ts`
- Modify: `functions/__tests__/firestoreRules.test.ts`

**Interfaces:**
- Consumes: publication manifest, image decisions, Firestore/Storage runtime
- Produces:
  - `parsePublicationCommand(argv)`
  - `analyzePublication(runtime, manifest, decisions)`
  - `stagePublication(runtime, plan, backupPath)`
  - `verifyStagedPublication(runtime, plan)`
  - `publishPublication(runtime, plan)`
  - `rollbackPublication(runtime, backup, newIds)`

- [ ] **Step 1: CLI 안전 계약 테스트 작성**

```js
test('accepts only explicit publication commands', () => {
  for (const command of ['analyze', 'stage', 'verify', 'publish', 'rollback']) {
    expect(parsePublicationCommand([command])).toBe(command);
  }
  expect(() => parsePublicationCommand(['delete'])).toThrow('지원하지 않는 명령');
});

test('stages every document as unverified', async () => {
  const { db, writes } = createFirestoreFixture();
  await stagePublication({ db, projectId: 'hebimall' }, createPlan(), 'backup.json');
  expect(writes).toHaveLength(32);
  expect(writes.every(write => write.data.publicPolicyVerified === false)).toBe(true);
});

test('publishes only a fully verified matching stage', async () => {
  const fixture = createVerifiedStageFixture({ eventCount: 32 });
  await publishPublication(fixture.runtime, fixture.plan);
  expect(fixture.writes).toHaveLength(32);
  expect(fixture.writes.every(write => write.data.publicPolicyVerified === true)).toBe(true);
});

test('rolls back without deleting new documents', async () => {
  const fixture = createRollbackFixture();
  await rollbackPublication(fixture.runtime, fixture.backup, fixture.newIds);
  expect(fixture.delete).not.toHaveBeenCalled();
  for (const id of fixture.newIds) {
    expect(fixture.writes).toContainEqual(expect.objectContaining({
      id,
      data: expect.objectContaining({
        publicPolicyVerified: false,
        isActive: false,
      }),
    }));
  }
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run:

```powershell
npm test -- --runTestsByPath scripts/event-publication.test.js
```

Expected: module 미구현으로 FAIL

- [ ] **Step 3: Event 타입에 publicationVersion 추가**

```ts
export interface Event {
  // existing fields
  publicationVersion?: string;
}
```

32개 stage 문서는 `publicationVersion: '20260731'`을 갖는다. publish는 이 값과 canonical 필드가 manifest와 일치할 때만 공개 값을 바꾼다.

- [ ] **Step 4: 전체 문서 백업 serializer 구현**

백업은 `migration-logs/event-publication/20260731/backups/{timestamp}.json`에 저장한다. Firestore Timestamp는 다음 marker로 직렬화한다.

```js
{ "__type": "timestamp", "value": "2026-07-31T00:00:00.000Z" }
```

serializer/deserializer는 배열과 plain object를 재귀 처리하고, 백업에는 `projectId`, `createdAt`, 기존 22개 전체 데이터와 checksum을 포함한다. 민감한 환경변수와 URL query는 기록하지 않는다.

- [ ] **Step 5: analyze와 stage 구현**

`analyze`는 읽기 전용으로 다음을 반환한다.

```js
{
  projectId: 'hebimall',
  existingEvents: 22,
  newEvents: 10,
  totalEvents: 32,
  activeReviewTargets: 6,
  imageAssets: 64,
  readyToStage: true,
}
```

`stage` 순서:

1. project ID가 `hebimall`인지 확인
2. manifest와 image decisions 재검증
3. review 대상 상품 6개가 `status: active`인지 확인
4. 이미지 64개가 reuse 또는 업로드 검증 완료인지 확인
5. 기존 22개 전체 백업 저장
6. 한 Firestore batch에서 기존 22개 `set(..., { merge: true })`, 신규 10개 `set(...)`
7. stale conditional field는 `FieldValue.delete()`로 제거
8. 32개 모두 `publicPolicyVerified: false`

- [ ] **Step 6: verify와 publish 구현**

`verify`는 32개 문서, version, canonical copy, category slug, review targets, image URL 응답과 `publicPolicyVerified: false`를 확인한다.

`publish`는 다음이 모두 참일 때만 32개를 한 batch로 `true` 전환한다.

- `verify` 결과 invalid 0
- 현재 문서 `publicationVersion === '20260731'`
- `--confirm-project=hebimall` 인자 존재
- `--confirm-count=32` 인자 존재

이번 실행에서는 publish 명령을 호출하지 않는다.

- [ ] **Step 7: 비파괴 rollback 구현**

rollback은 명시한 백업 파일을 읽어 기존 22개를 전체 복원하고, 신규 10개는 삭제하지 않고 다음 값으로 갱신한다.

```js
{
  publicPolicyVerified: false,
  isActive: false,
}
```

rollback도 `--confirm-project=hebimall`과 백업 경로가 필요하다. 이번 실행에서는 rollback을 호출하지 않는다.

- [ ] **Step 8: Firestore Emulator 연결을 명시적 개발 옵션으로 추가**

`src/shared/libs/firebase/firebase.ts`에서 `db`를 먼저 생성하고, 기존 `NEXT_PUBLIC_USE_FIREBASE_EMULATOR === 'true'` 분기 안에서 Firestore도 연결한다.

```ts
const db = getFirestore(app);

if (
  process.env.NODE_ENV === 'development'
  && process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === 'true'
) {
  connectFunctionsEmulator(functions, 'localhost', 5002);
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
}
```

환경변수가 없거나 `false`이면 현재처럼 운영 Firebase를 사용한다.

- [ ] **Step 9: 공개 Rules 테스트 보강**

다음 계약을 emulator 테스트로 확인한다.

- `publicPolicyVerified: false`인 stage 문서는 공개 읽기 불가
- `publicPolicyVerified: true`, `isActive: true`인 종료 문서는 공개 읽기 가능
- `isActive: false`인 신규 rollback 문서는 공개 읽기 불가

- [ ] **Step 10: CLI와 Rules 테스트 통과 확인**

Run:

```powershell
npm test -- --runTestsByPath scripts/event-publication.test.js
npm run test:rules
```

Expected: 모든 테스트 PASS

---

### Task 6: 이미지 업로드와 운영 Firestore 비공개 stage

**Files created at runtime:**
- `migration-logs/event-publication/20260731/backups/*.json`
- `migration-logs/event-publication/20260731/reports/*.json`

**Interfaces:**
- Consumes: Task 3 manifest, Task 4 image decisions/assets, Task 5 CLI
- Produces: 운영 Storage의 immutable 이미지 객체, 운영 Firestore 32개 비공개 stage

- [ ] **Step 1: 전체 관련 테스트와 정적 검증**

Run:

```powershell
npm test -- --runTestsByPath `
  src/app/events/_components/eventListStatus.test.ts `
  src/app/events/_components/EventList.test.tsx `
  "src/app/events/[eventId]/eventProductSelection.test.ts" `
  src/shared/utils/eventPublicPolicy.test.ts `
  scripts/event-publication-manifest.test.js `
  scripts/event-publication-assets.test.js `
  scripts/event-publication.test.js
npm run typecheck
npm run lint -- --max-warnings=0
```

Expected: 테스트, 타입체크, 린트 PASS

- [ ] **Step 2: 읽기 전용 publication 분석**

Run:

```powershell
npm run events:publication:analyze
```

Expected:

```text
projectId=hebimall existingEvents=22 newEvents=10 totalEvents=32 readyToStage=true
```

- [ ] **Step 3: 생성 이미지 업로드**

Run:

```powershell
npm run events:publication:upload-images
npm run events:publication:verify-images
```

Expected: 필요한 신규 객체만 업로드되고 `events=32 assets=64 invalid=0`

- [ ] **Step 4: Firestore 비공개 stage 실행**

Run:

```powershell
npm run events:publication:stage
```

Expected:

- 백업 파일 생성
- existing 22, new 10, staged 32
- publicPolicyVerified true 문서 0
- 신규 문서 삭제 0

- [ ] **Step 5: 운영 stage 검증**

Run:

```powershell
npm run events:publication:verify
```

Expected:

```text
events=32 validDocuments=32 verifiedFalse=32 reachableImages=64 activeReviewTargets=6
```

- [ ] **Step 6: 운영 공개 상태 불변 확인**

배포 사이트 `https://hebimall.web.app/events/`는 stage 문서를 읽지 못하므로 계속 `0개 이벤트`여야 한다. 공개 문서가 노출되면 즉시 중단하고 원인을 조사한다.

---

### Task 7: 로컬·Emulator 통합 QA와 문서 갱신

**Files:**
- Create: `scripts/event-publication-emulator-seed.js`
- Create: `scripts/event-publication-emulator-seed.test.js`
- Modify: `docs/event-page-review.md`
- Modify: `docs/commerce-policy.md` only if public copy policy text changes
- Modify: `docs/README.md`

**Interfaces:**
- Consumes: canonical manifest와 로컬 생성 이미지
- Produces: Emulator용 32개 공개 fixture와 QA 기록

- [ ] **Step 1: Emulator seed 테스트 작성**

```js
test('seeds exactly 32 verified public events into the emulator only', async () => {
  const runtime = createEmulatorRuntime();
  const result = await seedPublicationFixture(runtime, buildPublicationManifest());
  expect(result).toEqual({ events: 32, publicPolicyVerified: true });
  expect(runtime.projectId).toBe('demo-hebimall-events');
});

test('refuses a non-emulator host or production project id', async () => {
  await expect(seedPublicationFixture({
    projectId: 'hebimall',
    emulatorHost: undefined,
  }, buildPublicationManifest())).rejects.toThrow('Emulator 전용');
});
```

- [ ] **Step 2: Emulator-only seed 구현**

`FIRESTORE_EMULATOR_HOST`가 존재하고 project ID가 `demo-hebimall-events`일 때만 실행한다. 이미지 URL은 `/events/2026-publication/...` 로컬 경로를 사용하고 32개 fixture의 `publicPolicyVerified`만 emulator에서 `true`로 만든다.

- [ ] **Step 3: Emulator seed 테스트 통과 확인**

Run:

```powershell
npm test -- --runTestsByPath scripts/event-publication-emulator-seed.test.js
```

Expected: PASS

- [ ] **Step 4: Firestore Emulator와 로컬 앱 실행**

Emulator:

```powershell
firebase emulators:start --only firestore --project demo-hebimall-events
```

별도 터미널에서 seed:

```powershell
$env:FIRESTORE_EMULATOR_HOST='127.0.0.1:8080'
node scripts/event-publication-emulator-seed.js
```

별도 터미널에서 앱:

```powershell
$env:NEXT_PUBLIC_USE_FIREBASE_EMULATOR='true'
npm run dev
```

- [ ] **Step 5: 브라우저 QA**

Browser 스킬을 사용해 `http://localhost:3000/events/`를 확인한다.

- 1440px: 진행·예정/종료 탭, 유형 필터, 페이지네이션, 32개 합계
- 390px: 탭 줄바꿈, 카드 2열/1열 기존 반응형, 수평 오버플로우 없음
- 대표 상세: 세일·신상품·시즌·review·종료 각 1개
- 예정/종료 참여 CTA 차단
- 이미지 64개 로딩
- 콘솔 error 0

- [ ] **Step 6: 전체 품질 게이트**

Run:

```powershell
npm run typecheck
npm run lint -- --max-warnings=0
npm test -- --runInBand
npm run test:rules
npm run functions:build
npm run build
```

Expected: 모든 명령 exit 0

- [ ] **Step 7: 문서 갱신**

`docs/event-page-review.md`에 다음을 기록한다.

- 22개 legacy 안전 copy 전환과 이미지 reuse/generate 수량
- 신규 10개 구성
- 상태 탭과 상품 필터 보정
- 운영 stage 32개가 모두 비공개임
- Emulator 브라우저 QA 결과
- publish와 배포가 아직 실행되지 않았음

동작 정책이 바뀌지 않으면 `docs/commerce-policy.md`는 수정하지 않는다. `docs/README.md`에는 이 실행 계획 링크를 추가한다.

---

### Task 8: 공개 전 최종 인계

**Files:**
- No code changes

**Interfaces:**
- Consumes: Task 1~7 검증 결과와 stage report
- Produces: 배포·publish 승인 요청

- [ ] **Step 1: 변경 범위 최종 확인**

Run:

```powershell
git status --short
git diff --check
git diff --stat
```

기존 사용자 CSS 변경과 이번 이벤트 변경을 구분해 보고한다.

- [ ] **Step 2: 운영 불변 확인**

Run:

```powershell
npm run events:publication:verify
```

Expected: `verifiedFalse=32`, 공개된 stage 문서 0

- [ ] **Step 3: 해비님에게 배포 승인 요청**

다음을 명확히 보고한다.

- 로컬 코드·테스트·빌드 결과
- 기존 이미지 reuse 수량과 생성 수량
- Storage 업로드 수량
- Firestore backup 경로와 staged 32개
- 운영 `/events/`는 아직 0개
- 다음 승인 작업은 코드 배포 후 `events:publication:publish --confirm-project=hebimall --confirm-count=32`

승인 전에는 deploy와 publish를 실행하지 않는다.

---

## Execution Notes

- 각 Task는 테스트 실패를 먼저 확인한 뒤 최소 구현으로 통과시킨다.
- 계획의 commit 단계는 사용자 지침과 프로젝트 규칙 때문에 의도적으로 생략한다.
- `stage`, 이미지 upload, Storage write는 해비님이 승인한 이벤트 공개 작업 범위에 포함한다.
- `publish`, Firebase deploy, rollback, 신규 문서 삭제는 별도 승인 없이는 실행하지 않는다.
