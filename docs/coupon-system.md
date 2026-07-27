# 쿠폰 시스템

## 구조

`coupons` 컬렉션에 쿠폰 마스터 데이터를 저장하고, `user_coupons` 컬렉션에서 사용자별 발급/사용 상태를 관리합니다.

### Firestore 컬렉션

```
coupons/
  {couponId}
    id, name, type('할인금액'|'할인율'|'무료배송'), value, minOrderAmount,
    expiryDate, description, isActive, createdAt, updatedAt

user_coupons/
  {userCouponId}
    uid, couponId, status('사용가능'|'사용완료'|'기간만료'),
    issuedDate, usedDate, orderId, createdAt, updatedAt
```

## 파일 구조

```
src/shared/types/coupon.ts            # 타입 정의
src/shared/services/couponService.ts  # 서비스 로직
src/context/couponProvider.tsx        # Context Provider
src/app/mypage/coupons/               # 쿠폰 페이지
functions/src/handlers/coupon.ts      # Cloud Functions HTTP handler
functions/src/domain/couponDomain.ts  # 쿠폰 코드/만료/상태 순수 로직
functions/__tests__/couponDomain.test.ts # 쿠폰 도메인 단위 테스트
src/shared/utils/kstDate.ts           # 클라이언트 KST date-only 계약
functions/src/domain/kstDate.ts       # Functions KST date-only 계약
scripts/coupon-seed-data.js           # 실행일 상대 순수 seed builder
scripts/seed-coupons.js               # import-safe seed CLI
```

## 기능

### CouponService
- 쿠폰 마스터 및 사용자 쿠폰 조회 (필터, 정렬)
- 주문 시 사용 가능 쿠폰 조회 (최소 주문금액, 만료일 검증)
- 타입별 할인금액 계산

### CouponProvider
- 사용자 쿠폰 목록, 통계, 로딩 상태 관리
- 발급/사용/등록/새로고침 액션
- 사용자 변경 시 자동 갱신

### Cloud Functions
- `action: "issue"`: 발급 (중복 검증)
- `action: "use"`: 사용 (만료일 검증)
- `action: "register"`: 코드 기반 쿠폰 등록
- `action: "cleanup"`: 만료 쿠폰 정리 (관리자)
- `action: "adminCreate"`: 쿠폰 마스터 생성 (관리자)
- `action: "adminUpdate"`: 쿠폰 마스터 수정 (관리자)
- `action: "adminArchive"`: 쿠폰 마스터 비활성화/보관 (관리자)
- 코드 정규화, 만료일 일 단위 판정, 사용 가능 상태 판정은 `couponDomain`에서 공통 처리한다.

## 2026-07-21 KST date-only 계약

- 클라이언트 `src/shared/utils/kstDate.ts`와 Functions `functions/src/domain/kstDate.ts`는 각각 `toKstDayKey()`, `parseCouponExpiryDay()`, `isExpiredOnKstDay()`를 제공하고 같은 경계 테스트를 통과한다.
- 쿠폰 만료일은 `Asia/Seoul` 달력 날짜로 해석한다. `YYYY-MM-DD`, `YYYY.MM.DD`, `YYYY/MM/DD`는 유효한 실제 날짜만 `YYYY-MM-DD`로 정규화한다.
- 만료일 당일의 서울 시간 마지막 순간까지 사용할 수 있고, `expiryDay < todayKstDay`일 때만 만료다. 해석할 수 없는 만료 값은 안전하게 만료로 취급한다.
- `CouponService`와 `orderPricing`은 만료 여부를 읽기 전용으로 계산한다. 클라이언트의 `expireUserCoupon()` 및 `user_coupons` 만료 `updateDoc()` 경로는 제거했으며, 상태 변경은 Functions와 scheduled cleanup이 담당한다.
- 날짜 전용 문자열의 두 구분자는 같아야 한다. `2026-07/21`, `2026.07/21`처럼 구분자를 섞은 값은 브라우저의 관대한 `Date` 파싱으로 넘기지 않고 만료 값으로 거부한다.

## 2026-07-21 사용자 전환·checkout 준비 상태

