# STYNA Shopping-First Hybrid UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** STYNA를 쇼핑 흐름이 먼저 보이는 포트폴리오로 압축하고, 데이터·인증·모바일 상태를 안정화하며, 공개·인증·마이페이지·관리자 화면을 하나의 절제된 디자인 문법으로 통일한다.

**Architecture:** 기존 Next.js App Router, TanStack Query와 Firebase 서비스 경계를 유지한다. 공통 비동기 상태 패턴과 내비게이션 정의만 작은 단위로 추출하고, 홈·장바구니·로그인·고정 UI가 이를 소비한다. 공개 상품 오류를 빈 결과로 숨기지 않으며, 포트폴리오 데모 로그인은 명시적 환경변수로만 노출한다.

**Tech Stack:** Next.js 15, React 19, TypeScript, CSS Modules, TanStack Query 5, Firebase Auth/Firestore, Jest 30, Testing Library, Impeccable 4.0.2

## Global Constraints

- 기준 설계는 `docs/superpowers/specs/2026-07-27-shopping-first-hybrid-ui-design.md`다.
- Impeccable 기준점은 `25/40`, P0 0건, P1 3건이다.
- 이메일·비밀번호 로그인, 일반 회원 빠른 로그인, 관리자 빠른 로그인을 모두 유지한다.
- 빠른 로그인은 `NEXT_PUBLIC_ENABLE_DEMO_LOGIN=true`일 때만 노출한다.
- 관리자 권한 판정, Firebase Rules, 문서 구조와 기존 URL을 변경하지 않는다.
- 새 결제·배송·쿠폰·로그인 기능과 새 의존성을 추가하지 않는다.
- Pretendard, 흑백·오프화이트, 얇은 구분선과 4열/2열 상품 매대 문법을 유지한다.
- 새 `box-shadow`와 `border-radius`를 추가하지 않는다.
- detector의 장식 경고를 자동 수정하지 않고 실제 화면과 역할을 확인한 파일만 수정한다.
- 각 작업은 실패 테스트 → 최소 구현 → 집중 테스트 → 관련 문서 갱신 순서로 완료한다.
- 커밋, 푸시와 배포는 수행하지 않는다.

---

## File Structure

### 새 공통 단위

- `src/app/_components/AsyncStatePanel.tsx`: loading·error·empty·permission 상태의 의미와 CTA를 통일한다.
- `src/app/_components/AsyncStatePanel.module.css`: 공개 쇼핑 디자인의 상태 패널 레이아웃을 정의한다.
- `src/app/_components/AsyncStatePanel.test.tsx`: 상태별 ARIA와 링크·버튼 동작을 검증한다.
- `src/app/_components/header/navigation.ts`: 데스크톱과 모바일이 공유하는 다섯 개 내비게이션 그룹을 생성한다.
- `src/app/_components/header/navigation.test.ts`: 목적지 보존과 그룹 구조를 검증한다.
- `src/app/_components/PortfolioDemoSection.tsx`: 홈의 분산된 포트폴리오 설명을 한 구역으로 통합한다.
- `src/app/_components/PortfolioDemoSection.module.css`: 홈 하단 포트폴리오 구역을 기존 토큰으로 배치한다.
- `src/app/_components/PortfolioDemoSection.test.tsx`: 데모 범위와 쇼핑 가이드 진입을 검증한다.
- `src/shared/utils/siteGuide.ts`: 홈 구역에서 전역 쇼핑 가이드를 여는 단일 이벤트 인터페이스를 제공한다.
- `src/shared/utils/siteGuide.test.ts`: 이벤트 dispatch를 검증한다.
- `src/shared/utils/floatingUi.ts`: 경로별 챗봇·쇼핑 가이드 노출 정책을 제공한다.
- `src/shared/utils/floatingUi.test.ts`: 인증·주문·상품·이벤트·홈 경로 정책을 검증한다.
- `src/app/design-system-quality.test.ts`: 승인된 CSS 품질 규칙과 layout transition 제거를 검증한다.

### 기존 단위

- `src/app/auth/login/page.tsx`: 로그인 폼, 데모 로그인 flag와 오류 공지를 소유한다.
- `src/app/_components/FeaturedProducts.tsx`: 관리자 추천 설정과 홈 공개 상품 fallback을 조합한다.
- `src/app/products/_components/ProductList.tsx`: 공개 상품 loading·error·empty·success 상태를 소유한다.
- `src/app/orders/cart/page.tsx`: auth loading과 비로그인 복구 gate를 소유한다.
- `src/app/_components/header/Header.tsx`: 공유 내비게이션 그룹의 데스크톱·모바일 동작을 렌더링한다.
- `src/app/page.tsx`: 쇼핑 우선 홈 섹션 순서를 소유한다.
- `src/app/_components/chat/ChatWidget.tsx`: 도움말 기능과 경로별 노출을 소유한다.
- `src/app/_components/popup/SiteGuideManager.tsx`: 쇼핑 가이드 trigger와 dialog 상태를 소유한다.

---

### Task 1: 환경변수 기반 포트폴리오 데모 로그인

**Impeccable phase:** `$impeccable harden`, `$impeccable clarify`

**Files:**
- Modify: `src/app/auth/login/page.tsx`
- Modify: `src/app/auth/login/page.test.tsx`
- Modify: `src/app/auth/login/page.module.css`
- Modify: `docs/env-setup.md`
- Modify: `docs/auth-ui.md`

**Interfaces:**
- Consumes: `process.env.NEXT_PUBLIC_ENABLE_DEMO_LOGIN`
- Produces: `const showDemoLogins = process.env.NEXT_PUBLIC_ENABLE_DEMO_LOGIN === "true"`
- Preserves: `login(email, password, rememberMe)`, `getSafeRedirectTarget(...)`, 일반 회원·관리자 계정과 기존 redirect

- [ ] **Step 1: 환경변수 off·on과 오류 semantics 실패 테스트 작성**

```tsx
test('shows both portfolio demo logins only when the public flag is true', () => {
  process.env.NEXT_PUBLIC_ENABLE_DEMO_LOGIN = 'true';
  render(<LoginPage />);

  expect(screen.getByText('포트폴리오 데모 로그인')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '일반 회원 로그인' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '관리자 로그인' })).toBeInTheDocument();
});

test('hides portfolio demo logins when the public flag is not true', () => {
  process.env.NEXT_PUBLIC_ENABLE_DEMO_LOGIN = 'false';
  render(<LoginPage />);

  expect(screen.queryByRole('button', { name: '일반 회원 로그인' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '관리자 로그인' })).not.toBeInTheDocument();
});

test('announces an authentication error', () => {
  jest.mocked(useAuth).mockReturnValue({
    login,
    error: '이메일 또는 비밀번호를 확인해주세요.',
    clearError,
    user: null,
    loading: false,
  } as unknown as ReturnType<typeof useAuth>);

  render(<LoginPage />);
  expect(screen.getByRole('alert')).toHaveTextContent('이메일 또는 비밀번호를 확인해주세요.');
});
```

