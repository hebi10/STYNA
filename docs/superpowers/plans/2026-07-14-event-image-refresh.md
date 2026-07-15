# Event Image Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 이벤트 22개에 한글 행사명과 혜택이 포함된 서로 다른 와이드·카드 이미지를 생성하고 Firebase Storage와 Firestore에 안전하게 전환한다.

**Architecture:** `scripts/event-image-refresh-manifest.json`을 이미지 카피·아트디렉션·경로의 단일 원본으로 사용한다. 생성된 원본은 Sharp 기반 검증 도구로 `1600x820` 와이드와 `1000x1250` 카드 WebP로 정규화하며, UI는 공용 반응형 이미지 컴포넌트를 통해 모바일에서 카드 이미지를 선택한다. Storage 업로드와 Firestore batch 전환을 분리해 44개 업로드가 모두 검증되기 전에는 이벤트 문서를 변경하지 않는다.

**Tech Stack:** Next.js 15, React 19, TypeScript, Jest, Sharp, Firebase Admin SDK, Firebase Storage, Firestore, built-in image generation tool

## Global Constraints

- 이벤트 22개 모두 와이드 1개와 카드 1개를 생성한다.
- 행사명과 핵심 혜택은 이미지 생성 단계에서 한글로 직접 포함한다.
- 한글 오류는 별도 합성으로 수정하지 않고 이미지를 다시 생성한다.
- 와이드는 `1600x820`, 카드는 `1000x1250`, 형식은 WebP, 파일은 5MB 미만이다.
- 기존 Storage 객체와 `public/events/2026` 파일은 삭제하지 않는다.
- Firestore는 Storage 44개 업로드와 검증이 모두 끝난 뒤 22개 문서를 한 번에 전환한다.
- 이미지 생성은 built-in image generation tool을 한 이미지당 한 번씩 호출한다.
- 둥근 그래픽 스티커, 장식성 그림자, 가짜 로고, 워터마크, 불필요한 영문을 사용하지 않는다.
- 사용자 승인 없이 커밋, 푸시, 배포하지 않는다.

---

### Task 1: 이벤트 이미지 매니페스트

**Files:**
- Create: `scripts/event-image-refresh-manifest.json`
- Create: `scripts/event-image-refresh-manifest.test.js`
- Reference: `docs/superpowers/specs/2026-07-14-event-image-refresh-design.md`

**Interfaces:**
- Consumes: 설계 문서의 이벤트 22개 ID, 행사명, 혜택, 아트디렉션
- Produces: `{ version, formats, events }` 구조의 매니페스트와 이벤트별 `widePrompt`, `cardPrompt`, `wideOutput`, `cardOutput`

- [ ] **Step 1: 매니페스트 계약 테스트를 작성한다**

```js
const manifest = require('./event-image-refresh-manifest.json');

describe('event image refresh manifest', () => {
  test('contains 22 unique events and two exact output formats', () => {
    expect(manifest.version).toBe('20260714');
    expect(manifest.formats).toEqual({
      wide: { width: 1600, height: 820 },
      card: { width: 1000, height: 1250 },
    });
    expect(manifest.events).toHaveLength(22);
    expect(new Set(manifest.events.map((event) => event.id)).size).toBe(22);
  });

  test('keeps exact Korean copy and versioned output paths', () => {
    for (const event of manifest.events) {
      expect(event.title).toMatch(/[가-힣]/);
      expect(event.benefit).toMatch(/[가-힣0-9%]/);
      expect(event.widePrompt).toContain(`행사명: "${event.title}"`);
      expect(event.widePrompt).toContain(`혜택 문구: "${event.benefit}"`);
      expect(event.cardPrompt).toContain(`행사명: "${event.title}"`);
      expect(event.cardPrompt).toContain(`혜택 문구: "${event.benefit}"`);
      expect(event.wideOutput).toBe(`public/events/2026-v2/${event.id}-wide.webp`);
      expect(event.cardOutput).toBe(`public/events/2026-v2/${event.id}-card.webp`);
    }
  });
});
```

