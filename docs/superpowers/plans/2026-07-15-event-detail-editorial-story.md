# 이벤트 상세 에디토리얼 스토리 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기존 이벤트 요약 이미지 아래에 이벤트별 신규 에디토리얼 이미지 3장, 관련 상품 8개와 짧은 유의사항을 배치해 22개 상세 페이지를 실제 패션몰 기획전 흐름으로 바꾼다.

**Architecture:** 기존 `Event` 문서에 선택적 `editorialImages` 객체를 추가하고, 신규 `EventEditorialStory`가 `benefit → styling → product` 순서로 렌더링한다. 이미지 제작은 기존 캠페인 이미지를 스타일 참조로 사용해 이벤트마다 세 명령어를 먼저 확정한 뒤 세 장을 연속 생성하며, 검증된 66장만 신규 Storage 경로에 업로드하고 Firestore를 batch로 갱신한다.

**Tech Stack:** Next.js 15, React 19, TypeScript, CSS Modules, Jest, Testing Library, Firebase Firestore/Storage, Sharp, built-in image generation

## Global Constraints

- 이벤트 수는 정확히 22개이며 신규 상세 이미지는 이벤트마다 3장, 총 66장이다.
- 신규 이미지 역할과 순서는 `benefit`, `styling`, `product`로 고정한다.
- 최종 이미지는 모두 `1000 × 1500` WebP, 5MB 미만이어야 한다.
- 각 이미지는 단일 가로 포스터가 아니라 2~3개의 사진 장면과 제목 포함 최대 4개의 짧은 한글 카피로 구성한 세로형 상세 콘텐츠여야 한다.
- 이미지 안 한글은 행사명과 역할별 핵심 문구만 사용하고 워터마크, 타사 로고, 의미 없는 문구를 금지한다.
- 기존 이미지 객체와 `bannerImage`, `thumbnailImage`, `detailImage` 필드는 삭제하거나 덮어쓰지 않는다.
- 신규 Storage 객체는 생성 전용으로 업로드하고 Firestore는 66개 URL 검증 후 한 batch에서 갱신한다.
- 코드에는 `box-shadow`와 `border-radius`를 추가하지 않는다.
- 사용자 지침에 따라 커밋, 푸시, 배포는 수행하지 않는다.

---

### Task 1: 에디토리얼 이미지 명령어·자산 계약

**Files:**
- Create: `scripts/event-editorial-image-manifest.json`
- Create: `scripts/event-editorial-image-assets.js`
- Create: `scripts/event-editorial-image-assets.test.js`
- Modify: `package.json`

**Interfaces:**
- Consumes: `scripts/event-image-refresh-manifest.json`의 22개 `id`, `title`, `benefit`, `subjectType`, `concept`, `palette`, `wideOutput`
- Produces: `EDITORIAL_ROLES`, `validateManifestContract()`, `getRawPath()`, `getOutputPath()`, `normalizeAssets()`, `validateAssets()`, `buildContactSheets()`

- [ ] **Step 1: 실패하는 manifest 계약 테스트 작성**

```js
expect(manifest.events).toHaveLength(22);
expect(manifest.events.flatMap(event => event.images)).toHaveLength(66);
expect(event.images.map(image => image.role)).toEqual(['benefit', 'styling', 'product']);
expect(new Set(manifest.events.flatMap(event => event.images.map(image => image.output)))).toHaveSize(66);
expect(image.prompt).toContain(`행사명: "${event.title}"`);
```

- [ ] **Step 2: 테스트를 실행해 실패 확인**

Run: `npx jest --runInBand scripts/event-editorial-image-assets.test.js`

Expected: manifest 또는 구현 파일이 없어 FAIL

- [ ] **Step 3: 22개 이벤트의 공통 캠페인 명령어와 세 역할 명령어 작성**

각 이벤트 항목은 다음 계약을 완전한 값으로 저장한다.

