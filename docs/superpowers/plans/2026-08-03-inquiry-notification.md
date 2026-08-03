# 1:1 문의 실시간 알림 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 1:1 문의 등록과 관리자 답변을 Firestore 실시간 구독으로 감지해 읽지 않은 알림이 있을 때만 헤더 종 아이콘을 표시하고, 문의 화면 로드 후 안전하게 읽음 처리한다.

**Architecture:** 기존 `inquiries` 문서에 관리자·고객용 boolean 읽음 상태를 추가하고 `InquiryService`가 생성, 답변, 구독, 일괄 읽음 처리를 담당한다. 헤더는 전용 훅의 boolean 상태만 소비하며, 고객 `/cs/inquiry`와 관리자 `/admin/inquiries`가 데이터를 먼저 화면에 보존한 뒤 읽음 필드를 변경한다. `/mypage/qa`는 고객 문의 기준 화면으로 리다이렉트하고 상품 QnA는 `/qna`에 유지한다.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Firebase Firestore 12, TanStack Query 5, Jest 30, Testing Library, Firebase Rules Emulator

## Global Constraints

- 모든 사용자 문구와 문서는 한국어로 작성한다.
- 기존 Next.js, React, Firebase, Jest 구조를 유지하고 새 의존성을 추가하지 않는다.
- 1:1 문의는 `inquiries`, 상품 QnA는 `qna`를 기준 저장소로 사용한다.
- 알림이 있을 때만 종 아이콘을 표시하고 숫자 배지, 빨간 점, 팝오버를 추가하지 않는다.
- 이메일, SMS, 브라우저 푸시와 주문·쿠폰 알림은 구현하지 않는다.
- 신규 UI에 box-shadow와 추가 border-radius를 사용하지 않는다.
- 데스크톱과 모바일 종 아이콘의 클릭 목표 영역은 최소 44×44px로 유지한다.
- 기존 읽기 권한, 엄격 관리자 판정, hard delete 금지 정책을 유지한다.
- 기존 문의의 알림 필드 누락은 읽은 상태로 취급하고 별도 운영 데이터 백필을 실행하지 않는다.
- 사용자 승인 없이 운영 Firebase 데이터 생성·수정, 커밋, 푸시, 배포를 실행하지 않는다.
- 설계 기준은 `docs/superpowers/specs/2026-08-03-inquiry-notification-design.md`다.

## File Map

### Create

- `src/shared/services/inquiryService.test.ts`: 문의 알림 payload, legacy 매핑, 구독, 일괄 읽음 서비스 테스트
- `src/shared/hooks/useInquiryNotification.ts`: 인증 상태에 따른 Firestore 실시간 알림 구독 훅
- `src/shared/hooks/useInquiryNotification.test.tsx`: 구독 시작·해제·오류 상태 테스트
- `src/app/_components/header/InquiryNotificationLink.tsx`: 고객·관리자 목적지를 분리하는 순수 종 아이콘 링크
- `src/app/admin/inquiries/page.test.tsx`: 신규 문의 필터, 읽음 처리, 답변 흐름 테스트
- `src/app/admin/_components/adminNav.test.tsx`: 관리자 1:1 문의 링크와 활성 상태 테스트

### Modify

- `src/shared/types/inquiry.ts`: `unreadForAdmin`, `unreadForCustomer` 타입 추가
- `src/shared/services/inquiryService.ts`: 알림 필드 생성·매핑, 실시간 구독, 읽음 batch, 답변 원자 업데이트
- `firestore.rules`: 문의 알림 생성값과 작성자·엄격 관리자 업데이트 규칙
- `functions/__tests__/firestoreRules.test.ts`: 알림 권한 행렬 테스트
- `firestore.indexes.json`: 고객 미확인 답변 조회 인덱스
- `src/app/_components/header/Header.tsx`: 훅 연결, 데스크톱·모바일 종 링크, 접근성 상태 메시지
- `src/app/_components/header/Header.module.css`: 44px 알림 링크와 모바일 액션 배치
- `src/app/_components/header/Header.test.tsx`: 역할별 종 표시·링크·접근성·비로그인 테스트
- `src/app/cs/inquiry/page.tsx`: query 초기 탭, 새 답변 우선 정렬·자동 펼침·로드 후 읽음 처리
- `src/app/cs/inquiry/page.test.tsx`: 고객 알림 도착과 읽음 처리 순서 테스트
- `src/app/mypage/qa/page.tsx`: `/cs/inquiry?tab=list` 서버 리다이렉트
- `src/app/mypage/_components/SidebarMenu.tsx`: 문의관리 링크 변경
- `src/app/mypage/_components/SidebarMenu.test.tsx`: 고객 문의 기준 경로 검증
- `src/app/admin/inquiries/page.tsx`: unread 필터, 목록 보존 후 관리자 읽음 처리
- `src/app/admin/_components/adminNav.tsx`: 1:1 문의 관리 링크 추가
- `docs/header-ui.md`: 종 아이콘 위치와 반응형 동작 기록
- `docs/mypage-ui.md`: 문의관리 기준 경로와 QnA 분리 기록
- `docs/security-admin-permission.md`: 문의 알림 필드 권한 기록

### Preserve

- `src/app/mypage/qa/page.module.css`: 리다이렉트 전환 후 사용되지 않아도 삭제 승인을 받기 전까지 보존한다.
- `src/shared/services/simpleQnAService.ts`: 상품 QnA 흐름을 유지하므로 수정하지 않는다.
- `src/app/qna/**`: 상품 QnA 화면과 작성 흐름을 수정하지 않는다.

---

### Task 1: 문의 알림 타입과 Firestore 서비스 경계

**Files:**
- Create: `src/shared/services/inquiryService.test.ts`
- Modify: `src/shared/types/inquiry.ts`
- Modify: `src/shared/services/inquiryService.ts`

**Interfaces:**
- Consumes: Firebase `onSnapshot`, `query`, `where`, `limit`, `writeBatch`, `doc`, `updateDoc`, `serverTimestamp`
- Produces: `InquiryNotificationAudience`, `InquiryService.subscribeToUnreadInquiries`, `InquiryService.markInquiriesRead`