- [ ] **Step 2: 테스트가 매니페스트 부재로 실패하는지 확인한다**

Run: `npm test -- scripts/event-image-refresh-manifest.test.js`

Expected: `Cannot find module './event-image-refresh-manifest.json'`

- [ ] **Step 3: 설계 문서의 22개 행을 매니페스트로 작성한다**

각 이벤트 객체는 다음 구조를 사용하고, `concept`와 `palette`는 설계 문서의 아트디렉션을 그대로 구체화한다.

```json
{
  "id": "event-2026-06-midyear-sale",
  "title": "미드이어 세일",
  "benefit": "베스트 최대 60%",
  "concept": "대형 상품 랙과 가격 태그를 중심으로 구성한 인물 없는 패션 편집숍 세일 캠페인",
  "palette": "검정, 크림, 강한 세일 레드 포인트",
  "widePrompt": "실제 한국 종합 패션몰의 와이드 캠페인 포스터. 대형 상품 랙과 가격 태그, 인물 없음. 검정과 크림, 절제된 세일 레드. 왼쪽 카피 안전 영역. 이미지 안에 정확히 다음 두 한글 문구만 선명하게 표시: 행사명: \"미드이어 세일\", 혜택 문구: \"베스트 최대 60%\". 가짜 로고, 워터마크, 다른 글자, 둥근 스티커, 장식성 그림자 없음.",
  "cardPrompt": "실제 한국 종합 패션몰의 세로형 캠페인 카드 포스터. 상품 랙과 가격 태그를 세로 구도에 맞게 재구성, 인물 없음. 이미지 안에 정확히 다음 두 한글 문구만 선명하게 표시: 행사명: \"미드이어 세일\", 혜택 문구: \"베스트 최대 60%\". 가짜 로고, 워터마크, 다른 글자, 둥근 스티커, 장식성 그림자 없음.",
  "wideOutput": "public/events/2026-v2/event-2026-06-midyear-sale-wide.webp",
  "cardOutput": "public/events/2026-v2/event-2026-06-midyear-sale-card.webp"
}
```

필수 이벤트 ID와 카피는 다음 22쌍을 정확히 사용한다.

```text
event-2026-01-layering-sale | 윈터 레이어링 세일 | 최대 45% 혜택
event-2026-01-welcome-coupon | 새해 웰컴 쿠폰 | 첫 구매 20% 쿠폰
event-2026-02-knit-review | 니트 리뷰 리워드 | 리뷰 작성 시 2천원
event-2026-02-spring-preview | 스프링 프리뷰 | 봄 신상품 선공개
event-2026-03-trench-week | 트렌치 위크 | 아우터 최대 35%
event-2026-03-photo-review | 포토 리뷰 챌린지 | 최대 5천원 적립
event-2026-03-white-day-coupon | 화이트데이 쿠폰 | 선물 아이템 15%
event-2026-04-shirt-collection | 셔츠 컬렉션 런칭 | 런칭 한정 혜택
event-2026-04-office-look | 오피스룩 기획전 | 출근룩 최대 40%
event-2026-04-styling-coupon | 스타일링 상담 쿠폰 | 3만원 쿠폰
event-2026-05-denim-festival | 데님 페스티벌 | 데님 최대 50%
event-2026-05-family-coupon | 패밀리 먼스 쿠폰 | 추가 10% 쿠폰
event-2026-05-best-review | 베스트 리뷰 어워즈 | 베스트 리뷰 1만원
event-2026-06-midyear-sale | 미드이어 세일 | 베스트 최대 60%
event-2026-06-summer-linen | 썸머 리넨 컬렉션 | 시원한 리넨 신상
event-2026-07-vacation-coupon | 바캉스 쿠폰팩 | 휴가룩 쿠폰 3종
event-2026-07-cool-touch | 쿨터치 데일리 세일 | 최대 35% 할인
event-2026-07-summer-review | 여름 착용 리뷰 | 리뷰 적립금 2배
event-2026-08-pre-fall | 프리폴 컬렉션 | 가을 신상품 선공개
event-2026-08-last-summer | 라스트 썸머 클리어런스 | 마지막 최대 70%
h1WITXqWE2BL3G0ACiza | 신규 회원 가입 이벤트 | 첫 구매 20% 쿠폰
PacCrKVG9TikHo7lambG | 봄맞이 특가 세일 | 봄 신상품 최대 50%
```

