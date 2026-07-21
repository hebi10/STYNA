# 프로젝트 보안·품질 게이트 실행 계획

> 실행 방식: 현재 작업공간에서 테스트 우선으로 한 태스크씩 구현하고, 각 태스크마다 구현자와 리뷰어를 분리한다. 커밋·푸시·배포는 하지 않는다.

**목표:** 활성 계정·엄격 관리자 판정을 Functions와 Firestore에 일치시키고, 관리자 계정 변경과 AI 사용량 제한을 서버 경계로 옮기며, CSV·빌드·마이그레이션·의존성 품질 게이트를 재현 가능하게 만든다.

**핵심 구조:** 새 계정은 `status: active`, `role: user`로 생성한다. 민감 Function은 revoked token, 존재하는 활성 사용자 문서, token claim과 문서 role의 이중 관리자 판정을 사용한다. 계정 상태·역할은 `adminUsers` Function만 변경한다. Firestore는 같은 계정 조건을 사용하고 주문 클라이언트 쓰기를 전면 차단한다. AI 제공자 호출은 배포 Function 한 곳에서만 수행하며 Firestore transaction 카운터로 UID/익명 세션/네트워크 축을 함께 제한한다.

**기술 스택:** Next.js 15 App Router, React 19, Firebase Auth/Firestore/Functions, Firestore Rules Emulator, Jest/Testing Library, TypeScript.

---

## 공통 실행 원칙

- 기능 변경 전 실패 테스트를 먼저 추가하고 실제 실패 원인을 확인한다.
- 기존 주문 transaction, QnA 비밀글 조회, Hosting rewrite, 사용자 변경 파일인 `docs/image-delivery-performance.md`, `next.config.test.ts`, `next.config.ts`는 보존한다.
- `users/{uid}`가 없는 기존 계정은 의도적으로 fail-closed 처리한다. 배포 전 백필 필요성만 문서화하고 실제 데이터 변경·배포는 하지 않는다.
- 계정 삭제는 기존 의미를 보존한 soft delete다. 사용자 문서를 `deleted`로 닫고 Auth를 disable/revoke하며 사용자 데이터나 Auth 레코드를 파괴적으로 지우지 않는다.
- 관리자 본인의 역할·상태가 바뀐 경우에만 현재 클라이언트 토큰을 강제 갱신하고, 갱신 실패 시 로그아웃한다. 다른 사용자의 세션은 서버의 문서 판정과 refresh-token revoke로 차단한다.
- 각 태스크 완료 시 focused test → 타입체크/Functions build 등 해당 범위 검증 → 독립 코드 리뷰 순서로 진행한다.

## Task 1: 가입 기본값과 공통 서버 인증 계약

**Files**

- Create: `src/app/auth/signup/signupUserDocument.ts`
- Create: `src/app/auth/signup/signupUserDocument.test.ts`
- Modify: `src/app/auth/signup/page.tsx`
- Modify: `scripts/seed-users.js`
- Modify: `functions/__tests__/auth.test.ts`
- Modify: `functions/src/utils/auth.ts`

**1. 실패 테스트 작성**

- `buildSignupUserDocument(uid, formData, timestamp)`가 기존 프로필 필드와 함께 `status: "active"`, `role: "user"`, `createdAt`, `updatedAt`을 반환하는지 검증한다.
- `verifyAuthContext()`가 `verifyIdToken(token, true)`를 호출하는지 검증한다.
- 사용자 문서 부재, `inactive`, `banned`, `deleted`, 미정의 상태를 모두 403으로 거부하는지 검증한다.
- 관리자 권한은 `(admin === true 또는 role claim === "admin")`과 사용자 문서 `role === "admin"`이 동시에 참일 때만 부여되는 행렬을 검증한다.
- revoked token 검증 실패는 401로 정규화되는지 검증한다.

**2. 최소 구현**

