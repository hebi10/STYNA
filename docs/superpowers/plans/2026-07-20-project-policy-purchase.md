# 프로젝트 정책·구매 흐름 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 화면의 상거래 정책을 실제 서버 동작과 일치시키고, 이벤트 자격·로그인 의도 복원·쿠폰 날짜·주문 후 캐시 갱신을 신뢰 가능한 단일 흐름으로 완성한다.

**Architecture:** UI 정책은 타입이 있는 한 canonical 모듈에서 관리하고 Functions가 필요한 정책은 compare-only 생성 경계로 동기화한다. 이벤트 참여와 주문·쿠폰 상태 변경은 Functions transaction을 최종 권위로 유지하며, 클라이언트는 검증된 세션 의도와 공통 query key를 사용해 복귀·갱신만 담당한다. 날짜는 클라이언트와 Functions가 동일한 `Asia/Seoul` date-only 계약 테스트를 각각 통과해야 한다.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Firebase Auth/Firestore/Functions, TanStack React Query 5, Jest/Testing Library, PowerShell.

## Global Constraints

- 구현 순서는 실패 테스트 작성 → 실제 실패 확인 → 최소 구현 → focused 검증 → 독립 리뷰다.
- 의존성은 `Task 1 → Task 2`, `Task 4 → Task 5`, `Task 7 → Task 8`이다. Task 3과 Task 6은 독립이며 Task 9는 Task 1~8 이후 실행한다.
- 현재 dirty Task 6~8 파일과 사용자의 기존 변경을 보존한다. 특히 `scripts/sync-chat-responses.js`, `functions/src/chatResponses.ts`, `package*.json`, 보안·품질 문서를 덮어쓰거나 되돌리지 않는다.
- 코드와 UI에는 그림자와 큰 radius를 추가하지 않는다.
- 실제 PG 연동, 실제 결제, DB seed 실행, 이벤트 migration execute, 배포, 커밋, 푸시는 비범위다.
- `scripts/seed-coupons.js`와 이벤트 migration은 import만으로 Firebase·dotenv·Admin SDK·Firestore를 초기화하지 않는다.
- 주문·쿠폰·이벤트의 최종 금액, 자격, 상태, 보상은 서버가 결정한다. 클라이언트 계산은 미리보기와 선택 안내에만 사용한다.
- 쿠폰 만료일은 `Asia/Seoul` 달력 날짜의 마지막 순간까지 유효하다. `expiryDay < todayKstDay`일 때만 만료다.
- cron의 500-write batch 한도와 N+1 쿠폰 master 조회는 이번 필수 범위에서 변경하지 않고 Task 9 문서에 후속 위험으로만 기록한다.
- 전체 검증에서도 seed·migration execute·Firebase deploy 명령을 실행하지 않는다.

## File Responsibility Map

- `src/shared/constants/commercePolicy.ts`: UI와 생성 대상이 공유할 타입·정책 값·고지 문구의 canonical source.
- `scripts/sync-chat-responses.js`: policy/chat source를 Functions source로 명시적으로 생성하거나 compare-only 검증하는 유일한 경계.
- `scripts/coupon-seed-data.js`: 실행 시각을 주입받아 상대 날짜 seed payload를 만드는 순수 모듈.
- `scripts/event-eligibility-migration.js`: 기존 이벤트를 읽어 proposed patch와 수동 보정 목록만 출력하는 import-safe dry-run 도구.
- `functions/src/domain/purchaseEvidence.ts`: 주문 상태, 대상 상품·옵션, 구매 인증 review ID의 공통 계약.
- `functions/src/domain/eventEligibility.ts`: transaction 안에서 이벤트 자격에 필요한 읽기와 판정을 수행하는 서버 도메인.
- `src/shared/utils/safeRedirect.ts`: same-origin redirect 정규화.
- `src/shared/utils/productIntent.ts`: TTL이 있는 versioned one-shot 상품 의도 저장·소비.
- `src/shared/utils/kstDate.ts`, `functions/src/domain/kstDate.ts`: 각 런타임의 동일한 KST date-only 계약.
- `src/shared/hooks/useOrders.ts`, `src/shared/hooks/usePoint.ts`, `src/shared/hooks/useCart.ts`: query key와 서버 조회 캐시의 소유자.
- `src/shared/utils/postPurchaseSync.ts`: 주문 성공 후 여러 캐시·Context 갱신을 `Promise.allSettled`로 격리하는 helper.

## Dependency Order

1. Task 1 완료 후 Task 2를 시작한다.
2. Task 4 완료 후 Task 5를 시작한다.
3. Task 7 완료 후 Task 8을 시작한다.
4. Task 3과 Task 6은 위 체인과 병렬 실행할 수 있다.
5. Task 9는 Task 1~8의 focused 검증과 독립 리뷰가 모두 끝난 뒤 실행한다.

---

### Task 1: Canonical commerce policy와 Functions generated sync

**Files:**

- Create: `src/shared/constants/commercePolicy.ts`
- Create: `src/shared/constants/commercePolicy.test.ts`
- Create: `functions/src/commercePolicy.ts` (generated target)
- Modify: `src/shared/utils/chatResponses.ts`
- Modify: `functions/src/chatResponses.ts` (generated target)
- Modify: `functions/src/handlers/chat.ts`
- Modify: `scripts/sync-chat-responses.js`
- Modify: `scripts/sync-chat-responses.test.js`
- Modify: `package.json`

**Interfaces:**

- Produces: `COMMERCE_POLICY`, `formatSignupBenefit()`, `buildDemoDataNotice()`, `buildChatPolicyPrompt()`.
- Produces: `checkGeneratedCommerceSources()`와 `writeGeneratedCommerceSources()`; 기본 `sync:chat-responses`는 compare-only, `sync:chat-responses:write`만 파일을 쓴다.
- Task 2 consumes: `COMMERCE_POLICY`, `formatSignupBenefit()`, `buildDemoDataNotice()`.

- [ ] **Step 1: canonical 정책과 생성 경계의 실패 테스트를 작성한다**

```ts
import {
  COMMERCE_POLICY,
  buildChatPolicyPrompt,
  formatSignupBenefit,
} from './commercePolicy';

test('publishes only implemented commerce benefits', () => {
  expect(COMMERCE_POLICY.signupBonusPoints).toBe(5000);
  expect(COMMERCE_POLICY.shipping.standardFee).toBe(3000);
  expect(COMMERCE_POLICY.shipping.freeThreshold).toBe(50000);
  expect(formatSignupBenefit()).toContain('5,000P');
  expect(buildChatPolicyPrompt()).not.toMatch(/생일|등급별|구매.*1%|카카오페이|네이버페이|당일/);
});

test('states the demo and Firebase persistence boundary', () => {
  expect(COMMERCE_POLICY.demo.realPayment).toBe(false);
  expect(COMMERCE_POLICY.demo.dataStore).toBe('Firebase');
});
```

`scripts/sync-chat-responses.test.js`에는 다음을 추가한다.

```js
test('checks policy and chat targets without writing either file', () => {
  expect(() => checkGeneratedCommerceSources(paths)).not.toThrow();
  expect(fs.writeFileSync).not.toHaveBeenCalled();
});

test('rejects a stale generated policy target', () => {
  expect(() => checkGeneratedCommerceSources(stalePolicyPaths)).toThrow(/commerce policy/i);
});
```

- [ ] **Step 2: 실패를 확인한다**