- [ ] **Step 4: 매니페스트 테스트를 통과시킨다**

Run: `npm test -- scripts/event-image-refresh-manifest.test.js`

Expected: 2 tests passed

- [ ] **Step 5: 변경 범위를 확인한다**

Run: `git diff --check && git status --short`

Expected: 매니페스트와 테스트만 신규 파일로 표시되고 공백 오류가 없다.

---

### Task 2: 이미지 정규화·검증 도구

**Files:**
- Create: `scripts/event-image-refresh-assets.js`
- Create: `scripts/event-image-refresh-assets.test.js`
- Modify: `package.json`

**Interfaces:**
- Consumes: 매니페스트, 생성 원본 경로 `tmp/event-image-refresh/raw/{eventId}-{wide|card}.png`
- Produces: `normalizeAssets()`, `validateAssets()`, `buildContactSheets()`와 최종 WebP 44개

- [ ] **Step 1: 경로·크기·파일 수 검증 테스트를 작성한다**

```js
const path = require('path');
const {
  getRawPath,
  getOutputPath,
  validateManifestContract,
} = require('./event-image-refresh-assets');

test('builds deterministic raw and output paths', () => {
  const event = { id: 'event-1', wideOutput: 'public/events/2026-v2/event-1-wide.webp', cardOutput: 'public/events/2026-v2/event-1-card.webp' };
  expect(getRawPath(event, 'wide')).toBe(path.resolve('tmp/event-image-refresh/raw/event-1-wide.png'));
  expect(getOutputPath(event, 'card')).toBe(path.resolve('public/events/2026-v2/event-1-card.webp'));
});

test('requires exactly 22 events and 44 outputs', () => {
  expect(() => validateManifestContract({ events: [] })).toThrow('이벤트 22개가 필요합니다.');
});
```

- [ ] **Step 2: 테스트가 모듈 부재로 실패하는지 확인한다**

Run: `npm test -- scripts/event-image-refresh-assets.test.js`

Expected: `Cannot find module './event-image-refresh-assets'`

- [ ] **Step 3: Sharp 기반 도구를 구현한다**

```js
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const manifest = require('./event-image-refresh-manifest.json');

const FORMATS = {
  wide: { width: 1600, height: 820 },
  card: { width: 1000, height: 1250 },
};

function getRawPath(event, format) {
  return path.resolve(`tmp/event-image-refresh/raw/${event.id}-${format}.png`);
}

function getOutputPath(event, format) {
  return path.resolve(format === 'wide' ? event.wideOutput : event.cardOutput);
}

function validateManifestContract(input) {
  if (!Array.isArray(input.events) || input.events.length !== 22) {
    throw new Error('이벤트 22개가 필요합니다.');
  }
}

async function normalizeAsset(event, format) {
  const target = FORMATS[format];
  const output = getOutputPath(event, format);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  await sharp(getRawPath(event, format))
    .resize(target.width, target.height, { fit: 'cover', position: 'centre' })
    .webp({ quality: 86 })
    .toFile(output);
}
```

`validateAssets()`는 44개 파일의 형식·가로·세로·5MB 미만을 검사하고, `buildContactSheets()`는 와이드 22개와 카드 22개를 각각 ID 순서로 배치한다. CLI는 `normalize`, `validate`, `contact-sheet` 세 명령만 허용한다.

- [ ] **Step 4: package.json 스크립트를 추가한다**

