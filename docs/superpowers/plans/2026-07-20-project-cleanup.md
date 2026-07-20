# Dead and Duplicate Code Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 사용자에게 연결된 빈 기능과 끊어진 액션을 제거하고, 실제로 참조되지 않는 컴포넌트와 중복 추천 설정 계열을 정리하면서 운영용 비공개 코드를 보존한다.

**Architecture:** 삭제는 import·라우트·문자열 참조와 후속 설계 사용 여부를 함께 확인한 뒤 수행한다. 사용자 메뉴 정리, 인증 데드 라우트, 오프라인 액션, 관리자 유령 사용자 생성, 미사용 홈 컴포넌트, 추천 설정 중복을 서로 독립적인 테스트 단위로 처리한다. 홈에 연결할 `FeaturedProductService`와 `FeaturedProducts`는 보존하고, 별도 `recommendationSettings` 계열만 제거한다.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript 5, Firebase/Firestore, Jest 30, Testing Library

## Global Constraints

- 기존 사용자 변경인 `docs/image-delivery-performance.md`, `next.config.test.ts`, `next.config.ts`를 보존한다.
- 관리자, API, Functions, 데이터 관리 스크립트는 사이트에 직접 노출되지 않는다는 이유만으로 제거하지 않는다.
- 삭제 전 import, 링크, 라우팅, 서비스 호출, 테스트와 문서 참조를 확인한다.
- 기존 스타일과 프레임워크를 우선하며 그림자와 라운드를 추가하지 않는다.
- 기능 변경은 실패 테스트를 먼저 작성하고 최소 구현으로 통과시킨다.
- 동작, 구조, 명령 또는 정책이 바뀐 경우 관련 문서를 짧게 갱신한다.
- `FeaturedProductService`, `/admin/featured-products`, `FeaturedProducts`는 단계 5의 홈 큐레이션 연결에 사용하므로 삭제하지 않는다.
- 커밋, 푸시, 배포하지 않는다.

## File Structure

- `scripts/project-surface-audit.test.js`: 삭제된 라우트·관리 기능·중복 추천 설정이 다시 들어오지 않도록 소스 표면을 검증한다.
- `src/app/mypage/_components/SidebarMenu.tsx`: 구현된 마이페이지 기능만 노출한다.
- `src/app/mypage/layout.tsx`: 삭제한 마이페이지 라우트의 active tab 매핑을 제거한다.
- `src/app/support/offline/page.tsx`: 데모 매장임을 밝히고 존재하지 않는 액션을 렌더링하지 않는다.
- `src/app/admin/dashboard/users/page.tsx`: Auth 없는 사용자 추가 액션을 제거한다.
- `src/shared/services/adminUserService.ts`: Firestore 문서만 만드는 `createUser` API를 제거한다.
- `src/shared/utils/syncProductReviews.ts`: 운영 호출이 없고 테스트 mock만 남은 레거시 리뷰 동기화 쓰기 유틸을 제거한다.
- `src/shared/services/siteContentService.ts`: 중복 `recommendationSettings` 타입과 접근 메서드를 제거한다.
- `scripts/static-content-data.js`, `scripts/seed-static-content.js`: 중복 추천 설정 시드를 제거한다.
- `firestore.rules`: 더 이상 사용하는 코드가 없는 `recommendationSettings` 규칙을 제거해 기본 거부로 돌린다.

---

### Task 1: 빈 마이페이지 기능을 문의 관리로 정리

**Files:**
- Create: `scripts/project-surface-audit.test.js`
- Modify: `src/app/mypage/_components/SidebarMenu.test.tsx`
- Modify: `src/app/mypage/_components/SidebarMenu.tsx`
- Modify: `src/app/mypage/layout.tsx`
- Delete: `src/app/mypage/counsel/page.tsx`
- Delete: `src/app/mypage/restock/page.tsx`
- Delete: `src/app/mypage/withdrawal/page.tsx`
- Modify: `docs/mypage-ui.md`

**Interfaces:**
- Consumes: `SidebarMenu({ activeTab, logout })`, `/mypage/qa`
- Produces: 구현된 메뉴만 포함하고 상담 내역을 `/mypage/qa`로 통합한 마이페이지 내비게이션

- [ ] **Step 1: 구현된 문의 링크와 빈 메뉴 부재를 검증하는 실패 테스트 작성**

