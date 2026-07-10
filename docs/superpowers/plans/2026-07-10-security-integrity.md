# Security Integrity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 주문 재고와 쿠폰·QnA·이벤트 권한 경계를 서버 검증과 규칙 테스트로 안전하게 만든다.

**Architecture:** 주문 도메인에는 상품별 수량 집계와 주문 가능 옵션 검증을 추가하고, 핸들러는 옵션별 주문 행을 유지하면서 상품별 재고 변경만 수행한다. 이벤트 참여와 쿠폰 보상은 Function transaction으로 합치며, Firestore 규칙은 클라이언트 직접 쓰기를 최소화한다.

**Tech Stack:** Next.js 15, TypeScript, Firebase Functions v2, Firestore, Jest, Firebase Emulator.

## Global Constraints

- 기존 사용자 변경사항과 메인 배너 파일을 되돌리거나 수정하지 않는다.
- 실제 결제는 연동하지 않고 다음 단계에서 가상 주문 데모임을 명시한다.
- 모든 새 동작은 테스트를 먼저 작성하고 실패를 확인한 뒤 구현한다.
- 관리자 판정은 Firebase Custom Claim만 사용한다.
- Function의 Admin SDK 쓰기는 transaction에서 수행하고 클라이언트는 직접 쓰지 않는다.
- 커밋·푸시·배포는 하지 않는다.

---

### Task 1: 상품별 재고 집계와 주문 가능 상품 검증

**Files:**
- Modify: `functions/src/domain/orderDomain.ts`
- Modify: `functions/src/handlers/order.ts`
- Modify: `functions/__tests__/orderDomain.test.ts`
- Modify: `functions/__tests__/httpHandlers.test.ts`

**Interfaces:**
- Produces: `aggregateProductQuantities(items): Array<{ productId: string; quantity: number }>`
- Produces: `assertOrderableProductOption(productData, item): void`

- [ ] Write failing domain tests for `p1/M x2 + p1/L x3 => p1 x5`, inactive/draft rejection, declared size/color rejection, and legacy empty option arrays.
- [ ] Run `npm test -- functions/__tests__/orderDomain.test.ts` and confirm the new tests fail because helpers are absent.
- [ ] Implement the two pure domain helpers. Preserve option-level order rows and treat a missing status or empty option arrays as legacy-compatible.
- [ ] Run the domain test and confirm it passes.
- [ ] Write failing handler tests that assert one `stock: 5` update for a `p1/M x2 + p1/L x3` order with stock 10, reject stock 4, and restore a single `increment(5)` when cancelling that order.
- [ ] Run `npm test -- functions/__tests__/httpHandlers.test.ts` and confirm the order cases fail.
- [ ] Replace per-option stock mutations with a product-ID aggregation map in create and cancel transactions. Validate active status and options before adding order writes.
- [ ] Run both focused test files and confirm all pass.

### Task 2: 쿠폰 발급과 이벤트 참여를 서버 transaction으로 통합

**Files:**
- Modify: `functions/src/handlers/coupon.ts`
- Create: `functions/src/domain/couponIssuance.ts`
- Create: `functions/src/handlers/event.ts`
- Modify: `functions/src/index.ts`
- Modify: `firebase.json`
- Create: `src/app/api/event/participate/route.ts`
- Modify: `src/shared/services/eventService.ts`
- Modify: `src/app/events/[eventId]/EventDetailClient.tsx`
- Modify: `src/shared/types/event.ts`
- Modify: `functions/__tests__/httpHandlers.test.ts`

**Interfaces:**
- Produces: `issueUserCouponInTransaction(transaction, db, input)` shared by coupon and event handlers.
- Produces: `POST /api/event/participate/` accepting only `{ eventId: string }`.

- [ ] Write failing handler tests that make an authenticated non-admin `action: "issue"` return 403.
- [ ] Write failing event tests for a valid event issuing exactly one participant, one participant-count increment, and one user coupon; assert a repeated request is idempotent.
- [ ] Run `npm test -- functions/__tests__/httpHandlers.test.ts` and confirm the added cases fail.
- [ ] Extract coupon issuance validation/write logic into `couponIssuance.ts`; restrict `issue` to `requireAdmin`; keep code registration behavior unchanged.
- [ ] Add the event Function transaction: read event and deterministic participation doc, validate active date/capacity, create the participant, increment count, and issue `rewardCouponId` when configured.
- [ ] Export the Function, add the Hosting rewrite and Next proxy, then change the client service to send only `eventId`.
- [ ] Run the focused handler and event UI tests; confirm success and repeat participation behavior.

### Task 3: QnA secret access and write-field authorization

**Files:**
- Modify: `firestore.rules`
- Modify: `functions/src/handlers/qna.ts`
- Modify: `src/shared/services/qnaService.ts`
- Modify: `src/app/qna/[id]/page.tsx`
- Modify: `src/app/qna/write/page.tsx`
- Modify: `functions/__tests__/qnaDomain.test.ts`
- Create: `functions/__tests__/firestoreRules.test.ts`

**Interfaces:**
- Produces: owner/admin-only secret QnA read behavior without a password verification route.
- Produces: owner updates limited to title, content, category, images, secret fields, notification flag, and updated timestamp.

- [ ] Write failing QnA tests showing password verification is no longer available to a non-owner and that safe QnA data never exposes secret material.
- [ ] Add failing Firestore rules tests: owner cannot update `answer`, `status`, `views`, `userId`, or `createdAt`; owner can edit permitted content; admin can answer; other users are denied.
- [ ] Run the focused tests with the Emulator command and confirm the new authorization cases fail under current rules.
- [ ] Remove the password verification client path and require owner/admin identity in the Function. Tighten QnA create/update rules with allowed keys and immutable server-owned fields.
- [ ] Run focused QnA and rule tests and confirm all pass.

### Task 4: Rules-test harness and policy documentation

**Files:**
- Modify: `functions/package.json`
- Modify: `package.json`
- Modify: `jest.config.js`
- Modify: `docs/security-admin-permission.md`
- Modify: `docs/coupon-system.md`
- Modify: `docs/qna-secret-password.md`
- Modify: `docs/order-serverization.md`

**Interfaces:**
- Produces: an Emulator-only rules test command used independently from ordinary unit tests.

- [ ] Add `@firebase/rules-unit-testing` and an Emulator execution script that loads the repository Firestore rules.
- [ ] Add rule cases for coupon/user-coupon/event/eventParticipants client writes being denied and the QnA matrix from Task 3.
- [ ] Run the Emulator test command and verify the full owner/admin/anonymous matrix passes.
- [ ] Update the four short policy documents with the changed trust boundaries, test command, and no-password secret-QnA policy.
- [ ] Run `npm run typecheck`, `npm run lint -- --max-warnings=0`, `npm test`, and `npm run functions:build`.
