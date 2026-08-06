# 1:1 문의 비로그인 안내 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 비로그인 방문자에게 1:1 문의 로그인 필요 안내와 복귀 가능한 로그인 CTA를 제공한다.

**Architecture:** `/cs/inquiry/` 페이지가 `useAuth()`의 인증 로딩 상태를 먼저 구분하고, 비로그인일 때만 전용 안내 패널을 렌더링한다. 로그인 링크는 기존 로그인 페이지의 `getSafeRedirectTarget` 처리와 호환되는 상대 경로 쿼리를 사용하며, 로그인 사용자용 문의 작성·목록 로직은 바꾸지 않는다.

**Tech Stack:** Next.js App Router, React 19, TypeScript, CSS Modules, Jest, Testing Library

## Global Constraints

- 로그인 링크는 정확히 `/auth/login?redirect=/cs/inquiry`를 사용한다.
- 인증 확인 중에는 비로그인 안내를 노출하지 않고 `로그인 상태를 확인하고 있습니다.` 상태만 표시한다.
- 기존 문의 작성·문의 내역 탭과 Firebase 조회·읽음 처리 로직을 변경하지 않는다.
- 신규 UI에 그림자, 아이콘, 장식성 일러스트, 과도한 둥근 모서리를 추가하지 않는다.
- CTA는 실제 링크이고 모든 화면에서 최소 44px 높이를 유지한다.
- 기존 검정 버튼·얇은 보더·표면 색상 토큰을 재사용하며, 모바일 480px 이하에서는 CTA를 전체 폭으로 표시한다.

## 파일 구조

- 수정: `src/app/cs/inquiry/page.tsx` — 인증 로딩·비로그인 안내 상태와 로그인 복귀 링크 렌더링
- 수정: `src/app/cs/inquiry/page.module.css` — 전용 안내 패널, CTA, 반응형 레이아웃
- 수정: `src/app/cs/inquiry/page.test.tsx` — 인증 로딩과 비로그인 안내의 렌더링·링크 계약 검증
- 수정: `docs/README.md` — 구현 계획 허브 항목 추가

---

### Task 1: 비로그인 안내 상태와 로그인 복귀 동작

**Files:**
- Modify: `src/app/cs/inquiry/page.test.tsx:25-40, 61-74`
- Modify: `src/app/cs/inquiry/page.tsx:3-25, 260-268`

**Interfaces:**
- Consumes: `useAuth(): { user, loading, userData, isUserDataLoading }` from `src/context/authProvider.tsx`
- Consumes: existing login-page safe redirect behavior for `redirect=/cs/inquiry`
- Produces: unauthenticated UI with `role="status"` during auth loading, a single `h1`, and a link named `로그인하고 문의하기`

- [ ] **Step 1: Add the failing guest-state component tests**

  Update `mockAuth()` so its default mock includes `loading: false`. Add the following tests before the existing authenticated inquiry tests:

  ```tsx
  test('shows an authentication-check status before the auth state resolves', () => {
    mockAuth({ user: null, loading: true, isUserDataLoading: true, userData: null });

    render(<InquiryPage />);

    expect(screen.getByRole('status')).toHaveTextContent('로그인 상태를 확인하고 있습니다.');
    expect(screen.queryByRole('heading', { name: '로그인 후 1:1 문의를 남길 수 있어요' }))
      .not.toBeInTheDocument();
  });

  test('guides a signed-out visitor to login and preserves the inquiry return path', () => {
    mockAuth({ user: null, loading: false, isUserDataLoading: false, userData: null });

    render(<InquiryPage />);

    expect(screen.getByRole('heading', { name: '로그인 후 1:1 문의를 남길 수 있어요' }))
      .toBeInTheDocument();
    expect(screen.getByText('문의 작성과 답변 확인은 로그인한 회원만 이용할 수 있습니다.'))
      .toBeInTheDocument();
    expect(screen.getByRole('link', { name: '로그인하고 문의하기' }))
      .toHaveAttribute('href', '/auth/login?redirect=/cs/inquiry');
    expect(screen.getByRole('link', { name: '로그인하고 문의하기' }))
      .toHaveClass('loginButton');
    expect(screen.getByRole('heading', { name: '로그인 후 1:1 문의를 남길 수 있어요' })
      .closest('section'))
      .toHaveClass('loginRequired');
    expect(screen.queryByRole('button', { name: '문의 등록' })).not.toBeInTheDocument();
  });
  ```

- [ ] **Step 2: Run the focused tests and verify they fail**

  Run: `npx jest src/app/cs/inquiry/page.test.tsx --runInBand`

  Expected: FAIL because the existing page immediately renders a text-only `formNote` for `!user`, lacks `loading` handling, heading, and login link.

- [ ] **Step 3: Implement the minimal authentication-state branches**

  In `page.tsx`, import `Link` from `next/link`, alias `loading` from `useAuth()` to `isAuthLoading`, and insert these branches before the existing `if (!user)` branch:

  ```tsx
  if (isAuthLoading) {
    return (
      <div className={`${styles.inquiryContainer} ${styles.authPending}`} role="status">
        로그인 상태를 확인하고 있습니다.
      </div>
    );
  }

  if (!user) {
    return (
      <div className={`${styles.inquiryContainer} ${styles.guestContainer}`}>
        <section className={styles.loginRequired} aria-labelledby="inquiry-login-title">
          <span className={styles.loginEyebrow}>1:1 INQUIRY</span>
          <h1 id="inquiry-login-title">로그인 후 1:1 문의를 남길 수 있어요</h1>
          <p>문의 작성과 답변 확인은 로그인한 회원만 이용할 수 있습니다.</p>
          <Link href="/auth/login?redirect=/cs/inquiry" className={styles.loginButton}>
            로그인하고 문의하기
          </Link>
          <span className={styles.loginHint}>
            로그인 후 현재 페이지로 돌아와 문의를 바로 작성할 수 있습니다.
          </span>
        </section>
      </div>
    );
  }
  ```

  Keep all existing authenticated tab, form, list, and Firestore effects below this guard unchanged.