```json
{
  "event-images:normalize": "node scripts/event-image-refresh-assets.js normalize",
  "event-images:validate": "node scripts/event-image-refresh-assets.js validate",
  "event-images:contact-sheet": "node scripts/event-image-refresh-assets.js contact-sheet"
}
```

- [ ] **Step 5: 단위 테스트를 통과시킨다**

Run: `npm test -- scripts/event-image-refresh-assets.test.js`

Expected: all tests passed

---

### Task 3: 반응형 이벤트 이미지와 중복 오버레이 제거

**Files:**
- Create: `src/app/events/_components/EventResponsiveImage.tsx`
- Create: `src/app/events/_components/EventResponsiveImage.test.tsx`
- Modify: `src/app/events/_components/EventList.tsx`
- Modify: `src/app/events/_components/EventList.module.css`
- Modify: `src/app/events/_components/EventList.test.tsx`
- Modify: `src/app/events/[eventId]/EventDetailClient.tsx`
- Modify: `src/app/events/[eventId]/EventDetailClient.module.css`

**Interfaces:**
- Consumes: `desktopSrc`, `mobileSrc`, `alt`, Next Image 크기 props
- Produces: 640px 이하에서 카드 이미지를 선택하는 `<picture>`와 접근 가능한 이벤트 링크

- [ ] **Step 1: 반응형 이미지의 실패 테스트를 작성한다**

```tsx
render(
  <EventResponsiveImage
    desktopSrc="/wide.webp"
    mobileSrc="/card.webp"
    alt="미드이어 세일"
    width={1600}
    height={820}
  />
);

expect(document.querySelector('source')).toHaveAttribute('media', '(max-width: 640px)');
expect(document.querySelector('source')).toHaveAttribute('srcset', '/card.webp');
expect(screen.getByAltText('미드이어 세일')).toHaveAttribute('src', '/wide.webp');
```

- [ ] **Step 2: 컴포넌트 부재로 테스트가 실패하는지 확인한다**

Run: `npm test -- src/app/events/_components/EventResponsiveImage.test.tsx`

Expected: module not found

- [ ] **Step 3: 최소 반응형 이미지 컴포넌트를 구현한다**

```tsx
import Image from 'next/image';

interface EventResponsiveImageProps {
  desktopSrc: string;
  mobileSrc: string;
  alt: string;
  width: number;
  height: number;
  className?: string;
  priority?: boolean;
}

export default function EventResponsiveImage(props: EventResponsiveImageProps) {
  const { desktopSrc, mobileSrc, alt, width, height, className, priority } = props;
  return (
    <picture>
      <source media="(max-width: 640px)" srcSet={mobileSrc} />
      <Image src={desktopSrc} alt={alt} width={width} height={height} className={className} priority={priority} />
    </picture>
  );
}
```

- [ ] **Step 4: EventList 실패 기대값을 먼저 수정한다**

`EventList.test.tsx`에서 대표·카드 링크의 접근 가능한 이름을 검사하고, `.posterHeroTitle`, `.posterHeroDescription`, `.eventTitle`, `.eventDescription`, `.eventDiscount`가 렌더링되지 않는 것을 기대한다. 대표 히어로에는 `detailImage`와 `thumbnailImage`, 카드에는 `thumbnailImage`가 전달되는지도 검사한다.

- [ ] **Step 5: 변경 전 EventList 테스트가 실패하는지 확인한다**

Run: `npm test -- src/app/events/_components/EventList.test.tsx`

Expected: 중복 텍스트 요소가 아직 존재하고 반응형 source가 없어 실패

- [ ] **Step 6: 목록과 상세에서 공용 컴포넌트를 사용한다**

대표 링크와 카드 링크에 `aria-label={`${event.title}: ${event.description}`}`를 지정한다. 대표 히어로는 `desktopSrc={displayImages.detailImage}`, `mobileSrc={displayImages.thumbnailImage}`를 사용하고, 상세 배너도 같은 조합을 사용한다. 카드에서는 제목·설명·혜택 오버레이를 제거하고 유형·상태·기간·CTA만 유지한다.

