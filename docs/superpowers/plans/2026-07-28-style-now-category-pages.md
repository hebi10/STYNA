# Style Now Category Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 홈 스타일나우를 계절 카드 4개로 압축하고 계절별 상세 화면에서 편집 비주얼 3단과 상품 20개를 제공한다.

**Architecture:** `styleNowData.ts`가 카테고리 이미지, 편집 패널, 한국어 카피와 상품 ID를 단일 소스로 제공한다. 홈 `StyleNowSection`은 정적 링크 카드만 렌더링하고, 동적 라우트가 검증된 계절을 `StyleNowSeasonPage`에 전달해 상품을 조회한다.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, CSS Modules, TanStack Query, Jest, Testing Library

## Global Constraints

- 일반·관리자·개발용 로그인 동작을 변경하지 않는다.
- 기존 `ProductCard`, 상품 ID, Firebase 조회 규칙을 재사용한다.
- 신규 UI에 `box-shadow`와 `border-radius`를 추가하지 않는다.
- 이미지 내 문자는 사용하지 않고 한국어 카피를 HTML로 렌더링한다.
- 커밋, 푸시, 배포하지 않는다.

---

### Task 1: 데이터 계약과 테스트

**Files:**
- Modify: `src/app/_components/style-now/styleNowData.ts`
- Modify: `src/app/_components/style-now/styleNowData.test.ts`

**Interfaces:**
- Produces: `getStyleNowSeason(key: string): StyleNowSeason | null`
- Produces: 계절별 `categoryImage`, `editorialPanels`, `productIds`

- [ ] 유효·무효 계절 조회와 세 패널 데이터의 실패 테스트를 작성한다.
- [ ] 테스트를 실행해 신규 필드와 헬퍼 부재로 실패하는지 확인한다.
- [ ] 카테고리 이미지, 패널 이미지·alt·한국어 카피를 계절 데이터에 추가한다.
- [ ] 관련 테스트가 통과하는지 확인한다.

### Task 2: 홈 계절 카드

**Files:**
- Modify: `src/app/_components/style-now/StyleNowSection.tsx`
- Modify: `src/app/_components/style-now/StyleNowSection.module.css`
- Modify: `src/app/_components/style-now/StyleNowSection.test.tsx`

**Interfaces:**
- Consumes: `STYLE_NOW_SEASONS`
- Produces: `/style-now/{season}` 링크 4개

- [ ] 기존 탭·상품 목록 대신 계절 카드 링크를 요구하는 실패 테스트를 작성한다.
- [ ] 테스트가 기존 탭 UI 때문에 실패하는지 확인한다.
- [ ] 4:3 신규 이미지, 계절명, 설명을 포함하는 링크 카드 4개로 교체한다.
- [ ] 데스크톱 4열·태블릿 2열·모바일 1열 CSS를 작성한다.
- [ ] 홈 컴포넌트 테스트를 다시 실행한다.

### Task 3: 계절 상세 화면과 라우트

**Files:**
- Create: `src/app/_components/style-now/StyleNowSeasonPage.tsx`
- Create: `src/app/_components/style-now/StyleNowSeasonPage.test.tsx`
- Create: `src/app/_components/style-now/StyleNowSeasonPage.module.css`
- Create: `src/app/style-now/[season]/page.tsx`

**Interfaces:**
- Consumes: `StyleNowSeason`
- Produces: 편집 패널 3개, 계절 내비게이션, 상품 20개, 로딩·오류 상태

- [ ] 세 패널, 한국어 카피, 상품 20개를 요구하는 실패 테스트를 작성한다.
- [ ] 컴포넌트가 없어 실패하는지 확인한다.
- [ ] 기존 모델 이미지 상단 크롭과 신규 상품 이미지 2장을 연결한다.
- [ ] 기존 상품 검증과 `ProductCard` 렌더링을 상세 컴포넌트로 이동한다.
- [ ] 동적 라우트에서 유효 계절만 전달하고 나머지는 `notFound()` 처리한다.
- [ ] 상세 테스트를 실행해 통과하는지 확인한다.

### Task 4: 문서·정적·브라우저 검증

**Files:**
- Modify: `docs/README.md`
- Modify: `docs/superpowers/specs/2026-07-28-style-now-category-pages-design.md`

- [ ] 신규 문서와 실제 파일 경로가 일치하는지 확인한다.
- [ ] `npm run typecheck`, 범위 Jest, `npm run lint -- --max-warnings=0`, `npm run build`를 실행한다.
- [ ] 데스크톱과 모바일에서 홈 카드, 계절 상세, 상품 링크, 404, 가로 넘침을 확인한다.
- [ ] Impeccable detector를 변경 UI에 한 번 실행하고 결과를 반영한다.
- [ ] 생성 자산의 해상도, MIME과 육안 구분을 확인한다.

