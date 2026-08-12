# 운영 재검수 잔여 문제 해결 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 공개 포트폴리오에서 카테고리·리뷰·관리자 데모·금액 표시의 신뢰성 및 안전성을 복구하고, 운영 시드 데이터 정비와 UI 잔여 항목을 검증 가능하게 완료한다.

**Architecture:** 리뷰의 원본은 `reviews` 컬렉션으로 유지하고, 상품의 `reviewSummary`·`rating`·`reviewCount`는 Function과 백필만 갱신하는 검증된 materialized summary로 한정한다. 공개 관리자 데모는 실제 관리자와 별개의 `demo_admin` 주체로 고정하고, 실제 관리자 쓰기는 최근 비밀번호 재인증을 UI·Rules·Functions에서 모두 통과해야 한다. 데이터 삭제·수정과 Firebase 배포는 코드 작업·로컬 검증 이후 별도 운영 승인 단계에서만 실행한다.

**Tech Stack:** Next.js 15 App Router, TypeScript, Firebase Auth, Firestore Rules/Indexes, Firebase Functions, Jest, Firebase Emulator

## Global Constraints

- 일반 로그인과 관리자 로그인은 유지한다.
- 공개 관리자 데모에는 개인정보와 변경 권한을 제공하지 않는다.
- 실제 결제·배송·결제수단을 암시하거나 약속하지 않는다.
- 신규 UI에는 `box-shadow`와 `border-radius`를 추가하지 않는다.
- 운영 데이터 삭제·수정, Firebase Rules/Functions/Indexes 배포는 해비님의 명시적 승인 후에만 실행한다.
- `npm run verify`와 공개 배포 브라우저 QA를 통과하기 전에는 완료로 판단하지 않는다.

---

## 현재 사실과 결정 게이트

- 2026-08-12 읽기 전용 분석에서 상품 178개 중 98개는 `reviewSummary`/`rating`/`reviewCount`가 실제 리뷰와 다르고, 고아 리뷰 3개가 `other-product-1`, `other-product-2`를 가리킨다.
- 공개 배포의 `reviews` 집계 쿼리는 `reviews(productId ASC, rating ASC, __name__ ASC)` 복합 인덱스 부재 오류를 낸다. 현재 `firestore.indexes.json`에는 `productId + createdAt`만 있다.
- `/categories`에는 `Bags` 카드가 보이지만 `/categories/bags/`는 404다. 목록은 `isActive` 누락을 활성으로 보되 상세 서비스는 과거에 `isActive === true`만 허용했던 불일치가 원인이다.
- 소스의 `AdminShell`은 올바른 `demo_admin`이면 실제 관리 메뉴와 하위 화면을 마운트하지 않는다. 공개 데모에 변경 버튼이 보이면 데모 계정 프로비저닝 또는 배포 산출물이 이 계약과 다르다는 뜻이므로 저장 버튼을 눌러 검증하지 않는다.

**운영 승인 1 — 고아 리뷰:** 권장안은 `other-product-1`, `other-product-2`를 가리키는 테스트성 고아 리뷰 3건을 삭제한 뒤 백필하는 것이다. 보존이 필요하면 삭제 대신 올바른 실제 `productId` 목록을 해비님이 제공해야 하며, 추측 매핑은 금지한다.

**운영 승인 2 — 배포:** 인덱스·Rules·Functions·Hosting 배포와 백필 execute는 코드·규칙 테스트 및 dry-run 결과를 검토한 뒤 별도로 승인받는다.

## 작업 구조