```ts
export type InquiryNotificationAudience = 'admin' | 'customer';

export interface SubscribeToUnreadInquiryOptions {
  audience: InquiryNotificationAudience;
  userId: string;
}

static subscribeToUnreadInquiries(
  options: SubscribeToUnreadInquiryOptions,
  onChange: (hasUnread: boolean) => void,
  onError?: (error: Error) => void,
): Unsubscribe;

static async markInquiriesRead(
  inquiryIds: string[],
  audience: InquiryNotificationAudience,
): Promise<void>;
```

- [ ] **Step 1: 문의 생성·답변 payload의 실패 테스트를 작성한다.**

`src/shared/services/inquiryService.test.ts`에 Firebase 함수를 mock하고 다음 계약을 추가한다.

```ts
test('creates a customer inquiry with only the admin notification unread', async () => {
  jest.mocked(addDoc).mockResolvedValue({ id: 'inquiry-1' } as never);

  await InquiryService.createInquiry(
    'owner-1',
    'owner@example.com',
    '작성자',
    { category: 'other', title: '문의', content: '문의 내용' },
  );

  expect(jest.mocked(addDoc).mock.calls[0][1]).toEqual(expect.objectContaining({
    unreadForAdmin: true,
    unreadForCustomer: false,
  }));
});

test('answers atomically and creates a customer notification', async () => {
  await InquiryService.answerInquiry('inquiry-1', {
    content: '답변 내용',
    answeredBy: '관리자',
  });

  expect(updateDoc).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
    status: 'answered',
    unreadForAdmin: false,
    unreadForCustomer: true,
  }));
});
```

- [ ] **Step 2: 서비스 테스트가 알림 필드 누락으로 실패하는지 확인한다.**

Run: `npm test -- --runTestsByPath src/shared/services/inquiryService.test.ts`

Expected: 두 payload 테스트가 `unreadForAdmin` 또는 `unreadForCustomer` 누락으로 FAIL한다.

- [ ] **Step 3: `Inquiry` 타입과 생성·답변 payload에 알림 필드를 추가한다.**

`src/shared/types/inquiry.ts`의 `Inquiry`에 필드를 필수 boolean으로 추가한다.

```ts
export interface Inquiry {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  category: 'order' | 'delivery' | 'exchange' | 'product' | 'account' | 'other';
  title: string;
  content: string;
  status: 'waiting' | 'answered' | 'closed';
  createdAt: Date;
  updatedAt: Date;
  unreadForAdmin: boolean;
  unreadForCustomer: boolean;
  answer?: {
    content: string;
    answeredBy: string;
    answeredAt: Date;
  };
}
```

`createInquiry`에는 `true/false` 초기값을 넣고 `answerInquiry`에는 다음 필드를 같은 `updateDoc` 호출에 넣는다.

```ts
await updateDoc(inquiryRef, {
  answer: {
    ...answer,
    answeredAt: serverTimestamp(),
  },
  status: 'answered',
  unreadForAdmin: false,
  unreadForCustomer: true,
  updatedAt: serverTimestamp(),
});
```

- [ ] **Step 4: 기존 문서를 읽은 상태로 변환하는 실패 테스트를 추가한다.**

```ts
test('maps legacy inquiry notification fields to read', async () => {
  jest.mocked(getDocs).mockResolvedValue({
    docs: [{
      id: 'legacy-1',
      data: () => ({
        userId: 'owner-1',
        category: 'other',
        title: '기존 문의',
        content: '기존 내용',
        status: 'waiting',
        createdAt: { toDate: () => new Date('2026-01-01') },
        updatedAt: { toDate: () => new Date('2026-01-01') },
      }),
    }],
  } as never);

  const inquiries = await InquiryService.getUserInquiries('owner-1');

  expect(inquiries[0]).toEqual(expect.objectContaining({
    unreadForAdmin: false,
    unreadForCustomer: false,
  }));
});
```

- [ ] **Step 5: 모든 문의 매핑 지점에서 boolean을 정규화한다.**

`getUserInquiries`, `getAllInquiries`, `getInquiry`의 반환 객체에 다음 정규화를 공통으로 적용한다. 중복이 커지면 `mapInquiryDocument(id, data)` private 함수로 한정해 추출한다.

```ts
unreadForAdmin: data.unreadForAdmin === true,
unreadForCustomer: data.unreadForCustomer === true,
```

- [ ] **Step 6: 역할별 실시간 구독 계약 테스트를 작성한다.**

```ts
test.each([
  ['customer', 'unreadForCustomer'],
  ['admin', 'unreadForAdmin'],
] as const)('subscribes to %s unread inquiries', (audience, field) => {
  InquiryService.subscribeToUnreadInquiries(
    { audience, userId: 'owner-1' },
    jest.fn(),
  );

  expect(where).toHaveBeenCalledWith(field, '==', true);
  if (audience === 'customer') {
    expect(where).toHaveBeenCalledWith('userId', '==', 'owner-1');
  }
  expect(limit).toHaveBeenCalledWith(1);
  expect(onSnapshot).toHaveBeenCalledTimes(1);
});
```

구독 callback은 `snapshot.empty`가 아니면 `onChange(true)`, 오류면 `onChange(false)` 후 `onError(error)`를 호출하도록 테스트한다.

- [ ] **Step 7: `subscribeToUnreadInquiries`를 구현한다.**

고객 쿼리에는 `userId`와 `unreadForCustomer`, 관리자 쿼리에는 `unreadForAdmin`만 사용한다. 두 쿼리 모두 `limit(1)`을 적용하고 Firebase가 반환한 `Unsubscribe`를 그대로 반환한다.

```ts
const constraints = options.audience === 'admin'
  ? [where('unreadForAdmin', '==', true), limit(1)]
  : [
      where('userId', '==', options.userId),
      where('unreadForCustomer', '==', true),
      limit(1),
    ];

return onSnapshot(
  query(collection(db, COLLECTION_NAME), ...constraints),
  (snapshot) => onChange(!snapshot.empty),
  (error) => {
    onChange(false);
    onError?.(error);
  },
);
```

- [ ] **Step 8: 중복 ID 제거와 역할별 필드만 쓰는 batch 테스트를 작성한다.**

테스트 상단 Firebase mock에서 batch spy를 다음처럼 연결한다.

