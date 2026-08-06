# STYNA SELECT 편집형 추천 상품 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기존 추천 상품 설정을 이용해 홈에 `STYNA SELECT` 편집형 상품 영역을 제공한다.

**Architecture:** `featuredProducts/mainPageFeatured` 문서에 선택적 `heroImage`를 추가하고, 기존 상품 ID·순서 조회 흐름을 보존한다. `FeaturedProducts`가 무드 이미지와 최대 세 개의 압축 상품 행을 렌더링하며, 관리자 화면이 그 콘텐츠를 설정한다.

**Tech Stack:** Next.js App Router, TypeScript, TanStack Query, Firebase Firestore, Jest, CSS Modules

## Global Constraints

- 실제 독점 판매를 암시하는 카피는 사용하지 않고 기본 제목은 `STYNA SELECT`로 한다.
- 기존 공개 상품 조회와 오류·대체·비활성화 정책을 유지한다.
- 신규 의존성·상품 데이터·외부 이미지 업로드를 추가하지 않는다.
- 사용자 작업 중인 `StyleNowSection`의 홈 배치 순서는 변경하지 않는다.

---

### Task 1: 추천 설정의 무드 이미지와 세 상품 계약 정의

**Files:**
- Modify: `src/shared/services/featuredProductService.ts`
- Modify: `src/shared/services/featuredProductService.test.ts`

**Interfaces:**
- Produces: `FeaturedProductConfig.heroImage: string`
- Produces: 기본 제목 `STYNA SELECT`, 기본 부제목과 기본 무드 이미지

- [ ] **Step 1: 실패 테스트 작성**

```ts
expect(config.heroImage).toBe('/style-now/autumn/style-now-autumn-main.webp');
expect(config.maxCount).toBe(3);
```

- [ ] **Step 2: 실패 확인**

Run: `npm test -- --runInBand src/shared/services/featuredProductService.test.ts`

- [ ] **Step 3: 최소 구현**

`FeaturedProductConfig`와 저장 옵션에 `heroImage`를 추가하고, 기존 문서에서는 안전한 기본 이미지를 사용한다.

- [ ] **Step 4: 통과 확인**

Run: `npm test -- --runInBand src/shared/services/featuredProductService.test.ts`

### Task 2: 편집형 홈 섹션 렌더링

**Files:**
- Modify: `src/app/_components/FeaturedProducts.tsx`
- Modify: `src/app/_components/FeaturedProducts.module.css`
- Modify: `src/app/_components/FeaturedProducts.test.tsx`
- Modify: `src/app/page.tsx`
- Modify: `src/app/page.test.tsx`

**Interfaces:**
- Consumes: `FeaturedProductSection.config.heroImage`, 정렬된 `products`
- Produces: 큰 무드 이미지, 최대 세 개의 상품 상세 링크, `/recommend` 전체 보기 링크

- [ ] **Step 1: 실패 테스트 작성**

```tsx
expect(screen.getByRole('img', { name: 'STYNA SELECT 무드 이미지' }))
  .toHaveAttribute('src', '/style-now/autumn/style-now-autumn-main.webp');
expect(screen.getAllByRole('link', { name: /상품 보기$/ })).toHaveLength(3);
```

- [ ] **Step 2: 실패 확인**

Run: `npm test -- --runInBand src/app/_components/FeaturedProducts.test.tsx src/app/page.test.tsx`

- [ ] **Step 3: 최소 구현**

기존 카드 그리드 대신 이미지와 상품 행을 렌더링하고, 공개 추천 대체 데이터도 세 개로 제한한다. 홈에서는 관리자 설명을 덮어쓰지 않는다.

- [ ] **Step 4: 통과 확인**

Run: `npm test -- --runInBand src/app/_components/FeaturedProducts.test.tsx src/app/page.test.tsx`

### Task 3: 관리자 설정 반영과 문서화

**Files:**
- Modify: `src/app/admin/featured-products/page.tsx`
- Modify: `src/app/admin/featured-products/page.test.tsx`
- Modify: `docs/static-content.md`

**Interfaces:**
- Consumes: `heroImage`, 최대 노출 수 3
- Produces: 내부 이미지 경로 입력과 세 개 이하의 선택 상품 저장

- [ ] **Step 1: 실패 테스트 작성**

```tsx
expect(screen.getByLabelText('무드 이미지 경로')).toHaveValue('/style-now/autumn/style-now-autumn-main.webp');
expect(screen.getByText('선택된 추천 상품 (0/3)')).toBeInTheDocument();
```

- [ ] **Step 2: 실패 확인**

Run: `npm test -- --runInBand src/app/admin/featured-products/page.test.tsx`

- [ ] **Step 3: 최소 구현**

관리자 폼에서 무드 이미지 경로를 저장하고 선택 한도를 세 개로 제한한다. 정적 콘텐츠 문서에 새 운영 항목을 기록한다.

- [ ] **Step 4: 통과 확인**

Run: `npm test -- --runInBand src/app/admin/featured-products/page.test.tsx`

### Task 4: 통합 검증

**Files:**
- Verify: `src/shared/services/featuredProductService.test.ts`
- Verify: `src/app/_components/FeaturedProducts.test.tsx`
- Verify: `src/app/admin/featured-products/page.test.tsx`
- Verify: `src/app/page.test.tsx`

- [ ] **Step 1: 관련 테스트 실행**

Run: `npm test -- --runInBand src/shared/services/featuredProductService.test.ts src/app/_components/FeaturedProducts.test.tsx src/app/admin/featured-products/page.test.tsx src/app/page.test.tsx`

- [ ] **Step 2: 타입과 린트 실행**

Run: `npm run typecheck && npm run lint -- --max-warnings=0`

- [ ] **Step 3: 화면 확인**

Run: `npm run dev`

데스크톱과 768px 이하에서 STYNA SELECT의 이미지·상품 링크·포커스·줄바꿈을 확인한다.
