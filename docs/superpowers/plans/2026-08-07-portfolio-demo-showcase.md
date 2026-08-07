# 포트폴리오 데모 쇼케이스 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 홈 최하단 포트폴리오 고지를 쇼핑몰형 쇼케이스 정보 구역으로 재구성한다.

**Architecture:** 기존 `PortfolioDemoSection`의 데이터 상수와 사이트 가이드 이벤트를 보존한다. JSX 안에서 세 개의 구현 범위 카드를 렌더링하고, CSS 모듈에서 데스크톱 3열·모바일 1열 그리드와 기존 토큰 기반 시각 위계를 제공한다.

**Tech Stack:** Next.js App Router, React, TypeScript, CSS Modules, Jest, Testing Library

## Global Constraints

- 포트폴리오 안내는 홈 최하단 `PortfolioDemoSection` 한 곳에만 유지한다.
- 실제 결제가 진행되지 않는다는 고지와 기존 정책 상수의 사실 관계를 바꾸지 않는다.
- `openSiteGuide`와 `구현 범위 자세히 보기` 버튼의 기존 이벤트 동작을 유지한다.
- 새 의존성, `box-shadow`, `border-radius`, 하드코딩 색상값을 추가하지 않는다.
- 데스크톱은 구현 범위를 3열로, 768px 이하 모바일은 1열로 배치하고 조작 버튼은 44px 이상을 유지한다.

---

### Task 1: 포트폴리오 쇼케이스 마크업과 테스트

**Files:**
- Modify: `src/app/_components/PortfolioDemoSection.test.tsx`
- Modify: `src/app/_components/PortfolioDemoSection.tsx`

**Interfaces:**
- Consumes: `SITE_INFO.demoNotice`, `buildDemoDataNotice()`, `formatSignupBenefit()`, `openSiteGuide()`
- Produces: 단일 `section[aria-labelledby="portfolio-demo-title"]` 안의 `portfolio-summary`와 `portfolio-capabilities` 정보 구조

- [ ] **Step 1: 쇼케이스 정보 구조를 검증하는 실패 테스트를 작성한다**

```tsx
expect(screen.getByRole('heading', {
  name: '포트폴리오로 구현한 쇼핑몰',
})).toBeInTheDocument();
expect(screen.getByRole('heading', { name: '쇼핑 경험' })).toBeInTheDocument();
expect(screen.getByRole('heading', { name: '운영 기능' })).toBeInTheDocument();
expect(screen.getByRole('heading', { name: '데모 환경' })).toBeInTheDocument();
expect(screen.getByText(SITE_INFO.demoNotice)).toBeInTheDocument();
expect(screen.getByText(buildDemoDataNotice())).toBeInTheDocument();
expect(screen.getByText(formatSignupBenefit())).toBeInTheDocument();
```

- [ ] **Step 2: 컴포넌트 테스트가 실패하는지 확인한다**

Run: `npm test -- --runTestsByPath src/app/_components/PortfolioDemoSection.test.tsx`

Expected: 새 제목과 세 구현 범위 제목을 찾지 못해 FAIL.

- [ ] **Step 3: 기존 데이터와 버튼 동작을 보존한 최소 JSX를 구현한다**

```tsx
<header className={styles.summary}>
  <p className={styles.eyebrow}>PORTFOLIO DEMO</p>
  <h2 id="portfolio-demo-title" className={styles.title}>
    포트폴리오로 구현한 쇼핑몰
  </h2>
  <p className={styles.intro}>
    상품 탐색부터 주문과 운영 화면까지 연결한 커머스 프로젝트입니다.
  </p>
</header>
<div className={styles.capabilities}>
  <article className={styles.capability}>
    <h3>쇼핑 경험</h3>
    <p>상품 탐색, 장바구니, 주문 흐름을 직접 확인할 수 있습니다.</p>
  </article>
  <article className={styles.capability}>
    <h3>운영 기능</h3>
    <p>관리자 화면에서 상품, 이벤트, 쿠폰 관리 기능을 확인할 수 있습니다.</p>
  </article>
  <article className={styles.capability}>
    <h3>데모 환경</h3>
    <p>{SITE_INFO.demoNotice}</p>
    <p>{buildDemoDataNotice()}</p>
    <p className={styles.benefit}>{formatSignupBenefit()}</p>
  </article>
</div>
```

- [ ] **Step 4: 컴포넌트 테스트를 통과시키고 가이드 이벤트를 재확인한다**

