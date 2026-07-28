# 데스크톱 헤더 메뉴 구성 복원 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 현재 모바일·접근성 동작을 유지하면서 데스크톱 헤더 중앙 메뉴를 개편 이전의 기본 6개와 보조 5개 직접 링크 구성으로 복원한다.

**Architecture:** `navigation.ts`가 모바일 그룹과 별도로 데스크톱 기본·보조 링크 데이터를 생성한다. `Header.tsx`는 데스크톱에서 직접 링크 목록을 렌더링하고 모바일에서는 기존 그룹 disclosure를 계속 사용하며, `Header.module.css`가 1280px 이상에서만 보조 목록을 노출한다.

**Tech Stack:** Next.js 15, React 19, TypeScript, CSS Modules, Jest, Testing Library

## Global Constraints

- 기존 접근성, 모바일 dialog, focus trap, Escape 처리, pathname 변경 상태 초기화를 유지한다.
- 검색, 장바구니, 로그인·마이페이지, 관리자 메뉴의 위치와 동작을 유지한다.
- 새 `box-shadow`와 `border-radius`를 추가하지 않는다.
- 새 의존성을 추가하지 않는다.
- 관련 없는 파일과 사용자의 기존 변경사항을 수정하지 않는다.
- 커밋, 푸시, 배포를 실행하지 않는다.

---

### Task 1: 데스크톱 내비게이션 데이터 추가

**Files:**
- Modify: `src/app/_components/header/navigation.ts`
- Test: `src/app/_components/header/navigation.test.ts`

**Interfaces:**
- Consumes: `HeaderCategory`, `HeaderNavItem`
- Produces: `buildDesktopHeaderNav(categories: HeaderCategory[]): { primaryItems: HeaderNavItem[]; secondaryItems: HeaderNavItem[] }`

- [ ] **Step 1: 실패하는 데이터 테스트 작성**

`navigation.test.ts`에 활성 카테고리가 있을 때의 순서와 fallback을 검증한다.

```ts
test('builds the restored desktop primary and secondary destinations', () => {
  expect(buildDesktopHeaderNav([
    { id: 'bags', name: '가방', href: '/categories/bags' },
  ])).toEqual({
    primaryItems: [
      { label: '전체 상품', href: '/products' },
      { label: '신상', href: '/recommend?filter=new' },
      { label: '베스트', href: '/recommend?filter=review' },
      { label: '가방', href: '/categories/bags' },
      { label: '세일', href: '/main/sale' },
      { label: '브랜드', href: '/brand' },
    ],
    secondaryItems: [
      { label: '추천', href: '/recommend' },
      { label: '이벤트', href: '/events' },
      { label: '리뷰', href: '/reviews' },
      { label: '1:1문의', href: '/cs/inquiry' },
      { label: '상품문의', href: '/qna' },
    ],
  });
});

test('uses the category hub before an active category loads', () => {
  expect(buildDesktopHeaderNav([]).primaryItems[3]).toEqual({
    label: '카테고리',
    href: '/categories',
  });
});
```

- [ ] **Step 2: 데이터 테스트 실패 확인**

Run: `npm test -- --runTestsByPath src/app/_components/header/navigation.test.ts`

Expected: `buildDesktopHeaderNav` export가 없어 실패한다.

- [ ] **Step 3: 최소 데이터 생성 함수 구현**

기존 상수를 재사용해 데스크톱 목록을 추가한다.

```ts
export function buildDesktopHeaderNav(categories: HeaderCategory[]) {
  const featuredCategory = categories[0]
    ? { label: categories[0].name, href: categories[0].href }
    : { label: '카테고리', href: '/categories' };

  return {
    primaryItems: [
      ...SHOP_DESTINATIONS,
      SHOP_AFTER_CATEGORIES[0],
      SHOP_AFTER_CATEGORIES[1],
      featuredCategory,
      SHOP_AFTER_CATEGORIES[2],
      SHOP_AFTER_CATEGORIES[3],
    ],
    secondaryItems: [
      { label: '추천', href: '/recommend' },
      { label: '이벤트', href: '/events' },
      { label: '리뷰', href: '/reviews' },
      ...SUPPORT_DESTINATIONS.filter(({ href }) => href !== '/cs/faq'),
    ],
  };
}
```

- [ ] **Step 4: 데이터 테스트 통과 확인**

Run: `npm test -- --runTestsByPath src/app/_components/header/navigation.test.ts`

Expected: 모든 `navigation.test.ts` 테스트가 통과한다.

### Task 2: 데스크톱 직접 링크 렌더링과 반응형 스타일 복원

**Files:**
- Modify: `src/app/_components/header/Header.tsx`
- Modify: `src/app/_components/header/Header.module.css`
- Test: `src/app/_components/header/Header.test.tsx`
- Modify: `docs/header-ui.md`

**Interfaces:**
- Consumes: `buildDesktopHeaderNav(categories)`의 `primaryItems`, `secondaryItems`
- Preserves: `buildHeaderNavGroups(categories)` 기반 모바일 disclosure