- 가입 payload 생성 함수를 분리하고 화면의 `setDoc()`이 해당 함수를 사용하게 한다.
- 사용자 시드 문서에도 `status: "active"`, `role: "user"`를 추가한다. 시드가 Auth 사용자를 만든다고 오해하게 만드는 동작은 추가하지 않는다.
- `verifyAuthContext()`는 `verifyIdToken(token, true)` 후 `users/{uid}`를 읽는다. 문서가 존재하고 상태가 정확히 `active`일 때만 성공한다.
- `AuthContext.role`은 사용자 문서 role을 사용하고 `isAdmin`은 token claim과 문서 role을 교차 검증한다. `verifyAuth()`와 `requireAdmin()` 공개 시그니처는 유지한다.

**3. 검증**

```powershell
npm test -- --runInBand src/app/auth/signup/signupUserDocument.test.ts functions/__tests__/auth.test.ts
npm run functions:build
npm run typecheck
```

## Task 2: 관리자 계정 상태·역할·삭제 서버화

**Files**

- Modify: `functions/src/handlers/adminUsers.ts`
- Modify: `functions/__tests__/httpHandlers.test.ts`
- Modify: `src/shared/services/adminUserService.ts`
- Modify: `src/shared/services/adminUserService.test.ts`
- Modify: `src/shared/types/user.ts`
- Create: `src/shared/utils/authAccess.ts`
- Create: `src/shared/utils/authAccess.test.ts`
- Modify: `src/context/authProvider.tsx`

**1. 실패 테스트 작성**

- `adminUsers`가 `setRole`, `setStatus`, `deleteUser` 외 action과 잘못된 role/status를 400으로 거부하는지 검증한다.
- 관리자 승격은 기존 custom claims를 보존하면서 `role/admin` claim을 갱신하고 refresh token을 회수하며, 활성 문서인데 Auth가 disabled인 복구 상태라면 Auth를 enable한 뒤 대상 사용자 문서 role/isAdmin을 마지막에 연다. 관리자 강등은 사용자 문서를 먼저 닫고 claim을 제거한 뒤 token을 회수한다.
- `inactive`/`banned`는 문서 상태를 먼저 닫고 Auth `disabled: true`, token revoke를 수행하는지 검증한다.
- `active` 복구는 Auth를 먼저 enable하고 기존 token을 회수한 뒤 사용자 문서를 마지막에 active로 여는지 검증한다. 문서가 없거나 중간 단계가 실패하면 복구하지 않는다.
- `deleteUser`는 문서를 `deleted`로 먼저 바꾸고 Auth disable/revoke를 수행하되 Auth 레코드와 Firestore 사용자 데이터는 삭제하지 않는지 검증한다.
- 교차 서비스 단계 실패 시 503과 `retryable: true`를 반환한다. 권한을 여는 최종 문서 쓰기의 결과가 모호하면 rollback하지 않는다. 미커밋이면 문서가 닫힌 상태이고 커밋이면 승인된 요청의 완성 상태이므로, 동일 요청 재시도가 두 경우 모두 안전하게 200으로 수렴하는지 검증한다.
- 클라이언트 서비스의 상태 변경·삭제·역할 변경이 `/api/admin/users`만 호출하고 `updateDoc`을 호출하지 않는지 검증한다.
- 변경 대상이 현재 사용자면 `getIdToken(true)`를 호출하고 실패 시 `signOut()`하는지 검증한다.
- `hasStrictAdminAccess(claims, userData)`가 claim, 문서 role, active 상태를 모두 요구하는지 검증한다.

**2. 최소 구현**

- 요청 body를 다음 discriminated union으로 처리한다.

```ts
type AdminUserAction =
  | { action: "setRole"; userId: string; role: "user" | "admin" }
  | { action: "setStatus"; userId: string; status: "active" | "inactive" | "banned" }
  | { action: "deleteUser"; userId: string };
```