`src/app/mypage/_components/SidebarMenu.test.tsx`에 다음 테스트를 추가한다.

```tsx
test('exposes the implemented inquiry history without empty support routes', () => {
  render(<SidebarMenu activeTab="reviews" logout={jest.fn()} />);

  expect(screen.getByRole('link', { name: '문의관리' })).toHaveAttribute('href', '/mypage/qa');
  expect(screen.queryByRole('link', { name: '상담내역' })).not.toBeInTheDocument();
  expect(screen.queryByRole('link', { name: '재입고알림' })).not.toBeInTheDocument();
});
```

링크 없이 남은 회원 탈퇴 페이지까지 검증하도록 `scripts/project-surface-audit.test.js`를 생성한다.

```js
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const exists = (relativePath) => fs.existsSync(path.join(root, relativePath));
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

describe('public project surface', () => {
  test('does not ship empty mypage routes', () => {
    expect(exists('src/app/mypage/counsel/page.tsx')).toBe(false);
    expect(exists('src/app/mypage/restock/page.tsx')).toBe(false);
    expect(exists('src/app/mypage/withdrawal/page.tsx')).toBe(false);
  });
});
```

- [ ] **Step 2: 테스트가 현재 빈 메뉴 때문에 실패하는지 확인**

Run: `npm test -- --runInBand src/app/mypage/_components/SidebarMenu.test.tsx scripts/project-surface-audit.test.js`

Expected: 빈 메뉴 링크와 세 빈 라우트 파일이 존재해 FAIL.

- [ ] **Step 3: 빈 메뉴와 active tab 매핑 제거**

`SidebarMenu.tsx`에서 `/mypage/counsel`, `/mypage/restock` Link 블록을 삭제한다. `layout.tsx`의 `tabMap`은 다음 항목만 유지한다.

```tsx
const tabMap = {
  "/mypage/order-list": "orders",
  "/mypage/order-detail": "orders",
  "/mypage/qa": "reviews",
  "/mypage/recently-viewed": "wishlist",
  "/mypage/wishlist": "favorite",
  "/mypage/coupons": "coupons",
  "/mypage/point": "point",
  "/mypage/info-edit": "profile",
};
```

`src/app/mypage/counsel/page.tsx`, `src/app/mypage/restock/page.tsx`, `src/app/mypage/withdrawal/page.tsx`를 삭제한다.

- [ ] **Step 4: 마이페이지 문서에 통합 정책 기록**

`docs/mypage-ui.md`에 “상담 내역은 `/mypage/qa` 문의 관리로 통합했고 백엔드가 없는 재입고 알림과 동작 없는 회원 탈퇴 빈 라우트는 제거했다”는 짧은 항목을 추가한다.

- [ ] **Step 5: 관련 테스트와 참조 검증**

Run: `npm test -- --runInBand src/app/mypage/_components/SidebarMenu.test.tsx src/app/mypage/layout.test.tsx scripts/project-surface-audit.test.js`

Expected: 세 테스트 파일 PASS.

Run: `rg -n "/mypage/(counsel|restock|withdrawal)" src docs/mypage-ui.md`

Expected: 과거 경로를 설명하는 문서 기록 외 런타임 참조 없음.

### Task 2: 동작 없는 이메일 찾기 라우트 제거

**Files:**
- Modify: `scripts/project-surface-audit.test.js`
- Delete: `src/app/auth/find-email/page.tsx`
- Delete: `src/app/auth/find-email/page.module.css`
- Modify: `docs/auth-ui.md`

**Interfaces:**
- Consumes: 로그인 화면의 기존 `/auth/find-password` 링크
- Produces: 실제로 동작하는 비밀번호 재설정만 제공하는 인증 복구 표면

- [ ] **Step 1: 동작 없는 인증 라우트 부재를 검증하는 실패 테스트 작성**

```js
test('does not ship the actionless find-email route', () => {
  expect(exists('src/app/auth/find-email/page.tsx')).toBe(false);
  expect(exists('src/app/auth/find-email/page.module.css')).toBe(false);
  expect(read('src/app/auth/login/page.tsx')).not.toContain('/auth/find-email');
});
```

- [ ] **Step 2: 라우트 파일 존재로 테스트가 실패하는지 확인**

Run: `npm test -- --runInBand scripts/project-surface-audit.test.js -t "find-email"`

Expected: `exists(...)`가 `true`라서 FAIL.

- [ ] **Step 3: 이메일 찾기 라우트와 전용 스타일 삭제**