Run:

```powershell
npx jest --runInBand --no-cache --runTestsByPath src/shared/constants/commercePolicy.test.ts scripts/sync-chat-responses.test.js
```

Expected: `commercePolicy.ts`와 새 sync API가 없어 FAIL한다.

- [ ] **Step 3: canonical 정책 모듈을 최소 구현한다**

```ts
export interface CommercePolicy {
  signupBonusPoints: 5000;
  shipping: {
    standardFee: 3000;
    freeThreshold: 50000;
    promisedDispatch: false;
  };
  demo: {
    realPayment: false;
    dataStore: 'Firebase';
  };
}

export const COMMERCE_POLICY = {
  signupBonusPoints: 5000,
  shipping: {
    standardFee: 3000,
    freeThreshold: 50000,
    promisedDispatch: false,
  },
  demo: {
    realPayment: false,
    dataStore: 'Firebase',
  },
} as const satisfies CommercePolicy;

export function formatSignupBenefit(): string {
  return `회원가입 완료 시 ${COMMERCE_POLICY.signupBonusPoints.toLocaleString('ko-KR')}P`;
}

export function buildDemoDataNotice(): string {
  return '포트폴리오 데모로 실제 결제는 진행되지 않으며 입력한 정보와 주문 기록은 Firebase에 저장될 수 있습니다.';
}
```

`buildChatPolicyPrompt()`는 일반 배송비·무료 기준, 실제 결제 없음, Firebase 저장 가능성, 구현된 5,000P만 포함한다. 생일·등급·구매 적립·간편결제·당일 출고는 문자열에 포함하지 않는다.

- [ ] **Step 4: Functions 생성 경계를 최소 구현한다**

`scripts/sync-chat-responses.js`는 두 source/target 쌍을 한 번에 검증한다.

```js
const generatedTargets = [
  {
    source: 'src/shared/constants/commercePolicy.ts',
    target: 'functions/src/commercePolicy.ts',
    transform: buildGeneratedCommercePolicy,
  },
  {
    source: 'src/shared/utils/chatResponses.ts',
    target: 'functions/src/chatResponses.ts',
    transform: buildGeneratedChatResponses,
  },
];
```

chat source의 정확한 import 한 줄만 Functions 상대 경로로 변환한다.

```js
source.replace(
  "@/shared/constants/commercePolicy",
  "./commercePolicy",
);
```

기존 `buildGeneratedChatResponses`, `checkChatResponses`, `writeChatResponses` export는 호환을 위해 유지하고 새 복수 대상 함수에서 재사용한다. `--check`는 비교만 하고, `--write`는 임시 파일 후 rename 방식으로 두 target을 갱신한다.

- [ ] **Step 5: menu 응답과 AI SYSTEM_PROMPT를 같은 정책으로 연결한다**

- `src/shared/utils/chatResponses.ts`는 canonical formatter를 사용한다.
- `functions/src/handlers/chat.ts`는 generated `../commercePolicy`의 `buildChatPolicyPrompt()`를 SYSTEM_PROMPT에 삽입한다.
- 실제 지원하지 않는 결제수단 목록 대신 “선택한 결제 방식은 데모 주문 기록에만 사용되며 실제 승인·청구가 발생하지 않는다”를 사용한다.

- [ ] **Step 6: 생성물을 명시적으로 갱신한 뒤 compare-only 검증을 통과시킨다**

Run:

```powershell
npm run sync:chat-responses:write
npm run sync:chat-responses
npx jest --runInBand --no-cache --runTestsByPath src/shared/constants/commercePolicy.test.ts scripts/sync-chat-responses.test.js functions/__tests__/chatHandler.test.ts
npm run functions:build
npm run typecheck
```

Expected: generated 두 파일이 source와 일치하고 모든 명령이 PASS한다. 이 명시적 write는 구현 단계에서만 실행하며 build 자체는 source를 쓰지 않는다.

- [ ] **Step 7: 독립 리뷰를 받는다**

Reviewer는 생성 import 경로, compare-only 보장, 기존 Task 6 sync 변경 보존, SYSTEM_PROMPT와 menu의 금지 문구 부재를 확인한다.

---

### Task 2: UI 허위 문구 제거와 데모·Firebase 고지 통일

**Dependencies:** Task 1.

**Files:**

- Modify: `src/app/_components/header/Header.tsx`
- Modify: `src/app/_components/header/Header.test.tsx`
- Modify: `src/app/_components/popup/SiteGuidePopup.tsx`
- Create: `src/app/_components/popup/SiteGuidePopup.test.tsx`
- Modify: `src/app/orders/cart/page.tsx`
- Create: `src/app/orders/cart/page.test.tsx`
- Modify: `src/app/orders/checkout/page.tsx`
- Modify: `src/app/orders/checkout/page.test.tsx`
- Modify: `src/app/auth/signup/page.tsx`
- Create: `src/app/auth/signup/page.test.tsx`
- Modify: `src/app/legal/privacy/page.tsx`
- Create: `src/app/legal/privacy/page.test.tsx`
- Modify: `src/app/mypage/point/page.tsx`
- Modify: `src/shared/services/pointService.ts`
- Modify: `src/shared/hooks/usePoint.ts`
- Modify: `scripts/seed-users.js`

**Interfaces:**

- Consumes: Task 1의 `COMMERCE_POLICY`, `formatSignupBenefit()`, `buildDemoDataNotice()`.
- Preserves: `PointService.addSignupPoint()`와 `useSignupPoint()`.
- Removes: `addOrderPoint`, `addReviewPoint`, `addBirthdayPoint`, `useOrderPoint`, `useReviewPoint`, `useBirthdayPoint`.

- [ ] **Step 1: 각 소비 화면의 실패 테스트를 작성한다**

```tsx
test('shows the implemented signup benefit and no fictional benefit', () => {
  render(<Header />);
  expect(screen.getByText(/회원가입.*5,000P/)).toBeInTheDocument();
  expect(screen.queryByText(/10% 쿠폰|생일|구매.*1%/)).not.toBeInTheDocument();
});

test('discloses demo payment and Firebase persistence before signup', () => {
  render(<SignupPage />);
  expect(screen.getByText(/실제 결제는 진행되지/)).toBeInTheDocument();
  expect(screen.getByText(/Firebase에 저장될 수/)).toBeInTheDocument();
});
```

cart/popup/checkout/privacy/point 테스트는 다음 금지 표현을 query하지 못해야 한다.

```ts
const forbiddenPolicy = /생일 쿠폰|등급별 적립|구매.*1%|카카오페이|네이버페이|페이코|토스페이|당일 출고|당일\/익일/;
expect(container.textContent).not.toMatch(forbiddenPolicy);
```

checkout은 `buildDemoDataNotice()` 전체 문구를, signup과 privacy는 실제 결제 없음과 Firebase 저장 가능성을 모두 표시해야 한다.

- [ ] **Step 2: 테스트 실패를 확인한다**

Run:

```powershell
npx jest --runInBand --no-cache --runTestsByPath src/app/_components/header/Header.test.tsx src/app/_components/popup/SiteGuidePopup.test.tsx src/app/orders/cart/page.test.tsx src/app/orders/checkout/page.test.tsx src/app/auth/signup/page.test.tsx src/app/legal/privacy/page.test.tsx
```

Expected: 기존 10% 쿠폰·1% 적립·당일 배송 문구와 누락된 Firebase 고지 때문에 FAIL한다.