```json
{
  "id": "event-2026-08-pre-fall",
  "title": "프리폴 컬렉션",
  "benefit": "가을 신상품 선공개",
  "referenceImage": "public/events/2026-v2/event-2026-08-pre-fall-wide.webp",
  "campaignCommand": "실제 한국 종합 패션몰의 프리폴 기획전. 버건디, 올리브, 차콜 팔레트와 어두운 도심 자연광을 세 이미지에서 일관되게 유지한다.",
  "images": [
    {
      "role": "benefit",
      "prompt": "Use case: ads-marketing\nAsset type: 이벤트 상세 혜택 세로 콘텐츠\nPrimary request: 상단 캠페인 장면, 중단 핵심 혜택, 하단 일정 안내를 하나의 자연스러운 세로 상세 이미지로 구성한다.\nText (verbatim): \"프리폴 컬렉션\", \"가을 신상품 선공개\", \"먼저 만나는 가을\"\nConstraints: 세로 2:3, 사진 장면 3개 이하, 제목 포함 한글 카피 4개 이하, 정확한 한글, 가로 중앙 안전 영역 88%, 가짜 로고와 워터마크 없음",
      "output": "public/events/2026-editorial/event-2026-08-pre-fall-20260715-benefit.webp"
    },
    {
      "role": "styling",
      "prompt": "Use case: ads-marketing\nAsset type: 이벤트 상세 MD 추천 세로 콘텐츠\nPrimary request: 남녀 모델 2인의 전신 룩, 소재 디테일, 스타일 조합을 위에서 아래로 세 장면으로 제안한다.\nText (verbatim): \"MD 추천 스타일\", \"가벼운 재킷\", \"니트 레이어링\"\nConstraints: 세로 2:3, 사진 장면 3개 이하, 제목 포함 한글 카피 4개 이하, 같은 캠페인 팔레트와 캐스팅 톤, 정확한 한글, 가짜 로고와 워터마크 없음",
      "output": "public/events/2026-editorial/event-2026-08-pre-fall-20260715-styling.webp"
    },
    {
      "role": "product",
      "prompt": "Use case: ads-marketing\nAsset type: 이벤트 상세 상품 세로 콘텐츠\nPrimary request: 가벼운 재킷, 니트, 가죽 액세서리의 제품 정물과 소재 클로즈업을 위에서 아래로 세 장면 구성한다.\nText (verbatim): \"프리폴 에센셜\", \"가을을 준비하는 세 가지 선택\", \"추천 상품을 만나보세요\"\nConstraints: 세로 2:3, 사진 장면 3개 이하, 제목 포함 한글 카피 4개 이하, 제품 형태 정확성, 같은 캠페인 팔레트, 정확한 한글, 가짜 로고와 워터마크 없음",
      "output": "public/events/2026-editorial/event-2026-08-pre-fall-20260715-product.webp"
    }
  ]
}
```

22개 항목 모두 기존 `concept`, `palette`, `subjectType`을 바탕으로 역할별 장면과 한글 문구를 명시한다. `styling`은 여성 단독, 남성 단독, 혼성 2인, 혼성 3인을 분산하고 `product`는 플랫레이, 마네킹, 소재 클로즈업, 착용 디테일을 분산한다.

- [ ] **Step 4: 자산 정규화·검증 구현**

```js
const EDITORIAL_ROLES = Object.freeze(['benefit', 'styling', 'product']);
const TARGET = Object.freeze({ width: 1000, height: 1500 });
const MAX_FILE_SIZE = 5 * 1024 * 1024;

function getRawPath(event, role) {
  return path.resolve(`tmp/event-editorial-images/raw/${event.id}-${role}.png`);
}

function getOutputPath(image) {
  return path.resolve(image.output);
}

async function normalizeAsset(event, image) {
  await sharp(getRawPath(event, image.role))
    .resize(TARGET.width, TARGET.height, { fit: 'cover', position: 'centre' })
    .webp({ quality: 88 })
    .toFile(getOutputPath(image));
}
```

검증은 이벤트 22개, 역할 순서, 출력 66개 고유성, prompt 한글 계약, WebP, 크기, 파일 용량을 모두 확인한다. 연락판은 역할별 22장과 이벤트별 3장 스트립을 생성한다.