- `firestore.indexes.json`: 리뷰 집계에 필요한 복합 인덱스 선언
- `src/shared/services/reviewService.ts`: 유효한 materialized summary 우선, 실패 시 오래된 상품 숫자를 재사용하지 않는 요약 조회 계약
- `src/context/reviewProvider.tsx`, `src/app/products/_components/ProductDetailClient.tsx`, `ProductReviews.tsx`: 동일 summary 상태로 헤더·탭·본문을 렌더링
- `functions/src/triggers/reviewStats.ts`, `scripts/review-summary-backfill.js`: 리뷰 원본에서 상품 통계를 일관되게 갱신
- `src/shared/services/categoryService.ts`, `src/shared/utils/categoryRouting.ts`, `src/app/categories/*`: 목록과 동적 라우트가 같은 활성·정규화 기준 사용
- `src/app/admin/*`, `src/shared/utils/authAccess.ts`, `firestore.rules`, `storage.rules`, `functions/src/utils/auth.ts`: 데모 분리, 개인정보 마스킹, 5분 쓰기 권한 검증
- `src/shared/utils/orderPricing.ts`, `src/app/orders/cart/page.tsx`, `src/app/orders/checkout/page.tsx`, `src/app/mypage/order-detail/[orderId]/page.tsx`: 가격 원장과 표시 라벨 통일
- `src/shared/utils/*`, `src/app/products/_components/ProductDetailClient.tsx`, 주문 상세/관리자 목록: 영문 원본값 표시 변환, 사이즈·운영 시드 정비

### Task 1: 리뷰 집계 인덱스와 단일 표시 계약

**Files:**
- Modify: `firestore.indexes.json`
- Modify: `src/shared/services/reviewService.ts`
- Modify: `src/context/reviewProvider.tsx`
- Modify: `src/app/products/_components/ProductDetailClient.tsx`
- Modify: `src/app/products/_components/ProductReviews.tsx`
- Test: `src/shared/services/reviewService.test.ts`
- Test: `src/app/products/_components/ProductDetailClient.test.tsx`
- Test: `src/app/products/_components/ProductReviews.test.tsx`

**Interfaces:**
- Produces: `ReviewSummaryLoadState = { status: 'loading' | 'ready' | 'error'; summary: ReviewSummary | null }`.
- Produces: `ReviewService.getReviewSummary(productId): Promise<ReviewSummary>` where a valid `reviewSummary` or Firestore aggregate is the only accepted source.

- [ ] **Step 1: 인덱스 누락을 고정하는 검증을 추가한다**

`scripts/firestore-index-contract.test.js`에 다음 계약을 추가한다.

```js
expect(indexes).toContainEqual(expect.objectContaining({
  collectionGroup: 'reviews',
  queryScope: 'COLLECTION',
  fields: [
    { fieldPath: 'productId', order: 'ASCENDING' },
    { fieldPath: 'rating', order: 'ASCENDING' },
    { fieldPath: '__name__', order: 'ASCENDING' },
  ],
}));
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npm test -- --runTestsByPath scripts/firestore-index-contract.test.js`

Expected: `reviews(productId, rating, __name__)` 인덱스 부재 assertion 실패.

- [ ] **Step 3: Firestore 인덱스를 선언한다**

`firestore.indexes.json`의 최상위 `indexes` 배열에 다음 COLLECTION 인덱스를 추가한다.

```json
{
  "collectionGroup": "reviews",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "productId", "order": "ASCENDING" },
    { "fieldPath": "rating", "order": "ASCENDING" },
    { "fieldPath": "__name__", "order": "ASCENDING" }
  ]
}
```

- [ ] **Step 4: 오래된 `reviewCount` fallback 회귀 테스트를 쓴다**

`ProductDetailClient.test.tsx`에서 `getReviewSummary`가 0건을 반환했을 때 `124`가 아니라 `0 (0개 리뷰)`와 `리뷰 (0)`가 표시되는 케이스, 요약 조회 실패 때는 `리뷰 정보 확인 필요`을 표시하고 기존 `product.reviewCount`를 표시하지 않는 케이스를 추가한다.

```tsx
expect(screen.queryByRole('button', { name: '리뷰 (124)' })).not.toBeInTheDocument();
expect(screen.getByText('리뷰 정보 확인 필요')).toBeInTheDocument();
```

- [ ] **Step 5: 같은 상태를 세 화면에 전달한다**

`ReviewProvider`에 상품별 `ReviewSummaryLoadState`를 두고, `ProductDetailClient`가 상품 상세 마운트 시 `loadReviewSummary(product.id)`를 호출한다. `ProductReviews`는 새로운 조회를 시작하지 않고 같은 context 상태를 사용한다. `ready`일 때만 헤더·탭·요약·본문을 렌더링하고, `error`는 내부 Firestore 오류를 노출하지 않는 재시도 안내로 통일한다.