- [ ] **Step 3: 정책 소비 화면을 최소 수정한다**

- Header의 “신규 회원 10% 쿠폰”을 `formatSignupBenefit()`으로 교체한다.
- SiteGuidePopup은 배송비·무료 기준과 데모 범위만 안내한다.
- cart의 5만원 무료배송은 유지하고 1% 적립 행을 제거한다. express 선택은 SLA를 약속하지 않는 “특급 배송 옵션(데모)”로 표시한다.
- checkout의 결제수단은 선택 가능한 기록 값으로 유지하되 섹션 상단에 `buildDemoDataNotice()`를 표시한다.
- signup submit 버튼 앞과 privacy 첫 설명에 같은 고지를 표시한다.
- point 페이지의 숨김 benefit grid를 포함해 생일·구매·리뷰 자동 적립 안내를 제거하고 실제 잔액·내역 설명만 남긴다.

- [ ] **Step 4: 죽은 point helper와 오해를 만드는 seed history를 제거한다**

- 일반 사용자 호출 시 admin-only `points action:add`에 도달하는 주문·리뷰·생일 helper와 hook export를 삭제한다.
- 가입 5,000P helper와 서버 `signupBonus` 경계는 보존한다.
- `scripts/seed-users.js`의 생일 축하·리뷰 작성 자동 적립 history fixture를 제거하고 가입 적립, 사용, 환급처럼 실제 서버 모델에 존재하는 예시만 남긴다.
- `rg`로 삭제 대상 함수의 외부 참조가 없음을 다시 확인한다.

Run:

```powershell
rg -n "addOrderPoint|addReviewPoint|addBirthdayPoint|useOrderPoint|useReviewPoint|useBirthdayPoint" src scripts
```

Expected: 검색 결과가 없다.

- [ ] **Step 5: focused 검증을 통과시킨다**

Run:

```powershell
npx jest --runInBand --no-cache --runTestsByPath src/app/_components/header/Header.test.tsx src/app/_components/popup/SiteGuidePopup.test.tsx src/app/orders/cart/page.test.tsx src/app/orders/checkout/page.test.tsx src/app/auth/signup/page.test.tsx src/app/legal/privacy/page.test.tsx
npm run sync:chat-responses
npm run typecheck
```

Expected: 모든 UI 정책 테스트 PASS, generated source 일치, typecheck PASS.

- [ ] **Step 6: 한국어 깨짐과 전역 금지 문구를 확인한다**

Run:

```powershell
rg -n "생일 월|구매 금액의 1%|구매액 [1-5]%|당일 발송|당일 출고|카카오페이|네이버페이|페이코|토스페이" src functions/src scripts --glob '!functions/lib/**'
```

Expected: 정책 소비 코드에는 결과가 없고, 실제 관리 데이터의 일반 단어가 남으면 구현 정책 주장이 아닌지 한 줄씩 검토한다.

---

### Task 3: KST 상대 날짜 coupon seed와 import-safe CLI

**Files:**

- Create: `scripts/coupon-seed-data.js`
- Create: `scripts/coupon-seed-data.test.js`
- Modify: `scripts/seed-coupons.js`

**Interfaces:**

- Produces: `buildCouponSeedData(now: Date): { coupons: CouponSeed[]; userCoupons: UserCouponSeed[] }`.
- Produces: `toKstDateKey(date: Date): string`, `addKstDays(dayKey: string, days: number): string` for this script only.
- Does not call: Firebase initialization, dotenv, Firestore, `process.exit()` during module import.

- [ ] **Step 1: deterministic 상대 날짜와 import 안전성 실패 테스트를 작성한다**

```js
const { buildCouponSeedData } = require('./coupon-seed-data');

test('always creates active and expired coupon fixtures from the KST run day', () => {
  const data = buildCouponSeedData(new Date('2026-07-20T15:30:00.000Z'));
  expect(data.coupons.some((coupon) => coupon.isActive && coupon.expiryDate > '2026-07-21')).toBe(true);
  expect(data.userCoupons.some((coupon) => coupon.status === '기간만료')).toBe(true);
});

test('uses July 21 in Seoul after 15:00 UTC', () => {
  const data = buildCouponSeedData(new Date('2026-07-20T15:00:00.000Z'));
  expect(data.runDate).toBe('2026-07-21');
});
```

import 안전성 테스트는 `jest.isolateModules(() => require('./seed-coupons'))` 중 Firebase initialize와 dotenv config가 호출되지 않는다고 검증한다.

- [ ] **Step 2: 실패를 확인한다**

Run:

```powershell
npx jest --runInBand --no-cache --runTestsByPath scripts/coupon-seed-data.test.js
```

Expected: 순수 builder가 없어 FAIL한다.

- [ ] **Step 3: 순수 seed builder를 최소 구현한다**

`buildCouponSeedData()`는 고정 ID를 유지하면서 다음 상대 날짜를 만든다.

- 환영/할인 쿠폰: 실행일 +30일, +60일.
- 무료배송 쿠폰: 실행일 +14일.
- 비활성·만료 master: 실행일 -1일.
- 사용 가능 user coupon의 issuedDate: 실행일 -2일.
- 사용 완료 fixture: issued -10일, used -1일.
- 기간 만료 fixture: issued -30일, expired 실행일.

Date 문자열은 모두 `YYYY-MM-DD`이며 `createdAt`/`updatedAt` Timestamp는 builder가 아니라 runtime write 직전에 주입한다.

- [ ] **Step 4: CLI runtime을 import 경계 밖으로 옮긴다**

```js
function loadCouponSeedRuntime() {
  require('dotenv').config({ path: '.env.local' });
  const firebase = require('firebase/app');
  const firestore = require('firebase/firestore');
  return { firebase, firestore };
}

if (require.main === module) {
  void seedCouponData(buildCouponSeedData(new Date()), loadCouponSeedRuntime());
}

module.exports = { loadCouponSeedRuntime, seedCouponData };
```

`seedCouponData(data, runtime)`은 주입된 runtime만 사용하며 import 시 호출되지 않는다.

- [ ] **Step 5: 테스트와 정적 검증만 실행한다**

Run:

```powershell
npx jest --runInBand --no-cache --runTestsByPath scripts/coupon-seed-data.test.js
node -e "require('./scripts/seed-coupons.js'); console.log('import-safe')"
```

Expected: PASS와 `import-safe`. `npm run seed:coupons`는 실행하지 않는다.

- [ ] **Step 6: 독립 리뷰를 받는다**

Reviewer는 실행일이 어느 해든 유효/만료 fixture가 함께 존재하는지, KST 자정 경계, import 부작용 부재, DB write 미실행을 확인한다.

---

### Task 4: Event eligibility/reward 타입, 관리자 폼, legacy dry-run planner

**Files:**

- Modify: `src/shared/types/event.ts`
- Modify: `src/app/admin/events/_components/EventForm.tsx`
- Modify: `src/app/admin/events/_components/EventForm.test.tsx`
- Create: `scripts/event-eligibility-migration.js`
- Create: `scripts/event-eligibility-migration.test.js`
- Modify: `package.json`

**Interfaces:**

- Produces: `EventEligibilityType = 'none' | 'purchase' | 'delivered' | 'review'`.
- Produces: `EventRewardType = 'none' | 'coupon'`.
- Produces: `planEventEligibilityPatch(event): { patch; reasons; requiresManualTargetProducts }`.
- Task 5 consumes: `eligibilityType`, `rewardType`, `targetProducts`, `rewardCouponId`.