- [ ] **Step 5: package scripts 추가**

```json
"event-editorial-images:normalize": "node scripts/event-editorial-image-assets.js normalize",
"event-editorial-images:validate": "node scripts/event-editorial-image-assets.js validate",
"event-editorial-images:contact-sheet": "node scripts/event-editorial-image-assets.js contact-sheet"
```

- [ ] **Step 6: 집중 테스트 통과 확인**

Run: `npx jest --runInBand scripts/event-editorial-image-assets.test.js`

Expected: manifest 계약, 경로, 규격, 연락판 테스트 PASS

---

### Task 2: 이벤트별 3장 순차 생성과 시각 검수

**Files:**
- Create: `tmp/event-editorial-images/raw/*.png` (중간 산출물)
- Create: `public/events/2026-editorial/*.webp` (최종 66장)
- Create: `tmp/event-editorial-images/contact-sheets/*.webp` (검수 산출물)

**Interfaces:**
- Consumes: `scripts/event-editorial-image-manifest.json`
- Produces: `public/events/2026-editorial/{eventId}-20260715-{role}.webp` 66개

- [ ] **Step 1: imagegen 공통 프롬프트 지침 확인**

Read: `C:/Users/박도영/.codex/skills/.system/imagegen/references/prompting.md`

- [ ] **Step 2: 이벤트 하나의 명령어를 먼저 읽고 3장을 순서대로 생성**

각 이벤트에서 built-in 이미지 생성 호출을 다음 순서로 개별 실행한다.

1. `benefit`: `referenceImage`를 스타일 참조로 포함
2. `styling`: `referenceImage`와 방금 생성한 `benefit`을 스타일 참조로 포함
3. `product`: `referenceImage`, `benefit`, `styling`을 스타일 참조로 포함

각 호출은 manifest의 해당 `prompt`와 `campaignCommand`를 합쳐 사용한다. 하나의 호출에서 서로 다른 역할을 동시에 만들지 않는다.

- [ ] **Step 3: 이벤트 단위 즉시 검수**

세 장 생성 직후 다음 항목을 확인하고, 실패한 역할만 한 가지 수정 지시로 다시 생성한다.

- 행사명과 혜택 한글이 manifest와 일치한다.
- 세 이미지의 팔레트, 계절, 광원, 타이포 톤이 하나의 캠페인처럼 보인다.
- 손, 얼굴, 제품 형태가 자연스럽다.
- 모바일 중앙 안전 영역에 핵심 문구와 피사체가 들어온다.
- 다른 이벤트의 인물, 배경, 구도와 과도하게 반복되지 않는다.

- [ ] **Step 4: 22개 이벤트를 manifest 순서로 반복**

Run order: 1월 이벤트부터 `PacCrKVG9TikHo7lambG`까지 manifest 배열 순서를 유지한다. 이벤트 A의 세 장을 끝내기 전에 이벤트 B로 넘어가지 않는다.

- [ ] **Step 5: 정규화와 전체 연락판 검수**

Run:

```powershell
npm run event-editorial-images:normalize
npm run event-editorial-images:validate
npm run event-editorial-images:contact-sheet
```

Expected: 66/66 WebP, 모두 `1000 × 1500`, 역할별 22장 연락판과 이벤트별 스트립 생성

---

### Task 3: Event 스키마와 관리자 업로드 슬롯

**Files:**
- Modify: `src/shared/types/event.ts`
- Modify: `src/app/admin/events/_components/EventForm.tsx`
- Modify: `src/app/admin/events/_components/EventForm.test.tsx`

**Interfaces:**
- Produces: `EventEditorialImages`, `Event.editorialImages?: EventEditorialImages`

- [ ] **Step 1: 실패하는 관리자 폼 테스트 작성**

```tsx
editorialImages: {
  benefit: '/benefit.webp',
  styling: '/styling.webp',
  product: '/product.webp',
}
```