- [ ] **Step 2: 로그인 집중 테스트를 실행해 실패 확인**

Run: `npm test -- --runInBand src/app/auth/login/page.test.tsx src/shared/utils/safeRedirect.test.ts`

Expected: 데모 버튼은 `NODE_ENV`만 사용하므로 flag on/off 테스트가 FAIL하고 오류 영역에 alert role이 없어 semantics 테스트가 FAIL.

- [ ] **Step 3: 데모 로그인 flag와 오류 공지 최소 구현**

```tsx
const showDemoLogins =
  process.env.NEXT_PUBLIC_ENABLE_DEMO_LOGIN === 'true';

{error && (
  <div className={styles.errorMessage} role="alert">
    {error}
  </div>
)}

{showDemoLogins && (
  <>
    <div className={styles.divider}>
      <span className={styles.dividerText}>포트폴리오 데모 로그인</span>
    </div>
    {/* 기존 일반 회원 로그인·관리자 로그인 버튼과 계정 동작 유지 */}
  </>
)}
```

테스트는 원래 환경변수를 저장하고 각 테스트 후 복원해 다른 테스트 파일에 상태를 누출하지 않는다.

- [ ] **Step 4: 로그인 스타일과 문서 갱신**

`page.module.css`는 기존 검정 CTA, 밝은 표면과 얇은 보더를 유지한다. 데모 영역에 새 그림자와 라운드를 추가하지 않는다. `docs/env-setup.md`에 다음 값을 추가한다.

```dotenv
NEXT_PUBLIC_ENABLE_DEMO_LOGIN=true
```

이 값은 포트폴리오 데모 배포에서만 사용하고 일반 운영 배포에서는 생략하거나 `false`로 둔다고 명시한다.

- [ ] **Step 5: 집중 검증**

Run: `npm test -- --runInBand src/app/auth/login/page.test.tsx src/shared/utils/safeRedirect.test.ts`

Expected: flag off·on, 두 빠른 로그인, 안전 redirect와 오류 alert가 모두 PASS.

---

### Task 2: 공통 비동기 상태 패널

**Impeccable phase:** `$impeccable harden`

**Files:**
- Create: `src/app/_components/AsyncStatePanel.tsx`
- Create: `src/app/_components/AsyncStatePanel.module.css`
- Create: `src/app/_components/AsyncStatePanel.test.tsx`

**Interfaces:**

```ts
export type AsyncStateKind = 'loading' | 'error' | 'empty' | 'permission';

export type AsyncStateAction =
  | { label: string; onClick: () => void; href?: never }
  | { label: string; href: string; onClick?: never };

export interface AsyncStatePanelProps {
  kind: AsyncStateKind;
  title: string;
  description?: string;
  primaryAction?: AsyncStateAction;
  secondaryAction?: AsyncStateAction;
}
```

- [ ] **Step 1: 상태 의미와 CTA 실패 테스트 작성**

```tsx
test('uses status for loading and alert for errors', () => {
  const { rerender } = render(
    <AsyncStatePanel kind="loading" title="상품을 불러오는 중입니다." />,
  );
  expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');

  rerender(
    <AsyncStatePanel
      kind="error"
      title="상품을 불러오지 못했습니다."
      primaryAction={{ label: '다시 시도', onClick: jest.fn() }}
    />,
  );
  expect(screen.getByRole('alert')).toHaveTextContent('상품을 불러오지 못했습니다.');
});

test('renders callback and link actions without nesting interactive controls', () => {
  const retry = jest.fn();
  render(
    <AsyncStatePanel
      kind="permission"
      title="로그인이 필요합니다."
      primaryAction={{ label: '로그인하고 계속하기', href: '/auth/login?redirect=/orders/cart' }}
      secondaryAction={{ label: '쇼핑 계속하기', href: '/products' }}
    />,
  );
  expect(screen.getByRole('link', { name: '로그인하고 계속하기' })).toHaveAttribute(
    'href',
    '/auth/login?redirect=/orders/cart',
  );
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
  expect(retry).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: 새 테스트를 실행해 실패 확인**

Run: `npm test -- --runInBand src/app/_components/AsyncStatePanel.test.tsx`

Expected: 모듈이 없어 FAIL.

- [ ] **Step 3: 공통 컴포넌트 최소 구현**

```tsx
function StateAction({ action }: { action: AsyncStateAction }) {
  if ('href' in action) {
    return <Link href={action.href}>{action.label}</Link>;
  }
  return <button type="button" onClick={action.onClick}>{action.label}</button>;
}

const liveProps =
  kind === 'loading'
    ? { role: 'status', 'aria-live': 'polite', 'aria-busy': true }
    : kind === 'error'
      ? { role: 'alert' }
      : {};
```

loading에는 spinner 장식과 진행 문구, error·empty·permission에는 제목·설명·최대 두 개의 행동만 렌더링한다.

- [ ] **Step 4: 상태 패널 CSS 작성**

```css
.panel {
  display: grid;
  justify-items: start;
  gap: var(--spacing-md);
  padding: var(--spacing-xl) 0;
  border-top: 1px solid var(--color-border);
  border-bottom: 1px solid var(--color-border);
  background: var(--color-bg-primary);
}
```

새 `box-shadow`와 `border-radius`를 사용하지 않는다.

- [ ] **Step 5: 집중 검증**

Run: `npm test -- --runInBand src/app/_components/AsyncStatePanel.test.tsx`

Expected: 네 상태와 버튼·링크 행동이 PASS.

---

### Task 3: 상품 조회 상태와 홈 추천 fallback 안정화

**Impeccable phase:** `$impeccable harden`

**Files:**
- Modify: `src/app/products/_components/ProductList.tsx`
- Modify: `src/app/products/_components/ProductList.test.tsx`
- Modify: `src/app/products/_components/ProductList.module.css`
- Modify: `src/app/_components/FeaturedProducts.tsx`
- Modify: `src/app/_components/FeaturedProducts.test.tsx`
- Modify: `src/app/_components/FeaturedProducts.module.css`
- Modify: `src/app/_components/ProductSection.tsx`
- Modify: `src/app/_components/ProductSection.test.tsx`
- Modify: `docs/product-listing-structure.md`
- Modify: `docs/static-content.md`

**Interfaces:**
- Consumes: `AsyncStatePanel`, `useHomeProducts()`, `productKeys.featured()`
- Produces: 추천 설정 성공 시 관리자 순서, 추천 설정 실패 시 `recommendedProducts.slice(0, 4)` fallback
- Rule: error와 empty를 동시에 렌더링하지 않는다.

- [ ] **Step 1: 상품 목록 error·empty 분리 테스트 추가**

```tsx
test('renders a retryable alert instead of an empty result when the first query fails', async () => {
  jest.mocked(ProductService.queryProducts).mockRejectedValueOnce(
    new Error('permission-denied'),
  );

  render(<ProductList />);

  expect(await screen.findByRole('alert')).toHaveTextContent(
    '상품 목록을 불러오지 못했습니다.',
  );
  expect(screen.getByRole('button', { name: '다시 시도' })).toBeInTheDocument();
  expect(screen.queryByText('조건에 맞는 상품이 없습니다.')).not.toBeInTheDocument();
});