- [ ] **Step 7: 이미지 속 한글 안전 영역에 맞게 CSS를 조정한다**

대표 히어로와 카드는 이미지 위 전체 그라데이션을 제거하고, 상태·CTA 영역에만 불투명 검정 표면을 사용한다. 카드 비율은 `aspect-ratio: 4 / 5`로 고정하고 `min-height` 반복값을 제거한다. 그림자와 큰 radius를 추가하지 않는다.

- [ ] **Step 8: 이벤트 UI 테스트를 통과시킨다**

Run: `npm test -- src/app/events/_components/EventResponsiveImage.test.tsx src/app/events/_components/EventList.test.tsx src/shared/utils/eventImages.test.ts`

Expected: all tests passed

---

### Task 4: 파일럿 이미지 4개 생성

**Files:**
- Create: `tmp/event-image-refresh/raw/event-2026-06-midyear-sale-wide.png`
- Create: `tmp/event-image-refresh/raw/event-2026-06-midyear-sale-card.png`
- Create: `tmp/event-image-refresh/raw/event-2026-03-photo-review-wide.png`
- Create: `tmp/event-image-refresh/raw/event-2026-03-photo-review-card.png`

**Interfaces:**
- Consumes: 매니페스트의 `widePrompt`, `cardPrompt`
- Produces: 제품 단독 세일형과 UGC 리뷰형의 기준 이미지 4개

- [ ] **Step 1: 미드이어 세일 와이드 이미지를 생성한다**

Built-in image generation call: 매니페스트 `event-2026-06-midyear-sale.widePrompt`를 그대로 사용하고 새 이미지를 생성한다.

- [ ] **Step 2: 미드이어 세일 카드 이미지를 생성한다**

Built-in image generation call: 같은 이벤트의 `cardPrompt`를 사용해 별도 세로 이미지를 생성한다.

- [ ] **Step 3: 포토 리뷰 챌린지 와이드 이미지를 생성한다**

Built-in image generation call: `event-2026-03-photo-review.widePrompt`를 사용한다.

- [ ] **Step 4: 포토 리뷰 챌린지 카드 이미지를 생성한다**

Built-in image generation call: 같은 이벤트의 `cardPrompt`를 사용한다.

- [ ] **Step 5: 생성 결과를 프로젝트 staging 경로로 복사하고 검수한다**

각 결과를 명시된 `tmp/event-image-refresh/raw` 경로에 복사한다. 네 파일 모두 행사명·혜택이 정확하고, 불필요한 글자·로고·워터마크가 없으며, 세일형과 UGC형의 구도가 명확히 다른지 `view_image`로 확인한다. 한 항목이라도 실패하면 그 이미지만 다시 생성한다.

---

### Task 5: 나머지 이미지 40개 생성

**Files:**
- Create: `tmp/event-image-refresh/raw/*-{wide|card}.png`

**Interfaces:**
- Consumes: 파일럿에서 확정한 품질 기준과 나머지 20개 이벤트 프롬프트
- Produces: 전체 원본 44개

- [ ] **Step 1: 세일형을 이벤트별 와이드→카드 순서로 생성·검수한다**

```text
event-2026-01-layering-sale
event-2026-03-trench-week
event-2026-04-office-look
event-2026-05-denim-festival
event-2026-07-cool-touch
event-2026-08-last-summer
```

- [ ] **Step 2: 쿠폰형을 이벤트별 와이드→카드 순서로 생성·검수한다**

```text
event-2026-01-welcome-coupon
event-2026-03-white-day-coupon
event-2026-04-styling-coupon
event-2026-05-family-coupon
event-2026-07-vacation-coupon
h1WITXqWE2BL3G0ACiza
PacCrKVG9TikHo7lambG
```

- [ ] **Step 3: 리뷰형을 이벤트별 와이드→카드 순서로 생성·검수한다**