세 미리보기와 `혜택 이미지`, `MD 추천 이미지`, `상품 에디토리얼 이미지` 업로드 버튼을 기대한다. 저장 payload가 `editorialImages`를 유지하는지도 검증한다.

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx jest --runInBand src/app/admin/events/_components/EventForm.test.tsx`

Expected: 신규 슬롯이 없어 FAIL

- [ ] **Step 3: 타입과 상태 구현**

```ts
export interface EventEditorialImages {
  benefit?: string;
  styling?: string;
  product?: string;
}

export interface Event {
  id: string;
  editorialImages?: EventEditorialImages;
}
```

`EventForm`은 세 역할을 선택적으로 초기화하고 `events/editorial/{role}`에 업로드하며, 값이 하나라도 있으면 존재하는 역할만 `editorialImages`로 저장한다.

- [ ] **Step 4: 관리자 폼 테스트 통과 확인**

Run: `npx jest --runInBand src/app/admin/events/_components/EventForm.test.tsx`

Expected: 기존 이미지 테스트와 신규 세 슬롯 테스트 PASS

---

### Task 4: 에디토리얼 이미지 Firebase 동기화

**Files:**
- Create: `scripts/event-editorial-image-firebase-sync.js`
- Create: `scripts/event-editorial-image-firebase-sync.test.js`
- Modify: `package.json`

**Interfaces:**
- Consumes: 검증된 manifest와 66개 로컬 WebP
- Produces: Storage 신규 객체 66개, Firestore `editorialImages` batch, 백업 JSON

- [ ] **Step 1: 실패하는 동기화 계약 테스트 작성**

```js
expect(buildStoragePlan(event, '20260715')).toEqual({
  benefit: `events/editorial/${event.id}-20260715-benefit.webp`,
  styling: `events/editorial/${event.id}-20260715-styling.webp`,
  product: `events/editorial/${event.id}-20260715-product.webp`,
});
expect(buildEventUpdate(plan, bucket)).toEqual({
  editorialImages: {
    benefit: expect.stringContaining(plan.benefit),
    styling: expect.stringContaining(plan.styling),
    product: expect.stringContaining(plan.product),
  },
});
```

생성 전용 precondition, 66개 로컬 파일, 백업 보존, batch 22개, verify 66개, rollback을 각각 테스트한다.

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx jest --runInBand scripts/event-editorial-image-firebase-sync.test.js`

Expected: 동기화 구현이 없어 FAIL

- [ ] **Step 3: analyze/upload/verify-upload/apply/verify/rollback 구현**

기존 `event-image-firebase-sync.js`의 프로젝트·버킷 검증, immutable 업로드, backup, batch, HTTP 검증 패턴을 재사용하되 기존 세 이미지 필드는 수정하지 않는다. 백업은 각 문서의 기존 `editorialImages` 존재 여부와 값을 보존한다.

- [ ] **Step 4: package scripts 추가**

```json
"event-editorial-images:firebase:analyze": "node scripts/event-editorial-image-firebase-sync.js analyze",
"event-editorial-images:firebase:upload": "node scripts/event-editorial-image-firebase-sync.js upload",
"event-editorial-images:firebase:verify-upload": "node scripts/event-editorial-image-firebase-sync.js verify-upload",
"event-editorial-images:firebase:apply": "node scripts/event-editorial-image-firebase-sync.js apply",
"event-editorial-images:firebase:verify": "node scripts/event-editorial-image-firebase-sync.js verify",
"event-editorial-images:firebase:rollback": "node scripts/event-editorial-image-firebase-sync.js rollback"
```

- [ ] **Step 5: 집중 테스트 통과 확인**

Run: `npx jest --runInBand scripts/event-editorial-image-firebase-sync.test.js`

Expected: analyze부터 rollback까지 PASS

---

### Task 5: 상단 요약과 에디토리얼 스토리 컴포넌트