- 모든 action은 강화된 `requireAdmin()`을 통과해야 한다.
- 역할 변경 전 Auth 사용자와 Firestore 사용자 문서의 존재를 확인한다. 승격 순서는 custom claims → token revoke → 필요 시 Auth enable → 문서 role/isAdmin이며, 강등 순서는 문서 role/isAdmin → custom claims → token revoke다. 최종 문서 쓰기 뒤에는 권한 관련 후속 단계가 없어야 한다.
- 비활성·정지·삭제는 문서 상태 → Auth disable → token revoke 순서다. 활성 복구는 Auth enable → token revoke → 문서 상태 active 순서다.
- refresh token 회수나 Auth disable만으로 기존 ID token이 Security Rules에서 즉시 무효화된다고 가정하지 않는다. same-state 요청도 문서 role/isAdmin, custom claims, Auth disabled 상태를 확인·보정한 뒤에만 unchanged로 처리한다.
- 서비스의 `updateUserStatus()`와 `deleteUser()`에서 Firestore 직접 쓰기를 제거하고 공통 API helper를 사용한다. 응답은 일반 오류만 노출한다.
- `UserProfile`/`AdminUserData`의 조회 상태에는 `deleted`를 포함하되 `setStatus` 입력에는 포함하지 않는다.
- `AuthProvider`의 화면용 관리자 판정도 `hasStrictAdminAccess()`를 사용한다. 로그인 시 사용자 문서가 없거나 상태가 active가 아니면 로그아웃하고 일반 오류 메시지를 표시한다. 신규 가입은 Auth 생성 전부터 사용자 문서 생성과 사용자 쿼리 갱신이 끝날 때까지 명시적인 provisioning 상태로 묶어 임시 문서 부재를 차단 사유로 오판하지 않는다.

**3. 검증**

```powershell
npm test -- --runInBand functions/__tests__/httpHandlers.test.ts src/shared/services/adminUserService.test.ts src/shared/utils/authAccess.test.ts
npm run functions:build
npm run typecheck
```

## Task 3: Firebase Rules 활성 계정·엄격 관리자·쓰기 스키마

**Files**

- Modify: `firestore.rules`
- Modify: `storage.rules`
- Modify: `firebase.rules-test.json`
- Modify: `jest.config.js`
- Modify: `jest.rules.config.js`
- Modify: `package.json`
- Create: `functions/__tests__/storageRules.test.ts`
- Modify: `functions/__tests__/firestoreRules.test.ts`
- Modify: `src/shared/services/qnaService.ts`
- Modify: `src/shared/services/qnaService.test.ts`

**1. Rules fixture 정리**

- rules-disabled seed에 active owner/user, inactive/banned/deleted user, claim+문서 role을 모두 가진 active admin, claim-only admin, role-only admin, inactive admin을 만든다.
- 테스트 작성 시 `createdAt`/`updatedAt`은 `serverTimestamp()`를 사용해 `request.time` 검증과 일치시킨다.

**2. 실패 테스트 작성**

- 자기 가입은 `status: active`, `role: user`, 허용 키만 있을 때 성공하며 admin role, 비활성 상태, 임의 키는 실패한다.
- active owner의 허용된 쓰기만 성공하고 비활성·정지·삭제·문서 없는 사용자의 cart/wishlist/QnA/inquiry 쓰기는 실패한다.
- claim-only, role-only, inactive admin은 관리자 쓰기에 실패하고 active+claim+role admin만 성공한다.
- Storage 이미지 쓰기도 claim-only, role-only, inactive admin은 실패하고 active+claim+role admin만 성공한다. 공개 이미지 읽기와 크기·MIME 제한은 보존한다.
- 관리자 브라우저도 `users` status/role update·delete와 `orders` update·delete를 직접 할 수 없다.
- QnA/inquiry 생성에서 forged userId/email/name, 임의 시간, answer/views, 비허용 키, waiting 이외 상태를 거부한다.
- QnA 작성자는 본문 필드와 기존 soft-close만 변경할 수 있고 답변·조회수·작성자·생성일을 바꾸지 못한다.
- strict admin은 QnA/inquiry의 답변·상태·updatedAt만 변경할 수 있고 소유권·본문 생성 필드를 바꾸지 못한다.
- 공개 QnA 목록 쿼리는 `isSecret == false`를 명시해 Security Rules가 전체 결과 집합을 안전하다고 증명할 수 있어야 한다. 사용자 본인의 비밀 문의 목록과 서버 검증 상세 흐름은 보존한다.

