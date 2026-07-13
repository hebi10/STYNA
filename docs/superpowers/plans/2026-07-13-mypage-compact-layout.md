# 마이페이지 컴팩트 레이아웃 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 마이페이지 첫 화면과 모든 하위 화면을 쇼핑몰에 맞는 균형 잡힌 밀도로 축소하고 경로별 좌측 메뉴 활성 상태를 정확하게 만든다.

**Architecture:** `MyPageLayout`이 현재 경로에서 활성 메뉴와 첫 화면 여부를 직접 계산한다. 구조 변경은 공통 레이아웃과 메뉴에 한정하고, 화면 밀도는 기존 CSS 모듈의 패딩·간격·글자 크기·그리드를 조정해 통일한다.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, CSS Modules, Jest, Testing Library

## 전역 제약

- 기존 데이터 조회, 링크, 폼, 주문·쿠폰·포인트 동작은 변경하지 않는다.
- 그림자와 새로운 둥근 모서리를 추가하지 않는다.
- 데스크톱 밀도는 줄이되 모바일 입력과 버튼의 터치 영역은 유지한다.
- 사용자의 기존 변경사항을 되돌리지 않는다.
- 커밋, 푸시, 배포하지 않는다.

---

### Task 1: 경로 기반 좌측 메뉴와 첫 화면 전용 요약

**Files:**
- Modify: `src/app/mypage/layout.tsx`
- Modify: `src/app/mypage/_components/SidebarMenu.tsx`
- Modify: `src/app/mypage/layout.test.tsx`

**Interfaces:**
- Consumes: `usePathname(): string`
- Produces: `getMyPageActiveTab(pathname: string): string`, 첫 화면에서는 `overview`, 주문상세에서는 `orders`

- [ ] **Step 1: 실패하는 경로 테스트 추가**

```tsx
expect(screen.getByRole('link', { name: '나의 쇼핑 현황' })).toHaveClass('active');
expect(screen.getByRole('link', { name: '주문내역' })).not.toHaveClass('active');
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- src/app/mypage/layout.test.tsx`
Expected: `나의 쇼핑 현황` 링크가 없어 FAIL

- [ ] **Step 3: 경로 계산과 조건부 요약 구현**

```tsx
const isOverview = pathname === '/mypage';
const activeTab = getMyPageActiveTab(pathname);

{isOverview ? (
  <>
    <ProfileSection userInfo={userInfo} />
    <QuickActions actions={quickActions} />
  </>
) : null}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- src/app/mypage/layout.test.tsx`
Expected: PASS

### Task 2: 공통 레이아웃과 첫 화면 밀도 축소

**Files:**
- Modify: `src/app/mypage/layout.module.css`
- Modify: `src/app/mypage/page.module.css`

**Interfaces:**
- Consumes: 기존 CSS 클래스 이름
- Produces: 220px 데스크톱 사이드바, 축소된 공통 패딩, 데스크톱 4열 통계 카드

- [ ] **Step 1: CSS 계약 테스트 추가**