```ts
const batchUpdate = jest.fn();
const batchCommit = jest.fn().mockResolvedValue(undefined);

jest.mocked(writeBatch).mockReturnValue({
  update: batchUpdate,
  commit: batchCommit,
} as never);
```

```ts
test('marks unique customer inquiry ids as read', async () => {
  await InquiryService.markInquiriesRead(
    ['inquiry-1', 'inquiry-1', 'inquiry-2'],
    'customer',
  );

  expect(batchUpdate).toHaveBeenCalledTimes(2);
  expect(batchUpdate).toHaveBeenCalledWith(expect.anything(), {
    unreadForCustomer: false,
  });
  expect(batchCommit).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 9: `markInquiriesRead`를 450개 단위 batch로 구현한다.**

```ts
const uniqueIds = Array.from(new Set(inquiryIds.filter(Boolean)));
const field = audience === 'admin' ? 'unreadForAdmin' : 'unreadForCustomer';

for (let start = 0; start < uniqueIds.length; start += 450) {
  const batch = writeBatch(db);
  uniqueIds.slice(start, start + 450).forEach((inquiryId) => {
    batch.update(doc(db, COLLECTION_NAME, inquiryId), { [field]: false });
  });
  await batch.commit();
}
```

- [ ] **Step 10: 서비스 테스트 전체를 통과시킨다.**

Run: `npm test -- --runTestsByPath src/shared/services/inquiryService.test.ts`

Expected: `inquiryService.test.ts`의 생성, 답변, legacy 매핑, 구독, batch 테스트가 모두 PASS한다.

---

### Task 2: Firestore 알림 권한과 인덱스

**Files:**
- Modify: `firestore.rules`
- Modify: `functions/__tests__/firestoreRules.test.ts`
- Modify: `firestore.indexes.json`
- Modify: `src/shared/services/inquiryService.test.ts`

**Interfaces:**
- Consumes: Task 1의 정확한 `unreadForAdmin`, `unreadForCustomer` payload
- Produces: 작성자 고객 알림 읽음 규칙, 엄격 관리자 문의 알림 읽음 규칙, 답변 알림 규칙

- [ ] **Step 1: 테스트 fixture에 정확한 초기 알림 값을 추가한다.**

`inquiryData`가 기존 저장 문서와 신규 생성 테스트를 모두 지원하도록 기본 값을 명시한다.

```ts
function inquiryData(userId = 'owner-1') {
  return {
    userId,
    userEmail: `${userId}@example.com`,
    userName: `${userId} name`,
    category: 'order',
    title: '일반 문의',
    content: '문의 내용',
    status: 'waiting',
    createdAt: fixedTime,
    updatedAt: fixedTime,
    unreadForAdmin: true,
    unreadForCustomer: false,
  };
}
```

- [ ] **Step 2: 생성값 위조와 작성자 읽음 권한 실패 테스트를 추가한다.**

```ts
test.each([
  ['admin notification', { unreadForAdmin: false }],
  ['customer notification', { unreadForCustomer: true }],
])('denies forged inquiry %s on creation', async (_name, override) => {
  const ownerDb = testEnv.authenticatedContext('owner-1', {
    email: 'owner-1@example.com',
  }).firestore();

  await assertFails(addDoc(collection(ownerDb, 'inquiries'), {
    ...validInquiryCreate(),
    ...override,
  }));
});

test('allows only the owner to clear a customer notification', async () => {
  const ownerDb = testEnv.authenticatedContext('owner-1').firestore();
  const otherDb = testEnv.authenticatedContext('user-1').firestore();

  await testEnv.withSecurityRulesDisabled(async (context) => {
    await updateDoc(doc(context.firestore(), 'inquiries', 'inquiry-1'), {
      unreadForCustomer: true,
    });
  });

  await assertSucceeds(updateDoc(doc(ownerDb, 'inquiries', 'inquiry-1'), {
    unreadForCustomer: false,
  }));
  await assertFails(updateDoc(doc(otherDb, 'inquiries', 'inquiry-1'), {
    unreadForCustomer: false,
  }));
});
```

작성자가 `unreadForCustomer: true`, `unreadForAdmin: false`, 본문 변경을 시도하는 거부 테스트도 각각 추가한다.

- [ ] **Step 3: 엄격 관리자 읽음과 답변 알림 결합 실패 테스트를 추가한다.**

```ts
test('allows a strict admin to clear only the admin notification', async () => {
  const adminDb = testEnv.authenticatedContext('admin-1', { admin: true }).firestore();

  await assertSucceeds(updateDoc(doc(adminDb, 'inquiries', 'inquiry-1'), {
    unreadForAdmin: false,
  }));
});

test('requires a valid answer when creating a customer notification', async () => {
  const adminDb = testEnv.authenticatedContext('admin-1', { admin: true }).firestore();

  await assertFails(updateDoc(doc(adminDb, 'inquiries', 'inquiry-1'), {
    unreadForCustomer: true,
    updatedAt: serverTimestamp(),
  }));
});
```

기존 유효 답변 테스트에는 `unreadForAdmin: false`, `unreadForCustomer: true`를 추가한다. claim-only, role-only, inactive admin의 읽음 변경 거부도 기존 table test에 포함한다.

- [ ] **Step 4: Rules Emulator에서 신규 테스트가 실패하는지 확인한다.**

Run: `npm run test:rules`

Expected: 문의 생성 필드 allowlist, 작성자 알림 읽음, 관리자 단독 읽음 또는 답변 알림 규칙이 없어 inquiry rules가 FAIL한다.

- [ ] **Step 5: 문의 생성 allowlist와 초기값 검증을 추가한다.**

`inquiryCreateAllowedKeys()`에 두 키를 넣고 `isValidInquiryCreate()`에 정확한 초기값을 추가한다.

```text
request.resource.data.unreadForAdmin == true &&
request.resource.data.unreadForCustomer == false
```

- [ ] **Step 6: 작성자와 관리자 읽음 전용 규칙 함수를 분리한다.**

```text
function isValidInquiryOwnerReadUpdate() {
  let changed = request.resource.data.diff(resource.data).affectedKeys();
  return isActiveOwner(resource.data.userId) &&
    request.resource.data.userId == resource.data.userId &&
    changed.hasOnly(['unreadForCustomer']) &&
    resource.data.get('unreadForCustomer', false) == true &&
    request.resource.data.unreadForCustomer == false;
}