```tsx
const reviewLabel = reviewSummaryState.status === 'ready'
  ? `리뷰 (${reviewSummaryState.summary.totalReviews})`
  : reviewSummaryState.status === 'error' ? '리뷰 정보 확인 필요' : '리뷰 확인 중';
```

- [ ] **Step 6: 페이지 첫 리뷰 목록도 summary와 교차 검증한다**

`ProductReviews`는 첫 페이지 `productReviews.length === 0`이고 summary가 0보다 크면 “리뷰를 불러오지 못했습니다. 다시 시도해 주세요.”를 표시한다. 이때 “리뷰 없음”을 표시하지 않는다. 정상 0건일 때만 빈 상태를 표시한다.

- [ ] **Step 7: 집중 테스트를 통과시킨다**

Run: `npm test -- --runTestsByPath scripts/firestore-index-contract.test.js src/shared/services/reviewService.test.ts src/app/products/_components/ProductDetailClient.test.tsx src/app/products/_components/ProductReviews.test.tsx`

Expected: PASS.

- [ ] **Step 8: 커밋한다**

```powershell
git add firestore.indexes.json src/shared/services/reviewService.ts src/context/reviewProvider.tsx src/app/products/_components/ProductDetailClient.tsx src/app/products/_components/ProductReviews.tsx scripts/firestore-index-contract.test.js src/shared/services/reviewService.test.ts src/app/products/_components/ProductDetailClient.test.tsx src/app/products/_components/ProductReviews.test.tsx
git commit -m "리뷰 집계 표시 일관성"
```

### Task 2: 리뷰 통계 트리거·백필 및 운영 데이터 정합성

**Files:**
- Modify: `functions/src/triggers/reviewStats.ts` (필요할 때만)
- Modify: `scripts/review-summary-backfill.js`
- Modify: `scripts/review-summary-backfill.test.js`
- Modify: `docs/review-statistics.md`

**Interfaces:**
- Consumes: Task 1의 `reviewSummary` 스키마 버전 1.
- Produces: `npm run migrate:review-summary:analyze`에서 `staleProductCount`, `invalidReviewCount`, `orphanReviewCount`를 보고한다.

- [ ] **Step 1: 고아 리뷰가 execute를 차단하는 테스트를 보강한다**

```js
await expect(runReviewSummaryBackfill({ execute: true }, runtime))
  .rejects.toThrow('orphan reviews=3');
```

- [ ] **Step 2: 고아 리뷰 처리안을 확정받는다**

해비님의 운영 승인 1을 받기 전에는 어떤 리뷰도 삭제·수정하지 않는다. 권장안 승인 시 삭제 대상 문서 ID, `productId`, 생성일을 읽기 전용으로 재출력해 대상 3건을 확인한다.

- [ ] **Step 3: 승인된 처리만 수행하는 전용 스크립트를 작성한다**

`scripts/review-orphan-remediation.js`는 기본 `analyze`만 지원하고, 삭제는 정확한 문서 ID 목록과 `--execute`가 모두 있어야 한다. `other-product-1`, `other-product-2` 같은 문자열 패턴으로 삭제 대상을 추측하지 않는다.

```powershell
node scripts/review-orphan-remediation.js analyze
node scripts/review-orphan-remediation.js delete --ids review-a,review-b,review-c --execute
```

- [ ] **Step 4: dry-run에서 수정 대상을 검토한다**

Run: `npm run migrate:review-summary:dry-run`

Expected: `invalidReviewCount: 0`, `orphanReviewCount: 0`, 갱신 대상 상품 ID와 이전/예상 summary를 출력.

- [ ] **Step 5: 운영 승인 뒤에만 backfill을 실행한다**

Run: `npm run migrate:review-summary:execute`

Expected: `reconciledProductCount`를 기록하고, 재분석에서 `staleProductCount: 0`, `orphanReviewCount: 0`.

- [ ] **Step 6: 실제 상품 두 개를 확인한다**

쿨터치 셔츠와 로우컷 화이트 스니커즈의 `reviews` 수, `reviewSummary.totalReviews`, `reviewCount`, `rating`이 같은지 Admin SDK 읽기 전용 스크립트로 대조한다. 상품 ID·개수만 기록하고 리뷰 작성자 개인정보는 출력하지 않는다.

- [ ] **Step 7: 커밋한다**

