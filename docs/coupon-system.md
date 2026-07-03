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
scripts/seed-coupons.js              # 시드 데이터
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

## 2026-06-29 Chrome 주문 QA 메모
- 일반 회원 계정의 장바구니 쿠폰 드롭다운은 렌더링됐지만 현재 계정에 사용 가능한 쿠폰이 없어 실제 쿠폰 할인/복원은 Chrome 실주문에서 검증하지 못했다.
- 시드 쿠폰 만료일이 2024~2025년 중심이라 2026-06-29 기준 실사용 쿠폰 QA에는 최신 테스트 쿠폰 데이터가 필요하다.