function isValidInquiryAdminReadUpdate() {
  let changed = request.resource.data.diff(resource.data).affectedKeys();
  return isStrictAdmin() &&
    changed.hasOnly(['unreadForAdmin']) &&
    resource.data.get('unreadForAdmin', false) == true &&
    request.resource.data.unreadForAdmin == false;
}
```

- [ ] **Step 7: 관리자 답변 규칙에 고객 알림 결합 조건을 추가한다.**

`isValidInquiryAdminUpdate()`의 허용 키를 `answer`, `status`, `updatedAt`, `unreadForAdmin`, `unreadForCustomer`로 제한하고 다음을 강제한다.

```text
(!changed.hasAny(['answer']) ||
  (isValidInquiryAnswer() &&
    request.resource.data.status == 'answered' &&
    request.resource.data.unreadForAdmin == false &&
    request.resource.data.unreadForCustomer == true)) &&
(!changed.hasAny(['unreadForCustomer']) ||
  (changed.hasAny(['answer']) && request.resource.data.unreadForCustomer == true))
```

`match /inquiries/{inquiryId}`의 update는 세 규칙 중 하나만 허용한다.

```text
allow update: if isValidInquiryAdminUpdate() ||
  isValidInquiryAdminReadUpdate() ||
  isValidInquiryOwnerReadUpdate();
```

- [ ] **Step 8: 고객 알림 조회 인덱스를 선언하고 계약 테스트를 추가한다.**

`firestore.indexes.json`에 다음 인덱스를 추가한다.

```json
{
  "collectionGroup": "inquiries",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "userId", "order": "ASCENDING" },
    { "fieldPath": "unreadForCustomer", "order": "ASCENDING" }
  ]
}
```

`inquiryService.test.ts`에서 JSON을 읽어 `['userId', 'unreadForCustomer']` 조합이 존재하는지 검증한다.

- [ ] **Step 9: 규칙과 서비스 테스트를 통과시킨다.**

Run: `npm test -- --runTestsByPath src/shared/services/inquiryService.test.ts`

Run: `npm run test:rules`

Expected: 서비스 테스트 PASS, Firestore·Storage rules 전체 PASS. Emulator 종료 시 기존 Java teardown 경고가 발생하더라도 프로세스 exit code와 Jest 실패 수를 기준으로 판정한다.

---

### Task 3: 실시간 훅과 조건부 헤더 종 아이콘

**Files:**
- Create: `src/shared/hooks/useInquiryNotification.ts`
- Create: `src/shared/hooks/useInquiryNotification.test.tsx`
- Create: `src/app/_components/header/InquiryNotificationLink.tsx`
- Modify: `src/app/_components/header/Header.tsx`
- Modify: `src/app/_components/header/Header.module.css`
- Modify: `src/app/_components/header/Header.test.tsx`

**Interfaces:**
- Consumes: `InquiryService.subscribeToUnreadInquiries`
- Produces: `useInquiryNotification(options): boolean`, 역할별 `InquiryNotificationLink`

```ts
interface UseInquiryNotificationOptions {
  userId: string | null;
  isAdmin: boolean;
  enabled: boolean;
}

export function useInquiryNotification(
  options: UseInquiryNotificationOptions,
): boolean;
```

- [ ] **Step 1: 구현 직전에 Impeccable UI 품질 기준을 로드한다.**

Run: `Get-Content -Raw -Encoding UTF8 'C:\Users\박도영\.agents\skills\impeccable\reference\craft-floor.md'`

Expected: 기존 헤더 시각 문법, 최소 목표 영역, 접근성, 추가 그림자·radius 금지를 구현 체크리스트에 반영한다.

- [ ] **Step 2: 훅 구독·해제·오류 실패 테스트를 작성한다.**

```tsx
import { renderHook } from '@testing-library/react';
import { InquiryService } from '@/shared/services/inquiryService';
import { useInquiryNotification } from './useInquiryNotification';

jest.mock('@/shared/services/inquiryService', () => ({
  InquiryService: {
    subscribeToUnreadInquiries: jest.fn(),
  },
}));

test('subscribes after auth is ready and cleans up on account change', () => {
  const unsubscribe = jest.fn();
  jest.mocked(InquiryService.subscribeToUnreadInquiries)
    .mockReturnValue(unsubscribe);

  const { rerender, unmount } = renderHook(
    ({ userId }) => useInquiryNotification({
      userId,
      isAdmin: false,
      enabled: true,
    }),
    { initialProps: { userId: 'owner-1' as string | null } },
  );

  expect(InquiryService.subscribeToUnreadInquiries).toHaveBeenCalledWith(
    { audience: 'customer', userId: 'owner-1' },
    expect.any(Function),
    expect.any(Function),
  );

  rerender({ userId: null });
  expect(unsubscribe).toHaveBeenCalledTimes(1);
  unmount();
});
```

`enabled: false`, `userId: null`에서는 구독하지 않고 false를 반환하며, error callback이 실행되면 false로 복귀하는 테스트를 추가한다.

- [ ] **Step 3: `useInquiryNotification`을 구현한다.**

```ts
useEffect(() => {
  if (!enabled || !userId) {
    setHasUnread(false);
    return;
  }

  setHasUnread(false);
  return InquiryService.subscribeToUnreadInquiries(
    { audience: isAdmin ? 'admin' : 'customer', userId },
    setHasUnread,
    (error) => {
      console.error('문의 알림 구독 실패:', error);
      setHasUnread(false);
    },
  );
}, [enabled, isAdmin, userId]);
```

- [ ] **Step 4: 역할별 링크의 실패 테스트를 `Header.test.tsx`에 추가한다.**

`useInquiryNotification`을 mock하고 다음을 검증한다.

```tsx
function mockSignedInAuth({ isAdmin }: { isAdmin: boolean }) {
  jest.mocked(useAuth).mockReturnValue({
    user: { uid: 'owner-1' },
    userData: {
      email: 'owner-1@example.com',
      name: '작성자',
      role: isAdmin ? 'admin' : 'user',
      status: 'active',
    },
    isAdmin,
    loading: false,
    isUserDataLoading: false,
    logout: jest.fn(),
  } as unknown as ReturnType<typeof useAuth>);
}