```powershell
git add functions/src/triggers/reviewStats.ts scripts/review-summary-backfill.js scripts/review-summary-backfill.test.js scripts/review-orphan-remediation.js docs/review-statistics.md package.json
git commit -m "리뷰 통계 백필 안전성"
```

### Task 3: `Bags` 카테고리 라우트 단일화와 배포 확인

**Files:**
- Modify: `src/shared/services/categoryService.ts`
- Modify: `src/shared/utils/categoryRouting.ts`
- Modify: `src/app/categories/page.tsx`
- Modify: `src/app/categories/[category]/page.tsx`
- Test: `src/shared/services/categoryService.test.ts`
- Test: `src/shared/utils/categoryRouting.test.ts`
- Test: `src/app/categories/page.test.tsx`
- Test: `src/app/categories/[category]/page.test.tsx`
- Modify: `docs/product-listing-structure.md`

**Interfaces:**
- Produces: `normalizeCategoryId('Bags') === 'bags'` and `toCategoryPath('Bags') === '/categories/bags'`.
- Produces: `CategoryService.getCategories()` excludes only documents whose `isActive === false`.

- [ ] **Step 1: `isActive` 누락·대문자 ID 회귀 테스트를 추가한다**

```ts
expect(await CategoryService.getCategories()).resolves.toEqual([
  expect.objectContaining({ id: 'Bags', name: '가방' }),
]);

const page = await DynamicCategoryPage({ params: Promise.resolve({ category: 'bags' }) });
render(page);
expect(screen.getByTestId('product-list')).toHaveAttribute('data-category', 'Bags');
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npm test -- --runTestsByPath src/shared/services/categoryService.test.ts src/app/categories/[category]/page.test.tsx`

Expected: 기존 `isActive === true` 필터 또는 ID 비교가 남아 있으면 실패.

- [ ] **Step 3: 목록·상세의 활성 규칙을 맞춘다**

`CategoryService.getCategories()`와 `CategoryProvider`는 `data.isActive !== false`를 사용한다. `[category]/page.tsx`는 `category.id.toLowerCase()`와 `getCategoryIdCandidates()`를 사용해 실제 Firestore ID를 `ProductList.initialCategory`로 전달한다.

- [ ] **Step 4: 모든 카드 링크를 하나의 함수로 생성한다**

`categories/page.tsx`, Header, 홈 카테고리 섹션에서 직접 문자열 결합을 제거하고 `toCategoryPath(category.id)`만 사용한다. `Bags`, `bags`, `bag`의 외부 링크는 모두 `/categories/bags/`로 끝나야 한다.

- [ ] **Step 5: 집중 테스트를 통과시킨다**

Run: `npm test -- --runTestsByPath src/shared/services/categoryService.test.ts src/shared/utils/categoryRouting.test.ts src/app/categories/page.test.tsx src/app/categories/[category]/page.test.tsx`

Expected: PASS.

- [ ] **Step 6: Hosting 배포 뒤 실제 경로를 점검한다**

`/categories/`, `/categories/Bags/`, `/categories/bags/`, `/categories/tops/`, `/categories/clothing/`를 새 비로그인 브라우저 세션에서 한 번씩 확인한다. 첫 두 경로는 `/categories/bags/`로 정규화되고 200 화면을 보여야 하며, 카드의 이미지 8개는 `naturalWidth > 0`이어야 한다.

- [ ] **Step 7: 커밋한다**

```powershell
git add src/shared/services/categoryService.ts src/shared/utils/categoryRouting.ts src/app/categories src/context/categoryProvider.tsx src/app/_components docs/product-listing-structure.md
git commit -m "카테고리 경로 정규화"
```

### Task 4: 관리자 데모 계정 분리, 쓰기 잠금, 개인정보 마스킹