Run: `npm test -- --runTestsByPath src/app/_components/PortfolioDemoSection.test.tsx`

Expected: PASS. 단일 section, 정책 상수 노출, 버튼 클릭 뒤 `OPEN_SITE_GUIDE_EVENT` 한 번 발생을 확인한다.

### Task 2: 쇼케이스형 레이아웃과 반응형 CSS

**Files:**
- Modify: `src/app/_components/PortfolioDemoSection.module.css`
- Test: `src/app/_components/PortfolioDemoSection.test.tsx`

**Interfaces:**
- Consumes: Task 1의 `summary`, `intro`, `capabilities`, `capability` CSS class
- Produces: 3열 구현 범위 그리드와 768px 이하 1열 레이아웃

- [ ] **Step 1: 3열 그리드와 모바일 1열을 확인하는 정적 CSS 테스트를 추가한다**

```tsx
expect(css).toContain('grid-template-columns: repeat(3, minmax(0, 1fr))');
expect(css).toContain('@media (max-width: 768px)');
expect(css).toContain('grid-template-columns: 1fr');
expect(css).not.toMatch(/box-shadow|border-radius/);
expect(css).not.toMatch(/#[0-9a-f]{3,8}/i);
```

- [ ] **Step 2: 새 CSS 요구 사항이 없어 테스트가 실패하는지 확인한다**

Run: `npm test -- --runTestsByPath src/app/_components/PortfolioDemoSection.test.tsx`

Expected: 3열 그리드 선언을 찾지 못해 FAIL.

- [ ] **Step 3: 기존 토큰만 사용해 정보 단위를 분리하는 CSS를 구현한다**

```css
.capabilities {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin-top: 2rem;
  border-top: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
}

.capability {
  min-width: 0;
  padding: 1.25rem;
}

.capability + .capability {
  border-left: 1px solid var(--line);
}

@media (max-width: 768px) {
  .capabilities {
    grid-template-columns: 1fr;
  }

  .capability + .capability {
    border-top: 1px solid var(--line);
    border-left: 0;
  }
}
```

- [ ] **Step 4: 컴포넌트 테스트를 통과시킨다**

Run: `npm test -- --runTestsByPath src/app/_components/PortfolioDemoSection.test.tsx`

Expected: PASS. 기존 색상 토큰, 그림자·반경 금지, 3열·1열 반응형 선언을 모두 확인한다.

### Task 3: 문서 인덱스와 범위 검증

**Files:**
- Modify: `docs/README.md`
- Modify: `docs/superpowers/plans/2026-08-07-portfolio-demo-showcase.md`

**Interfaces:**
- Consumes: Task 1과 Task 2로 완성한 `PortfolioDemoSection`
- Produces: 문서 허브에서 찾을 수 있는 완료된 구현 계획과 검증 기록

- [ ] **Step 1: 계획 문서를 Docs Hub에 연결한다**

```markdown
- 포트폴리오 데모 쇼케이스 안내 구현 계획 : superpowers/plans/2026-08-07-portfolio-demo-showcase.md
```

- [ ] **Step 2: 수정 범위에 맞는 자동 검증을 실행한다**

Run: `npm test -- --runTestsByPath src/app/_components/PortfolioDemoSection.test.tsx src/app/page.test.tsx scripts/project-surface-audit.test.js`

Expected: PASS. 홈 하단 단일 포트폴리오 구역, 데모 정책 문구, 쇼케이스 컴포넌트 동작을 확인한다.

- [ ] **Step 3: 타입 검사와 린트를 실행한다**

Run: `npm run typecheck && npm run lint -- --max-warnings=0`

Expected: PASS.

- [ ] **Step 4: 변경된 UI 파일에 Impeccable detector를 한 번 실행한다**

Run: `node C:\\Users\\박도영\\.agents\\skills\\impeccable\\scripts\\detect.mjs --json src/app/_components/PortfolioDemoSection.tsx src/app/_components/PortfolioDemoSection.module.css`

Expected: 실제 디자인 결함이 없거나, 새로 만든 구조와 무관한 경고만 남는다.

- [ ] **Step 5: 데스크톱·모바일 브라우저 검증을 기록한다**

Run: `/` 경로를 1440px와 390px 너비에서 열어 제목, 3개 정보 단위, 1열 전환, 버튼 클릭 뒤 쇼핑 가이드 열림을 확인한다.

Expected: 데스크톱에서 3개 정보 단위가 한 행에 배치되고, 모바일에서 줄바꿈·가로 overflow 없이 한 열로 표시된다.