```text
event-2026-02-knit-review
event-2026-05-best-review
event-2026-07-summer-review
```

- [ ] **Step 4: 신상품형을 이벤트별 와이드→카드 순서로 생성·검수한다**

```text
event-2026-02-spring-preview
event-2026-04-shirt-collection
event-2026-06-summer-linen
event-2026-08-pre-fall
```

각 이벤트의 두 생성 호출 사이에 `view_image`로 한글과 형태를 확인한다. 다른 이벤트의 인물·배경·색상과 반복되면 다음 이벤트로 넘어가기 전에 재생성한다.

- [ ] **Step 5: 원본 수를 확인한다**

Run: `(Get-ChildItem 'tmp/event-image-refresh/raw' -Filter '*.png').Count`

Expected: `44`

---

### Task 6: WebP 정규화와 전체 시각 QA

**Files:**
- Create: `public/events/2026-v2/*-{wide|card}.webp`
- Create: `tmp/event-image-refresh/contact-sheets/wide.png`
- Create: `tmp/event-image-refresh/contact-sheets/card.png`

**Interfaces:**
- Consumes: 원본 PNG 44개
- Produces: 배포 가능한 WebP 44개와 두 컨택트시트

- [ ] **Step 1: 최종 WebP를 생성한다**

Run: `npm run event-images:normalize`

Expected: 44 files written

- [ ] **Step 2: 자동 규격 검증을 통과시킨다**

Run: `npm run event-images:validate`

Expected: `valid=44 invalid=0`

- [ ] **Step 3: 컨택트시트를 생성한다**

Run: `npm run event-images:contact-sheet`

Expected: `wide.png`, `card.png`

- [ ] **Step 4: 전체 반복성과 한글을 수동 검수한다**

두 컨택트시트를 `view_image`로 확인한다. 같은 인물·포즈·공간·팔레트가 연속된 이벤트는 해당 원본만 다시 생성하고 Step 1~3을 다시 실행한다.

---

### Task 7: Firebase 업로드·batch 전환 도구

**Files:**
- Create: `scripts/event-image-firebase-sync.js`
- Create: `scripts/event-image-firebase-sync.test.js`
- Modify: `package.json`

**Interfaces:**
- Consumes: 매니페스트, WebP 44개, `scripts/util-firestore-admin.js`
- Produces: `analyze`, `upload`, `verify-upload`, `apply`, `verify`, `rollback` 명령과 Firestore 업데이트 payload

- [ ] **Step 1: 순수 함수 실패 테스트를 작성한다**

```js
const {
  buildStoragePlan,
  buildEventUpdate,
  parseCommand,
} = require('./event-image-firebase-sync');

test('maps one event to two storage objects and three firestore fields', () => {
  const event = { id: 'event-1', wideOutput: 'public/events/2026-v2/event-1-wide.webp', cardOutput: 'public/events/2026-v2/event-1-card.webp' };
  const plan = buildStoragePlan(event, '20260714');
  expect(plan).toEqual({
    wide: 'events/banner/event-1-20260714-wide.webp',
    card: 'events/thumbnail/event-1-20260714-card.webp',
  });
  expect(buildEventUpdate(plan, 'bucket.example')).toEqual({
    bannerImage: 'https://firebasestorage.googleapis.com/v0/b/bucket.example/o/events%2Fbanner%2Fevent-1-20260714-wide.webp?alt=media',
    detailImage: 'https://firebasestorage.googleapis.com/v0/b/bucket.example/o/events%2Fbanner%2Fevent-1-20260714-wide.webp?alt=media',
    thumbnailImage: 'https://firebasestorage.googleapis.com/v0/b/bucket.example/o/events%2Fthumbnail%2Fevent-1-20260714-card.webp?alt=media',
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
```

- [ ] **Step 2: 모듈 부재로 테스트가 실패하는지 확인한다**

Run: `npm test -- scripts/event-image-firebase-sync.test.js`

Expected: module not found