test.each([
  [false, '/cs/inquiry?tab=list', '새 문의 답변 확인'],
  [true, '/admin/inquiries?filter=unread', '새 고객 문의 확인'],
] as const)('renders an unread inquiry bell for admin=%s', (isAdmin, href, label) => {
  mockSignedInAuth({ isAdmin });
  jest.mocked(useInquiryNotification).mockReturnValue(true);
  render(<Header />);

  const links = screen.getAllByRole('link', { name: label });
  expect(links).toHaveLength(2);
  links.forEach((link) => expect(link).toHaveAttribute('href', href));
});

test('does not render a bell without unread inquiries', () => {
  mockSignedInAuth({ isAdmin: false });
  jest.mocked(useInquiryNotification).mockReturnValue(false);
  render(<Header />);

  expect(screen.queryByRole('link', { name: '새 문의 답변 확인' }))
    .not.toBeInTheDocument();
});
```

비로그인·인증 로딩 상태에서 훅이 disabled로 호출되고 종이 렌더링되지 않는 테스트도 추가한다.

- [ ] **Step 5: 순수 `InquiryNotificationLink`를 구현한다.**

```tsx
interface InquiryNotificationLinkProps {
  isAdmin: boolean;
  className: string;
  onNavigate?: () => void;
}

export default function InquiryNotificationLink({
  isAdmin,
  className,
  onNavigate,
}: InquiryNotificationLinkProps) {
  const href = isAdmin
    ? '/admin/inquiries?filter=unread'
    : '/cs/inquiry?tab=list';
  const label = isAdmin ? '새 고객 문의 확인' : '새 문의 답변 확인';

  return (
    <Link href={href} className={className} aria-label={label} onClick={onNavigate}>
      <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
      </svg>
    </Link>
  );
}
```

SVG는 생성 이미지가 아니라 색상과 크기를 상속하는 단색 UI control glyph로만 사용하며 별도 이미지 자산을 만들지 않는다.

- [ ] **Step 6: `Header`에서 인증 완료 후 훅을 한 번만 호출한다.**

`useAuth`에서 `loading`, `isUserDataLoading`을 함께 받고 다음 값을 만든다.

```ts
const authReady = !authLoading && !isUserDataLoading && Boolean(user);
const hasUnreadInquiry = useInquiryNotification({
  userId: user?.uid ?? null,
  isAdmin,
  enabled: authReady,
});
```

데스크톱은 `마이페이지` 링크 직후, 모바일은 로고 반대편의 `mobileHeaderActions` 안에서 메뉴 버튼 직전에 같은 상태를 소비해 링크를 각각 한 번 렌더링한다. 모바일 링크의 `onNavigate`는 `closeMobileMenu`를 사용한다.

- [ ] **Step 7: 접근성 상태 메시지와 44px 스타일을 추가한다.**

```tsx
<span className={styles.visuallyHidden} role="status" aria-live="polite">
  {hasUnreadInquiry
    ? (isAdmin ? '새 고객 문의가 있습니다.' : '새 문의 답변이 있습니다.')
    : ''}
</span>
```

```css
.notificationLink {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  min-width: 44px;
  height: 44px;
  color: var(--text-subtle);
  text-decoration: none;
}

.notificationLink svg {
  width: 19px;
  height: 19px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.6;
}

.mobileHeaderActions {
  display: flex;
  align-items: center;
  margin-left: auto;
}

.visuallyHidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
```

기존 media query에서 데스크톱은 모바일용 링크를 숨기고 `.userMenu`의 링크만 표시한다. 알림 링크 focus-visible은 기존 헤더 outline 규칙에 포함한다.

- [ ] **Step 8: 헤더 테스트와 훅 테스트를 통과시킨다.**

Run: `npm test -- --runTestsByPath src/shared/hooks/useInquiryNotification.test.tsx src/app/_components/header/Header.test.tsx`

Expected: 역할별 목적지, 알림 없음, 인증 로딩, 접근 가능한 이름, 구독 해제가 모두 PASS한다.

---

### Task 4: 고객 문의 기준 화면과 마이페이지 경로 통합

**Files:**
- Modify: `src/app/cs/inquiry/page.tsx`
- Modify: `src/app/cs/inquiry/page.test.tsx`
- Modify: `src/app/mypage/qa/page.tsx`
- Modify: `src/app/mypage/_components/SidebarMenu.tsx`
- Modify: `src/app/mypage/_components/SidebarMenu.test.tsx`

**Interfaces:**
- Consumes: `InquiryService.getUserInquiries`, `InquiryService.markInquiriesRead(ids, 'customer')`
- Produces: `/cs/inquiry?tab=list` 초기 목록, 새 답변 우선 표시, `/mypage/qa` 서버 리다이렉트

- [ ] **Step 1: query 초기 탭과 새 답변 펼침 실패 테스트를 추가한다.**

`page.test.tsx`에 navigation mock과 읽음 서비스 mock을 추가한다.

```tsx
import { useSearchParams } from 'next/navigation';

jest.mock('next/navigation', () => ({
  useSearchParams: jest.fn(),
}));

jest.mock('@/shared/services/inquiryService', () => ({
  InquiryService: {
    createInquiry: jest.fn(),
    getUserInquiries: jest.fn(),
    markInquiriesRead: jest.fn(),
  },
}));
```

```tsx
test('opens unread answers from the notification route and then marks them read', async () => {
  jest.mocked(useSearchParams).mockReturnValue(
    new URLSearchParams('tab=list') as unknown as ReturnType<typeof useSearchParams>,
  );
  jest.mocked(InquiryService.getUserInquiries).mockResolvedValue([
    {
      id: 'answered-1',
      userId: 'owner-1',
      userEmail: 'owner-1@example.com',
      userName: '문서 작성자',
      category: 'other',
      title: '답변된 문의',
      content: '문의 내용',
      status: 'answered',
      createdAt: new Date('2026-08-01'),
      updatedAt: new Date('2026-08-03'),
      unreadForAdmin: false,
      unreadForCustomer: true,
      answer: {
        content: '관리자 답변',
        answeredBy: '관리자',
        answeredAt: new Date('2026-08-03'),
      },
    },
  ]);

  render(<InquiryPage />);

  expect(await screen.findByText('관리자 답변')).toBeInTheDocument();
  await waitFor(() => expect(InquiryService.markInquiriesRead)
    .toHaveBeenCalledWith(['answered-1'], 'customer'));
});
```

목록 로드 실패 시 `markInquiriesRead`가 호출되지 않는 테스트도 추가한다.

- [ ] **Step 2: 고객 화면 테스트가 초기 write 탭과 닫힌 답변 때문에 실패하는지 확인한다.**

Run: `npm test -- --runTestsByPath src/app/cs/inquiry/page.test.tsx`

Expected: `관리자 답변`을 찾지 못하거나 읽음 서비스 호출이 없어 FAIL한다.

- [ ] **Step 3: reactive query string에서 목록 탭을 읽고 중복 로드를 제거한다.**

```ts
const searchParams = useSearchParams();
const requestedTab = searchParams.get('tab') === 'list' ? 'list' : 'write';
const [activeTab, setActiveTab] = useState<'write' | 'list'>(requestedTab);