**3. 최소 규칙 구현**

- `isActiveAccount()`는 로그인, `users/{uid}` 존재, `status == "active"`를 요구한다.
- `isStrictAdmin()`은 active account, admin token claim, 문서 `role == "admin"`을 모두 요구한다. 기존 관리자 쓰기 조건은 이 helper로 통일한다.
- Storage Rules의 관리자 판정도 `firestore.get()`으로 같은 사용자 문서의 active/admin 조건을 확인해 claim-only 접근을 차단한다.
- 자기 사용자 문서 create는 bootstrap 예외로 active account를 요구하지 않되 정확한 기본 role/status와 허용 키를 강제한다. 자기 profile update는 active owner만 허용한다.
- 관리자 클라이언트의 `users` create/update/delete는 제거하고 strict admin read만 유지한다. Admin SDK Function은 Rules를 우회한다.
- `/orders/{orderId}`의 create/update/delete는 모두 false, read는 active owner 또는 strict admin으로 제한한다.
- `isValidQnACreate`, `isValidQnAOwnerUpdate`, `isValidQnAAdminUpdate`, `isValidInquiryCreate`, `isValidInquiryAdminUpdate`로 허용 필드와 관리 필드를 분리한다.

**4. 검증**

```powershell
npm run test:rules
```

## Task 4: AI Function 단일 제한 경계와 프록시 우회 차단

**Files**

- Create: `functions/src/domain/chatRateLimit.ts`
- Create: `functions/__tests__/chatRateLimit.test.ts`
- Modify: `functions/src/config/environment.ts`
- Modify: `functions/src/handlers/chat.ts`
- Modify: `functions/__tests__/httpHandlers.test.ts`
- Create: `src/shared/utils/chatSession.ts`
- Create: `src/shared/utils/chatSession.test.ts`
- Modify: `src/app/_components/chat/ChatWidget.tsx`
- Modify: `src/app/_components/chat/ChatWidget.test.tsx`
- Modify: `src/app/api/chat/route.ts`
- Modify: `src/app/api/chat/route.test.ts`
- Modify: `scripts/setup-firebase-secrets.js`

**1. 실패 테스트 작성**

- rate-limit domain은 같은 principal의 분당 11번째, 일 101번째 요청을 거부한다.
- UID principal과 network counter를 독립 집계해 세션을 바꾸거나 네트워크를 바꿔도 각각의 축을 우회할 수 없음을 검증한다.
- 저장 payload/document id에는 raw UID, session ID, IP가 없고 HMAC-SHA256 해시만 있는지 검증한다.
- transaction은 관련 counter 문서를 모두 읽은 뒤 허용된 요청에만 두 counter를 원자적으로 갱신한다.
- Function은 모든 응답에 no-store를 적용하고 초과 시 429, `Retry-After`, `retryAfterSeconds`를 반환하며 provider를 호출하지 않는다.
- Widget은 안정적인 `X-Chat-Session-Id`를 보내고 로그인 상태면 Bearer token도 보낸다.
- Next 프록시는 Authorization/session header를 전달하고 upstream 429를 그대로 반환하며 로컬 OpenAI를 재호출하지 않는다.
- upstream 장애나 미설정 상태에서는 규칙 기반 fallback만 반환하고 OpenAI provider를 직접 호출하지 않는다.

**2. rate-limit domain 구현**

```ts
interface ChatRateLimitSubject {
  principalHash: string;
  networkHash: string;
}

interface ChatRateLimitDecision {
  allowed: boolean;
  retryAfterSeconds?: number;
}

createChatRateLimitSubject(input): ChatRateLimitSubject;
consumeChatRateLimit(db, subject, nowMs?): Promise<ChatRateLimitDecision>;
```

