# Firestore 관리자 권한 모델 정리

## 목표
- `users/{uid}` 문서의 자기 변경에서 민감 필드를 차단한다.
- 권한 판정을 Firebase Custom Claims 중심으로 통일한다.
- 관리자 페이지 접근은 `isAdmin` 기반 가드로만 통제한다.

## 영향 범위
- `firestore.rules`
- `functions/src/utils/auth.ts`
- `functions/src/handlers/adminUsers.ts`
- `functions/src/index.ts`
- `functions/firebase.json` rewrite
- `src/context/authProvider.tsx`
- `src/app/admin/_components/AuthChecking.tsx`
- `src/app/admin/dashboard/page.tsx`
- `src/app/admin/dashboard/dashboard/page.tsx`
- `src/app/admin/page.tsx`

## 검증 기준
- `npx tsc --noEmit --pretty false`
- `npx jest --runInBand`
- `npm run build` (Next 컴파일은 통과, `spawn EPERM`은 기존 환경 이슈)
- `npm run lint` (ESLint 설정 이슈로 자동 검증 불가)

## 구현 요약
- `firestore.rules`의 `isAdmin()`을 제거하고 custom claim(`admin == true` 또는 `role == "admin"`) 기준으로 변경.
- `users/{uid}` create/update 규칙에서 일반 유저가 수정 가능한 필드와 금지 필드를 분리.
- `isAdmin` 판정에서 `users/{uid}.role` fallback를 제거하고 ID token claim만 사용.
- 관리자 기능 변경 API(` /api/admin/users`)는 Function을 통해 claim/표시 필드만 업데이트.
- `AuthChecking`을 관리 라우트 통합 가드로 사용하고, 상태 분기(로딩/비로그인/권한 없음)를 명시.
- `/admin/dashboard` 진입 페이지와 `/admin/dashboard/dashboard`의 중복 권한 가드를 제거하고 가드로 위임.

## 결과 (요청 기준)
- 일반 사용자의 `role`, `pointBalance`, `status` 직접 수정은 Firestore 규칙에서 차단 대상.
- 관리자 판정은 custom claim 기반으로 통일되어 `user.role` 직접 신뢰 동작 제거.
- admin 경로는 로딩/미로그인/권한 없음 상태로 분기되는 가드 동작 적용.
- 기존 사용자 정보 조회, 포인트 조회/관리 흐름은 유지.
- 2026-05-11: 메인 카테고리 순서 설정용 `categoryOrder/{configId}`는 공개 읽기, 관리자 쓰기 규칙을 추가했다. 상품/카테고리 공개 노출 데이터와 같은 공개 화면 설정으로 취급한다.
- 2026-05-11: 배포 전 환경에서 `categoryOrder` 권한 오류가 나도 기본 카테고리 순서로 fallback하며, 개발 콘솔의 red error를 줄이기 위해 조회 실패 로그를 warning으로 낮췄다.
- 2026-05-12: 브랜드 목록용 `brandSummaries/{brandId}`는 공개 읽기, 관리자 쓰기 규칙을 추가했다. 상품 상세 데이터가 아닌 공개 목록 요약 데이터로 취급한다.
- 2026-05-12: Storage Rules의 관리자 판정도 Firestore/Functions/클라이언트와 같이 `admin == true` 또는 `role == "admin"` custom claim 기준으로 통일했다.
- 2026-06-12: 로컬 Next dev에서도 `/api/admin/users`가 Cloud Function `adminUsers`로 프록시되도록 App Router route를 추가했다. 관리자 권한 변경은 로컬 확인 시에도 custom claim 검증 Function 경계를 거친다.
- 2026-06-29: Firebase Hosting rewrite가 Next middleware를 우회해도 민감 응답이 캐시되지 않도록 `adminUsers`, `points`, `coupon` Function 자체에 `no-store` 헤더를 적용했다.
- 2026-06-29: 관리자 포인트 지급/차감은 클라이언트 Firestore 직접 쓰기 대신 `/api/points` 서버 경계를 거치도록 변경했다.
- 2026-06-29: 회원가입 보너스 포인트는 일반 사용자가 `add` 액션을 호출하지 않고 `signupBonus` 액션에서 사용자당 1회 transaction으로 지급한다.

## 남은 확인
- 일반 계정으로 `/admin` 접속 시 Unauthorized UI 분기와 비로그인 이동 UX는 통합 점검 필요.
- Firestore Emulator 또는 배포 환경에서 실제 규칙 self-update 차단 테스트 수행 필요.
- `categoryOrder`, `brandSummaries`, Storage 관리자 claim 반영을 위해 `firebase deploy --only firestore:rules,storage` 실행 필요.

## 2026-07-10 서버 권한 경계 보강
- 일반 사용자의 쿠폰 `issue` 액션을 차단하고, 직접 발급은 관리자·이벤트 보상 transaction만 사용한다.
- 이벤트 참여는 `/api/event/participate` Function이 결정적 참여 문서 ID와 단일 transaction으로 처리한다. 일반 사용자의 `eventParticipants`, `events`, `user_coupons` 직접 쓰기는 규칙에서 거부한다.
- 비밀 QnA는 비밀번호 공유 검증을 폐기하고 작성자 또는 custom claim 관리자만 읽을 수 있게 변경했다. 작성자는 본문 편집 필드만 바꿀 수 있으며 답변·조회수·작성자·생성일은 변경할 수 없다.
- Functions 공통 인증은 유효한 Firebase ID 토큰뿐 아니라 `users/{uid}.status`도 확인한다. `inactive`·`banned` 계정은 403으로 거부한다.
- 리뷰 작성자는 자신의 리뷰 본문·평점·이미지 등 편집 필드만 수정할 수 있다. `productId`, `userId`, `createdAt` 변경과 임의 필드 추가는 Firestore 규칙에서 차단한다.
- 리뷰 생성은 클라이언트 Firestore 쓰기를 허용하지 않고 `/api/review` Function에서만 처리한다. Function은 로그인 계정, 주문 소유권, 배송 완료(또는 구매 확정) 상태, 주문 상품·사이즈·색상 일치를 transaction으로 검증하며 같은 주문 상품 옵션에는 결정적 문서 ID로 1회만 생성한다. 기존 레거시 리뷰의 공개 조회와 작성자 수정·삭제 권한은 유지한다.
- `npm run test:rules`는 Firestore Emulator에서 이 권한 행렬을 검증한다. 현재 로컬 실행에는 Java 런타임이 필요하다.