**Files:**
- Modify: `scripts/provision-readonly-demo-admin.js`
- Modify: `src/app/admin/AdminShell.tsx`
- Create: `src/app/admin/_components/AdminWriteAccessContext.tsx`
- Create: `src/app/admin/_components/AdminWriteAction.tsx`
- Modify: `src/app/admin/dashboard/products/**`, `src/app/admin/dashboard/orders/page.tsx`, `src/app/admin/dashboard/users/page.tsx`
- Modify: `src/app/admin/categories/**`, `src/app/admin/coupons/page.tsx`, `src/app/admin/featured-products/page.tsx`, `src/app/admin/events/**`, `src/app/admin/inquiries/**`, `src/app/admin/qna/**`, `src/app/admin/reviews/**`
- Modify: `functions/src/utils/auth.ts`, `firestore.rules`, `storage.rules`
- Test: `functions/__tests__/auth.test.ts`, `src/app/admin/_components/AdminReauthentication.test.tsx`, `src/app/admin/_components/AuthChecking.test.tsx`, 관리자 화면별 Jest 테스트, `tests/rules/*`
- Modify: `docs/security-admin-permission.md`

**Interfaces:**
- Produces: `useAdminWriteAccess(): { canWrite: boolean; requestReauthentication(): void }`.
- Produces: `AdminWriteAction` which sets `disabled={!canWrite}` and invokes no mutating handler until reauthentication completes.
- Produces: `maskDemoUser(value, kind)` returning deterministic non-identifying email, phone and address strings.

- [ ] **Step 1: 실제 데모 계정 상태를 읽기 전용으로 확인한다**

Run: `npm run provision:demo-admin:dry-run`

Expected: 대상 UID의 문서 role, custom claim, 다른 실제 관리자 존재 여부만 출력한다. UID·이메일·토큰은 콘솔에 출력하지 않는다.

- [ ] **Step 2: 데모 격리 실패를 고정하는 테스트를 쓴다**

```tsx
render(<AdminShell><button>상품 저장</button></AdminShell>);
expect(screen.queryByRole('button', { name: '상품 저장' })).not.toBeInTheDocument();
expect(screen.getByText('읽기 전용 관리자 화면입니다')).toBeInTheDocument();
```

`auth.test.ts`에는 `demoAdmin: true` + `role: demo_admin`이 `requireAdmin`과 `requireRecentAdmin` 모두 403인지 추가한다.

- [ ] **Step 3: 화면의 변경 버튼을 인증 전 비활성화한다**

`AdminShell`의 click-capture 우회에 의존하지 않고 `AdminWriteAccessContext`를 제공한다. 상품 추가/저장/삭제, 주문 상태 변경, 사용자 role·정지·삭제·포인트, 카테고리·쿠폰·추천·이벤트·QnA·문의·리뷰 변경 버튼을 `AdminWriteAction`으로 교체한다. 읽기 필터, 페이지 이동, 로그아웃은 비활성화하지 않는다.

```tsx
<AdminWriteAction onClick={() => void saveProduct()}>
  상품 저장
</AdminWriteAction>
```

- [ ] **Step 4: 재인증 후 5분 경계 테스트를 만든다**

Jest fake timer로 인증 직후 `canWrite === true`, 299초에는 true, 301초에는 false를 검증한다. Functions unit test와 Rules Emulator test에서는 `auth_time = request.time - 301 seconds`가 Firestore·Storage·관리 API 쓰기를 거부하는지 검증한다.

- [ ] **Step 5: 개인정보가 데모로 새지 않게 한다**

데모 역할은 실제 목록/상세 서비스를 호출하지 않고 정적 요약만 사용한다. 불가피한 예시 데이터는 `demo@styna.example`, `010-0000-0000`, `서울시 데모구` 등 고정 마스킹 값으로 만든다. 이메일·전화·주소 원문이 DOM/네트워크 응답에 없는 테스트를 추가한다.

- [ ] **Step 6: 서버 경계를 재검증한다**

`requireRecentAdmin`을 사용하는 `adminUsers`, `points`, `coupon`, `order` 관리자 액션과 Rules의 `isAdminForWrite`를 목록화해 누락 endpoint가 없는지 테스트한다. 데모 토큰, 오래된 `auth_time`, strict admin 최신 `auth_time` 세 가지 matrix를 각 endpoint와 Firestore/Storage에서 검증한다.

- [ ] **Step 7: 프로비저닝과 배포는 승인 후 실행한다**

실행 전 strict actual admin이 최소 1명인지 dry-run 결과로 재확인한다. 해비님 승인 후에만 `npm run provision:demo-admin:execute`를 실행하고 Rules·Functions·Hosting을 함께 배포한다.

- [ ] **Step 8: 커밋한다**

