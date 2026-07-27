# Shopping-first Hybrid UI P2 Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the five remaining P2 findings from the shopping-first hybrid UI.

**Architecture:** Fix shared causes at the narrowest correct layer: product-detail controls for touch targets, typed nested header navigation for SHOP IA, home/product presentation for metadata reduction, and shared tokens/state panels for contrast and recovery hierarchy. Preserve all auth and remote-data behavior.

**Tech Stack:** Next.js 15, React 19, TypeScript, CSS Modules, Jest, Testing Library.

## Global Constraints

- Preserve email/password login, normal quick login, and admin quick login.
- Quick login remains gated by `NEXT_PUBLIC_ENABLE_DEMO_LOGIN === "true"`.
- Do not add `box-shadow` or `border-radius` to new or modified UI.
- Preserve user changes and avoid unrelated refactors.
- Use UTF-8.
- Do not commit, push, or deploy.

---

### Task 1: Mobile product-detail hit areas

**Files:**
- Create: `src/app/products/_components/ProductDetail-css.test.ts`
- Modify: `src/app/products/_components/ProductDetail.module.css`
- Modify: `src/app/products/_components/ProductDetailClient.tsx`
- Test: `src/app/products/_components/ProductDetailClient.test.tsx`

**Interfaces:**
- Consumes: existing `ProductDetailClient` option and Q&A controls.
- Produces: minimum `44×44px` product-detail touch targets.

- [ ] Write CSS contract tests that fail unless `.sizeButton` has `min-width` and `min-height: 44px`, `.colorButton` has `width` and `height: 44px`, `.quantityButton` has `width` and `min-height: 44px`, `.tabHeader` has `min-height: 44px`, and `.inquiryButton` has `min-height: 44px`.
- [ ] Run `npm test -- --runInBand src/app/products/_components/ProductDetail-css.test.ts` and verify the expected failures.
- [ ] Add the minimum CSS declarations and attach `styles.inquiryButton` to the existing inquiry button without changing behavior.
- [ ] Run `npm test -- --runInBand src/app/products/_components/ProductDetail-css.test.ts src/app/products/_components/ProductDetailClient.test.tsx`.

### Task 2: Two-level SHOP disclosure

**Files:**
- Modify: `src/app/_components/header/navigation.ts`
- Modify: `src/app/_components/header/navigation.test.ts`
- Modify: `src/app/_components/header/Header.tsx`
- Modify: `src/app/_components/header/Header.module.css`
- Modify: `src/app/_components/header/Header.test.tsx`
- Modify: `docs/header-ui.md`

**Interfaces:**
- Consumes: active categories returned by `CategoryOrderService.getSortedCategories()`.
- Produces: six first-level SHOP destinations and nested dynamic category destinations.

- [ ] Add failing navigation and component tests for the six-item first level, nested categories, `/categories` hub preservation, no duplicate category hrefs, desktop two-stage Escape/focus return, and mobile close/reset behavior.
- [ ] Run `npm test -- --runInBand src/app/_components/header/navigation.test.ts src/app/_components/header/Header.test.tsx` and verify the expected failures.
- [ ] Extend the navigation model with a category disclosure node and render nested desktop/mobile category regions using existing visual tokens.
- [ ] Reset child disclosure state on parent close, navigation, viewport switch, and mobile menu close.
- [ ] Update `docs/header-ui.md` with the two-level SHOP contract.
- [ ] Re-run the two focused test files.

### Task 3: Product and home metadata distillation

**Files:**
- Modify: `src/app/_components/ProductSection.tsx`
- Modify: `src/app/_components/ProductSection.test.tsx`
- Modify: `src/app/products/_components/ProductList.tsx`
- Modify: `src/app/products/_components/ProductList.module.css`
- Modify: `src/app/products/_components/ProductList.test.tsx`
- Modify: `src/app/page.tsx`
- Modify: `src/app/page.module.css`
- Modify: `src/app/page.test.tsx`
- Modify: `docs/product-listing-structure.md`
- Modify: `docs/static-content.md`

**Interfaces:**
- Consumes: existing ProductCard new/sale badges and existing product result information.
- Produces: one status badge per meaning, no product statistics tiles, one portfolio explanation area.

- [ ] Add failing tests proving a new product receives only the ProductCard `isNew` state and no second `operationLabel="NEW"`, product-list stats are absent while result text remains, and home omits repeated eyebrow/service metadata while keeping `PortfolioDemoSection`.
- [ ] Run the three focused test files and verify the expected failures.
- [ ] Remove duplicate operation metadata, product statistics markup/styles, repeated home eyebrows, and the extra service information section/import.
- [ ] Update the two directly affected documents.
- [ ] Re-run the three focused test files.

### Task 4: Contrast, heading, and empty-state action hierarchy

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/app/globals-css.test.ts`
- Modify: `src/app/_components/AsyncStatePanel.tsx`
- Modify: `src/app/_components/AsyncStatePanel.module.css`
- Modify: `src/app/_components/AsyncStatePanel.test.tsx`
- Modify: `src/app/orders/cart/page.tsx`
- Modify: `src/app/orders/cart/page.test.tsx`
- Modify: `src/app/events/_components/EventList.tsx`
- Modify: `src/app/events/_components/EventList.module.css`
- Modify: `src/app/events/_components/EventList.test.tsx`
- Modify: `src/app/cs/faq/page.test.tsx`
- Modify: `docs/design-system-qa.md`

**Interfaces:**
- Produces: `AsyncStatePanelProps.headingLevel?: 'h1' | 'h2'`, defaulting to `h2`.
- Produces: distinct `.primaryAction` and `.secondaryAction` classes.
- Consumes: existing primary/secondary action declarations.

- [ ] Add failing tests for `--text-soft` contrast `>= 4.5:1`, selectable panel heading level, primary/secondary classes and order, signed-out cart page `h1`, a single FAQ `h1`, and actionable event empty states.
- [ ] Run the focused tests and verify the expected failures.
- [ ] Update the shared token, panel heading/action rendering, cart heading level, and event empty-state actions.
- [ ] Update `docs/design-system-qa.md`.
- [ ] Re-run the focused tests.

### Task 5: Integrated verification and Impeccable re-evaluation

**Files:**
- Modify: `docs/quality-gates.md`
- Create: `.impeccable/critique/<timestamp>__src-app.md`

**Interfaces:**
- Consumes: Tasks 1–4.
- Produces: final QA evidence and updated design-health score.

- [ ] Run focused tests for all changed surfaces.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm run lint -- --max-warnings=0`.
- [ ] Run `npm test -- --runInBand`.
- [ ] Run a production build using process-only dotenv preload without copying or printing `.env.local`.
- [ ] Inspect the seven representative surfaces at `390×844`, `768×1024`, and `1440×900` in one browser batch, then perform at most one fix/confirmation batch.
- [ ] Run the Impeccable critique workflow and persist a new snapshot.
- [ ] Record the final gates in `docs/quality-gates.md`.