- [ ] **Step 1: type/form validation 실패 테스트를 작성한다**

```tsx
test('requires target product ids for purchase evidence', async () => {
  render(<EventForm />);
  await user.selectOptions(screen.getByLabelText('참여 자격'), 'delivered');
  await user.click(screen.getByRole('button', { name: '이벤트 생성' }));
  expect(window.alert).toHaveBeenCalledWith('구매 자격 이벤트에는 대상 상품 ID가 필요합니다.');
});

test('submits only none or coupon rewards', async () => {
  render(<EventForm />);
  expect(screen.getByLabelText('보상 유형')).toHaveTextContent('보상 없음');
  expect(screen.getByLabelText('보상 유형')).toHaveTextContent('쿠폰');
  expect(screen.getByLabelText('보상 유형')).not.toHaveTextContent('적립금');
});
```

- [ ] **Step 2: legacy planner 실패 테스트를 작성한다**

```js
test('maps ordinary no-reward legacy events to none', () => {
  expect(planEventEligibilityPatch({ title: '시즌 세일' }).patch).toMatchObject({
    eligibilityType: 'none',
    rewardType: 'none',
  });
});

test('maps review copy to review but blocks missing target products', () => {
  expect(planEventEligibilityPatch({ title: '포토 리뷰 이벤트' })).toMatchObject({
    patch: { eligibilityType: 'review' },
    requiresManualTargetProducts: true,
  });
});
```

known review IDs `event-2026-02-knit-review`, `event-2026-03-photo-review`, `event-2026-05-best-review`, `event-2026-07-summer-review`도 같은 결과를 검증한다.

- [ ] **Step 3: 실패를 확인한다**

Run:

```powershell
npx jest --runInBand --no-cache --runTestsByPath src/app/admin/events/_components/EventForm.test.tsx scripts/event-eligibility-migration.test.js
```

Expected: 새 타입·폼 필드·planner가 없어 FAIL한다.

- [ ] **Step 4: 타입과 관리자 폼을 최소 구현한다**

```ts
export type EventEligibilityType = 'none' | 'purchase' | 'delivered' | 'review';
export type EventRewardType = 'none' | 'coupon';

export interface Event {
  eligibilityType: EventEligibilityType;
  rewardType: EventRewardType;
  rewardCouponId?: string;
  targetProducts?: string[];
}
```

- 폼은 참여 자격과 보상 유형 select를 제공한다.
- `purchase|delivered|review`는 trim·중복 제거된 `targetProducts`가 1개 이상이어야 한다.
- `rewardType === 'coupon'`일 때만 `rewardCouponId`를 요구하고 payload에 포함한다.
- 적립금·임의 금액 보상 입력은 제거한다. `discountAmount`가 프로모션 표시 값으로 필요하면 “할인 표시 금액”으로만 유지하고 지급 보상과 연결하지 않는다.

- [ ] **Step 5: import-safe dry-run planner를 최소 구현한다**

planner는 입력 document를 수정하지 않고 proposed patch만 반환한다.

- 이미 유효한 eligibility/reward 값은 보존한다.
- rewardCouponId가 있으면 `rewardType:'coupon'`, 없으면 `none`.
- review copy/known ID면 `eligibilityType:'review'`.
- 그 외 보상 없는 legacy 이벤트는 `eligibilityType:'none'`.
- review/purchase/delivered인데 targetProducts가 비면 `requiresManualTargetProducts:true`로 보고한다.
- `scripts/firestore-migration-runtime.js`는 `main()` 안에서만 dynamic load한다.
- CLI는 `analyze` 또는 기본 dry-run만 지원하며 write API와 `--execute` 옵션을 구현하지 않는다.

`package.json`에는 읽기 전용 명령만 추가한다.

```json
"migrate:events:eligibility:dry-run": "node scripts/event-eligibility-migration.js analyze"
```

- [ ] **Step 6: focused 검증을 통과시킨다**

Run:

```powershell
npx jest --runInBand --no-cache --runTestsByPath src/app/admin/events/_components/EventForm.test.tsx scripts/event-eligibility-migration.test.js
node -e "require('./scripts/event-eligibility-migration.js'); console.log('import-safe')"
npm run typecheck
```

Expected: PASS. dry-run 명령도 실제 프로젝트 자격증명이 필요한 DB 접근이므로 이번 계획 실행에서는 호출하지 않는다.

---

### Task 5: 서버 transaction eligibility와 review 증거 helper 공유

**Dependencies:** Task 4.

**Files:**

- Create: `functions/src/domain/purchaseEvidence.ts`
- Create: `functions/src/domain/eventEligibility.ts`
- Create: `functions/__tests__/eventEligibility.test.ts`
- Modify: `functions/src/handlers/review.ts`
- Modify: `functions/src/handlers/event.ts`
- Modify: `functions/__tests__/httpHandlers.test.ts`
- Modify: `src/shared/services/eventService.ts`
- Modify: `src/app/events/[eventId]/EventDetailClient.tsx`
- Modify: `src/app/events/[eventId]/EventDetailClient.test.tsx`
- Modify: `src/shared/constants/eventUiMeta.ts`

**Interfaces:**

- Produces: `isDeliveredOrderStatus(status)`, `getOrderProducts(order)`, `orderHasTargetProduct(order, ids)`, `buildReviewDocumentId(input)`.
- Produces: `assertEventEligibility(transaction, db, input): Promise<EligibilityEvidence>`.
- Consumes: Task 4 event fields.

- [ ] **Step 1: 공통 구매 증거와 자격 matrix 실패 테스트를 작성한다**

```ts
test.each(['delivered', '배송완료', 'purchase_confirmed', '구매확정'])(
  'accepts delivered status %s',
  (status) => expect(isDeliveredOrderStatus(status)).toBe(true),
);

test('rejects another user and a wrong target product', async () => {
  await expect(assertEventEligibility(transaction, db, {
    userId: 'user-1',
    eligibilityType: 'delivered',
    targetProducts: ['target-1'],
  })).rejects.toMatchObject({ code: 'ineligible_delivered' });
});
```

matrix는 다음을 모두 포함한다.

- `none`: 주문 없이 통과.
- `purchase`: 대상 상품을 포함하고 cancelled/returned/exchanged가 아닌 본인 주문만 통과.
- `delivered`: 배송 완료·구매 확정 상태만 통과.
- `review`: delivered 증거와 같은 주문/상품/옵션의 `verifiedPurchase:true` review가 모두 필요.
- 다른 사용자 주문/review, 잘못된 상품·옵션, 빈 targetProducts는 거부.

- [ ] **Step 2: handler transaction 실패 테스트를 먼저 작성한다**

`functions/__tests__/httpHandlers.test.ts`에 기간·정원·중복·자격·보상 발급이 한 transaction에서 원자적으로 동작하는 matrix를 추가한다.

```ts
test('writes no participant or count when eligibility fails', async () => {
  const response = await participate();
  expect(response.status).toHaveBeenCalledWith(403);
  expect(transaction.set).not.toHaveBeenCalled();
  expect(transaction.update).not.toHaveBeenCalled();
});

test('rolls back participation when coupon issuance fails', async () => {
  issueCoupon.mockRejectedValue(new Error('coupon exhausted'));
  await participate();
  expect(participantStore).toHaveLength(0);
  expect(eventData.participantCount).toBe(0);
});
```