`src/app/auth/find-email/page.tsx`, `src/app/auth/find-email/page.module.css`를 삭제한다. 로그인 화면의 `/auth/find-password` 링크는 유지한다.

- [ ] **Step 4: 인증 문서에서 삭제된 파일과 정책 정리**

`docs/auth-ui.md`의 대상 파일에서 find-email 두 파일을 제거하고, 실제 이메일 찾기 백엔드가 없어 경로를 제거했다는 기록을 추가한다.

- [ ] **Step 5: 인증 표면 테스트 실행**

Run: `npm test -- --runInBand scripts/project-surface-audit.test.js src/app/auth/login/page.test.tsx`

Expected: 두 테스트 파일 PASS.

### Task 3: 오프라인 데모의 끊어진 액션 제거

**Files:**
- Create: `src/app/support/offline/page.test.tsx`
- Modify: `src/app/support/offline/page.tsx`
- Modify: `src/app/support/offline/page.module.css`
- Modify: `docs/static-content.md`

**Interfaces:**
- Consumes: `SiteContentService.getOfflineStores()`, `getOfflineServices()`, `getOfflineInfo()`
- Produces: 가상 데이터임을 명시하고 존재하지 않는 상세·길찾기 액션을 제공하지 않는 매장 목록

- [ ] **Step 1: 데모 고지와 액션 부재를 검증하는 실패 테스트 작성**

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import OfflinePage from './page';
import { SiteContentService } from '@/shared/services/siteContentService';

jest.mock('@/shared/services/siteContentService', () => ({
  SiteContentService: {
    getOfflineStores: jest.fn(),
    getOfflineServices: jest.fn(),
    getOfflineInfo: jest.fn(),
  },
}));

jest.mock('./page.module.css', () => ({
  __esModule: true,
  default: new Proxy({}, { get: (_target, property) => String(property) }),
}));

test('labels sample stores and does not render unavailable actions', async () => {
  jest.mocked(SiteContentService.getOfflineStores).mockResolvedValue([{
    id: 'sample-store',
    name: 'STYNA SAMPLE',
    type: '가상 매장',
    address: '예시 주소',
    phone: '예시 연락처',
    hours: '예시 운영시간',
    transport: '예시 교통편',
    features: [],
    order: 1,
  }]);
  jest.mocked(SiteContentService.getOfflineServices).mockResolvedValue([]);
  jest.mocked(SiteContentService.getOfflineInfo).mockResolvedValue(null);

  render(<OfflinePage />);

  await waitFor(() => expect(screen.getByText('STYNA SAMPLE')).toBeInTheDocument());
  expect(screen.getByText(/포트폴리오 데모용 가상 매장/)).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: '상세보기' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '길찾기' })).not.toBeInTheDocument();
});
```

- [ ] **Step 2: 기존 상세·길찾기 액션 때문에 테스트가 실패하는지 확인**

Run: `npm test -- --runInBand src/app/support/offline/page.test.tsx`

Expected: 데모 고지 부재 또는 상세·길찾기 액션 존재로 FAIL.

- [ ] **Step 3: 끊어진 액션을 제거하고 데모 고지 추가**

`page.tsx`에서 `next/link` import와 `storeActions` 블록을 제거한다. 설명은 다음 문구로 교체한다.

```tsx
<p className={styles.pageDescription}>
  포트폴리오 데모용 가상 매장 정보입니다. 실제 방문이나 구매는 제공하지 않습니다.
