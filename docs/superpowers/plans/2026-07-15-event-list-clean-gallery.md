# Event List Clean Gallery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 이벤트 목록을 링크 없는 전용 27:9 허브 이미지와 페이지당 8개의 4열 카드 갤러리로 구성한다.

**Architecture:** 기존 `EventList`의 필터·페이지네이션 흐름은 유지하고, 동적 대표 이벤트 대신 정적 이벤트 허브 자산을 렌더링한다. 페이지 크기는 `EventProvider`의 단일 상수에서 8로 제공하고, CSS는 허브 27:9와 카드 4:5 비율을 각각 보존한다.

**Tech Stack:** Next.js 15, React, TypeScript, CSS Modules, Jest, Testing Library

## Global Constraints

- 상단 대표 배너와 카드 이미지 위 텍스트·배지를 모두 제거한다.
- 상단은 링크 없는 이벤트 허브 전용 27:9 이미지를 사용한다.
- 허브 이미지 안 문구는 `STYNA EVENTS`, `새로운 스타일과 혜택을 만나보세요`만 사용한다.
- 카드 아래 기간과 CTA는 유지한다.
- 페이지당 카드 수는 정확히 8개다.
- 데스크톱 4열, 태블릿 2열, 모바일 1열을 사용한다.
- 카드 이미지는 `aspect-ratio: 4 / 5`와 `object-fit: contain`으로 전체를 표시한다.
- 그림자와 라운드를 새로 추가하지 않는다.
- 커밋·푸시·배포하지 않는다.

---

### Task 1: 이벤트 목록 클린 갤러리

**Files:**
- Modify: `src/app/events/_components/EventList.tsx`
- Modify: `src/app/events/_components/EventList.module.css`
- Modify: `src/app/events/_components/EventList.test.tsx`
- Create: `src/app/events/_components/EventList-css.test.ts`
- Modify: `docs/event-page-review.md`

**Interfaces:**
- Consumes: `EventResponsiveImage`, `getEventDisplayImages(event)`, 기존 이벤트 필터와 페이지네이션 상태
- Produces: 기존 `EventList` 공개 인터페이스를 유지하는 오버레이 없는 반응형 이벤트 갤러리

- [x] **Step 1: 마크업 실패 테스트 작성**

`EventList.test.tsx`의 대표 테스트에서 `.posterHeroOverlay`, `.posterCardOverlay`, `.eventBadges`가 없고 카드별 `.eventFooter`가 유지되는지 검증한다.

```tsx
expect(container.querySelector('.posterHeroOverlay')).toBeNull();
expect(container.querySelectorAll('.posterCardOverlay')).toHaveLength(0);
expect(container.querySelectorAll('.eventBadges')).toHaveLength(0);
expect(container.querySelectorAll('.eventFooter')).toHaveLength(2);
```

- [x] **Step 2: CSS 실패 테스트 작성**

`EventList-css.test.ts`에서 실제 CSS 파일을 읽어 데스크톱 4열, 카드 4:5, `contain`, 태블릿 2열, 모바일 1열을 검증한다.

```ts
expect(css).toMatch(/\.eventGrid\s*{[\s\S]*?grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\)/);
expect(css).toMatch(/\.posterCardMedia\s*{[\s\S]*?aspect-ratio:\s*4 \/ 5/);
expect(css).toMatch(/\.posterCardImage\s*{[\s\S]*?object-fit:\s*contain/);
```

- [x] **Step 3: RED 확인**

Run:

```powershell
npx jest --runInBand --runTestsByPath 'src/app/events/_components/EventList.test.tsx' 'src/app/events/_components/EventList-css.test.ts'
```

Expected: 기존 대표·카드 오버레이와 자동 채움 3열/`cover` 때문에 실패한다.

- [x] **Step 4: 최소 마크업 구현**

`EventList.tsx`에서 `featuredMeta`, `featuredStatus`, 대표 오버레이, 카드 `uiMeta`/`status`/오버레이를 제거한다. 카드 footer의 기간과 CTA를 위해 `uiMeta`만 카드 footer 계산에 유지한다.

- [x] **Step 5: 최소 CSS 구현**

```css
.eventGrid {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.posterCardMedia {
  aspect-ratio: 4 / 5;
}

.posterCardImage {
  object-fit: contain;
  object-position: center;
}

@media (max-width: 900px) {
  .eventGrid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (max-width: 640px) {
  .eventGrid { grid-template-columns: 1fr; }
}
```

사용하지 않는 오버레이·배지·테마 CSS와 이미지 확대 효과를 함께 제거한다.

- [x] **Step 6: GREEN 확인**

Run:

```powershell
npx jest --runInBand --runTestsByPath 'src/app/events/_components/EventList.test.tsx' 'src/app/events/_components/EventList-css.test.ts'
```

Expected: 두 테스트 파일 전체 통과.

- [x] **Step 7: 문서와 정적 검증**

`docs/event-page-review.md`에 오버레이 제거, 4열, 4:5 `contain` 정책을 기록한다.

Run:

```powershell
npm run typecheck
npx eslint 'src/app/events/_components/EventList.tsx' 'src/app/events/_components/EventList.test.tsx' 'src/app/events/_components/EventList-css.test.ts' --max-warnings=0
git diff --check
```