- [ ] **Step 3: 실패를 확인한다**

Run:

```powershell
npx jest --runInBand --no-cache --runTestsByPath functions/__tests__/eventEligibility.test.ts functions/__tests__/httpHandlers.test.ts
```

Expected: eligibility domain과 새 error code가 없어 FAIL한다.

- [ ] **Step 4: purchase evidence helper를 review handler에 먼저 적용한다**

- 기존 review handler의 배송 상태, 주문 products, 옵션 비교, deterministic ID 로직을 `purchaseEvidence.ts`로 이동한다.
- 공개 동작과 review document ID는 변경하지 않는다.
- 기존 review handler 테스트를 먼저 PASS시켜 추출이 행동 변경을 만들지 않았음을 확인한다.

- [ ] **Step 5: event eligibility를 transaction 읽기 단계에 연결한다**

transaction 순서는 다음으로 고정한다.

1. event와 deterministic participant document를 읽는다.
2. 이벤트 존재·활성·기간·중복·정원을 확인한다.
3. eligibility 설정과 targetProducts를 검증한다.
4. 본인 orders equality query와 필요한 deterministic review 문서를 읽는다.
5. `assertEventEligibility()`를 통과한다.
6. coupon reward 발급에 필요한 문서를 읽고 issue helper를 실행한다.
7. participant 생성과 participantCount 증가를 마지막에 쓴다.

임의 order limit은 오래된 유효 주문을 누락시키므로 추가하지 않는다. 대량 사용자에서 전체 주문 read가 커지는 문제는 Task 9 후속 위험으로 기록한다.

error payload는 안정적인 code를 포함한다.

```ts
type EventParticipationErrorCode =
  | 'event_misconfigured'
  | 'ineligible_purchase'
  | 'ineligible_delivered'
  | 'ineligible_review';
```

eligibilityType 누락/오류와 필수 targetProducts 누락은 `event_misconfigured`로 fail-closed한다. Task 4 dry-run 결과의 수동 보정이 끝나기 전에는 배포하지 않는다.

- [ ] **Step 6: Event UI를 eligibilityType과 stable error code에 연결한다**

- 참여 방법과 CTA는 title keyword가 아니라 `eligibilityType`을 사용한다.
- visual campaign variant는 기존 `eventUiMeta`를 유지하되 참여 자격 카피와 분리한다.
- `eventService`는 stable code를 한국어 재선택·구매·배송·리뷰 안내로 매핑한다.
- 이미 참여한 요청은 기존 idempotent 성공을 유지한다.

- [ ] **Step 7: focused 검증을 통과시킨다**

Run:

```powershell
npx jest --runInBand --no-cache --runTestsByPath functions/__tests__/eventEligibility.test.ts functions/__tests__/httpHandlers.test.ts "src/app/events/[eventId]/EventDetailClient.test.tsx"
npm run functions:build
npm run typecheck
```

Expected: eligibility matrix, review 회귀, transaction rollback, Event UI 모두 PASS.

- [ ] **Step 8: 독립 서버 보안 리뷰를 받는다**

Reviewer는 모든 transaction read가 write보다 앞서는지, 타 사용자 주문/review가 증거가 되지 않는지, coupon 실패 시 participant/count가 남지 않는지 확인한다.

---

### Task 6: Same-origin redirect와 TTL one-shot 상품 의도 복원

**Files:**

- Create: `src/shared/utils/safeRedirect.ts`
- Create: `src/shared/utils/safeRedirect.test.ts`
- Create: `src/shared/utils/productIntent.ts`
- Create: `src/shared/utils/productIntent.test.ts`
- Modify: `src/app/auth/login/page.tsx`
- Modify: `src/app/auth/login/page.test.tsx`
- Modify: `src/app/products/_components/ProductDetailClient.tsx`
- Modify: `src/app/products/_components/ProductDetailClient.test.tsx`
- Modify: `src/app/events/[eventId]/EventDetailClient.tsx`
- Modify: `src/app/events/[eventId]/EventDetailClient.test.tsx`

**Interfaces:**

- Produces: `getSafeRedirectTarget(candidate, origin, fallback='/mypage'): string`.
- Produces: `saveProductIntent(storage, intent, nowMs)`, `consumeProductIntent(storage, nowMs): ProductIntentResult`.
- TTL: 10분. Storage key와 payload version은 모듈 상수로 한 곳에서 관리한다.

- [ ] **Step 1: hostile redirect 실패 테스트를 작성한다**

```ts
test.each([
  'https://evil.example/path',
  '//evil.example/path',
  '/\\\\evil.example/path',
  'javascript:alert(1)',
])('rejects non same-origin redirect %s', (candidate) => {
  expect(getSafeRedirectTarget(candidate, 'https://styna.example')).toBe('/mypage');
});

test('keeps an internal path with search and hash', () => {
  expect(getSafeRedirectTarget('/products/p1?resumeIntent=1#buy', 'https://styna.example'))
    .toBe('/products/p1?resumeIntent=1#buy');
});
```

- [ ] **Step 2: one-shot intent 실패 테스트를 작성한다**

```ts
test('consumes a valid intent exactly once', () => {
  saveProductIntent(storage, intent, 1_000);
  expect(consumeProductIntent(storage, 2_000)).toMatchObject({ ok: true, intent });
  expect(consumeProductIntent(storage, 2_001)).toEqual({ ok: false, reason: 'missing' });
});

test('removes an expired intent', () => {
  saveProductIntent(storage, intent, 1_000);
  expect(consumeProductIntent(storage, 601_001)).toEqual({ ok: false, reason: 'expired' });
  expect(storage.getItem(PRODUCT_INTENT_STORAGE_KEY)).toBeNull();
});
```

schema는 action `cart|buy|wishlist`, productId, pathname, size, color, positive integer quantity, createdAt, version을 검증한다.

- [ ] **Step 3: 실패를 확인한다**

Run:

```powershell
npx jest --runInBand --no-cache --runTestsByPath src/shared/utils/safeRedirect.test.ts src/shared/utils/productIntent.test.ts src/app/auth/login/page.test.tsx src/app/products/_components/ProductDetailClient.test.tsx "src/app/events/[eventId]/EventDetailClient.test.tsx"
```

Expected: helper와 복원 동작이 없어 FAIL한다.

- [ ] **Step 4: pure helper를 최소 구현한다**

`getSafeRedirectTarget()`은 `new URL(candidate, origin)`으로 파싱하고 exact `parsed.origin === new URL(origin).origin`일 때만 `pathname+search+hash`를 반환한다. backslash와 malformed URL은 fallback한다.

`consumeProductIntent()`는 JSON parse 직후 storage key를 먼저 삭제한 다음 version/schema/TTL을 판정한다. side effect 실패 후 새로고침해도 자동 재실행하지 않는다.

- [ ] **Step 5: 로그인 전 세 action을 저장한다**

- ProductDetailClient는 현재 pathname, product ID, size/color/quantity, action을 저장한다.
- redirect target은 원 상품 URL에 `resumeIntent=1`을 붙인다.
- login URL은 `/auth/login?redirect=${encodeURIComponent(target)}`다.
- wishlist는 옵션이 없어도 저장하고, cart/buy는 현재 선택 상태를 함께 저장한다.

- [ ] **Step 6: 상품 상세 복귀 시 한 번만 검증·실행한다**