`src/app/mypage/layout-density.test.ts`에서 공통 CSS가 `grid-template-columns: 220px 1fr`, 첫 화면 통계가 데스크톱 4열을 갖는지 확인한다.

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- src/app/mypage/layout-density.test.ts`
Expected: 기존 `280px`와 2열 통계 때문에 FAIL

- [ ] **Step 3: 공통 CSS 축소**

`content`, `profileSection`, `quickActions`, `sidebarCard`, `menuItem`, `contentArea`의 패딩과 간격을 20~30% 줄이고, 큰 제목과 통계 숫자를 한 단계 낮춘다. 모바일 미디어쿼리의 버튼·입력 높이는 유지한다.

- [ ] **Step 4: CSS 계약 테스트 통과 확인**

Run: `npm test -- src/app/mypage/layout-density.test.ts`
Expected: PASS

### Task 3: 상품 활동 컴포넌트 밀도 축소

**Files:**
- Modify: `src/app/mypage/_components/RecentProducts.module.css`
- Modify: `src/app/mypage/_components/WishlistProducts.module.css`
- Modify: `src/app/mypage/_components/CouponRegister.module.css`

**Interfaces:**
- Consumes: 기존 상품 카드와 쿠폰 등록 마크업
- Produces: 더 작은 빈 상태, 상품 카드 간격, 폼 패딩

- [ ] **Step 1: 주요 컴포넌트의 큰 여백 목록 확인**

Run: `rg -n "padding: 2.5rem|min-height: 240px|padding: 24px" src/app/mypage/_components --glob "*.module.css"`

- [ ] **Step 2: 기존 선택자 안에서 밀도 축소**

빈 상태 패딩은 약 `1.5rem`, 상품 그리드 간격은 `0.75rem`, 카드 본문은 `0.75rem`, 쿠폰 등록 패널은 `16px` 기준으로 조정한다.

- [ ] **Step 3: 관련 컴포넌트 테스트 실행**

Run: `npm test -- src/app/mypage/layout.test.tsx`
Expected: PASS

### Task 4: 모든 하위 화면 밀도 통일

**Files:**
- Modify: `src/app/mypage/order-list/page.module.css`
- Modify: `src/app/mypage/order-detail/[orderId]/page.module.css`
- Modify: `src/app/mypage/coupons/page.module.css`
- Modify: `src/app/mypage/point/page.module.css`
- Modify: `src/app/mypage/qa/page.module.css`
- Modify: `src/app/mypage/info-edit/page.module.css`

**Interfaces:**
- Consumes: 각 페이지의 기존 마크업과 CSS 클래스
- Produces: 공통적으로 16~24px 섹션 패딩, 12~16px 간격, 축소된 헤더와 빈 상태

- [ ] **Step 1: 대표 화면의 큰 값 기준 기록**

Run: `rg -n "padding: (3rem|4rem|40px)|min-height: (400px|50vh|100vh)" src/app/mypage --glob "*.module.css"`

- [ ] **Step 2: 주문·쿠폰·문의 화면 축소**

상단 요약, 필터, 목록 카드, 빈 상태의 `2~4rem` 패딩을 `1~1.5rem` 범위로 줄이고 섹션 간격을 `0.75~1rem`으로 통일한다.

- [ ] **Step 3: 적립금·회원정보·주문상세 화면 축소**

내부 이중 컨테이너의 전체 화면 최소 높이를 제거하고 폼·정보 카드 패딩을 `16~24px` 범위로 줄인다.

- [ ] **Step 4: 정적 검사와 전체 테스트 실행**

Run: `npm run typecheck && npm run lint -- --max-warnings=0 && npm test -- src/app/mypage/layout.test.tsx`
Expected: 모두 exit code 0

### Task 5: Chrome 시각 QA와 전체 검증

**Files:**
- Modify if needed: Task 1~4의 CSS 모듈
- Modify: `docs/mypage-ui.md`

**Interfaces:**
- Consumes: 로그인된 Chrome 세션과 `http://localhost:3000`
- Produces: 데스크톱·모바일에서 겹침이나 과대 여백이 없는 화면

- [ ] **Step 1: Chrome 데스크톱 확인**

`/mypage`, `/mypage/order-list`, `/mypage/coupons`, `/mypage/point`, `/mypage/info-edit`에서 활성 메뉴, 첫 화면 전용 요약, 카드 밀도를 확인한다.

- [ ] **Step 2: Chrome 모바일 확인**

약 390px 폭에서 가로 넘침, 버튼·입력 크기, 단일 열 전환을 확인한 뒤 뷰포트 설정을 원복한다.

- [ ] **Step 3: 문서 갱신**

`docs/mypage-ui.md`에 경로별 메뉴 활성화와 컴팩트 레이아웃 기준을 짧게 기록한다.

- [ ] **Step 4: 전체 검증**

Run: `npm run verify`
Expected: 타입체크, 린트, 전체 테스트, 함수 빌드, Next.js 빌드 모두 exit code 0