- `CouponProvider`는 overview generation과 필터 목록 generation을 분리하고 활성 UID를 함께 확인한다. overview는 통계·truncation·준비 상태를 독립적으로 갱신하되, 이후 시작된 필터 목록을 덮지 않는다. 반대로 새 overview는 그보다 먼저 시작된 필터 응답을 무효화한다.
- 공용 `loading`은 진행 중인 비동기 작업 수로 계산한다. refresh·필터·등록·사용·주문 쿠폰 조회가 겹쳐도 하나가 먼저 끝났다는 이유로 조기에 `false`가 되지 않는다.
- `userCouponsReady`는 현재 UID와 실제 로드가 완료된 UID가 같을 때만 `true`다. 준비 전에는 이전 계정의 쿠폰·통계·사용 가능 목록을 외부에 노출하지 않는다.
- 첫 쿠폰 목록 요청이 실패하면 빈 목록을 성공으로 가장하지 않고 오류를 유지한다. checkout은 오류 해소 또는 사용자의 명시적 `쿠폰을 선택하지 않음` 선택 전까지 저장 쿠폰이 포함된 주문 제출을 차단한다.
- 서버 count가 50건 이하를 가리키더라도 `user_coupons` 목록은 항상 다시 읽는다. 이 경로의 `total`과 상태 수는 그 목록 snapshot의 `records.length`로 계산하며, 앞선 count가 0이거나 50이어도 실제 목록이 늘어난 상황을 보수적으로 반영한다. 실제 records가 50건을 넘으면 반환 목록은 50건으로 제한하고 `isTruncated: true`로 표시한다.
- count가 50건을 넘으면 필수 Firestore Timestamp인 `createdAt` 내림차순으로 최신 50건만 읽는다. 이 쿼리는 `user_coupons(uid ASC, createdAt DESC)` 복합 인덱스를 사용한다. 표시용 `issuedDate`의 허용 구분자가 섞여도 서버 최신순 판정에는 영향을 주지 않는다.
- 대규모 이력의 전체 count, 최신 목록, 상태별 count는 서로 다른 Firestore read이므로 단일 snapshot이 아니다. 발급·사용이 동시에 일어나면 한 응답 안에서 합계가 순간적으로 다를 수 있는 eventual 통계이며, 다음 refresh에서 수렴한다.
- cart와 checkout은 주문금액별 `getAvailableCouponsForOrder()`를 실제 호출한다. overview 목록과 전체 사용 가능 결과를 ID로 병합해 50건 밖의 오래된 사용 가능 쿠폰도 선택·저장 쿠폰 복원이 가능하다. 금액이 바뀌면 늦은 이전 응답은 무시하고, 조회 중에는 선택·제출을 차단하며 실패 시 오류를 안내한 뒤 사용자가 쿠폰을 명시적으로 해제하면 쿠폰 없는 주문은 계속할 수 있다.
- 전체 사용 가능 후보는 TanStack Query에 UID와 refresh revision으로 캐시하고 일반 5분 GC 대상에서 제외한다. 같은 계정의 동시 요청은 하나로 합치고 주문 금액 변경은 캐시된 후보를 로컬 필터링하므로 Firestore 전체 조회를 반복하지 않는다. 50건 이하의 완전한 overview는 후보 캐시를 바로 채우며, overview 상태 변경만으로 Provider callback이 바뀌지 않아 checkout/cart가 같은 목록을 다시 읽지 않는다.
- 주문 후보 훅은 로드 결과를 loader identity와 주문 금액에 귀속한다. UID·refresh revision·주문 금액이 바뀐 첫 렌더부터 이전 결과와 `ready`를 숨기며, 이전 계정용 callback과 늦은 응답도 활성 UID 확인을 통과하지 못한다. 완전한 overview는 후보 캐시가 비어 있을 때만 채워 이미 완료된 더 최신 전체 후보를 덮지 않는다.
- 명시적 refresh는 후보 revision을 올려 기존 응답을 무효화하며 성공한 완전 overview로 새 캐시를 채운다. refresh가 실패하면 기존 overview를 준비 완료 데이터로 노출하지 않고 새 전체 후보만 사용하며, 후보 조회도 실패하면 빈 결과와 오류를 유지해 저장 쿠폰 주문을 차단한다. UID 변경·로그아웃·Provider 해제 시 이전 UID의 후보 캐시는 제거한다.
- overview 조회가 실패하면 오류를 유지한다. 마이페이지는 실패한 값을 `0`이나 계속되는 로딩 상태로 표시하지 않고 `확인 실패`로 안내한다.

## 2026-07-21 실행일 상대 seed

- `scripts/coupon-seed-data.js`의 `buildCouponSeedData(now)`는 KST 실행일인 `runDate`와 `coupons`, `userCoupons`를 반환한다. 유효 master는 실행일 `+14일`, `+30일`, `+60일`, 만료 master는 `-1일`처럼 상대 날짜로 만든다.
- 사용 가능·사용 완료·기간 만료 사용자 쿠폰도 `runDate` 기준 상대 날짜로 만들어 어느 실행일에도 유효 fixture와 만료 fixture가 함께 존재한다. 2026-06-29에 기록한 고정 과거 seed 문제는 이 builder로 해결했다.
- `scripts/seed-coupons.js`를 import하는 것만으로 dotenv, Firebase, Firestore를 초기화하거나 DB write를 실행하지 않는다. `loadCouponSeedRuntime()`과 `seedCouponData()`는 CLI main 경계에서만 호출한다.
- 문서 갱신 과정에서는 seed 명령이나 DB write를 실행하지 않았다.

## 2026-07-21 주문 만료 쿠폰 rollback 경계