- `resumeIntent=1`일 때만 consume한다.
- productId/path가 현재 상품과 일치하는지 확인한다.
- cart/buy는 size/color가 상품 선언 옵션에 있고 quantity가 양수이며 재고 이하인지 확인한다.
- 유효하면 state를 복원한 뒤 기존 cart/buy/wishlist 함수를 인증 재분기 없이 한 번 호출한다.
- missing/malformed/expired/mismatch/invalid option은 상세에 머물고 “옵션을 다시 선택해 주세요.”를 표시한다.
- React StrictMode 중복 effect는 component ref로 차단하고 storage는 side effect 전에 이미 삭제한다.

- [ ] **Step 7: event redirect를 현재 URL로 연결한다**

비로그인 참여는 `/auth/login` 단독 이동 대신 현재 `/events/{eventId}`를 encoded redirect로 포함한다. 이벤트 참여 자동 실행은 요구 범위가 아니며 로그인 후 원 이벤트 화면 복귀만 보장한다.

- [ ] **Step 8: focused 검증을 통과시킨다**

Run:

```powershell
npx jest --runInBand --no-cache --runTestsByPath src/shared/utils/safeRedirect.test.ts src/shared/utils/productIntent.test.ts src/app/auth/login/page.test.tsx src/app/products/_components/ProductDetailClient.test.tsx "src/app/events/[eventId]/EventDetailClient.test.tsx"
npm run typecheck
```

Expected: hostile redirect, TTL, one-shot, 세 action, invalid option, event return 테스트가 모두 PASS.

---

### Task 7: KST 쿠폰 날짜 계약과 rollback 밖 만료 상태 저장

**Files:**

- Create: `src/shared/utils/kstDate.ts`
- Create: `src/shared/utils/kstDate.test.ts`
- Create: `functions/src/domain/kstDate.ts`
- Create: `functions/__tests__/kstDate.test.ts`
- Modify: `src/shared/utils/orderPricing.ts`
- Modify: `src/shared/utils/orderPricing.test.ts`
- Modify: `src/shared/services/couponService.ts`
- Modify: `src/shared/services/couponService.test.ts`
- Modify: `functions/src/domain/couponDomain.ts`
- Modify: `functions/__tests__/couponDomain.test.ts`
- Modify: `functions/src/domain/orderDomain.ts`
- Modify: `functions/src/handlers/coupon.ts`
- Modify: `functions/src/handlers/order.ts`
- Modify: `functions/src/cron/cleanupExpiredCoupons.ts`
- Modify: `functions/__tests__/httpHandlers.test.ts`

**Interfaces:**

- Produces in both runtimes: `toKstDayKey(value): string`, `parseCouponExpiryDay(value): string | null`, `isExpiredOnKstDay(expiry, now): boolean`.
- Produces server-only: `ExpiredOrderCouponError`, `markExpiredUserCoupon(db, input): Promise<void>`.
- Task 8 consumes: client `isExpiredOnKstDay()` through `getCouponAvailability()`.

- [ ] **Step 1: 동일한 KST contract matrix 실패 테스트를 양쪽에 작성한다**

```ts
test.each([
  ['2026-07-20T14:59:59.999Z', '2026-07-20'],
  ['2026-07-20T15:00:00.000Z', '2026-07-21'],
])('maps %s to Seoul day %s', (instant, day) => {
  expect(toKstDayKey(new Date(instant))).toBe(day);
});

test.each(['2026-07-21', '2026.07.21', '2026/07/21'])(
  'keeps expiry valid through its Seoul calendar day',
  (expiry) => {
    expect(isExpiredOnKstDay(expiry, new Date('2026-07-21T14:59:59.999Z'))).toBe(false);
    expect(isExpiredOnKstDay(expiry, new Date('2026-07-21T15:00:00.000Z'))).toBe(true);
  },
);
```

invalid date, Date, Firestore Timestamp-like `toDate()` 값도 양쪽에서 같은 결과를 검증한다.

- [ ] **Step 2: order rollback 분리 실패 테스트를 작성한다**

```ts
test('commits only expired coupon status after the order transaction rolls back', async () => {
  const response = await createOrderWithExpiredCoupon();
  expect(response.status).toHaveBeenCalledWith(410);
  expect(orderStore).toHaveLength(0);
  expect(product.stock).toBe(originalStock);
  expect(cart.items).toEqual(originalItems);
  expect(userCoupon.status).toBe('기간만료');
});
```

별도 테스트는 만료 marking transaction이 이미 사용완료/소유자 불일치인 coupon을 덮어쓰지 않는지 검증한다.

- [ ] **Step 3: 실패를 확인한다**

Run:

```powershell
npx jest --runInBand --no-cache --runTestsByPath src/shared/utils/kstDate.test.ts src/shared/utils/orderPricing.test.ts src/shared/services/couponService.test.ts functions/__tests__/kstDate.test.ts functions/__tests__/couponDomain.test.ts functions/__tests__/httpHandlers.test.ts
```

Expected: UTC 비교와 transaction rollback 때문에 FAIL한다.

- [ ] **Step 4: client KST helper와 순수 availability를 최소 구현한다**

- `Intl.DateTimeFormat(..., { timeZone:'Asia/Seoul' }).formatToParts()`로 Date/Timestamp instant를 day key로 만든다.
- date-only 문자열은 정규식으로 year/month/day를 검증하고 해당 달의 실제 날짜인지 확인한다.
- `orderPricing.isCouponExpired`, `CouponService.getAvailableCouponsForOrder`, `getDaysUntilExpiry`가 같은 helper를 사용한다.
- `CouponService.expireUserCoupon()`와 client `updateDoc(user_coupons)` 호출을 제거한다. Rules가 금지한 client write를 background에서 시도하지 않는다.

- [ ] **Step 5: Functions KST helper를 모든 coupon 날짜 경계에 연결한다**

- `couponDomain.couponHasExpired`.
- coupon register/issue/use/cleanup의 issuedDate/usedDate/expiredDate.
- scheduled cleanup의 오늘 날짜와 expiry 판정.
- order number의 날짜와 주문 coupon 만료 판정.

서버와 클라이언트는 서로 import하지 않지만 같은 test matrix를 통과해야 한다.

- [ ] **Step 6: order 만료 상태를 rollback 밖에서 저장한다**

주문 transaction 안에서는 만료 update를 하지 않는다.

```ts
if (isExpiredOnKstDay(couponData.expiryDate, nowDate)) {
  throw new ExpiredOrderCouponError(selectedCoupon);
}
```

outer catch는 해당 error만 분기해 별도 transaction을 실행한다.

```ts
if (error instanceof ExpiredOrderCouponError) {
  await markExpiredUserCoupon(admin.firestore(), {
    userCouponId: error.userCouponId,
    userId: authContext.uid,
    now: new Date(),
  });
  res.status(410).json({ success: false, error: 'Coupon has expired.' });
  return;
}
```

`markExpiredUserCoupon()`은 user coupon 소유자·사용 가능 상태·master expiry를 다시 읽고 여전히 만료일 때만 `기간만료`로 바꾼다. marking 실패는 성공처럼 숨기지 않고 500으로 처리해 상태 불일치를 관측 가능하게 한다.

- [ ] **Step 7: focused 검증을 통과시킨다**

Run:

```powershell
npx jest --runInBand --no-cache --runTestsByPath src/shared/utils/kstDate.test.ts src/shared/utils/orderPricing.test.ts src/shared/services/couponService.test.ts functions/__tests__/kstDate.test.ts functions/__tests__/couponDomain.test.ts functions/__tests__/orderDomain.test.ts functions/__tests__/httpHandlers.test.ts
npm run functions:build
npm run typecheck
```

Expected: KST 경계, expiry day, rollback, 동시 상태 보호 테스트가 PASS.

- [ ] **Step 8: cron batch 위험을 구현 범위 밖으로 유지한다**

이번 Task에서는 날짜 판정만 교체한다. 500-write batch 분할과 coupon master read cache는 Task 9 문서의 후속 위험에 기록하고 코드 변경을 섞지 않는다.

---

### Task 8: 바로구매 쿠폰 선택과 주문 후 allSettled 캐시 동기화

**Dependencies:** Task 7.

**Files:**

- Create: `src/shared/hooks/useOrders.ts`
- Create: `src/shared/hooks/useOrders.test.tsx`
- Create: `src/shared/utils/postPurchaseSync.ts`
- Create: `src/shared/utils/postPurchaseSync.test.ts`
- Modify: `src/shared/hooks/usePoint.ts`
- Modify: `src/shared/hooks/useCart.ts`
- Modify: `src/app/mypage/order-list/page.tsx`
- Modify: `src/app/orders/checkout/page.tsx`
- Modify: `src/app/orders/checkout/page.test.tsx`
- Modify: `src/context/CouponProvider.tsx`

**Interfaces:**

- Produces: `pointKeys`, `orderKeys`, existing `cartKeys` preservation.
- Produces: `refreshPostPurchaseState({ queryClient, userId, refreshUserCoupons }): Promise<SettledRefreshSummary>`.
- Consumes: Task 7의 `getCouponAvailability()` KST 판정.

- [ ] **Step 1: query key와 post-purchase helper 실패 테스트를 작성한다**

```ts
test('settles every refresh even when coupon refresh fails', async () => {
  refreshUserCoupons.mockRejectedValue(new Error('coupon unavailable'));
  const result = await refreshPostPurchaseState(input);
  expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: pointKeys.all('user-1') });
  expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: orderKeys.all('user-1') });
  expect(result.failed).toBe(1);
});
```

`pointKeys`와 `orderKeys`는 사용자별 prefix로 balance/history와 list를 한 번에 무효화할 수 있어야 한다.

- [ ] **Step 2: 바로구매 coupon selector 실패 테스트를 작성한다**

```tsx
test('allows a buy-now draft with no preset coupon to select an available coupon', async () => {
  sessionStorage.setItem('orderData', JSON.stringify(buyNowDraft));
  render(<CheckoutPage />);
  await user.selectOptions(screen.getByLabelText('쿠폰 선택'), 'user-coupon-1');
  await submitOrder();
  expect(OrderService.createOrder).toHaveBeenCalledWith(
    expect.objectContaining({ selectedCoupon: 'user-coupon-1' }),
  );
});

test('disables expired and minimum-order coupons', () => {
  render(<CheckoutPage />);
  expect(screen.getByRole('option', { name: /기간 만료/ })).toBeDisabled();
  expect(screen.getByRole('option', { name: /최소 주문금액/ })).toBeDisabled();
});
```

- [ ] **Step 3: 주문 성공·후속 실패 경계 테스트를 작성한다**

```tsx
test('navigates to completion even when one cache refresh rejects', async () => {
  OrderService.createOrder.mockResolvedValue(orderResponse);
  refreshUserCoupons.mockRejectedValue(new Error('refresh failed'));
  await submitOrder();
  expect(sessionStorage.getItem('orderData')).toBeNull();
  expect(router.push).toHaveBeenCalledWith('/orders/complete?orderId=order-1');
  expect(window.alert).not.toHaveBeenCalledWith('주문 처리 중 문제가 발생했습니다.');
});

test('keeps the draft and skips refresh when order creation fails', async () => {
  OrderService.createOrder.mockRejectedValue(new Error('create failed'));
  await submitOrder();
  expect(sessionStorage.getItem('orderData')).not.toBeNull();
  expect(refreshUserCoupons).not.toHaveBeenCalled();
});
```

- [ ] **Step 4: 실패를 확인한다**

Run:

```powershell
npx jest --runInBand --no-cache --runTestsByPath src/shared/hooks/useOrders.test.tsx src/shared/utils/postPurchaseSync.test.ts src/app/orders/checkout/page.test.tsx
```

Expected: order cache/helper와 checkout selector가 없어 FAIL한다.

- [ ] **Step 5: query key와 order list cache를 최소 구현한다**

```ts
export const orderKeys = {
  all: (uid: string) => ['orders', uid] as const,
  list: (uid: string, limit: number) => ['orders', uid, 'list', limit] as const,
};

export const pointKeys = {
  all: (uid: string) => ['points', uid] as const,
  balance: (uid: string) => ['points', uid, 'balance'] as const,
  history: (uid: string, limit: number) => ['points', uid, 'history', limit] as const,
};
```

- `useOrders(uid, limit)`가 `OrderService.getUserOrders`를 React Query로 감싼다.
- order-list page의 local load effect를 hook data/refetch로 교체한다.
- 주문 취소 성공도 order key를 invalidate하고 coupon/point 복구 데이터를 갱신할 수 있도록 같은 key를 사용한다.
- `usePointHistory`는 refetch된 첫 페이지 data를 `allHistory`에 다시 반영한다. 기존 `!isInitialized` 조건 때문에 invalidate 후 stale history가 유지되지 않게 한다.

- [ ] **Step 6: checkout coupon selector를 최소 구현한다**

- `selectedCouponId` state를 draft의 기존 ID 또는 빈 값으로 초기화한다.
- userCoupons 전체를 option으로 표시하되 `getCouponAvailability(coupon, subtotal)` 결과가 unusable이면 disabled와 한국어 사유를 붙인다.
- 선택 변경 시 `calculateOrderPreview`가 즉시 다시 계산된다.
- submit payload에는 `orderPreview.usableCoupon?.id`만 보낸다.

- [ ] **Step 7: 주문 성공 후 갱신을 allSettled 경계로 분리한다**

`refreshPostPurchaseState()`는 다음 Promise를 `Promise.allSettled()`에 넣는다.

1. cart list invalidate.
2. cart count invalidate/refetch.
3. point balance/history prefix invalidate.
4. order list prefix invalidate.
5. `refreshUserCoupons()`.

checkout 흐름은 다음 순서를 지킨다.

1. Order Function 성공.
2. 선택적 배송지 저장을 별도 try/catch로 처리.
3. `orderResult` 저장, `orderData` 삭제.
4. `await refreshPostPurchaseState()`; 실패 항목은 log만 남기고 주문을 실패로 바꾸지 않음.
5. complete route 이동.

- [ ] **Step 8: focused 검증을 통과시킨다**

Run:

```powershell
npx jest --runInBand --no-cache --runTestsByPath src/shared/hooks/useOrders.test.tsx src/shared/utils/postPurchaseSync.test.ts src/app/orders/checkout/page.test.tsx
npm run typecheck
```

Expected: buy-now coupon, disabled 사유, exact key, partial refresh failure, create failure draft 보존 테스트가 PASS.

- [ ] **Step 9: 독립 데이터 일관성 리뷰를 받는다**