```powershell
git add scripts/provision-readonly-demo-admin.js src/app/admin functions/src/utils/auth.ts firestore.rules storage.rules functions/__tests__ tests/rules docs/security-admin-permission.md
git commit -m "관리자 데모 쓰기 보호"
```

### Task 5: 장바구니·주문 상세 금액 원장 통일

**Files:**
- Modify: `src/shared/utils/orderPricing.ts`
- Modify: `src/app/orders/cart/page.tsx`
- Modify: `src/app/orders/checkout/page.tsx`
- Modify: `src/app/orders/complete/page.tsx`
- Modify: `src/app/mypage/order-detail/[orderId]/page.tsx`
- Test: `src/shared/utils/orderPricing.test.ts`
- Test: `src/app/orders/cart/page.test.tsx`
- Test: `src/app/orders/checkout/page.test.tsx`

**Interfaces:**
- Produces: `OrderPreview` where `originalSubtotal - productDiscountAmount - couponDiscount + deliveryFee - pointUsed = finalAmount`.

- [ ] **Step 1: 79,000원→59,000원 표시 회귀 테스트를 작성한다**

```ts
expect(preview).toMatchObject({
  originalSubtotal: 79000,
  productDiscountAmount: 20000,
  subtotal: 59000,
  finalAmount: 59000,
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npm test -- --runTestsByPath src/shared/utils/orderPricing.test.ts src/app/orders/cart/page.test.tsx src/app/orders/checkout/page.test.tsx`

Expected: 현재 `subtotal`이 할인 후 금액이어서 “상품금액 59,000원 / 상품할인 -20,000원”이라는 이중 의미를 재현한다.

- [ ] **Step 3: 원금과 할인 후 상품금액을 분리한다**

`OrderPricingItem`에 `originalPrice`와 `salePrice`를 명시하고 `OrderPreview`에 `originalSubtotal`을 추가한다. 요약은 아래 순서만 사용한다.

```text
상품금액 79,000원
상품할인 -20,000원
쿠폰할인 -0원 (적용 시만 표시)
배송비 0원
포인트 사용 -0P (사용 시만 표시)
최종 결제금액 59,000원
```

- [ ] **Step 4: 서버 응답과 주문 상세도 같은 의미로 맞춘다**

Functions order domain의 `totalAmount`, `discountAmount`, `finalAmount` 의미를 확인하고, 과거 주문은 데이터 이관 없이 화면에서 `totalAmount`가 원금인지 할인 후 금액인지 판별 가능한 필드가 없으면 할인 행을 숨긴다. 임의 재계산으로 과거 주문 금액을 바꾸지 않는다.

- [ ] **Step 5: 집중 테스트를 통과시킨다**

Run: `npm test -- --runTestsByPath src/shared/utils/orderPricing.test.ts src/app/orders/cart/page.test.tsx src/app/orders/checkout/page.test.tsx`

Expected: PASS.

- [ ] **Step 6: 커밋한다**

```powershell
git add src/shared/utils/orderPricing.ts src/app/orders/cart/page.tsx src/app/orders/checkout/page.tsx src/app/orders/complete/page.tsx src/app/mypage/order-detail src/shared/utils/orderPricing.test.ts src/app/orders/cart/page.test.tsx src/app/orders/checkout/page.test.tsx
git commit -m "주문 금액 표시 정합성"
```

### Task 6: 사이즈 가이드와 영문 원본값 표시 정리

**Files:**
- Create: `src/shared/utils/productDisplayValue.ts`
- Modify: `src/app/products/_components/ProductDetailClient.tsx`
- Modify: `src/app/mypage/order-detail/[orderId]/page.tsx`
- Modify: `src/app/admin/dashboard/orders/page.tsx`
- Test: `src/shared/utils/productDisplayValue.test.ts`
- Test: `src/app/products/_components/ProductDetailClient.test.tsx`
- Test: `src/app/mypage/order-detail/[orderId]/page.test.tsx`

**Interfaces:**
- Produces: `formatPaymentMethod('card') === '카드 결제'`.
- Produces: `formatProductOptionValue('yellow gold') === '옐로우 골드'`.
- Produces: `hasSizeMeasurements(product.details.sizes): boolean`.

- [ ] **Step 1: 표시 변환 테스트를 작성한다**