- 주문 transaction 안에서 만료를 확인하면 `ExpiredOrderCouponError`를 던져 주문·재고·장바구니·포인트 변경 전체를 rollback한다. transaction 안에서는 쿠폰을 `기간만료`로 쓰지 않는다.
- outer catch가 `markExpiredUserCoupon()`을 별도 Firestore transaction으로 호출한다. 이 함수는 사용자 소유권, 현재 사용 가능 상태, master 쿠폰의 현재 만료 여부를 다시 확인한 뒤에만 `기간만료`를 기록한다.
- 별도 marking이 실패하면 주문 API는 500을 반환해 상태 저장 실패를 숨기지 않는다. marking이 성공하면 만료 쿠폰 응답은 410이다.

## 보안

- 모든 Functions에서 인증 검증
- 본인 쿠폰만 조회/사용 가능
- 동일 쿠폰 중복 발급 방지
- 사용 시 만료일 재검증

## 검증
- 2026-05-11: `functions/__tests__/couponDomain.test.ts`로 쿠폰 코드 대문자 정규화, UTC 일 단위 만료 판정, 사용 가능 상태 판정을 검증.
- 2026-05-12: 구매 흐름 점검에서 서버 주문 생성의 쿠폰 소유자/상태/활성/만료/최소 주문금액 검증을 확인했다. 다만 `/orders/cart` 화면의 쿠폰 선택/예상 금액은 상태만 필터링해 최소 주문금액, 만료, 무료배송 쿠폰 조건과 불일치할 수 있다.
- 2026-05-12: 관리자 쿠폰 생성/수정/비활성화는 `/api/coupon` Function 액션을 통해 수행하도록 변경했다. 이미 발급된 이력 보존을 위해 관리 화면의 삭제는 `isActive: false` 보관 처리로 동작한다.
- 2026-05-12: 장바구니/checkout 쿠폰 예상 계산을 `orderPricing` 유틸로 통합해 최소 주문금액, 만료, 무료배송 조건을 화면에서도 반영하도록 정리했다.
- 2026-05-12: 주문 생성 시 주문 문서에 `userCouponId`, `couponId`를 저장하고, 주문 취소 트랜잭션에서 해당 `user_coupons` 문서의 상태를 `사용가능`으로 복원한다.
- 2026-06-12: 로컬 Next dev에서도 `/api/coupon`이 Cloud Function `coupon`으로 프록시되도록 App Router route를 추가했다. 쿠폰 등록/관리 액션은 로컬과 배포 환경 모두 같은 서버 검증 경계를 사용한다.
- 2026-06-22: `action: "issue"`는 코드 없는 직접 발급 쿠폰만 허용하도록 제한했다. 코드 쿠폰은 `register` 액션을 통해서만 등록되며, 비활성/만료/발급 한도 초과 쿠폰은 서버에서 차단한다.
- 2026-06-29: Firebase Hosting rewrite가 Next middleware를 우회해도 민감 응답이 캐시되지 않도록 `coupon` Function 자체에 `no-store` 헤더를 적용했다.
- 2026-06-29: `register`/`issue`의 중복 확인, 발급 한도 확인, `user_coupons` 생성, `usedCount` 증가를 Firestore transaction 안에서 처리하도록 정리했다.

## 미구현

- 만료 임박 알림
- `cleanupExpiredCoupons`는 현재 단일 Firestore batch를 사용하므로 만료 대상이 500 writes를 넘지 않도록 batch 분할이 필요하다. 이번 범위에서는 구현하지 않았다.
- scheduled cleanup은 사용자 쿠폰마다 master 쿠폰을 개별 조회하는 N+1 구조다. coupon master read cache 또는 사전 조회 최적화는 이번 범위에서 구현하지 않았다.

## 2026-06-29 Chrome 주문 QA 메모
- 일반 회원 계정의 장바구니 쿠폰 드롭다운은 렌더링됐지만 현재 계정에 사용 가능한 쿠폰이 없어 실제 쿠폰 할인/복원은 Chrome 실주문에서 검증하지 못했다.
- 당시 시드 쿠폰 만료일이 2024~2025년 중심이었던 문제는 2026-07-21 실행일 상대 `buildCouponSeedData()`로 해결했다. 다만 실제 seed 실행과 Firebase 데이터 기반 쿠폰 QA는 수행하지 않았다.

## 2026-07-10 발급 권한과 이벤트 보상
- `action: "issue"`는 관리자만 사용할 수 있는 직접 발급 기능이다. 일반 회원은 쿠폰 코드 등록만 할 수 있다.
- `functions/src/domain/couponIssuance.ts`가 중복·활성·만료·한도 확인과 `user_coupons`/`usedCount` 쓰기를 공통 transaction으로 제공한다.
- 자동 쿠폰 이벤트는 `rewardCouponId`를 설정하고, 이벤트 참여 transaction 안에서 쿠폰을 한 번만 지급한다.