useEffect(() => {
  if (requestedTab === 'list') setActiveTab('list');
}, [requestedTab]);
```

문의 등록 성공 시 `setActiveTab('list')`만 실행하고 기존의 직접 `loadUserInquiries()` 호출을 제거해 activeTab effect와의 중복 조회를 막는다.

`useSearchParams`를 사용하는 본문을 `InquiryPageContent`로 분리하고 default export는 Suspense 경계로 감싼다.

```tsx
export default function InquiryPage() {
  return (
    <Suspense fallback={<div className={styles.inquiryContainer}>문의 화면을 준비하는 중입니다.</div>}>
      <InquiryPageContent />
    </Suspense>
  );
}
```

- [ ] **Step 4: unread 문의를 상단에 보존하고 첫 답변을 자동으로 펼친다.**

`loadUserInquiries`에서 원본 결과를 다음 순서로 처리한다.

```ts
const unreadIds = userInquiries
  .filter((inquiry) => inquiry.unreadForCustomer)
  .map((inquiry) => inquiry.id);
const orderedInquiries = [...userInquiries].sort((a, b) => {
  const unreadOrder = Number(b.unreadForCustomer) - Number(a.unreadForCustomer);
  return unreadOrder || b.updatedAt.getTime() - a.updatedAt.getTime();
});

setInquiries(orderedInquiries);
setOpenItems((current) => unreadIds.length > 0
  ? Array.from(new Set([...current, unreadIds[0]]))
  : current);
setPendingCustomerReadIds(unreadIds);
```

- [ ] **Step 5: 렌더 이후 customer 읽음 effect를 추가한다.**

```ts
useEffect(() => {
  if (loading || activeTab !== 'list' || pendingCustomerReadIds.length === 0) return;

  void InquiryService.markInquiriesRead(pendingCustomerReadIds, 'customer')
    .then(() => setPendingCustomerReadIds([]))
    .catch((error) => console.error('문의 답변 읽음 처리 실패:', error));
}, [activeTab, loading, pendingCustomerReadIds]);
```

실패 시 pending ID를 유지하되 effect 의존값을 변경하지 않아 즉시 재시도 loop가 생기지 않게 한다.

- [ ] **Step 6: 마이페이지 문의 링크와 리다이렉트 실패 테스트를 작성한다.**

`SidebarMenu.test.tsx`의 기대 경로를 `/cs/inquiry?tab=list`로 변경한다. `src/app/mypage/qa/page.test.tsx`를 새로 만들지 않고 단순 서버 redirect는 소스 계약으로 검증한다.

```ts
test('routes inquiry management to the canonical customer inquiry screen', () => {
  render(<SidebarMenu activeTab="reviews" logout={jest.fn()} />);
  screen.getAllByRole('link', { name: '문의관리' }).forEach((link) => {
    expect(link).toHaveAttribute('href', '/cs/inquiry?tab=list');
  });
});
```

- [ ] **Step 7: `/mypage/qa`를 서버 redirect로 변경한다.**

```tsx
import { redirect } from 'next/navigation';

export default function QAPage() {
  redirect('/cs/inquiry?tab=list');
}
```

`SidebarMenu.tsx`의 문의관리 href도 같은 경로로 바꾼다. `page.module.css`는 삭제하지 않는다.

- [ ] **Step 8: 고객 경로 관련 테스트를 통과시킨다.**

Run: `npm test -- --runTestsByPath src/app/cs/inquiry/page.test.tsx src/app/mypage/_components/SidebarMenu.test.tsx`

Expected: 문의 등록 identity 테스트, query 초기 목록, 자동 펼침, 읽음 호출, 마이페이지 링크가 모두 PASS한다.

---

### Task 5: 관리자 신규 문의 필터와 답변 알림

**Files:**
- Create: `src/app/admin/inquiries/page.test.tsx`
- Create: `src/app/admin/_components/adminNav.test.tsx`
- Modify: `src/app/admin/inquiries/page.tsx`
- Modify: `src/app/admin/_components/adminNav.tsx`

**Interfaces:**
- Consumes: `InquiryService.getAllInquiries`, `InquiryService.markInquiriesRead(ids, 'admin')`, `InquiryService.answerInquiry`
- Produces: `/admin/inquiries?filter=unread`의 화면 보존형 신규 문의 목록, 관리자 내비게이션 링크

- [ ] **Step 1: unread 진입 목록과 렌더 후 읽음 실패 테스트를 작성한다.**

테스트에서 `useSearchParams`와 문의 서비스를 mock한다.

```tsx
import { useSearchParams } from 'next/navigation';

jest.mock('next/navigation', () => ({
  useSearchParams: jest.fn(),
}));

jest.mock('@/shared/services/inquiryService', () => ({
  InquiryService: {
    getAllInquiries: jest.fn(),
    markInquiriesRead: jest.fn(),
    answerInquiry: jest.fn(),
    updateInquiryStatus: jest.fn(),
  },
}));
```

```tsx
function makeInquiry(overrides: Partial<Inquiry> = {}): Inquiry {
  return {
    id: 'inquiry-1',
    userId: 'owner-1',
    userEmail: 'owner-1@example.com',
    userName: '작성자',
    category: 'other',
    title: '문의',
    content: '문의 내용',
    status: 'waiting',
    createdAt: new Date('2026-08-03T00:00:00.000Z'),
    updatedAt: new Date('2026-08-03T00:00:00.000Z'),
    unreadForAdmin: false,
    unreadForCustomer: false,
    ...overrides,
  };
}