```ts
expect(formatPaymentMethod('card')).toBe('카드 결제');
expect(formatProductOptionValue('yellow gold')).toBe('옐로우 골드');
expect(formatProductOptionValue('blue')).toBe('블루');
```

- [ ] **Step 2: 공유 표시 유틸을 구현한다**

결제수단·색상·소재 값의 명시적 매핑만 둔다. 매핑에 없는 값은 원문을 그대로 보이되 `unknown`이나 빈 문자열은 `-`로 표시한다. 색상칩 전용 `getProductColorValue`와 텍스트 표시 유틸을 혼용하지 않는다.

- [ ] **Step 3: 빈 사이즈 가이드를 정직하게 표시한다**

치수 데이터가 하나도 없으면 빈 `<table>`을 렌더링하지 않고 “등록된 실측 치수 정보가 없습니다.”를 표시한다. 치수가 있는 상품은 기존 표의 헤더와 행을 유지한다.

- [ ] **Step 4: 관리자가 치수를 입력할 수 있는지 회귀 점검한다**

`EditProductForm`과 상품 추가 폼이 `details.sizes`를 저장하는 기존 입력을 유지하고, 1개 이상 실측값을 넣으면 상세 표가 렌더링되는 테스트를 추가한다.

- [ ] **Step 5: 집중 테스트를 통과시킨다**

Run: `npm test -- --runTestsByPath src/shared/utils/productDisplayValue.test.ts src/app/products/_components/ProductDetailClient.test.tsx src/app/mypage/order-detail/[orderId]/page.test.tsx`

Expected: PASS.

- [ ] **Step 6: 커밋한다**

```powershell
git add src/shared/utils/productDisplayValue.ts src/shared/utils/productDisplayValue.test.ts src/app/products/_components/ProductDetailClient.tsx src/app/mypage/order-detail src/app/admin/dashboard/orders
git commit -m "상품 주문 표시값 정리"
```

### Task 7: 시드 데이터 정상화 계획과 승인된 데이터 수정

**Files:**
- Create: `scripts/operational-data-audit.js`
- Create: `scripts/operational-data-remediation.js`
- Create: `scripts/operational-data-remediation.test.js`
- Modify: `docs/coupon-system.md`
- Modify: `docs/product-listing-structure.md`
- Modify: `docs/review-statistics.md`

**Interfaces:**
- Produces: read-only JSON report `{ invalidPointBalances, expiredActiveCoupons, couponSummaryMismatches, featuredProductOverLimit, duplicateCategoryIds, suspiciousProductDetails }`.
- Produces: execute mode that accepts an explicit plan file and refuses unspecified writes.

- [ ] **Step 1: 읽기 전용 감사 스크립트를 만든다**

점검 항목은 4천억 포인트 같은 비정상 잔액, 만료일이 지난 활성 쿠폰, 쿠폰 요약/목록 수 불일치, 추천 상품 3개 초과, 대소문자·별칭 카테고리 중복, 여름 반팔의 울 소재 같은 비정상 속성이다. 기본 명령은 어떤 Firestore write도 하지 않는다.

```powershell
node scripts/operational-data-audit.js analyze
```

- [ ] **Step 2: 수정 계획 파일을 생성한다**

`tmp/operational-data-plan.json`에는 문서 ID, 현재 값, 제안 값, 근거를 모두 기록한다. 포인트 잔액과 상품 소재는 자동 보정하지 않고 해비님의 값 승인을 필요로 한다.

- [ ] **Step 3: 쿠폰·추천·카테고리의 기계적 수정만 별도 승인받는다**

기계적으로 판정 가능한 수정은 만료 쿠폰을 비활성/기간만료로 전환, 추천 설정을 중복 없는 3개로 제한, 카테고리 `isActive` 누락을 명시적으로 `true`로 기록하는 것뿐이다. 사용자 포인트, 상품 소재, 리뷰는 자동 수정 대상에서 제외한다.

- [ ] **Step 4: execute는 정확한 계획 파일 hash를 검증한다**

```powershell
node scripts/operational-data-remediation.js execute --plan tmp/operational-data-plan.json --sha256 <approved-hash>
```

계획 파일의 hash가 다르거나 불명확한 문서가 있으면 모든 쓰기를 중단한다.

- [ ] **Step 5: 재감사와 문서화를 한다**