- [ ] **Step 1: 실패하는 헤더 렌더링 테스트 작성**

헤더 테스트에 데스크톱 기본·보조 링크가 별도 목록으로 렌더링되고 모바일 그룹 trigger는 유지되는지 검증한다.

```ts
test('restores the desktop primary and secondary navigation links', async () => {
  jest.mocked(CategoryOrderService.getSortedCategories).mockResolvedValue([
    { id: 'bags', name: '가방' },
  ] as Awaited<ReturnType<typeof CategoryOrderService.getSortedCategories>>);

  render(<Header />);

  await waitFor(() => {
    const desktopNav = screen.getByRole('navigation', { name: 'Primary' });
    expect(within(desktopNav).getByRole('link', { name: '전체 상품' })).toBeInTheDocument();
    expect(within(desktopNav).getByRole('link', { name: '가방' })).toBeInTheDocument();
    expect(within(desktopNav).getByRole('link', { name: '상품문의' })).toBeInTheDocument();
    expect(within(desktopNav).queryByRole('button', { name: 'SHOP 메뉴 열기' })).not.toBeInTheDocument();
  });

  fireEvent.click(screen.getByRole('button', { name: '메뉴 열기' }));
  expect(screen.getByRole('button', { name: 'SHOP 메뉴 열기' })).toBeInTheDocument();
});
```

- [ ] **Step 2: 헤더 테스트 실패 확인**

Run: `npm test -- --runTestsByPath src/app/_components/header/Header.test.tsx`

Expected: 데스크톱 내비게이션이 아직 `SHOP` disclosure라서 직접 링크 assertion이 실패한다.

- [ ] **Step 3: 현재 접근성 상태를 유지하며 데스크톱 JSX 교체**

`Header.tsx`에서 `buildDesktopHeaderNav`를 호출하고 데스크톱 `<nav>`만 직접 링크로 바꾼다.

```tsx
const navGroups = buildHeaderNavGroups(categories);
const { primaryItems, secondaryItems } = buildDesktopHeaderNav(categories);

<nav className={styles.nav} aria-label="Primary" ...>
  <div className={styles.navList}>
    {primaryItems.map((item) => (
      <Link key={item.href} href={item.href} className={styles.navLink}>
        {item.label}
      </Link>
    ))}
  </div>
  <div className={styles.secondaryNav} aria-label="Quick links">
    <div className={styles.secondaryNavList}>
      {secondaryItems.map((item) => (
        <Link key={item.href} href={item.href} className={styles.secondaryLink}>
          {item.label}
        </Link>
      ))}
    </div>
  </div>
</nav>
```

데스크톱 disclosure 전용 state, refs, effect, toggle 함수만 제거한다. 모바일 `openMobileGroup`, `openMobileDisclosure`, focus trap, inert 처리와 pathname·viewport 초기화는 유지한다.

- [ ] **Step 4: 예전 반응형 스타일을 현재 CSS에 맞게 복원**

`Header.module.css`에 `.secondaryNav`, `.secondaryNavList`, `.secondaryLink`를 추가하고 `@media (min-width: 1280px)`에서 `.secondaryNav { display: flex; }`를 적용한다. `960px`~`1279px`에서는 기본 6개 링크만 현재 축소 폰트·간격으로 표시한다.

- [ ] **Step 5: 관련 문서 갱신**

`docs/header-ui.md`의 현재 기준과 2026-07-28 기록에 데스크톱 직접 링크 6개, 1280px 이상 보조 링크 5개, 모바일 공유 그룹 유지 내용을 기록한다.

- [ ] **Step 6: 관련 테스트와 타입 검사**

Run:

```powershell
npm test -- --runTestsByPath src/app/_components/header/navigation.test.ts src/app/_components/header/Header.test.tsx
npm run typecheck
```

Expected: 두 테스트 파일과 타입 검사가 모두 통과한다.

- [ ] **Step 7: 브라우저 확인**

개발 서버를 실행하고 `960px`, `1279px`, `1280px`, 현재 첨부 화면과 유사한 `1320px`, 모바일 폭에서 확인한다.

- `960px`~`1279px`: 기본 직접 링크 6개만 표시
- `1280px` 이상: 구분선과 보조 링크 5개 추가 표시
- 모바일: 기존 그룹 disclosure, Escape, 링크 선택 후 닫힘 유지
- 모든 폭: 가로 넘침과 메뉴 겹침 없음

- [ ] **Step 8: 변경 범위 확인**

Run:

```powershell
git diff --check
git diff -- src/app/_components/header/navigation.ts src/app/_components/header/navigation.test.ts src/app/_components/header/Header.tsx src/app/_components/header/Header.module.css src/app/_components/header/Header.test.tsx docs/header-ui.md
```

Expected: 공백 오류가 없고 승인된 헤더·문서 파일만 의도대로 변경된다.
