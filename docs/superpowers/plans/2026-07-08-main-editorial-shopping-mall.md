# Main Editorial Shopping Mall Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 메인 화면을 실제 운영 중인 미니멀 데일리 셀렉트몰처럼 보이도록 개편하고, 헤더 고정 및 최상단 슬라이드 알림바를 추가한다.

**Architecture:** 기존 Next.js App Router 구조와 컴포넌트 경계를 유지한다. Header는 고정 레이아웃과 알림바를 담당하고, Home은 편집형 섹션 순서를 구성하며, ProductCard는 운영 라벨과 MD 코멘트 표시를 담당한다.

**Tech Stack:** Next.js 15, React 19, CSS Modules, Jest, Testing Library.

## Global Constraints

- 모든 UI 문구는 한국어 중심으로 작성한다.
- 임의 커밋, 푸시, 배포는 하지 않는다.
- 기존 사용자가 만든 변경사항은 되돌리지 않는다.
- 카드와 버튼은 기존 디자인 규칙처럼 그림자 없이 낮은 radius를 유지한다.
- 검증은 `package.json`에 정의된 스크립트를 우선 사용한다.

---

### Task 1: Header Sticky Announcement Bar

**Files:**
- Modify: `src/app/_components/header/Header.tsx`
- Modify: `src/app/_components/header/Header.module.css`
- Test: `src/app/_components/header/Header.test.tsx`

**Interfaces:**
- Produces: `Header` renders a sticky header, a black rotating announcement bar, and unchanged navigation links.

- [x] **Step 1: Write failing tests**
  - Assert top announcement messages exist.
  - Assert header class uses sticky header styles.

- [x] **Step 2: Run header test to verify it fails**
  - Run: `npm test -- src/app/_components/header/Header.test.tsx`
  - Expected: FAIL because the announcement bar is missing.

- [x] **Step 3: Implement Header announcement and sticky CSS**
  - Add announcement message list and rendered layered slides.
  - Add `position: sticky; top: 0;` and black announcement bar animation.

- [x] **Step 4: Run header test to verify it passes**

### Task 2: Home Editorial Sections

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/page.module.css`
- Test: `src/app/page.test.tsx`

**Interfaces:**
- Produces: Home page contains campaign, planning, MD note, ranking basis, review highlight, seasonal event, and service information sections.

- [x] **Step 1: Write failing tests**
  - Assert required editorial texts appear.
  - Mock product/category components to keep test scoped to composition.

- [x] **Step 2: Run page test to verify it fails**
  - Run: `npm test -- src/app/page.test.tsx`
  - Expected: FAIL because new editorial sections are missing.

- [x] **Step 3: Implement page composition and styles**

- [x] **Step 4: Run page test to verify it passes**

### Task 3: Product Card Operating Labels

**Files:**
- Modify: `src/app/products/_components/ProductCard.tsx`
- Modify: `src/app/products/_components/ProductCard.module.css`
- Test: `src/app/products/_components/ProductCard.test.tsx`

**Interfaces:**
- Produces: `ProductCard` accepts optional `operationLabel`, `shippingLabel`, `mdComment` props.

- [x] **Step 1: Write failing tests**
  - Assert MD comment and operation labels render.

- [x] **Step 2: Run product card test to verify it fails**
  - Run: `npm test -- src/app/products/_components/ProductCard.test.tsx`
  - Expected: FAIL because props are unsupported.

- [x] **Step 3: Implement props and card UI**

- [x] **Step 4: Run product card test to verify it passes**

### Task 4: Verification

**Files:**
- Existing test and typecheck scripts from `package.json`

- [x] **Step 1: Run focused tests**
  - `npm test -- src/app/_components/header/Header.test.tsx src/app/page.test.tsx src/app/products/_components/ProductCard.test.tsx`

- [x] **Step 2: Run typecheck**
  - `npm run typecheck`

- [x] **Step 3: Run browser or build verification if the runtime supports it**
  - Prefer actual browser check for header sticky and main layout.

**Result notes:**
- Focused Jest tests passed for header announcement/sticky rendering, home editorial composition, product card operating metadata, and curated main product filtering.
- Full typecheck was executed, but the repository currently fails on pre-existing dependency/type issues outside this change: missing Testing Library exports, React Query `QueryClient` resolution, and existing implicit `any` errors.
- Local browser verification was attempted on port 3001. Next.js started, but page rendering failed because the installed `node_modules` is missing `@tanstack/query-core`.