**Files:**
- Create: `src/app/events/[eventId]/_components/EventEditorialStory.tsx`
- Create: `src/app/events/[eventId]/_components/EventEditorialStory.test.tsx`
- Create: `src/app/events/[eventId]/_components/EventEditorialStory.module.css`
- Modify: `src/app/events/[eventId]/_components/EventCommerceHero.tsx`
- Modify: `src/app/events/[eventId]/_components/EventCommerceBlocks.module.css`
- Modify: `src/app/events/[eventId]/EventDetailClient.tsx`
- Modify: `src/app/events/[eventId]/EventDetailClient.test.tsx`

**Interfaces:**
- Consumes: `Event.editorialImages`, 기존 CTA 상태와 `EventActionSummaryItem[]`
- Produces: compact summary hero, `EventEditorialStory({ title, images })`

- [ ] **Step 1: 실패하는 렌더링 테스트 작성**

```tsx
expect(screen.getByRole('region', { name: '프리폴 컬렉션 에디토리얼' })).toBeInTheDocument();
expect(screen.getAllByRole('img').map(image => image.getAttribute('alt'))).toEqual([
  '프리폴 컬렉션 혜택 안내',
  '프리폴 컬렉션 MD 추천 스타일',
  '프리폴 컬렉션 추천 상품 에디토리얼',
]);
```

신규 필드 전체 누락 시 region 없음, 일부 누락 시 존재하는 이미지만 역할 순서대로 표시하는 테스트를 추가한다. 상세 통합 테스트는 `요약 → 에디토리얼 → 상품 → 안내` DOM 순서를 확인한다.

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx jest --runInBand src/app/events/[eventId]/_components/EventEditorialStory.test.tsx src/app/events/[eventId]/EventDetailClient.test.tsx`

Expected: 신규 컴포넌트가 없어 FAIL

- [ ] **Step 3: 최소 렌더링 구현**

```tsx
const ROLE_META = [
  ['benefit', '혜택 안내'],
  ['styling', 'MD 추천 스타일'],
  ['product', '추천 상품 에디토리얼'],
] as const;

const items = ROLE_META.flatMap(([role, label]) => {
  const src = images?.[role];
  return src ? [{ role, label, src }] : [];
});

if (items.length === 0) return null;
```

각 이미지는 Next `Image` 또는 기존 반응형 이미지 컴포넌트로 원본 전체를 표시하고, 로딩 실패한 항목만 숨긴다.

- [ ] **Step 4: 상단 2열 요약으로 통합**

`EventCommerceHero`가 기존 이미지, 상태, 제목, 설명, 기간, 혜택 목록과 주 CTA를 한 섹션에 렌더링한다. `EventDetailClient`의 별도 `EventActionBar` 호출은 제거하고 `기획전 상품 보기`는 `#event-products`로 연결한다.

- [ ] **Step 5: 집중 테스트 통과 확인**

Run: `npx jest --runInBand src/app/events/[eventId]/_components/EventEditorialStory.test.tsx src/app/events/[eventId]/EventDetailClient.test.tsx src/app/events/[eventId]/_components/EventCommerceBlocks.test.tsx`

Expected: 신규 순서와 기존 CTA 동작 PASS

---

### Task 6: 상품 매대 문맥과 짧은 유의사항

**Files:**
- Modify: `src/app/events/[eventId]/_components/EventProductShowcase.tsx`
- Modify: `src/app/events/[eventId]/_components/EventProductShowcase.module.css`
- Modify: `src/app/events/[eventId]/_components/EventProductShowcase.test.tsx`
- Modify: `src/app/events/[eventId]/_components/EventInformationSections.tsx`
- Modify: `src/app/events/[eventId]/_components/EventInformationSections.test.tsx`
- Modify: `src/app/events/[eventId]/EventDetailClient.tsx`

**Interfaces:**
- Produces: `id="event-products"`, 이벤트 대상 라벨과 MD 문구가 전달된 최대 8개 상품, 두 아코디언

- [ ] **Step 1: 실패하는 상품·안내 테스트 작성**