test('renders filter reset only for a successful empty result', async () => {
  jest.mocked(ProductService.queryProducts).mockResolvedValueOnce({
    items: [],
    nextCursor: null,
    hasMore: false,
  });

  render(<ProductList />);

  expect(await screen.findByText('조건에 맞는 상품이 없습니다.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '조건 초기화' })).toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
```

- [ ] **Step 2: 추천 설정 실패 fallback 테스트 추가**

```tsx
test('falls back to public recommended products when featured config fails', () => {
  jest.mocked(useQuery).mockReturnValue({
    isLoading: false,
    isError: true,
    data: undefined,
    refetch: jest.fn(),
  } as never);
  jest.mocked(useHomeProducts).mockReturnValue({
    isLoading: false,
    isError: false,
    data: { recommendedProducts: [product('fallback-1', '대체 추천 셔츠')] },
  } as never);

  render(<FeaturedProducts />);

  expect(screen.getByText('대체 추천 셔츠')).toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test('shows one retryable error when config and public fallback both fail', () => {
  jest.mocked(useQuery).mockReturnValue({ isLoading: false, isError: true } as never);
  jest.mocked(useHomeProducts).mockReturnValue({ isLoading: false, isError: true } as never);

  render(<FeaturedProducts />);
  expect(screen.getAllByRole('alert')).toHaveLength(1);
});
```

- [ ] **Step 3: 관련 테스트를 실행해 실패 확인**

Run: `npm test -- --runInBand src/app/products/_components/ProductList.test.tsx src/app/_components/FeaturedProducts.test.tsx src/app/_components/ProductSection.test.tsx src/shared/hooks/useProducts.test.tsx src/shared/services/featuredProductService.test.ts`

Expected: 공통 상태 패널과 추천 fallback이 없어 새 테스트가 FAIL.

- [ ] **Step 4: ProductList 상태 구현**

초기 loading에는 기존 상품형 skeleton을 유지한다. error에는 `AsyncStatePanel`을 사용하고 기술 오류 문자열을 그대로 노출하지 않는다.

```tsx
if (error) {
  return (
    <AsyncStatePanel
      kind="error"
      title="상품 목록을 불러오지 못했습니다."
      description="잠시 후 다시 시도하거나 전체 상품으로 돌아가 주세요."
      primaryAction={{ label: '다시 시도', onClick: () => void loadPage(1, true) }}
      secondaryAction={{ label: '전체 상품 보기', href: '/products' }}
    />
  );
}
```

성공한 빈 결과에만 empty panel과 `clearFilters`를 연결한다. error가 설정된 render에서는 stats·pagination·empty를 렌더링하지 않는다.

- [ ] **Step 5: FeaturedProducts fallback 구현**

`useHomeProducts()`의 query는 이미 다른 홈 섹션과 같은 key로 dedupe되므로 별도 Firebase 호출 함수를 추가하지 않는다.

```tsx
const featuredQuery = useQuery({ /* 기존 featured query */ });
const homeQuery = useHomeProducts();
const fallbackProducts = homeQuery.data?.recommendedProducts.slice(0, 4) ?? [];
const useFallback = featuredQuery.isError && fallbackProducts.length > 0;
```

featured 설정이 비활성 또는 성공한 빈 설정이면 기존처럼 섹션을 숨긴다. 설정 조회가 실패했을 때만 공개 추천 fallback을 사용한다.

- [ ] **Step 6: ProductSection의 숨겨진 실패 상태를 공통화**

ProductSection의 error panel을 `AsyncStatePanel`로 교체한다. 조회 성공 후 해당 타입 상품이 없는 경우에는 페이지 전체 설명과 중복되는 빈 패널을 만들지 않고 기존처럼 섹션을 숨긴다.

- [ ] **Step 7: 집중 검증과 문서 갱신**

Run: `npm test -- --runInBand src/app/products/_components/ProductList.test.tsx src/app/_components/FeaturedProducts.test.tsx src/app/_components/ProductSection.test.tsx src/shared/hooks/useProducts.test.tsx src/shared/services/featuredProductService.test.ts`

Expected: loading·error·empty·success와 추천 fallback이 구분되어 PASS.

`docs/product-listing-structure.md`에는 error를 empty로 흡수하지 않는 규칙을, `docs/static-content.md`에는 추천 설정 실패 시 공개 추천 fallback 규칙을 기록한다.

---

### Task 4: 장바구니 인증 복구 gate

**Impeccable phase:** `$impeccable clarify`, `$impeccable harden`

**Files:**
- Modify: `src/app/orders/cart/page.tsx`
- Modify: `src/app/orders/cart/page.test.tsx`
- Modify: `src/app/orders/cart/page.module.css`
- Modify: `docs/commerce-policy.md`

**Interfaces:**
- Consumes: `AsyncStatePanel`, `useAuth()`
- Produces: auth loading status와 비로그인 permission gate
- Login target: `/auth/login?redirect=/orders/cart`
- Secondary target: `/products`

- [ ] **Step 1: auth loading과 비로그인 gate 실패 테스트 작성**

```tsx
test('shows a status while authentication is being checked', () => {
  jest.mocked(useAuth).mockReturnValue({
    user: null,
    loading: true,
  } as unknown as ReturnType<typeof useAuth>);

  render(<OrderCartPage />);
  expect(screen.getByRole('status')).toHaveTextContent('로그인 상태를 확인하고 있습니다.');
  expect(mockPush).not.toHaveBeenCalled();
});

test('offers login and shopping recovery actions to signed-out users', () => {
  jest.mocked(useAuth).mockReturnValue({
    user: null,
    loading: false,
  } as unknown as ReturnType<typeof useAuth>);

  render(<OrderCartPage />);

  expect(screen.getByRole('heading', { name: '장바구니를 보려면 로그인이 필요합니다' }))
    .toBeInTheDocument();
  expect(screen.getByRole('link', { name: '로그인하고 계속하기' })).toHaveAttribute(
    'href',
    '/auth/login?redirect=/orders/cart',
  );
  expect(screen.getByRole('link', { name: '쇼핑 계속하기' })).toHaveAttribute(
    'href',
    '/products',
  );
});
```

- [ ] **Step 2: 장바구니 테스트를 실행해 실패 확인**

Run: `npm test -- --runInBand src/app/orders/cart/page.test.tsx src/app/auth/login/page.test.tsx src/shared/utils/safeRedirect.test.ts`

Expected: 현재 raw 텍스트와 즉시 router push 때문에 heading·CTA 테스트가 FAIL.

- [ ] **Step 3: render gate 최소 구현**

비로그인 redirect effect를 제거하고 사용자가 CTA를 선택하도록 한다.

```tsx
if (authLoading) {
  return (
    <AsyncStatePanel
      kind="loading"
      title="로그인 상태를 확인하고 있습니다."
    />
  );
}

if (!user) {
  return (
    <AsyncStatePanel
      kind="permission"
      title="장바구니를 보려면 로그인이 필요합니다"
      description="로그인 후 담아둔 상품과 쿠폰을 이어서 확인할 수 있습니다."
      primaryAction={{
        label: '로그인하고 계속하기',
        href: '/auth/login?redirect=/orders/cart',
      }}
      secondaryAction={{ label: '쇼핑 계속하기', href: '/products' }}
    />
  );
}
```

- [ ] **Step 4: 장바구니 레이아웃 연결**

permission gate가 헤더·푸터 사이에서 과도한 빈 공간을 만들지 않도록 기존 container 폭과 상하 간격을 사용한다. 새로운 그림자와 라운드를 추가하지 않는다.

- [ ] **Step 5: 집중 검증과 문서 갱신**

Run: `npm test -- --runInBand src/app/orders/cart/page.test.tsx src/app/auth/login/page.test.tsx src/shared/utils/safeRedirect.test.ts`

Expected: auth loading, 비로그인 CTA, 로그인 후 safe redirect와 기존 장바구니 쿠폰 테스트가 PASS.

---

### Task 5: 다섯 그룹 헤더와 모바일 내비게이션

**Impeccable phase:** `$impeccable distill`

**Files:**
- Create: `src/app/_components/header/navigation.ts`
- Create: `src/app/_components/header/navigation.test.ts`
- Modify: `src/app/_components/header/Header.tsx`
- Modify: `src/app/_components/header/Header.test.tsx`
- Modify: `src/app/_components/header/Header.module.css`
- Modify: `docs/header-ui.md`

**Interfaces:**

```ts
export interface HeaderNavItem {
  label: string;
  href: string;
}

export interface HeaderNavGroup {
  id: 'shop' | 'recommend' | 'events' | 'reviews' | 'support';
  label: string;
  href?: string;
  items: HeaderNavItem[];
}

export function buildHeaderNavGroups(
  categories: HeaderCategory[],
): HeaderNavGroup[];
```

- [ ] **Step 1: 목적지 보존과 다섯 그룹 실패 테스트 작성**

```ts
test('groups every shopping and support destination into five top-level groups', () => {
  const groups = buildHeaderNavGroups([
    { id: 'bags', name: '가방', href: '/categories/bags' },
  ]);

  expect(groups.map((group) => group.label)).toEqual([
    'SHOP',
    '추천',
    '이벤트',
    '리뷰',
    '고객지원',
  ]);
  expect(groups[0].items).toEqual(expect.arrayContaining([
    { label: '전체 상품', href: '/products' },
    { label: '카테고리', href: '/categories' },
    { label: '가방', href: '/categories/bags' },
    { label: '신상', href: '/recommend?filter=new' },
    { label: '베스트', href: '/recommend?filter=review' },
    { label: '세일', href: '/main/sale' },
    { label: '브랜드', href: '/brand' },
  ]));
});
```

- [ ] **Step 2: Header disclosure와 키보드 실패 테스트 작성**

```tsx
test('opens one desktop group at a time and exposes its destinations', async () => {
  render(<Header />);

  fireEvent.click(screen.getByRole('button', { name: 'SHOP 메뉴 열기' }));
  expect(screen.getByRole('link', { name: '전체 상품' })).toHaveAttribute('href', '/products');

  fireEvent.click(screen.getByRole('button', { name: '고객지원 메뉴 열기' }));
  expect(screen.queryByRole('link', { name: '전체 상품' })).not.toBeVisible();
  expect(screen.getByRole('link', { name: 'FAQ' })).toHaveAttribute('href', '/cs/faq');
});
```

기존 Escape, focus trap, resize와 body overflow 테스트는 유지한다.

- [ ] **Step 3: 헤더 테스트를 실행해 실패 확인**

Run: `npm test -- --runInBand src/app/_components/header/navigation.test.ts src/app/_components/header/Header.test.tsx`

Expected: navigation 모듈과 그룹 disclosure가 없어 FAIL.

- [ ] **Step 4: 공유 내비게이션 정의 구현**

`buildHeaderNavGroups`는 Firebase 카테고리를 SHOP 내부에 추가하되, 로드 전에는 `/categories` fallback만 사용한다. 기존 지원 링크의 이벤트·리뷰는 각 독립 그룹으로 이동하고 FAQ·1:1 문의·상품 문의만 고객지원에 둔다.

- [ ] **Step 5: 데스크톱과 모바일 렌더 구현**

데스크톱 top-level은 다섯 개만 렌더링한다. items가 있는 그룹은 button disclosure, 단일 목적지는 Link로 렌더링한다. 모바일은 같은 groups 배열을 disclosure 목록으로 렌더링한다.

```tsx
<button
  type="button"
  aria-expanded={openDesktopGroup === group.id}
  aria-controls={`desktop-nav-${group.id}`}
  onClick={() => setOpenDesktopGroup(current => current === group.id ? null : group.id)}
>
  {group.label}
</button>
```

사용자 메뉴의 검색·장바구니·로그인·마이페이지·관리자는 기존 위치와 권한 조건을 유지한다.

- [ ] **Step 6: 헤더 CSS 정리**

dropdown과 모바일 disclosure는 흰 표면, 검정 텍스트, 얇은 보더로 작성한다. hover·focus·active를 구분하고 새 그림자와 라운드를 추가하지 않는다. 모든 top-level trigger와 모바일 링크는 최소 높이 44px을 사용한다.

- [ ] **Step 7: 집중 검증과 문서 갱신**

Run: `npm test -- --runInBand src/app/_components/header/navigation.test.ts src/app/_components/header/Header.test.tsx`

Expected: 다섯 그룹, 목적지, focus trap, Escape·resize·scroll lock과 역할 기반 사용자 메뉴가 PASS.

---

### Task 6: 쇼핑 우선 홈과 포트폴리오 안내 통합

**Impeccable phase:** `$impeccable distill`

**Files:**
- Create: `src/app/_components/PortfolioDemoSection.tsx`
- Create: `src/app/_components/PortfolioDemoSection.module.css`
- Create: `src/app/_components/PortfolioDemoSection.test.tsx`
- Create: `src/shared/utils/siteGuide.ts`
- Create: `src/shared/utils/siteGuide.test.ts`
- Modify: `src/app/_components/popup/SiteGuideManager.tsx`
- Create: `src/app/_components/popup/SiteGuideManager.test.tsx`
- Modify: `src/app/page.tsx`
- Modify: `src/app/page.module.css`
- Modify: `src/app/page.test.tsx`
- Modify: `docs/design-system-refactor.md`

**Interfaces:**

```ts
export const OPEN_SITE_GUIDE_EVENT = 'styna:open-site-guide';
export function openSiteGuide(): void;
```

Home order: banner → categories → featured → new → best → sale/events → service info → portfolio demo.

- [ ] **Step 1: 쇼핑 가이드 event 실패 테스트 작성**

```ts
test('dispatches the shared open-site-guide event', () => {
  const listener = jest.fn();
  window.addEventListener(OPEN_SITE_GUIDE_EVENT, listener);

  openSiteGuide();

  expect(listener).toHaveBeenCalledTimes(1);
  window.removeEventListener(OPEN_SITE_GUIDE_EVENT, listener);
});
```

- [ ] **Step 2: 포트폴리오 구역 실패 테스트 작성**

```tsx
test('keeps portfolio disclosure in one section and opens the shopping guide', () => {
  const open = jest.spyOn(siteGuide, 'openSiteGuide');
  render(<PortfolioDemoSection />);

  expect(screen.getByRole('heading', { name: '포트폴리오 데모 안내' })).toBeInTheDocument();
  expect(screen.getByText(/실제 결제는 진행되지 않습니다/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '구현 범위 자세히 보기' }));
  expect(open).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 3: 홈 순서와 중복 제거 실패 테스트 작성**

```tsx
test('renders one shopping-first path and one portfolio disclosure section', () => {
  const markup = renderToStaticMarkup(<Home />);

  expect(markup.match(/PORTFOLIO DEMO/g)).toHaveLength(1);
  expect(markup).not.toContain('스타일 코멘트 예시');
  expect(markup).not.toContain('혜택 안내 예시');
  expect(markup).not.toContain('isNew로 표시된 상품');

  const positions = [
    '카테고리',
    "에디터",
    '신상품',
    '베스트 랭킹',
    '할인 상품',
    '포트폴리오 데모 안내',
  ].map((text) => markup.indexOf(text));
  expect(positions).toEqual([...positions].sort((a, b) => a - b));
});
```

- [ ] **Step 4: 관련 테스트를 실행해 실패 확인**

Run: `npm test -- --runInBand src/shared/utils/siteGuide.test.ts src/app/_components/PortfolioDemoSection.test.tsx src/app/_components/popup/SiteGuideManager.test.tsx src/app/page.test.tsx`

Expected: 새 구성요소가 없고 기존 홈에 `PORTFOLIO DEMO`가 반복돼 FAIL.

- [ ] **Step 5: 가이드 event와 manager 연결**

```ts
export function openSiteGuide() {
  window.dispatchEvent(new Event(OPEN_SITE_GUIDE_EVENT));
}
```

`SiteGuideManager`는 mount 후 event listener를 등록하고 cleanup에서 제거한다. 기존 fixed trigger와 popup의 Escape·focus 복귀 동작은 유지한다.

- [ ] **Step 6: PortfolioDemoSection 구현**

한 개의 `section`에 데모 결제 고지, 일반·관리자 역할, 구현 범위 요약, 가이드 열기 버튼을 배치한다. 기능 개수를 새로 주장하지 않고 기존 `SITE_INFO.demoNotice`, `formatSignupBenefit()`과 실제 구현 범위만 사용한다.

- [ ] **Step 7: 홈 섹션 통합**

`curationStrip`, `mdNoteSection`, `reviewHighlight`, `saleNotice`를 제거한다. 편집 조합 카피는 FeaturedProducts의 description으로 이동하고, 신상품 subtitle은 `이번 주 새로 등록된 상품`으로 교체한다. sale ProductSection과 이벤트 링크를 하나의 연속 구간으로 배치한다.

- [ ] **Step 8: 홈 CSS 정리**

삭제된 네 구역의 사용되지 않는 class를 제거한다. 남은 섹션은 기존 `sectionContainer`, `productBand`, 얇은 구분선과 off-white 배경을 재사용한다. PortfolioDemoSection은 새 그림자와 라운드 없이 작성한다.

- [ ] **Step 9: 집중 검증과 문서 갱신**

Run: `npm test -- --runInBand src/shared/utils/siteGuide.test.ts src/app/_components/PortfolioDemoSection.test.tsx src/app/_components/popup/SiteGuideManager.test.tsx src/app/page.test.tsx src/app/_components/ProductSection.test.tsx`

Expected: 홈 순서, 단일 데모 안내, 쇼핑 가이드 열기와 삭제된 중복 구역이 PASS.

---

### Task 7: 경로별 고정 UI 정책과 모바일 충돌 제거

**Impeccable phase:** `$impeccable adapt`

**Files:**
- Create: `src/shared/utils/floatingUi.ts`
- Create: `src/shared/utils/floatingUi.test.ts`
- Modify: `src/app/_components/chat/ChatWidget.tsx`
- Modify: `src/app/_components/chat/ChatWidget.test.tsx`
- Modify: `src/app/_components/chat/ChatWidget.module.css`
- Modify: `src/app/_components/popup/SiteGuideManager.tsx`
- Modify: `src/app/_components/popup/SiteGuideManager.test.tsx`
- Modify: `src/app/_components/popup/SiteGuideManager.module.css`

**Interfaces:**

```ts
export interface FloatingUiPolicy {
  hideChat: boolean;
  hideGuide: boolean;
  suppressChatOnMobile: boolean;
  suppressGuideOnMobile: boolean;
}

export function getFloatingUiPolicy(pathname: string | null): FloatingUiPolicy;
```

Rules:
- `/auth/**`: chat와 guide 모두 숨김
- `/orders/**`: chat와 guide 모두 숨김
- `/products/**`: 모바일 chat 숨김, guide 숨김
- `/events/**`: 모바일 chat 숨김, guide 숨김
- 그 외 공개 경로: chat와 guide 표시, guide는 chat 위에 수직 배치

- [ ] **Step 1: 정책 실패 테스트 작성**

```ts
test.each([
  ['/auth/login', true, true],
  ['/orders/cart', true, true],
])('hides both floating tools on %s', (pathname, hideChat, hideGuide) => {
  expect(getFloatingUiPolicy(pathname)).toMatchObject({ hideChat, hideGuide });
});

test('suppresses shopping overlays on mobile product routes', () => {
  expect(getFloatingUiPolicy('/products/item-1')).toMatchObject({
    hideChat: false,
    suppressChatOnMobile: true,
    hideGuide: true,
  });
});
```

- [ ] **Step 2: component class와 경로 실패 테스트 작성**

```tsx
test('does not render the chatbot on order routes', () => {
  mockUsePathname.mockReturnValue('/orders/cart');
  render(<ChatWidget />);
  expect(screen.queryByRole('button', { name: '채팅 열기' })).not.toBeInTheDocument();
});

test('marks the chatbot as mobile-suppressed on product routes', () => {
  mockUsePathname.mockReturnValue('/products/item-1');
  render(<ChatWidget />);
  expect(screen.getByTestId('chat-widget')).toHaveClass('mobileSuppressed');
});
```

- [ ] **Step 3: 관련 테스트를 실행해 실패 확인**

Run: `npm test -- --runInBand src/shared/utils/floatingUi.test.ts src/app/_components/chat/ChatWidget.test.tsx src/app/_components/popup/SiteGuideManager.test.tsx`

Expected: 공유 정책과 경로 class가 없어 FAIL.

- [ ] **Step 4: 정책과 component 연결**

`ChatWidget`과 `SiteGuideManager`는 각각 `getFloatingUiPolicy(pathname)`을 사용한다. `hide*`는 null render, `suppress*OnMobile`은 CSS class로 표현한다. 대화 API, focus와 메시지 흐름은 변경하지 않는다.

- [ ] **Step 5: 모바일 CSS 구현**

```css
@media (max-width: 640px) {
  .mobileSuppressed {
    display: none;
  }
}
```

공개 홈에서 guide는 chat 바로 위에 유지하되 guide trigger의 높이를 44px로 올린다. 두 버튼의 bottom 간격은 safe-area를 포함하고 서로 겹치지 않는다.

- [ ] **Step 6: 집중 검증**

Run: `npm test -- --runInBand src/shared/utils/floatingUi.test.ts src/app/_components/chat/ChatWidget.test.tsx src/app/_components/popup/SiteGuideManager.test.tsx`

Expected: 경로별 숨김, 모바일 suppression, 기존 chat ARIA·focus·API 테스트가 PASS.

---

### Task 8: 공개 화면 접근성·카피·성능 마감

**Impeccable phase:** `$impeccable audit`

**Files:**
- Modify: `src/app/events/_components/EventList.tsx`
- Modify: `src/app/events/_components/EventList.test.tsx`
- Modify: `src/app/events/_components/EventList.module.css`
- Modify: `src/app/products/_components/ProductReviews.module.css`
- Modify: `src/app/admin/dashboard/products/_components/EditProductForm.module.css`
- Modify: `src/app/admin/_components/Chart.module.css`
- Create: `src/app/design-system-quality.test.ts`
- Verify: `src/app/_components/MainBanner.tsx`
- Verify: `src/app/_components/MainBanner.test.tsx`

**Interfaces:**
- Error state: `role="alert"`
- Loading state: `role="status" aria-live="polite"`
- Public interactive minimum: 44px
- Layout property transition count in approved files: 0

- [ ] **Step 1: 이벤트 오류와 44px 실패 테스트 작성**

```tsx
test('announces event loading failures and exposes retry', () => {
  useEvent.mockReturnValue({
    events: [],
    filteredEvents: [],
    filter: {},
    currentPage: 1,
    eventsPerPage: 8,
    loading: false,
    error: '이벤트 조회 실패',
    setFilter: jest.fn(),
    setCurrentPage: jest.fn(),
    refreshEvents: jest.fn(),
  });

  render(<EventList />);
  expect(screen.getByRole('alert')).toHaveTextContent('이벤트 정보를 불러오지 못했습니다.');
  expect(screen.getByRole('button', { name: '다시 시도' })).toBeInTheDocument();
});
```

`EventList-css.test.ts`에는 `.filterButton`과 `.pageButton`의 `min-height: 44px` 단언을 추가한다.

- [ ] **Step 2: layout transition 실패 테스트 작성**

```ts
test.each([
  'src/app/admin/dashboard/products/_components/EditProductForm.module.css',
  'src/app/admin/_components/Chart.module.css',
  'src/app/products/_components/ProductReviews.module.css',
])('%s does not animate layout width', (file) => {
  const source = readFileSync(resolve(process.cwd(), file), 'utf8');
  expect(source).not.toMatch(/transition\s*:[^;]*\bwidth\b/);
});
```

- [ ] **Step 3: 관련 테스트를 실행해 실패 확인**

Run: `npm test -- --runInBand src/app/events/_components/EventList.test.tsx src/app/events/_components/EventList-css.test.ts src/app/design-system-quality.test.ts src/app/_components/MainBanner.test.tsx`

Expected: EventList error에 alert가 없고 세 CSS에 width transition이 있어 FAIL. MainBanner의 priority 1장 테스트는 기존 상태에서 PASS해야 한다.

- [ ] **Step 4: 접근성·touch target 최소 구현**

EventList error panel에 `role="alert"`를 추가하고 filter·pagination controls에 최소 44px 높이를 적용한다. 색상만으로 active 상태를 전달하지 않고 기존 `aria-pressed`, `aria-current`를 유지한다.

- [ ] **Step 5: layout transition 제거**

세 CSS 파일의 `transition: width`를 제거한다. 현재 width 계산과 최종 시각 값은 유지하고 새 애니메이션을 추가하지 않는다.

- [ ] **Step 6: LCP 기존 계약 확인**

`MainBanner.test.tsx`의 “첫 LCP 후보 한 장만 priority” 테스트를 유지한다. 브라우저에서 초기 홈 로드 시 동일 이미지에 LCP warning이 재현되지 않는 것을 완료 조건으로 사용한다. 비활성 배너에 priority를 추가하지 않는다.

- [ ] **Step 7: 집중 검증**

Run: `npm test -- --runInBand src/app/events/_components/EventList.test.tsx src/app/events/_components/EventList-css.test.ts src/app/design-system-quality.test.ts src/app/_components/MainBanner.test.tsx`

Expected: alert, 44px, width transition 0건과 priority 1장 계약이 PASS.

---

### Task 9: 인증·마이페이지 디자인 문법 통일

**Impeccable phase:** `$impeccable polish`

**Files:**
- Modify: `src/app/auth/find-password/page.module.css`
- Modify: `src/app/auth/reset-password/page.module.css`
- Modify: `src/app/auth/signup/page.module.css`
- Modify: `src/app/mypage/info-edit/page.module.css`
- Modify: `src/app/mypage/coupons/page.module.css`
- Modify: `src/app/mypage/order-detail/[orderId]/page.module.css`
- Modify: `src/app/mypage/order-list/page.module.css`
- Modify: `src/app/mypage/point/page.module.css`
- Modify: `src/app/mypage/qa/page.module.css`
- Modify: `src/app/design-system-quality.test.ts`
- Modify: `docs/auth-ui.md`
- Modify: `docs/mypage-ui.md`

**Interfaces:**
- Public storefront tokens are the authority.
- Gradient text and bounce animation count in listed files: 0.
- Decorative grid background count in `mypage/info-edit`: 0.
- Semantic success·warning·error meaning remains textually labeled.

- [ ] **Step 1: 승인된 금지 패턴 실패 테스트 추가**

```ts
const secondarySurfaceFiles = [
  'src/app/auth/find-password/page.module.css',
  'src/app/auth/reset-password/page.module.css',
  'src/app/auth/signup/page.module.css',
  'src/app/mypage/info-edit/page.module.css',
];

test.each(secondarySurfaceFiles)('%s uses the storefront visual language', (file) => {
  const source = readFileSync(resolve(process.cwd(), file), 'utf8');
  expect(source).not.toMatch(/background-clip\s*:\s*text/);
  expect(source).not.toMatch(/animation\s*:[^;]*\bbounce\b/);
});

test('mypage info edit does not use a decorative tiled grid', () => {
  const source = readFileSync(
    resolve(process.cwd(), 'src/app/mypage/info-edit/page.module.css'),
    'utf8',
  );
  expect(source).not.toMatch(/repeating-linear-gradient|background-size\s*:\s*\d+px\s+\d+px/);
});
```

- [ ] **Step 2: 품질 테스트를 실행해 실패 확인**

Run: `npm test -- --runInBand src/app/design-system-quality.test.ts src/app/auth src/app/mypage`

Expected: gradient text, bounce와 grid background 단언이 FAIL하고 기존 기능 테스트는 PASS.

- [ ] **Step 3: 인증 화면 CSS 통일**

find-password, reset-password와 signup 제목은 `color: var(--black)` 단색으로 변경한다. bounce는 제거하고 상태 피드백은 opacity 또는 즉시 표시로 바꾼다. 기존 폼 너비, label, focus와 오류 문구는 유지한다.

- [ ] **Step 4: 마이페이지 CSS 통일**

info-edit의 장식 grid를 밝은 단색 표면으로 교체한다. coupons, order-detail, order-list와 qa의 두꺼운 상단 accent는 얇은 `1px solid var(--color-border)` 구분선으로 바꾼다. point의 의미 없는 측면 accent는 제거하고 상태 제목·값·설명으로 의미를 유지한다.

- [ ] **Step 5: 브라우저 상태 목록 확인**

일반 회원 데모 로그인으로 마이페이지, 정보 수정, 쿠폰, 주문 목록, 포인트와 Q&A를 확인한다. 빈 상태, loading, 긴 주문 번호와 긴 사용자 이름에서도 overflow가 없어야 한다.

- [ ] **Step 6: 집중 검증과 문서 갱신**

Run: `npm test -- --runInBand src/app/design-system-quality.test.ts src/app/auth src/app/mypage`

Expected: 승인된 장식 패턴 0건, 기존 인증·마이페이지 기능 테스트 PASS.

---

### Task 10: 관리자·지원 화면 디자인 문법 통일

**Impeccable phase:** `$impeccable polish`

**Files:**
- Modify: `src/app/admin/categories/page.module.css`
- Modify: `src/app/admin/dashboard/orders/page.module.css`
- Modify: `src/app/admin/dashboard/users/page.module.css`
- Modify: `src/app/admin/events/_components/EventForm.module.css`
- Modify: `src/app/admin/inquiries/page.module.css`
- Modify: `src/app/admin/page.module.css`
- Modify: `src/app/admin/qna/page.module.css`
- Modify: `src/app/admin/user-coupons/page.module.css`
- Modify: `src/app/admin/_components/ErrorBoundary.module.css`
- Modify: `src/app/admin/_components/LoadingSpinner.module.css`
- Modify: `src/app/qna/page.module.css`
- Modify: `src/app/qna/write/page.module.css`
- Modify: `src/app/qna/[id]/page.module.css`
- Modify: `src/app/support/offline/page.module.css`
- Modify: `src/app/design-system-quality.test.ts`
- Modify: `docs/admin-page-review.md`

**Interfaces:**
- Semantic error·warning·success 상태는 색상과 텍스트 label을 함께 유지한다.
- Decorative `border-left: 3px|4px solid <hex>` count in listed files: 0.
- Spinner용 border는 detector 오탐 대상에서 제외하며 기능을 유지한다.

- [ ] **Step 1: 장식 측면 accent 실패 테스트 작성**

```ts
const adminAndSupportFiles = [
  'src/app/admin/events/_components/EventForm.module.css',
  'src/app/admin/inquiries/page.module.css',
  'src/app/admin/page.module.css',
  'src/app/admin/qna/page.module.css',
  'src/app/admin/user-coupons/page.module.css',
  'src/app/qna/page.module.css',
  'src/app/qna/write/page.module.css',
  'src/app/qna/[id]/page.module.css',
  'src/app/support/offline/page.module.css',
];

test.each(adminAndSupportFiles)('%s has no decorative thick side accent', (file) => {
  const source = readFileSync(resolve(process.cwd(), file), 'utf8');
  expect(source).not.toMatch(/border-(left|right)\s*:\s*[34]px\s+solid\s+#[0-9a-f]{3,8}/i);
});
```

- [ ] **Step 2: 관리자·지원 테스트를 실행해 실패 확인**

Run: `npm test -- --runInBand src/app/design-system-quality.test.ts src/app/admin src/app/qna src/app/support`

Expected: 알려진 측면 accent에서 FAIL하고 기존 권한·폼·목록 테스트는 PASS.

- [ ] **Step 3: 관리자 화면 CSS 통일**

장식용 굵은 측면·상단 보더는 얇은 공용 border와 명시적 상태 label로 교체한다. 기존 테이블, 필터, pagination, error boundary와 loading spinner 동작은 유지한다. spinner 회전에 필요한 border 조합은 제거하지 않는다.

- [ ] **Step 4: Q&A·오프라인 지원 CSS 통일**

문의 공개·비밀·답변 상태는 텍스트 label과 기존 semantic color로 표현하고 굵은 측면 accent를 제거한다. 오프라인 매장 이미지의 장식 stripe는 제거하되 주소·운영시간·문의 정보 구조는 유지한다.

- [ ] **Step 5: 관리자 브라우저 검증**

관리자 데모 로그인으로 관리자 홈, 상품, 주문, 사용자, 이벤트, 문의와 쿠폰 화면을 확인한다. 표의 긴 값, 0건, loading, permission denied와 저장 오류 상태를 확인하고 공개 쇼핑 화면과 같은 글꼴·보더·CTA 위계를 사용해야 한다.

- [ ] **Step 6: 집중 검증과 문서 갱신**

Run: `npm test -- --runInBand src/app/design-system-quality.test.ts src/app/admin src/app/qna src/app/support`

Expected: 장식 side accent 0건, spinner 예외 유지, 기존 관리자 권한·폼·목록 테스트 PASS.

---

### Task 11: 전체 검증과 Impeccable 재평가

**Impeccable phase:** `$impeccable audit`, `$impeccable polish`, `$impeccable critique`

**Files:**
- Modify: `docs/design-system-qa.md`
- Modify: `docs/quality-gates.md`
- Modify: `docs/superpowers/specs/2026-07-27-shopping-first-hybrid-ui-design.md` only when implemented behavior differs from the approved wording
- Write: `.impeccable/critique/<timestamp>__src-app.md` through the Impeccable storage helper

- [ ] **Step 1: 변경 범위 집중 테스트**

Run:

```powershell
npm test -- --runInBand `
  src/app/auth/login/page.test.tsx `
  src/app/_components/AsyncStatePanel.test.tsx `
  src/app/_components/FeaturedProducts.test.tsx `
  src/app/_components/ProductSection.test.tsx `
  src/app/products/_components/ProductList.test.tsx `
  src/app/orders/cart/page.test.tsx `
  src/app/_components/header/navigation.test.ts `
  src/app/_components/header/Header.test.tsx `
  src/app/_components/PortfolioDemoSection.test.tsx `
  src/app/_components/popup/SiteGuideManager.test.tsx `
  src/app/_components/chat/ChatWidget.test.tsx `
  src/app/events/_components/EventList.test.tsx `
  src/app/design-system-quality.test.ts
```

Expected: 모든 집중 테스트 PASS.

- [ ] **Step 2: 타입·린트·전체 Jest 검증**

Run: `npm run typecheck`

Expected: exit code 0.

Run: `npm run lint -- --max-warnings=0`

Expected: exit code 0, warning 0.

Run: `npm test -- --runInBand`

Expected: 전체 Jest PASS.

- [ ] **Step 3: production build**

Run: `npm run build`

Expected: App Router build, metadata와 dynamic route 생성 PASS. Firebase 네트워크 오류를 404로 오인하지 않는다.

- [ ] **Step 4: 데모 로그인 flag 브라우저 검증**

`NEXT_PUBLIC_ENABLE_DEMO_LOGIN=true`로 리뷰 서버를 실행하고 일반 회원·관리자 빠른 로그인을 각각 확인한다. flag를 `false`로 바꾼 별도 실행에서는 두 버튼이 보이지 않아야 하며 이메일·비밀번호 로그인은 유지돼야 한다.

- [ ] **Step 5: 세 뷰포트 전체 경로 브라우저 검증**

뷰포트:
- `390×844`
- `768×1024`
- `1440×900`

경로:
- `/`
- `/products`
- `/search`
- 실제 `/products/[productId]`
- `/events`
- `/auth/login`
- `/orders/cart`
- `/mypage`
- `/admin`

확인 항목:
- 헤더 다섯 그룹과 모바일 disclosure
- loading·error·empty·permission 상태
- 로그인 후 `/orders/cart` 복귀
- 챗봇·쇼핑 가이드·필터·고정 구매 CTA 충돌 없음
- 44px touch target, 키보드 focus, Escape와 focus 복귀
- 가로 overflow·한글 깨짐 없음
- Firebase permission 오류와 LCP warning 없음

- [ ] **Step 6: Impeccable detector 1회 실행**

Run: `node C:\Users\박도영\.agents\skills\impeccable\scripts\detect.mjs --json src/app`

Expected: `broken-image` 테스트 mock 오탐은 별도로 분류하고, 실제 production 파일의 `layout-transition`, gradient text, bounce, decorative side accent는 0건. detector는 이 단계에서 한 번만 실행한다.

- [ ] **Step 7: Impeccable 전체 비평 재실행**

Assessment A와 B를 독립 서브 에이전트로 실행해 새 점수와 P0·P1을 저장한다.

Acceptance:
- P0 0건
- 기존 P1 3건 해결
- 새 P1 0건
- 점수가 기존 `25/40`보다 상승

- [ ] **Step 8: QA 문서 갱신**

`docs/design-system-qa.md`에 세 뷰포트와 역할별 로그인 결과를 기록한다. `docs/quality-gates.md`에 detector 1회와 Impeccable 재평가 순서를 추가한다. 실패하거나 확인하지 못한 항목은 원인과 남은 위험을 구분해 기록한다.

---

## Plan Self-Review

- Task 1이 세 로그인 경로와 환경변수 조건을 소유한다.
- Task 2~4가 비동기 상태, 상품 데이터 P1과 장바구니 P1을 해결한다.
- Task 5~7이 내비게이션, 홈 압축과 모바일 챗봇 P1을 해결한다.
- Task 8이 공개 화면 접근성·성능 P2를 해결한다.
- Task 9~10이 인증·마이페이지·관리자·지원 화면의 디자인 편차를 해결한다.
- Task 11이 자동 검증, 세 뷰포트, detector와 `25/40` 재평가를 완료한다.
- Firebase 데이터 구조·권한 완화·신규 기능·새 의존성·커밋 단계는 포함하지 않는다.