test('keeps unread inquiries visible after marking them read', async () => {
  jest.mocked(useSearchParams).mockReturnValue(
    new URLSearchParams('filter=unread') as unknown as ReturnType<typeof useSearchParams>,
  );
  jest.mocked(InquiryService.getAllInquiries).mockResolvedValue([
    makeInquiry({ id: 'new-1', unreadForAdmin: true, title: '새 문의' }),
    makeInquiry({ id: 'read-1', unreadForAdmin: false, title: '기존 문의' }),
  ]);
  jest.mocked(InquiryService.markInquiriesRead).mockResolvedValue();

  render(<AdminInquiriesPage />);

  expect(await screen.findByRole('heading', { name: '새 문의' })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: '기존 문의' })).not.toBeInTheDocument();
  await waitFor(() => expect(InquiryService.markInquiriesRead)
    .toHaveBeenCalledWith(['new-1'], 'admin'));
  expect(screen.getByRole('heading', { name: '새 문의' })).toBeInTheDocument();
});
```

목록 조회 실패 시 읽음 처리를 호출하지 않는 테스트를 추가한다.

- [ ] **Step 2: 관리자 페이지 테스트가 unread 필터 미지원으로 실패하는지 확인한다.**

Run: `npm test -- --runTestsByPath src/app/admin/inquiries/page.test.tsx`

Expected: 기존 문의도 함께 표시되거나 `markInquiriesRead`가 호출되지 않아 FAIL한다.

- [ ] **Step 3: reactive filter와 pending admin read 상태를 추가한다.**

```ts
const searchParams = useSearchParams();
const requestedFilter = searchParams.get('filter') === 'unread' ? 'unread' : 'all';
const [selectedFilter, setSelectedFilter] = useState(requestedFilter);
const [pendingAdminReadIds, setPendingAdminReadIds] = useState<string[]>([]);

useEffect(() => {
  if (requestedFilter === 'unread') setSelectedFilter('unread');
}, [requestedFilter]);
```

상태 옵션 첫 부분에 `{ value: 'unread', label: '새 문의' }`를 추가한다.

관리자 본문도 `AdminInquiriesPageContent`로 분리하고 default export를 Suspense 경계로 감싸 동일 route에서 query만 바뀌는 경우에도 필터가 반영되게 한다.

- [ ] **Step 4: `loadInquiries`에서 unread snapshot을 화면에 보존한다.**

```ts
if (selectedFilter === 'unread') {
  const unreadInquiries = allInquiries.filter((inquiry) => inquiry.unreadForAdmin);
  filteredInquiries = unreadInquiries;
  setPendingAdminReadIds(unreadInquiries.map((inquiry) => inquiry.id));
} else if (selectedFilter !== 'all') {
  filteredInquiries = allInquiries.filter((inquiry) => inquiry.status === selectedFilter);
}
```

`setInquiries(filteredInquiries)`를 Firestore 쓰기보다 먼저 실행하고 읽음 성공 후 현재 `inquiries` state를 다시 필터링하지 않는다.

- [ ] **Step 5: 렌더 이후 admin 읽음 effect를 추가한다.**

```ts
useEffect(() => {
  if (loading || selectedFilter !== 'unread' || pendingAdminReadIds.length === 0) return;

  void InquiryService.markInquiriesRead(pendingAdminReadIds, 'admin')
    .then(() => setPendingAdminReadIds([]))
    .catch((error) => console.error('신규 문의 읽음 처리 실패:', error));
}, [loading, pendingAdminReadIds, selectedFilter]);
```

- [ ] **Step 6: 답변 저장 서비스 호출 계약을 테스트한다.**

관리자 페이지 테스트에서 답변 모달을 열고 내용을 입력한 뒤 `answerInquiry`가 기존 인자 계약으로 한 번 호출되는지 검증한다. 고객 알림 필드는 UI가 조립하지 않고 Task 1의 서비스가 원자적으로 추가한다.

```tsx
expect(InquiryService.answerInquiry).toHaveBeenCalledWith('new-1', {
  content: '관리자 답변',
  answeredBy: 'Admin',
});
```

- [ ] **Step 7: 관리자 내비게이션 링크 실패 테스트를 작성한다.**

```tsx
import { render, screen } from '@testing-library/react';
import { usePathname } from 'next/navigation';
import AdminNav from './adminNav';

jest.mock('next/navigation', () => ({
  usePathname: jest.fn(),
}));