</p>
```

`page.module.css`에서 `.storeActions`, `.actionButton`, `.primaryAction`, `.secondaryAction` 및 해당 hover 규칙을 삭제한다.

- [ ] **Step 4: 정적 콘텐츠 문서에 가상 데이터 정책 기록**

`docs/static-content.md`의 오프라인 콘텐츠 설명에 “예시 데이터이며 상세·길찾기 기능은 제공하지 않는다”는 정책을 추가한다.

- [ ] **Step 5: 오프라인 화면 테스트 실행**

Run: `npm test -- --runInBand src/app/support/offline/page.test.tsx src/shared/services/siteContentService.test.ts`

Expected: 두 테스트 파일 PASS.

### Task 4: Auth 계정 없는 관리자 사용자 생성 제거

**Files:**
- Modify: `scripts/project-surface-audit.test.js`
- Modify: `src/app/admin/dashboard/users/page.tsx`
- Modify: `src/shared/services/adminUserService.ts`
- Modify: `src/shared/services/adminUserService.test.ts`

**Interfaces:**
- Consumes: 기존 사용자 조회·상태 변경·역할 변경·포인트·CSV 기능
- Produces: 로그인할 수 없는 Firestore 사용자 문서를 만들지 않는 관리자 사용자 화면

- [ ] **Step 1: Firestore-only 사용자 생성 부재를 검증하는 실패 테스트 추가**

`scripts/project-surface-audit.test.js`의 describe 안에 추가한다.

```js
test('does not expose Firestore-only admin user creation', () => {
  expect(read('src/app/admin/dashboard/users/page.tsx')).not.toContain('handleAddUser');
  expect(read('src/shared/services/adminUserService.ts')).not.toContain('static async createUser');
});
```

- [ ] **Step 2: 현재 핸들러와 서비스 메서드 때문에 실패하는지 확인**

Run: `npm test -- --runInBand scripts/project-surface-audit.test.js -t "admin user creation"`

Expected: 두 문자열이 존재해 FAIL.

- [ ] **Step 3: 사용자 추가 핸들러·버튼·빈 상태 CTA 제거**

`src/app/admin/dashboard/users/page.tsx`에서 `handleAddUser`, 상단 `사용자 추가` 버튼, 빈 상태의 `첫 번째 사용자 추가` 버튼을 제거한다. 빈 상태 안내는 다음처럼 실제 가능한 행동만 설명한다.

```tsx
<h3>사용자가 없습니다</h3>
<p>가입한 사용자가 없거나 현재 검색 조건에 맞는 사용자가 없습니다.</p>
```

- [ ] **Step 4: 서비스 메서드와 사용하지 않는 import·mock 제거**

`AdminUserService.createUser` 전체를 삭제하고 `firebase/firestore` import에서 `addDoc`를 제거한다. `adminUserService.test.ts`에서 `addDoc` import, mock과 reset도 제거한다.

- [ ] **Step 5: 관리자 사용자 관련 테스트와 타입 검사**

Run: `npm test -- --runInBand scripts/project-surface-audit.test.js src/shared/services/adminUserService.test.ts`

Expected: 두 테스트 파일 PASS.

Run: `npm run typecheck`

Expected: `createUser` 또는 `handleAddUser` 잔여 참조 없이 PASS.

### Task 5: 사용되지 않는 CategoryProductTabs 제거

**Files:**
- Modify: `scripts/project-surface-audit.test.js`
- Delete: `src/app/_components/CategoryProductTabs.tsx`
- Delete: `src/app/_components/CategoryProductTabs.module.css`
- Modify: `src/app/page.test.tsx`
- Modify: `docs/main-ranking-ui.md`

**Interfaces:**
- Consumes: 현재 홈의 `DynamicCategorySection`, `ProductSection`
- Produces: 과거 홈 구성의 미사용 컴포넌트와 테스트 mock이 없는 실제 홈 표면

- [ ] **Step 1: 미사용 컴포넌트 부재를 검증하는 실패 테스트 추가**

```js
test('does not keep the detached category product tabs implementation', () => {
  expect(exists('src/app/_components/CategoryProductTabs.tsx')).toBe(false);
  expect(exists('src/app/_components/CategoryProductTabs.module.css')).toBe(false);
  expect(read('src/app/page.test.tsx')).not.toContain('CategoryProductTabs');
});
```

- [ ] **Step 2: 현재 파일과 mock 때문에 테스트가 실패하는지 확인**

Run: `npm test -- --runInBand scripts/project-surface-audit.test.js -t "category product tabs"`

Expected: 컴포넌트·스타일 파일과 page test mock이 존재해 FAIL.

- [ ] **Step 3: 컴포넌트·스타일·죽은 mock 제거**

두 CategoryProductTabs 파일을 삭제하고 `src/app/page.test.tsx`에서 `jest.mock('./_components/CategoryProductTabs', ...)` 블록을 제거한다. 현재 홈의 `DynamicCategorySection`과 `ProductSection`은 변경하지 않는다.

- [ ] **Step 4: 과거 문서 기록을 현재 상태로 보정**

`docs/main-ranking-ui.md`에 CategoryProductTabs가 후속 홈 편집 개편에서 미사용 상태가 되어 제거됐고 현재 카테고리는 `DynamicCategorySection`이 담당한다는 기록을 추가한다.

- [ ] **Step 5: 홈 구성과 표면 테스트 실행**

Run: `npm test -- --runInBand scripts/project-surface-audit.test.js src/app/page.test.tsx`

Expected: 두 테스트 파일 PASS.

### Task 6: 운영 호출이 없는 레거시 리뷰 동기화 유틸 제거

**Files:**
- Modify: `scripts/project-surface-audit.test.js`
- Delete: `src/shared/utils/syncProductReviews.ts`
- Modify: `src/app/products/_components/ProductDetailClient.test.tsx`

**Interfaces:**
- Consumes: 상품 상세의 현재 리뷰 UI와 `ProductReviews` 흐름
- Produces: 레거시 카테고리 상품 문서를 직접 갱신하는 미사용 쓰기 유틸과 오래된 mock이 없는 상품 상세 테스트

- [ ] **Step 1: 미사용 유틸과 테스트 mock 부재를 검증하는 실패 테스트 추가**

```js
test('does not keep the detached legacy review sync utility', () => {
  expect(exists('src/shared/utils/syncProductReviews.ts')).toBe(false);
  expect(read('src/app/products/_components/ProductDetailClient.test.tsx'))
    .not.toContain('syncProductReviews');
});
```

- [ ] **Step 2: 현재 유틸과 mock 때문에 테스트가 실패하는지 확인**

Run: `npm test -- --runInBand scripts/project-surface-audit.test.js -t "legacy review sync"`

Expected: 유틸 파일과 테스트 import/mock이 존재해 FAIL.

- [ ] **Step 3: 레거시 쓰기 유틸과 stale 테스트 코드 제거**

`src/shared/utils/syncProductReviews.ts`를 삭제한다. `ProductDetailClient.test.tsx`에서 다음 세 부분을 제거한다.

```tsx
import { getProductReviewStats } from '@/shared/utils/syncProductReviews';