- `CHAT_RATE_LIMIT_SALT` secret을 HMAC key로 사용한다. raw network 값은 해시 함수 호출 이후 저장·응답·로그에 포함하지 않는다.
- Function이 신뢰한 `req.ip`를 network 입력으로 사용하고, 클라이언트가 임의로 보내는 별도 IP header는 신뢰하지 않는다. 주소를 얻을 수 없으면 모든 unknown 요청이 공유하는 보수적 bucket을 사용한다.
- `chatRateLimits` 컬렉션에 principal/network별 한 문서씩 두고 minute window/count와 day window/count를 보관한다. 한 transaction에서 두 문서를 모두 읽고, 10/min 또는 100/day를 넘으면 어떤 counter도 증가시키지 않는다.
- 익명 principal은 session ID 해시, 로그인 principal은 UID 해시를 사용한다. network hash는 별도 문서로 집계해 session rotation을 막는다.

**3. Function/클라이언트/프록시 구현**

- `chat` Function 시작 즉시 `applyNoStoreHeaders()`를 호출한다.
- Authorization이 있으면 강화된 `verifyAuthContext()`를 사용하며 잘못된 토큰을 익명 요청으로 낮추지 않는다. Authorization이 없으면 익명 session을 사용한다.
- `CHAT_RATE_LIMIT_SALT` 또는 OpenAI secret이 없으면 provider를 호출하지 않고 기존 규칙 기반 fallback으로 안전하게 종료한다.
- Next route에서는 직접 OpenAI 호출 경로를 제거한다. 배포에서는 기존 Firebase Hosting `/api/chat` rewrite가 Function을 직접 사용하고, 로컬에서는 명시된 Function/emulator upstream만 AI를 호출한다.
- 429는 status/body/retry header를 보존한다. 다른 upstream 실패는 provider 재호출 없이 fallback을 반환한다.
- setup script와 환경 문서에는 secret 이름만 추가하며 실제 값을 출력하지 않는다.

**4. 검증**

```powershell
npm test -- --runInBand functions/__tests__/chatRateLimit.test.ts functions/__tests__/httpHandlers.test.ts src/shared/utils/chatSession.test.ts src/app/api/chat/route.test.ts src/app/_components/chat/ChatWidget.test.tsx
npm run functions:build
npm run typecheck
```

## Task 5: 사용자 CSV 안전 직렬화

**Files**

- Create: `src/shared/utils/csv.ts`
- Create: `src/shared/utils/csv.test.ts`
- Modify: `src/shared/services/adminUserService.ts`
- Modify: `src/shared/services/adminUserService.test.ts`

**1. 실패 테스트 작성**

- comma, quote, CR, LF, CRLF가 RFC 4180 규칙대로 quoting/quote doubling 되는지 검증한다.
- `=`, `+`, `-`, `@`, tab, CR로 시작하는 값에 apostrophe를 붙여 spreadsheet formula 실행을 막는지 검증한다.
- number, boolean, null, undefined, Date가 안정적으로 문자열화되는지 검증한다.
- 이름·이메일에 comma/quote/formula payload가 있어도 실제 사용자 export가 안전한 CSV를 만드는지 검증한다.

**2. 최소 구현**

```ts
export function escapeCsvCell(value: unknown): string;
export function createCsv(rows: ReadonlyArray<ReadonlyArray<unknown>>): string;
```

- 수식 prefix 중립화를 먼저 적용하고, 이후 quote doubling과 RFC 4180 wrapping을 수행한다.
- `AdminUserService.exportUsersToCSV()`만 공통 helper를 사용한다. 주문 CSV는 이번 승인 범위를 넘기므로 변경하지 않고 후속 위험으로 남긴다.

**3. 검증**