test('exposes the 1:1 inquiry management route', () => {
  jest.mocked(usePathname).mockReturnValue('/admin/inquiries');
  render(<AdminNav />);

  expect(screen.getByRole('link', { name: '1:1 문의 관리' }))
    .toHaveAttribute('href', '/admin/inquiries');
  expect(screen.getByRole('link', { name: '1:1 문의 관리' }))
    .toHaveAttribute('aria-current', 'page');
});
```

- [ ] **Step 8: 관리자 내비게이션에 문의 링크를 추가한다.**

`QnA 관리` 바로 앞에 다음 항목을 추가해 일반 문의와 상품 QnA를 구분한다.

```ts
{ href: '/admin/inquiries', label: '1:1 문의 관리' },
{ href: '/admin/qna', label: 'QnA 관리' },
```

- [ ] **Step 9: 관리자 관련 테스트를 통과시킨다.**

Run: `npm test -- --runTestsByPath src/app/admin/inquiries/page.test.tsx src/app/admin/_components/adminNav.test.tsx src/app/admin/answerLengthContract.test.ts`

Expected: unread 목록 보존, 읽음 호출, 답변 서비스 호출, 관리자 링크, 답변 길이 계약이 모두 PASS한다.

---

### Task 6: 문서 동기화와 전체 검증

**Files:**
- Modify: `docs/header-ui.md`
- Modify: `docs/mypage-ui.md`
- Modify: `docs/security-admin-permission.md`
- Verify: `docs/superpowers/specs/2026-08-03-inquiry-notification-design.md`

**Interfaces:**
- Consumes: Task 1~5의 최종 타입, 경로, 권한, UI 동작
- Produces: 최신 프로젝트 문서와 검증 결과

- [ ] **Step 1: 동작이 바뀐 문서만 짧게 갱신한다.**

`docs/header-ui.md`에 다음 사실을 기록한다.

```md
## 2026-08-03 1:1 문의 알림
- 읽지 않은 문의 또는 답변이 있을 때만 데스크톱 마이페이지 오른쪽과 모바일 메뉴 버튼 옆에 종 아이콘을 표시한다.
- 일반 고객은 `/cs/inquiry?tab=list`, 엄격 관리자는 `/admin/inquiries?filter=unread`로 이동한다.
- 숫자 배지와 팝오버 없이 최소 44px 링크와 역할별 접근 가능한 이름을 사용한다.
```

`docs/mypage-ui.md`에는 `/mypage/qa` 리다이렉트와 상품 QnA 분리를, `docs/security-admin-permission.md`에는 두 알림 필드의 작성자·엄격 관리자 변경 범위를 기록한다.

- [ ] **Step 2: 변경 범위 Jest 테스트를 한 번에 실행한다.**

Run:

```powershell
npm test -- --runTestsByPath `
  src/shared/services/inquiryService.test.ts `
  src/shared/hooks/useInquiryNotification.test.tsx `
  src/app/_components/header/Header.test.tsx `
  src/app/cs/inquiry/page.test.tsx `
  src/app/mypage/_components/SidebarMenu.test.tsx `
  src/app/admin/inquiries/page.test.tsx `
  src/app/admin/_components/adminNav.test.tsx `
  src/app/admin/answerLengthContract.test.ts
```

Expected: 지정한 모든 suite가 PASS하고 실패 테스트와 snapshot 변경이 없다.

- [ ] **Step 3: 타입·린트·Rules·빌드를 순서대로 실행한다.**

Run: `npm run typecheck`

Run: `npx eslint src/shared/types/inquiry.ts src/shared/services/inquiryService.ts src/shared/services/inquiryService.test.ts src/shared/hooks/useInquiryNotification.ts src/shared/hooks/useInquiryNotification.test.tsx src/app/_components/header/Header.tsx src/app/_components/header/InquiryNotificationLink.tsx src/app/_components/header/Header.test.tsx src/app/cs/inquiry/page.tsx src/app/cs/inquiry/page.test.tsx src/app/mypage/qa/page.tsx src/app/mypage/_components/SidebarMenu.tsx src/app/mypage/_components/SidebarMenu.test.tsx src/app/admin/inquiries/page.tsx src/app/admin/inquiries/page.test.tsx src/app/admin/_components/adminNav.tsx src/app/admin/_components/adminNav.test.tsx`

Run: `npm run test:rules`

Run: `npm run build`

Expected: 모든 명령 exit code 0. Rules Emulator의 종료 경고가 있으면 Jest 실패 수와 최종 exit code를 함께 기록한다.

- [ ] **Step 4: UI detector를 변경 완료 후 한 번만 실행한다.**

Run:

```powershell
node 'C:\Users\박도영\.agents\skills\impeccable\scripts\detect.mjs' --json `
  'src/app/_components/header/Header.tsx' `
  'src/app/_components/header/Header.module.css' `
  'src/app/_components/header/InquiryNotificationLink.tsx' `
  'src/app/cs/inquiry/page.tsx' `
  'src/app/admin/inquiries/page.tsx'
```

Expected: 신규 box-shadow, 불필요한 radius, 44px 미만 목표 영역, 접근성 위반이 없다. 발견 사항은 한 번의 수정 batch로 처리한다.

- [ ] **Step 5: 브라우저에서 비파괴 화면 검증을 수행한다.**

- 비로그인: 종 아이콘이 표시되지 않는다.
- 일반 회원: `/cs/inquiry?tab=list` 진입과 기존 문의 목록이 정상 표시된다.
- 일반 회원: `/mypage/qa`가 고객 문의 목록으로 이동한다.
- 일반 회원: `/admin/inquiries` 접근이 차단된다.
- 관리자: 관리자 내비게이션에서 `1:1 문의 관리`로 이동한다.
- 데스크톱과 모바일: 종 아이콘 공간, 한 줄 헤더, 44px 목표 영역, 키보드 포커스를 확인한다.

운영 Firebase에 새 문의·답변을 쓰는 전체 실시간 시나리오는 실행 직전에 해비님의 별도 승인을 받는다. 승인하지 않으면 Task 1 서비스 테스트와 Task 2 Rules Emulator 결과로 쓰기 흐름을 검증하고 브라우저는 읽기 전용으로 제한한다.

- [ ] **Step 6: 승인된 환경에서만 전체 알림 왕복을 검증한다.**

검증 데이터 제목은 `QA 문의 알림 2026-08-03`으로 한정하고 다음을 확인한다.

1. 고객 문의 등록 후 관리자 종 표시
2. 관리자 종 클릭 후 목록 유지와 종 제거
3. 관리자 답변 후 고객 종 표시
4. 고객 종 클릭 후 답변 자동 펼침과 종 제거
5. 다른 고객에게 해당 문의·알림 비노출

운영 데이터 생성 승인이 없으면 이 단계는 `미실행: 운영 Firebase 쓰기 승인 없음`으로 보고하며 완료로 가장하지 않는다.

- [ ] **Step 7: 최종 변경과 검증 결과를 점검한다.**

Run: `git diff --check`

Run: `git status --short`

Expected: 공백 오류 없음. 계획 범위 밖 파일 변경 없음. 커밋·푸시·배포 없음.

## Execution Notes

- 각 Task는 앞 Task의 공개 인터페이스에만 의존한다.
- Task 1과 Task 2는 데이터·권한 경계이므로 UI보다 먼저 완료한다.
- Task 3~5는 파일 일부가 겹치거나 Task 1 인터페이스에 의존하므로 같은 작업 트리에서 순차 실행한다.
- 사용자 승인 없이 worktree, stash, branch, 커밋을 만들지 않는다.
- 구현 중 기존 사용자 변경을 발견하면 덮어쓰지 않고 해당 파일의 diff를 먼저 확인한다.