- [ ] **Step 4: Run the focused tests and verify they pass**

  Run: `npx jest src/app/cs/inquiry/page.test.tsx --runInBand`

  Expected: PASS, including the new auth-loading and signed-out return-path tests plus existing inquiry behavior tests.

### Task 2: 안내 패널 반응형 스타일과 품질 확인

**Files:**
- Modify: `src/app/cs/inquiry/page.module.css:after .inquiryContainer overrides`
- Modify: `docs/README.md`

**Interfaces:**
- Consumes: `guestContainer`, `authPending`, `loginRequired`, `loginEyebrow`, `loginButton`, and `loginHint` class names rendered by Task 1
- Produces: 520px-centered desktop panel, full-width mobile CTA, 44px touch target, and visible keyboard focus treatment

- [ ] **Step 1: Run the structural regression test before styling**

  Run: `npx jest src/app/cs/inquiry/page.test.tsx --runInBand`

  Expected: PASS. The Task 1 class-contract assertions protect the panel and CTA hooks while CSS is added.

- [ ] **Step 2: Add scoped CSS Module rules for the guest and pending states**

  Add the following behavior to `page.module.css` without changing the existing authenticated form, tab, or inquiry-list selectors:

  ```css
  .guestContainer,
  .authPending {
    display: grid;
    min-height: 360px;
    place-items: center;
  }

  .authPending {
    color: var(--text-subtle);
    font-size: 0.9rem;
  }

  .loginRequired {
    display: grid;
    width: min(100%, 520px);
    gap: 0.75rem;
    padding: 2.5rem 2rem;
    border: 1px solid var(--line);
    background: var(--surface-raised);
    text-align: center;
  }

  .loginButton {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 44px;
    margin: 1rem auto 0;
    padding: 0.8rem 1.3rem;
    border: 1px solid var(--black);
    background: var(--black);
    color: var(--surface-raised);
    font-weight: 600;
    text-decoration: none;
  }

  .loginButton:focus-visible {
    outline: 2px solid var(--black);
    outline-offset: 3px;
  }

  @media (max-width: 480px) {
    .guestContainer,
    .authPending {
      min-height: 300px;
    }

    .loginRequired {
      padding: 2.25rem 1.25rem;
    }

    .loginButton {
      width: 100%;
    }
  }
  ```

  Complete the visual hierarchy with scoped rules for the eyebrow, heading, body copy, and hint using existing `--black`, `--text-soft`, and `--text-subtle` tokens. Do not add `box-shadow`, a new icon, or a border radius.

- [ ] **Step 3: Add the implementation-plan entry to the documentation hub**

  Add this single entry near the matching design specification in `docs/README.md`:

  ```markdown
  - 1:1 문의 비로그인 안내 실행 계획 : superpowers/plans/2026-08-06-inquiry-login-gate.md
  ```

- [ ] **Step 4: Run focused automated verification**

  Run:

  ```bash
  npx jest src/app/cs/inquiry/page.test.tsx --runInBand
  npm run typecheck
  npm run lint -- --file src/app/cs/inquiry/page.tsx --file src/app/cs/inquiry/page.test.tsx
  ```

  Expected: all commands exit with code 0. If the scoped ESLint command is unsupported by the repository's Next.js ESLint setup, run `npx eslint src/app/cs/inquiry/page.tsx src/app/cs/inquiry/page.test.tsx` instead and record that substitution.

- [ ] **Step 5: Run manual desktop and mobile browser QA**

  In a signed-out browser session, open `/cs/inquiry/` and verify:

  1. At 1440px, the panel is centered in the existing inquiry content area; the heading, description, CTA, and hint read in that order.
  2. At 768px, the panel remains within the page gutter without horizontal overflow.
  3. At 480px and 375px, the CTA spans the available width, stays at least 44px tall, and all Korean copy wraps without clipping.
  4. Keyboard Tab visibly focuses `로그인하고 문의하기`, and Enter navigates to `/auth/login?redirect=/cs/inquiry`.
  5. Complete a valid login and confirm the login page returns to `/cs/inquiry/`, where the existing `문의하기` tab and form are shown.

- [ ] **Step 6: Commit the implementation**

  ```bash
  git add src/app/cs/inquiry/page.tsx src/app/cs/inquiry/page.module.css src/app/cs/inquiry/page.test.tsx docs/README.md
  git commit -m "1:1 문의 로그인 안내 추가"
  ```

## Self-Review

- Spec coverage: Task 1 covers the login return URL, auth loading guard, heading, CTA, and preservation of logged-in flows. Task 2 covers desktop/tablet/mobile geometry, 44px CTA, focus visibility, visual restrictions, browser verification, and documentation hub indexing.
- Placeholder scan: unfinished markers, deferred implementation, and undefined interface names are absent.
- Type consistency: `loading` is already part of `AuthContextType`; `isAuthLoading` is a local alias only. CSS class names referenced in Task 1 are defined in Task 2.