상품 section의 `id="event-products"`, 최대 8개, 기존 오류/재시도/빈 상태와 `ProductCard`의 이벤트 라벨 전달을 기대한다. 안내 제목은 `혜택·사용 방법`, `유의사항` 두 개만 기대하고 두 영역 모두 토글 가능한지 검증한다.

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx jest --runInBand src/app/events/[eventId]/_components/EventProductShowcase.test.tsx src/app/events/[eventId]/_components/EventInformationSections.test.tsx`

Expected: 기존 3개 안내와 상품 앵커 부재로 FAIL

- [ ] **Step 3: 상품 매대와 안내 구현**

상품 선택과 카드 수는 유지한다. 변형별 라벨은 세일 `기획전 할인 대상`, 쿠폰 `쿠폰 추천 상품`, 리뷰 `리뷰 인기 상품`, 신상 `신상품`, 특별 `MD 추천`으로 전달한다. 안내는 기존 본문·혜택·참여 단계를 첫 영역에 합치고 유의사항을 둘째 영역에 둔다.

- [ ] **Step 4: 집중 테스트 통과 확인**

Run: `npx jest --runInBand src/app/events/[eventId]/_components/EventProductShowcase.test.tsx src/app/events/[eventId]/_components/EventInformationSections.test.tsx`

Expected: 상품 8개와 두 아코디언 테스트 PASS

---

### Task 7: Firebase 반영, 전체 검증과 브라우저 QA

**Files:**
- Modify: `docs/event-page-review.md`
- Modify: `docs/README.md`

**Interfaces:**
- Consumes: 검증된 66개 WebP, 동기화 스크립트, 완료된 상세 UI
- Produces: Firebase Storage/Firestore 반영과 최종 QA 기록

- [ ] **Step 1: Firebase 사전 분석과 업로드**

Run:

```powershell
npm run event-editorial-images:firebase:analyze
npm run event-editorial-images:firebase:upload
npm run event-editorial-images:firebase:verify-upload
```

Expected: project/bucket 일치, 로컬 66/66, 신규 Storage 66/66

- [ ] **Step 2: Firestore batch 반영과 검증**

Run:

```powershell
npm run event-editorial-images:firebase:apply
npm run event-editorial-images:firebase:verify
```

Expected: 문서 22/22의 세 URL과 HTTP 이미지 66/66 통과

- [ ] **Step 3: 전체 정적 검증**

Run:

```powershell
npm run verify
git diff --check
rg -n '\x{FFFD}' docs scripts src public/events/2026-editorial
```

Expected: 타입 검사, lint, 전체 Jest, Functions build, Next build PASS, 대체 문자 0개

- [ ] **Step 4: 실제 브라우저 QA**

1280px과 모바일 크기에서 세일, 쿠폰, 리뷰, 신상, 특별 대표 이벤트를 확인한 뒤 22개 상세 URL을 순회한다. 다음 DOM/시각 기준을 기록한다.

- 기존 이미지와 요약이 상단 2열 또는 모바일 세로 구조로 표시된다.
- 신규 세로 상세 이미지 3장이 `benefit → styling → product` 순서이며 하나의 긴 본문처럼 이어지고 잘리지 않는다.
- 상품 8개가 데스크톱 4열 × 2줄, 모바일 2열로 표시된다.
- 안내는 두 개이며 CTA, 가로 넘침, 콘솔 오류와 이미지 로딩 오류가 없다.

- [ ] **Step 5: 문서 갱신과 임시 서버 정리**

`docs/event-page-review.md`에 생성 66/66, Storage 66/66, Firestore 22/22, 브라우저 22/22 결과와 롤백 백업 경로를 기록한다. 확인용 서버만 명령줄과 포트를 검증한 뒤 종료한다.

---

## 자체 검토 결과

- 설계의 상단 요약, 신규 이미지 3장, 상품 8개, 짧은 유의사항, Firebase 폴백과 관리자 슬롯이 각 Task에 연결되어 있다.
- 이미지 역할과 타입 이름은 전 Task에서 `benefit`, `styling`, `product` 및 `EventEditorialImages`로 일치한다.
- 기존 이벤트 이미지 삭제, API 변경, 별도 이벤트 컴포넌트 생성은 계획 범위에 포함하지 않았다.
- 커밋 단계는 사용자와 프로젝트 지침에 따라 제외했다.