jest.mock('@/shared/utils/syncProductReviews', () => ({
  getProductReviewStats: jest.fn(() => new Promise(() => undefined)),
}));

// 테스트 본문의 expect(getProductReviewStats).not.toHaveBeenCalled();
```

- [ ] **Step 4: 상품 상세 테스트와 참조 검사**

Run: `npm test -- --runInBand scripts/project-surface-audit.test.js src/app/products/_components/ProductDetailClient.test.tsx`

Expected: 두 테스트 파일 PASS.

Run: `rg -n "syncProductReviews|getProductReviewStats|syncProductReviewData|syncAllProductsReviewData" src scripts functions`

Expected: 런타임과 테스트 참조 없음.

### Task 7: 중복 recommendationSettings 계열 제거

**Files:**
- Modify: `scripts/project-surface-audit.test.js`
- Delete: `src/app/admin/recommendations/page.tsx`
- Delete: `src/app/admin/recommendations/page.module.css`
- Modify: `src/app/page.test.tsx`
- Modify: `src/shared/services/siteContentService.ts`
- Modify: `src/shared/services/siteContentService.test.ts`
- Modify: `scripts/static-content-data.js`
- Modify: `scripts/seed-static-content.js`
- Modify: `firestore.rules`
- Modify: `docs/static-content.md`

**Interfaces:**
- Consumes: 유지할 `FeaturedProductService`, `/admin/featured-products`, `FeaturedProducts`
- Produces: 추천 설정 데이터 모델을 `featuredProducts/mainPageFeatured` 하나로 제한한 코드 표면

- [ ] **Step 1: 중복 계열 부재와 유지 계열 존재를 검증하는 실패 테스트 추가**

```js
test('keeps one featured-product system and removes recommendationSettings', () => {
  expect(exists('src/app/admin/recommendations/page.tsx')).toBe(false);
  expect(exists('src/app/admin/recommendations/page.module.css')).toBe(false);

  for (const file of [
    'src/shared/services/siteContentService.ts',
    'scripts/static-content-data.js',
    'scripts/seed-static-content.js',
    'firestore.rules',
  ]) {
    expect(read(file)).not.toContain('recommendationSettings');
  }

  expect(exists('src/app/admin/featured-products/page.tsx')).toBe(true);
  expect(exists('src/app/_components/FeaturedProducts.tsx')).toBe(true);
  expect(exists('src/shared/services/featuredProductService.ts')).toBe(true);
});
```

- [ ] **Step 2: 중복 라우트·서비스·시드·규칙 때문에 실패하는지 확인**

Run: `npm test -- --runInBand scripts/project-surface-audit.test.js -t "one featured-product system"`

Expected: `recommendationSettings` 계열이 존재해 FAIL.

- [ ] **Step 3: 중복 관리자 화면과 서비스 API 제거**

`src/app/admin/recommendations/page.tsx`, `page.module.css`를 삭제한다. `siteContentService.ts`에서 `RecommendationSettingContent`, `getRecommendationSettings`, `saveRecommendationSetting`을 삭제하고 더 이상 필요 없는 `setDoc`, `Timestamp` import를 제거한다.

`siteContentService.test.ts`에서는 `setDoc` import·mock과 `upserts recommendation settings to Firestore` 테스트를 제거한다. `getDoc`은 오프라인 정보 조회에 사용되므로 유지한다.

`src/app/page.test.tsx`의 `FeaturedProducts` mock은 현재 홈에서 해당 컴포넌트를 import하지 않아 실행되지 않으므로 제거한다. `FeaturedProducts.tsx`와 `FeaturedProductService` 자체는 후속 홈 큐레이션 작업을 위해 유지한다.

- [ ] **Step 4: 중복 시드와 Firestore 규칙 제거**

`scripts/static-content-data.js`에서 `recommendationSettings` 배열과 export를 제거한다. `scripts/seed-static-content.js`에서 해당 import와 `upsertCollection("recommendationSettings", recommendationSettings)` 호출을 제거한다.

`firestore.rules`의 다음 전용 match를 삭제해 기본 거부를 적용한다.

```text
match /recommendationSettings/{settingId} {
  // 전체 블록 삭제
}
```

- [ ] **Step 5: 정적 콘텐츠 문서를 단일 추천 모델로 수정**

`docs/static-content.md`에서 `recommendationSettings` 범위와 보안 규칙 설명을 제거하고, 추천 상품은 `FeaturedProductService`와 `/admin/featured-products`에서 관리하며 홈 연결은 후속 성능·큐레이션 단계에서 수행한다고 기록한다.

- [ ] **Step 6: 중복 정리 관련 테스트 실행**

Run: `npm test -- --runInBand scripts/project-surface-audit.test.js src/shared/services/siteContentService.test.ts src/app/page.test.tsx`

Expected: 세 테스트 파일 PASS.

Run: `npm run typecheck`

Expected: 삭제된 타입·메서드·라우트 참조 없이 PASS.

### Task 8: 단계 1 전체 검증과 문서 상태 확인

**Files:**
- Modify only if required by verified behavior: `docs/README.md`
- Verify: all files changed in Tasks 1–7

**Interfaces:**
- Consumes: Tasks 1–7의 정리 결과
- Produces: 다음 보안 단계가 시작할 수 있는 테스트 통과 기준선

- [ ] **Step 1: 삭제 대상과 보존 대상 참조 감사**

Run: `rg -n "/mypage/(counsel|restock|withdrawal)|/auth/find-email|handleAddUser|static async createUser|CategoryProductTabs|syncProductReviews|getProductReviewStats|recommendationSettings|/admin/recommendations" src scripts functions firestore.rules docs`

Expected: 설계·계획·과거 변경 기록을 제외한 런타임 참조 없음. `FeaturedProductService`, `/admin/featured-products`, `FeaturedProducts`는 존재.

- [ ] **Step 2: 전체 정적 검사 실행**

Run: `npm run typecheck`

Expected: PASS.

Run: `npm run lint -- --max-warnings=0`

Expected: PASS, warnings 0.

- [ ] **Step 3: 전체 Jest 실행**

Run: `npm test -- --runInBand`

Expected: 모든 suite와 test PASS.

- [ ] **Step 4: 프로덕션 빌드 실행**

Run: `npm run build`

Expected: Next.js production build exit 0. 삭제한 `/auth/find-email`, `/mypage/counsel`, `/mypage/restock`, `/mypage/withdrawal`, `/admin/recommendations`가 route 목록에 없음.

- [ ] **Step 5: 변경 범위와 사용자 파일 보존 확인**

Run: `git diff --check`

Expected: whitespace 오류 없음.

Run: `git status --short`

Expected: 기존 사용자 변경 3개 파일이 유지되고, 단계 1에서 계획한 파일만 추가·수정·삭제됨. 커밋·푸시·배포 없음.