Reviewer는 주문이 이미 성공한 뒤 cache 오류가 재주문을 유도하지 않는지, point history가 실제 refetch data로 바뀌는지, usable coupon ID만 서버로 가는지 확인한다.

---

### Task 9: 문서, 전체 검증, 브라우저 QA, 독립 리뷰

**Dependencies:** Task 1~8.

**Files:**

- Create: `docs/commerce-policy.md`
- Modify: `docs/README.md`
- Modify: `docs/coupon-system.md`
- Modify: `docs/order-serverization.md`
- Modify: `docs/auth-ui.md`
- Modify: `docs/event-page-review.md`
- Modify: `docs/superpowers/plans/2026-07-20-project-policy-purchase.md` only if implementation differs from the interfaces recorded here

**Interfaces:**

- Consumes: 모든 Task의 최종 파일명·함수명·검증 결과.
- Produces: 재현 가능한 정책·날짜·이벤트·의도·주문 캐시 문서와 최종 검증 기록.

- [ ] **Step 1: 관련 문서를 실제 구현 기준으로 갱신한다**

`docs/commerce-policy.md`에는 다음만 기록한다.

- canonical source와 generated Functions source 관계.
- 가입 5,000P, 일반 배송비 3,000원, 5만원 이상 무료배송.
- 실제 결제·배송 서비스가 없는 포트폴리오 데모와 Firebase 저장 가능 고지.
- 금지된 미구현 주장 목록.

`docs/coupon-system.md`에는 KST date-only 계약, 상대 날짜 seed builder, client expiry write 제거, order rollback 밖 marking을 기록한다. 기존 `seed-coupons.ts` 오기는 `.js`로 고친다.

`docs/order-serverization.md`에는 buy-now coupon 선택, post-purchase cart/point/coupon/order refresh, cache 실패와 주문 성공의 분리 경계를 기록한다.

`docs/auth-ui.md`에는 exact same-origin 검증, 10분 TTL, one-shot consume, invalid option 재선택, event redirect를 기록한다.

`docs/event-page-review.md`에는 eligibility/reward 타입, transaction 증거, stable error code, dry-run planner와 수동 targetProducts gate를 기록한다.

- [ ] **Step 2: 후속 위험을 범위와 분리해 문서화한다**

- scheduled coupon cleanup의 500-write batch 분할과 master read cache.
- 이벤트 자격 판정을 위해 사용자 주문 전체를 읽는 구조의 장기 확장성 및 eligibility projection 필요성.
- dry-run에서 `requiresManualTargetProducts`가 남은 이벤트는 migration execute·배포 전에 운영자가 명시적으로 보정해야 함.

이 항목을 해결한 것처럼 쓰지 않고 이번 범위 미구현으로 명시한다.

- [ ] **Step 3: 금지 명령이 계획 실행 기록에 없는지 확인한다**

실행하지 않는 명령:

```text
npm run seed:coupons
npm run seed:all
node scripts/event-eligibility-migration.js --execute
firebase deploy
git commit
git push
```

- [ ] **Step 4: focused source sync와 전체 정적 검증을 실행한다**

Run:

```powershell
npm run sync:chat-responses
npm run typecheck
npm run lint -- --max-warnings=0
npm test -- --runInBand
npm run test:rules
npm run functions:build
npm run build
```

Expected: 모든 명령 exit code 0. 5분 동안 출력이 없는 명령은 중지하고 프로세스·잠금·캐시를 분석한 뒤 대체 검증과 함께 최종 보고한다.

- [ ] **Step 5: 한국어·금지 정책 문구 정적 검증을 실행한다**

Run:

```powershell
rg -n "생일 월|등급별 혜택|구매 금액의 1%|당일 발송|당일 출고|카카오페이|네이버페이|페이코|토스페이" src functions/src scripts --glob '!functions/lib/**'
rg -n "\\uFFFD|ì|ë|í" src functions/src docs scripts
```

Expected: 허위 정책 결과가 없고 한국어 깨짐 의심 결과는 각 파일을 UTF-8로 열어 확인한다.

- [ ] **Step 6: 안전한 로컬/에뮬레이터 브라우저 QA를 수행한다**

Browser skill을 사용해 390×844와 1440×900에서 다음을 확인한다.

- Header, guide, cart, checkout, signup, privacy, chat menu의 정책 문구 일치.
- cart/buy/wishlist 각각 로그아웃 action → 로그인 → 원 상품·옵션·수량 복원 → 한 번 실행 → 새로고침 시 재실행 없음.
- hostile redirect가 외부 origin으로 이동하지 않고 `/mypage`로 복귀.
- event 비로그인 참여가 원 이벤트로 복귀.
- buy-now checkout에서 usable coupon 선택, 만료/최소금액 coupon disabled.
- 테스트 계정의 안전한 로컬/에뮬레이터 주문 성공 후 cart/point/coupon/order list 최신 상태.
- 가로 overflow와 console error 없음.

실제 PG 결제, production DB seed/migration, 배포는 수행하지 않는다. emulator에서 주문 검증이 불가능하면 주문 생성 직전까지 UI를 확인하고 handler/cache 테스트 결과를 남은 근거로 명시한다.

- [ ] **Step 7: 세 영역의 독립 리뷰를 병렬로 받는다**

1. 정책/generated sync/허위 문구 리뷰.
2. 이벤트 schema/planner/transaction/review 증거 리뷰.
3. redirect/intent/KST coupon/order cache 리뷰.

각 reviewer는 Critical/Important/Minor와 Ready 여부를 반환한다. Important 이상이 남으면 전체 Ready는 No다.

- [ ] **Step 8: 최종 사실 보고를 남긴다**

- 변경 파일과 새 파일.
- focused/전체 검증의 실제 exit code.
- 브라우저 QA를 수행한 viewport와 확인 흐름.
- 실행하지 않은 seed/migration/deploy/commit 명령.
- 남은 cron batch와 event order-scan 위험.
- 독립 리뷰 판정.

## Completion Criteria

- 가입 혜택은 모든 소비 화면과 chat에서 5,000P로 일치한다.
- 생일 쿠폰, 등급별 적립, 구매 1%, 간편결제, 당일 출고를 구현 사실처럼 말하는 문구가 없다.
- signup·checkout·법적 안내에 실제 결제 없음과 Firebase 저장 가능성이 표시된다.
- coupon seed import는 무부작용이고 어느 실행일에도 유효/만료 fixture가 함께 생성된다.
- 이벤트 자격·보상 타입과 관리자 입력이 서버가 실제 검증·지급할 수 있는 값으로 제한된다.
- event transaction은 기간·정원·중복·자격·coupon reward·participant count를 원자적으로 처리한다.
- 로그인 redirect는 same-origin만 허용하고 cart/buy/wishlist intent가 10분 TTL로 한 번만 복원된다.
- coupon expiry는 client/server 모두 KST expiry day 다음 날부터 만료이며 client 금지 write가 없다.
- 만료 coupon 주문은 주문 transaction을 rollback하고 별도 transaction만 만료 상태를 저장한다.
- buy-now checkout에서도 usable coupon을 고를 수 있다.
- 주문 성공 후 cart, point balance/history, user coupon, order list가 갱신되며 refresh 실패가 성공 주문을 실패로 바꾸지 않는다.
- 전체 검증과 브라우저 QA 결과가 사실대로 기록되고 실제 PG·seed·migration execute·배포·커밋·푸시가 수행되지 않는다.