```powershell
npm test -- --runInBand src/shared/utils/csv.test.ts src/shared/services/adminUserService.test.ts
npm run typecheck
```

## Task 6: 빌드 compare-only와 import-safe 마이그레이션

**Files**

- Modify: `scripts/sync-chat-responses.js`
- Create: `scripts/sync-chat-responses.test.js`
- Create: `scripts/firestore-migration-runtime.js`
- Modify: `scripts/firestore-products-v2-migration.js`
- Create: `scripts/firestore-products-v2-migration.test.js`
- Modify: `package.json`

**1. 실패 테스트 작성**

- 동기화 check가 source/target 일치 시 성공하고 불일치 시 실패하되 target 파일을 쓰지 않는지 검증한다.
- `--write`를 명시할 때만 생성 파일을 갱신하는지 검증한다.
- migration module import만으로 `util-firestore-admin`, dotenv, Admin SDK 초기화 또는 Firestore 접근이 발생하지 않는지 검증한다.
- 명시적으로 runtime을 주입한 helper만 DB에 접근하는지 검증한다.

**2. 최소 구현**

```js
buildGeneratedChatResponses(source)
checkChatResponses(sourcePath?, targetPath?)
writeChatResponses(sourcePath?, targetPath?)
loadFirestoreMigrationRuntime()
```

- `sync:chat-responses`는 `--check` compare-only, `sync:chat-responses:write`는 명시적 갱신 명령으로 분리한다. `functions:build`는 compare-only check를 거친다.
- migration entrypoint만 `loadFirestoreMigrationRuntime()`을 호출한다. `analyzeStructure(options, runtime)`, `migrateProducts(options, runtime)`, `validateMigration(options, runtime)`은 주입된 runtime을 사용한다.
- 기존 `util-firestore-admin.js`를 사용하는 다른 운영 스크립트는 변경하지 않는다.
- `ci`와 `verify`에 `test:rules`를 포함한다. Java/Firestore Emulator 부재는 보안 게이트 실패로 취급한다.

**3. 검증**

```powershell
npm test -- --runInBand scripts/sync-chat-responses.test.js scripts/firestore-products-v2-migration.test.js
npm run sync:chat-responses
npm run functions:build
npm run test:rules
```

## Task 7: 호환 범위 의존성 보안 업데이트

**Files**

- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `functions/package.json`
- Modify: `functions/package-lock.json`

**1. 기준선 기록**

```powershell
npm audit --omit=dev
npm --prefix functions audit --omit=dev
```

- 자동 `npm audit fix`와 `--force`는 사용하지 않는다.
- 두 독립 lockfile을 각각 갱신하고 root와 Functions의 Next 버전을 동일하게 유지한다.

**2. 직접 의존성 업데이트**

- root: `next`와 `eslint-config-next`를 `15.5.20`, `firebase`를 `12.16.0`, 운영 스크립트가 사용하는 dev dependency `firebase-admin`을 `13.10.0`으로 올린다.
- Functions: `next`를 `15.5.20`, `firebase-admin`을 `13.10.0`, `firebase-functions`를 `6.6.0`으로 올린다.
- 모두 현재 major 범위 안의 호환 업데이트다. Admin 14/Functions 7/Next 16은 테스트 도구 peer 범위와 별도 마이그레이션이 필요하므로 적용하지 않는다.
- Next 15.5.20이 고정하는 취약한 `postcss@8.4.31`은 root와 Functions 각각에 검증 가능한 `overrides.postcss: "8.5.20"`을 명시한다. 이는 자동 audit fix가 아니라 동일 major의 단일 전이 의존성 교체이며, Next build와 Functions SSR build가 통과할 때만 유지한다.
- 패키지 매니저로 lockfile을 갱신한 뒤 예상 밖 direct dependency 변경이 없는지 diff를 검토한다.

**3. 검증과 중단 조건**

```powershell
npm run typecheck
npm run lint -- --max-warnings=0
npm test -- --runInBand
npm run functions:build
npm run test:rules
npm run build
npm audit --omit=dev
npm --prefix functions audit --omit=dev
```