Expected: 모두 exit 0.

- [x] **Step 8: 브라우저 QA**

`/events`에서 대표 배너 위 UI 없음, 카드 이미지 위 UI 없음, 데스크톱 4열, 이미지 잘림 없음, 가로 오버플로우 없음을 확인한다.

---

### Task 2: 이벤트 허브 이미지와 페이지당 8개 노출

**Files:**
- Create: `public/events/event-hub-hero.webp`
- Modify: `src/context/eventProvider.tsx`
- Modify: `src/context/eventProvider.test.tsx`
- Modify: `src/app/events/_components/EventList.tsx`
- Modify: `src/app/events/_components/EventList.test.tsx`
- Modify: `src/app/events/_components/EventList.module.css`
- Modify: `src/app/events/_components/EventList-css.test.ts`
- Modify: `docs/event-page-review.md`

**Interfaces:**
- Consumes: `EventProvider.eventsPerPage`, `EventResponsiveImage`
- Produces: `eventsPerPage = 8`, `/events/event-hub-hero.webp`를 쓰는 링크 없는 이벤트 허브 헤더

- [x] **Step 1: 27:9 이벤트 허브 이미지 생성**

이미지 생성 기능에 아래 프롬프트를 한 번 전달한다.

```text
한국 종합 패션몰 STYNA의 이벤트 허브용 3:1 와이드 에디토리얼 캠페인 배너. 세련된 한국인 여성 모델과 남성 모델, 의류·가방·신발 제품 디테일을 현대적인 패션 스튜디오에서 균형 있게 구성. 블랙, 아이보리, 차콜 기반에 절제된 코발트 블루 포인트. 특정 계절이나 특정 할인 행사로 보이지 않는 상시 이벤트 허브 이미지. 이미지 안에 정확히 두 문구만 선명하게 표시: “STYNA EVENTS”, “새로운 스타일과 혜택을 만나보세요”. 가짜 로고, 할인율, 쿠폰 숫자, 다른 글자, 워터마크, 둥근 스티커, 그림자 효과 없음. 비율 27:9.
```

생성 결과를 시각 검수한 뒤 `2700x900` WebP로 정규화해 `public/events/event-hub-hero.webp`에 저장한다.

- [x] **Step 2: 실패 테스트 작성**

`eventProvider.test.tsx`에 `eventsPerPage`가 8인지 보여 주는 소비자 컴포넌트를 추가한다.

```tsx
function EventPaginationSize() {
  const { eventsPerPage } = useEvent();
  return <div>page-size:{eventsPerPage}</div>;
}
```

`EventList.test.tsx`에는 10개 이벤트와 `eventsPerPage: 8`을 주입해 카드 8개와 페이지 버튼 2개를 검증하고, `.posterHero`가 링크가 아닌지 확인한다.

`EventList-css.test.ts`에는 `.posterHero`의 `aspect-ratio: 27 / 9`와 `public/events/event-hub-hero.webp`의 실제 `2700x900` 메타데이터 검증을 추가한다.

- [x] **Step 3: RED 확인**

Run:

```powershell
npx jest --runInBand --runTestsByPath 'src/context/eventProvider.test.tsx' 'src/app/events/_components/EventList.test.tsx' 'src/app/events/_components/EventList-css.test.ts'
```

Expected: provider가 6을 반환하고 대표 영역이 링크이며 CSS가 모바일에서 4:5로 바뀌어 실패한다.

- [x] **Step 4: 최소 구현**

`eventProvider.tsx`의 `eventsPerPage`를 8로 변경한다. `EventList.tsx`에서 `getFeaturedEvent`와 동적 대표 이미지 계산을 제거하고 다음 정적 허브 구조를 사용한다.

```tsx
<section className={styles.bannerSection} aria-label="이벤트 안내">
  <div className={styles.posterHero}>
    <EventResponsiveImage
      desktopSrc="/events/event-hub-hero.webp"
      mobileSrc="/events/event-hub-hero.webp"
      alt="STYNA EVENTS - 새로운 스타일과 혜택을 만나보세요"
      width={2700}
      height={900}
      className={styles.posterHeroImage}
      priority
    />
  </div>
</section>
```

`.posterHero`는 모든 viewport에서 `aspect-ratio: 27 / 9`를 유지하고 모바일의 4:5 override를 제거한다.

- [x] **Step 5: GREEN 및 전체 검증**

Run:

```powershell
npx jest --runInBand --runTestsByPath 'src/context/eventProvider.test.tsx' 'src/app/events/_components/EventList.test.tsx' 'src/app/events/_components/EventList-css.test.ts'
npm run verify
git diff --check
```

Expected: 관련 테스트와 전체 품질 게이트가 모두 exit 0.

- [x] **Step 6: 브라우저 QA와 문서 갱신**

`/events`에서 허브가 링크가 아니고 27:9로 전체 노출되는지, 첫 페이지 카드가 8개·4열 × 2줄인지, 페이지 버튼이 3개인지, 가로 오버플로우와 콘솔 오류가 없는지 확인한다. `docs/event-page-review.md`에 결과를 기록한다.