- [ ] **Step 3: 업로드와 전환 명령을 구현한다**

`upload`는 `admin.storage().bucket().upload()`에 `contentType: 'image/webp'`, `cacheControl: 'public, max-age=31536000, immutable'`을 지정한다. `apply`는 현재 22개 이미지 필드를 `%TEMP%/hebimall-event-image-backup-20260714.json`에 저장한 뒤 Firestore batch 22개 update를 한 번만 commit한다. `rollback`은 이 고정 백업 파일의 22개 이미지 필드만 batch로 복원하며 Storage 객체는 삭제하지 않는다. 명령 실행 중 이미지 URL 전체와 다운로드 토큰은 콘솔에 출력하지 않고 이벤트 ID와 성공 여부만 출력한다.

- [ ] **Step 4: package.json 스크립트를 추가한다**

```json
{
  "event-images:firebase:analyze": "node scripts/event-image-firebase-sync.js analyze",
  "event-images:firebase:upload": "node scripts/event-image-firebase-sync.js upload",
  "event-images:firebase:verify-upload": "node scripts/event-image-firebase-sync.js verify-upload",
  "event-images:firebase:apply": "node scripts/event-image-firebase-sync.js apply",
  "event-images:firebase:verify": "node scripts/event-image-firebase-sync.js verify",
  "event-images:firebase:rollback": "node scripts/event-image-firebase-sync.js rollback"
}
```

- [ ] **Step 5: 단위 테스트를 통과시킨다**

Run: `npm test -- scripts/event-image-firebase-sync.test.js`

Expected: all tests passed

---

### Task 8: Firebase 실행과 최종 검증

**Files:**
- Modify: `docs/event-page-review.md`

**Interfaces:**
- Consumes: 검증된 WebP 44개, Firebase 동기화 도구, UI 변경
- Produces: Storage 44개 신규 객체, Firestore 22개 전환, 검증 기록

- [ ] **Step 1: Firebase 관리자 인증과 대상 문서를 읽기 전용으로 점검한다**

Run: `npm run event-images:firebase:analyze`

Expected: `events=22 localAssets=44 adminReady=true`

- [ ] **Step 2: 새 객체 44개를 업로드한다**

Run: `npm run event-images:firebase:upload`

Expected: `uploaded=44 failed=0`

- [ ] **Step 3: Storage 객체를 다시 읽어 검증한다**

Run: `npm run event-images:firebase:verify-upload`

Expected: `verified=44 failed=0`

- [ ] **Step 4: Firestore 22개 문서를 batch로 전환한다**

Run: `npm run event-images:firebase:apply`

Expected: `updated=22 batchCommitted=true`

- [ ] **Step 5: Firestore 필드와 이미지 HTTP 응답을 검증한다**

Run: `npm run event-images:firebase:verify`

Expected: `events=22 validDocuments=22 reachableImages=44`

- [ ] **Step 6: 코드 품질 게이트를 실행한다**

Run: `npm run typecheck && npm run lint -- --max-warnings=0 && npm test`

Expected: exit 0, lint warning 0, all test suites passed

- [ ] **Step 7: 로컬 이벤트 화면을 검증한다**

Run: `npm run dev`

목록 4페이지와 상세 22개 URL에서 데스크톱·모바일 이미지, 한글 잘림, 중복 오버레이, 수평 오버플로우를 확인한다. 홈에서 추출한 내부 링크도 모두 2xx인지 확인한다.

- [ ] **Step 8: 작업 문서를 갱신한다**

`docs/event-page-review.md`에 생성 수량, Storage 경로, Firestore 전환 결과, UI 중복 제거, 모바일 이미지 정책, 실행한 검증을 짧게 기록한다.

- [ ] **Step 9: 최종 작업 트리를 확인한다**

Run: `git diff --check && git status --short`

Expected: 관련 코드·테스트·문서·이미지 파일만 변경되고 공백 오류가 없다. 커밋, 푸시, 배포는 실행하지 않는다.