Run: `node scripts/operational-data-audit.js analyze`

Expected: 자동 수정 범주의 오류 수 0, 수동 검토 항목은 문서 ID와 보류 사유를 남긴다.

- [ ] **Step 6: 커밋한다**

```powershell
git add scripts/operational-data-audit.js scripts/operational-data-remediation.js scripts/operational-data-remediation.test.js docs/coupon-system.md docs/product-listing-structure.md docs/review-statistics.md
git commit -m "운영 데이터 감사 도구"
```

### Task 8: 통합 검증, 승인 배포, 공개 재검수

**Files:**
- Modify: `docs/quality-gates.md`
- Modify: `docs/security-admin-permission.md`
- Modify: `docs/review-statistics.md`

- [ ] **Step 1: 변경 범위별 테스트를 먼저 실행한다**

```powershell
npm test -- --runTestsByPath src/shared/services/categoryService.test.ts src/shared/services/reviewService.test.ts src/app/products/_components/ProductDetailClient.test.tsx src/app/products/_components/ProductReviews.test.tsx src/shared/utils/orderPricing.test.ts
npm run test:functions
npm run test:rules
```

Expected: 모든 테스트 통과. Emulator가 실행되지 않으면 포트·Java·기존 프로세스 원인을 기록하고 해결 뒤 재실행한다.

- [ ] **Step 2: 전체 품질 게이트를 실행한다**

Run: `npm run verify`

Expected: typecheck, warning 0 lint, 전체 Jest, Rules, Functions build, Next production build PASS.

- [ ] **Step 3: 배포 승인을 받는다**

승인 범위에 Firestore index 배포, Rules·Storage Rules·Functions·Hosting 배포, demo_admin 프로비저닝, 승인된 고아 리뷰 처리, 리뷰 backfill execute를 각각 명시한다.

- [ ] **Step 4: 순서대로 배포·데이터 작업을 실행한다**

1. Firestore indexes, Rules, Storage Rules, Functions 배포
2. strict admin 존재 확인 후 demo_admin 프로비저닝
3. 승인된 고아 리뷰 처리
4. review-summary dry-run 검토 후 execute
5. Hosting 배포

각 단계가 실패하면 이후 단계로 진행하지 않고 실패 로그와 롤백 가능 여부를 보고한다.

- [ ] **Step 5: 비로그인 공개 브라우저에서 재검수한다**

다음 결과를 스크린샷과 DOM으로 기록한다.

```text
/categories/bags/ = 200, 가방 제목과 상품 목록 표시
/categories/ = 8개 이미지 naturalWidth > 0
쿨터치 셔츠 = 헤더/탭/요약/본문이 같은 리뷰 수
로우컷 화이트 스니커즈 = 내부 오류 문구 없음
장바구니 79,000 - 20,000 = 59,000
```

- [ ] **Step 6: 관리자 데모·실제 관리자 경계를 재검수한다**

데모 로그인에서 실제 사용자/주문/주소 조회 네트워크 요청과 수정 버튼이 없고, 실제 관리자에서는 인증 전 모든 변경 버튼이 disabled, 인증 후 5분 동안만 enabled, 만료 뒤 다시 disabled인지 확인한다. 저장·삭제·취소 같은 파괴적 클릭은 운영 데이터에서 실행하지 않는다.

- [ ] **Step 7: 결과를 문서화하고 커밋한다**

```powershell
git add docs/quality-gates.md docs/security-admin-permission.md docs/review-statistics.md
git commit -m "운영 재검수 결과"
```

## 자체 검토

- 검수에서 남은 리뷰 인덱스/집계, `Bags` 404, 데모 관리자 보호, 장바구니 금액, 사이즈·영문 값, 운영 시드 데이터 문제를 각각 Task 1~7에 배정했다.
- 실제 데이터 삭제·수정과 배포는 Task 2, 4, 7, 8의 승인 게이트 뒤로 분리했다.
- 기존 일반·관리자 로그인은 유지하며, 데모 관리자만 읽기 전용으로 좁힌다.
- 실행 순서는 리뷰 인덱스/표시 계약 → 카테고리 → 데모 보호 → 금액/표시 → 데이터 감사 → 승인 배포로, 각 단계가 독립 검증 가능하다.