- 같은 major 업데이트로 남는 취약점은 실제 의존 경로와 노출 범위를 기록한다. major downgrade/upgrade를 audit 숫자만 줄이기 위해 적용하지 않는다.
- 실제 결과는 root production audit 0건, Functions high/critical 0건이다. Functions moderate 집계는 동일 lockfile에서도 npm audit 서비스가 `firebase-functions` downstream synthetic effect를 포함하는지에 따라 8~9개로 변동했으며, 기반 리스크는 Admin 13의 Google Cloud 전이 경로에 남은 `uuid@9.0.1` advisory 한 건이다. audit가 제시한 Admin 14 major upgrade 또는 Admin 10/Functions 4 계열 downgrade는 이 계획 범위를 벗어나 적용하지 않았다.
- peer dependency 충돌, 빌드 회귀 또는 audit 악화가 있으면 해당 direct dependency만 이전 값으로 되돌리고 근거를 문서화한다.

## Task 8: 문서·단계 전체 검증·독립 리뷰

**Files**

- Modify: `docs/security-admin-permission.md`
- Modify: `docs/qna-secret-password.md`
- Modify: `docs/order-serverization.md`
- Modify: `docs/api-cache-debug-route.md`
- Modify: `docs/quality-gates.md`
- Modify: `docs/firestore-migration-plan.md`
- Modify: `docs/env-setup.md`
- Modify: `docs/superpowers/plans/2026-07-20-project-security-quality.md` only if implementation differs

**1. 문서 갱신**

- 활성 계정/엄격 관리자 조건, API-only 계정 변경, soft delete, 주문 직접 쓰기 차단, QnA/inquiry 허용 필드를 기록한다.
- AI 10/min·100/day, hashed network/session, 429/no-store, Function 단일 provider 경계와 `CHAT_RATE_LIMIT_SALT` 설정을 기록한다.
- compare-only sync, import-safe migration, `ci`/`verify`의 rules gate와 Java 전제를 기록한다.
- 실제 적용한 의존성 버전과 남은 audit 리스크만 사실대로 기록한다.

**2. 전체 검증**

```powershell
npm run typecheck
npm run lint -- --max-warnings=0
npm test -- --runInBand
npx tsc --noEmit --pretty false -p functions/tsconfig.json
npm run test:rules
npm run build
npm audit --omit=dev
npm --prefix functions audit --omit=dev
git diff --check
git status --short
```

**3. 독립 리뷰 기준**

- 계정/Rules reviewer: inactive·banned·deleted·missing 문서와 claim/doc 불일치가 Functions 및 Rules 양쪽에서 fail-closed인지 확인한다.
- AI reviewer: raw IP/session/UID가 저장·로그되지 않고 proxy/직접 Function 양쪽에서 제한을 우회할 수 없는지 확인한다.
- 품질 reviewer: build/test가 tracked source를 바꾸지 않고 migration import가 외부 초기화를 일으키지 않는지 확인한다.
- Critical/Important 지적을 수정하고 재검증한 뒤에만 정책·구매 흐름 단계로 이동한다.

## 완료 조건

- 민감 Function은 revoked token과 활성 사용자 문서를 요구한다.
- 관리자 판정은 token claim + active user document + admin document role을 모두 요구한다.
- 상태·역할·삭제는 Function만 수행하고 직접 Firestore 계정·주문 쓰기는 차단된다.
- AI provider 호출은 원자적 10/min·100/day 제한과 no-store/429 정책을 통과한다.
- 사용자 CSV가 RFC 4180과 formula injection 방어를 충족한다.
- Functions build와 test가 tracked source를 덮어쓰지 않고 migration helper import가 안전하다.
- `ci`/`verify`가 Rules Emulator 테스트를 포함하고 전체 검증이 통과한다.
- 커밋·푸시·배포나 실제 사용자 데이터 변경은 없다.
