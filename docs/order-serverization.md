# 주문 생성 서버화 정리

## 대상 파일
- `functions/src/handlers/order.ts`
- `functions/src/index.ts`
- `src/app/orders/checkout/page.tsx`
- `src/app/orders/complete/page.tsx`
- `src/shared/services/orderService.ts`
- `src/shared/types/order.ts`(타입 참조)
- `firestore.rules`

## 2026-04-24 작업 내용
- 주문 생성은 `POST /api/order`(Functions)로만 수행되도록 정리했고, 주문 생성 요청 필드는  
  `productId/size/color/quantity`, `deliveryAddress`, `paymentMethod`, `deliveryOption`, `selectedCoupon`, `requestedPointAmount`로 제한해 사용한다.
- 함수 내부에서 주문별 단가·총액·할인·배송비·최종 결제금액을 재산정한다.
- 주문 생성은 Firestore transaction 안에서 한 번에 처리한다.
  - 주문 문서 생성
  - 상품 재고 차감
  - 사용자 쿠폰 상태 갱신(`사용가능` → `사용완료`/`기간만료`)
  - 포인트 차감
  - 장바구니 선택 항목 정리
- `firestore.rules`에서 `orders` 생성은 `allow create: if false`로 막고, 읽기만 소유자/관리자로 허용하도록 유지해 일반 사용자의 임의 생성·변조를 차단한다.
- 클라이언트 완료 화면은 URL 파라미터(`orderId`) 혹은 이전 저장한 `orderResult`를 기반으로 `OrderService.getOrder`로 조회하도록 변경해, 로컬 계산값 의존도를 낮췄다.

## 검증
- `npx tsc --noEmit --pretty false -p ./functions/tsconfig.json` 통과
- 2026-05-11: 루트 `npx tsc --noEmit --pretty false -p tsconfig.json` 통과. 주문 완료 화면의 `pointUsed` 표시와 서버 주문 응답 구조에 맞춰 `Order` 타입에 `pointUsed`를 반영.
- 2026-05-11: `functions/src/domain/orderDomain.ts`와 `functions/__tests__/orderDomain.test.ts`를 추가해 주문 항목 병합, 할인 단가, 쿠폰 할인, 배송비 계산을 단위 테스트로 검증. `order.ts`의 배송비 계산은 같은 도메인 함수를 사용한다.

## 잔여 확인 포인트
- 상품 옵션 가격/재고 구조가 옵션별로 분리되는 경우, `order.ts`에서 옵션 단가·재고 규칙 확장 필요.
- 주문 완료 화면에서 주문 단가/할인 항목의 다국어 문자열 정합성 점검 필요.

## 2026-05-12 주문 흐름 UI 정리
- 서버 주문 생성 흐름과 타입은 변경하지 않고 주문 관련 CSS만 보정했다.
- `/cart`, `/orders/cart`, `/orders/checkout`, `/orders/complete`, `/orders/delivery`의 카드, 요약 박스, 입력, CTA radius를 2px로 낮추고 그림자를 제거했다.
- 배송 조회 화면은 파랑 CTA와 상태 배지를 검정/중립 표면으로 바꿔 메인 상품 매대 톤과 맞췄다.

## 2026-05-12 관리자 주문 상태 변경 서버화
- `/api/order`에 관리자 전용 `action: "updateStatus"` 분기를 추가했다.
- 상태 변경은 custom claim 기반 관리자만 가능하며 `pending -> confirmed -> preparing/shipped -> delivered` 등 허용된 전이만 통과한다.
- 변경 시 `statusHistory`에 이전 상태, 다음 상태, 관리자 uid, 변경 시각을 남긴다.
- 관리자 주문 화면의 `OrderService.updateOrderStatus`는 Firestore 직접 업데이트 대신 `/api/order`를 호출한다.

## 2026-05-12 구매 흐름 점검
- `OrderService.createOrder`는 클라이언트 계산값을 보내지 않고 상품/옵션/배송지/결제수단/쿠폰/포인트만 `POST /api/order`로 전달한다.
- Functions 주문 생성은 인증, 상품 조회, 재고 확인, 쿠폰 소유자/상태/만료/최소금액, 포인트 잔액, 장바구니 선택 항목 제거를 트랜잭션에서 처리한다.
- 확인된 리스크:
  - `/categories/[category]/products/[productId]` 상세의 장바구니 담기는 실제 저장 없이 alert만 표시하고, 바로 구매 버튼에는 실행 핸들러가 없다.
  - `/orders/cart`의 쿠폰 드롭다운은 `사용가능` 상태만 필터링하고 최소 주문금액/만료/무료배송 조건을 화면 계산에 반영하지 않아, checkout 또는 서버 확정 금액과 달라질 수 있다.
  - `/orders/checkout`은 상품별 할인 합계를 주문 금액에서 다시 빼고 있어 이미 할인 단가로 담긴 장바구니/바로구매 데이터와 서버 확정 금액이 어긋날 수 있다.
  - 로컬 `next dev`/`next build`는 Next worker `spawn EPERM`으로 브라우저 E2E 확인이 막혔다. 배포 환경은 Firebase Hosting rewrite의 `/api/order` 경로 확인이 필요하다.

## 2026-05-12 주문 완료 빌드 오류 보정
- `/orders/complete`에서 `useSearchParams()`를 쓰는 실제 콘텐츠를 `Suspense` 하위 컴포넌트로 분리해 Next 15 prerender 오류를 막았다.
- 루트 `themeColor`는 `metadata`가 아니라 `viewport` export에서 설정한다.
- `npm run typecheck`는 통과했고, `npm run build`는 이 환경의 Next worker `spawn EPERM` 제약으로 중단됐다.

## 2026-05-12 구매 흐름 보정
- 두 상품 상세 경로(`/products/[productId]`, `/categories/[category]/products/[productId]`)의 장바구니/바로구매 진입 동작을 맞췄다.
- 장바구니와 checkout의 예상 금액 계산을 `src/shared/utils/orderPricing.ts`로 통합했다.
- checkout은 이미 할인된 상품 단가에서 상품 할인액을 다시 차감하지 않고, 서버 주문 생성은 기존처럼 Functions에서 최종 재계산한다.
- `src/app/categories/[category]/products/[productId]/page.test.tsx`로 카테고리 상세의 장바구니/바로구매 동작을 회귀 테스트한다.

## 2026-05-12 주문 취소 서버화
- `/api/order`에 `action: "cancel"` 분기를 추가해 고객 주문 취소도 Functions 트랜잭션에서 처리한다.
- 고객 취소는 주문 소유자이고 상태가 `pending` 또는 `confirmed`일 때만 허용한다. 관리자가 `updateStatus`로 `cancelled` 전환하는 경우에도 같은 복구 트랜잭션을 사용한다.
- 취소 트랜잭션은 주문 상태 변경, `statusHistory` 기록, 상품 재고 복원, 사용 포인트 환급, 사용 쿠폰 복원을 함께 처리한다.
- 새 주문 생성 시 쿠폰 복구를 위해 `userCouponId`, `couponId`를 주문 문서에 저장한다. 기존 주문 중 이 필드가 없는 주문은 쿠폰 복구 대상 식별이 제한된다.
- 주문 상품 조회는 최상위 `products/{productId}`만 기준으로 단일화했고, `categories/{id}/products` 전체 스캔 fallback은 제거했다.

## 2026-06-05 Chrome 구매 흐름 보정
- 로컬 Next 개발 서버에서도 주문 생성을 확인할 수 있도록 `src/app/api/order/route.ts`에서 `/api/order/` 프록시를 추가했다.
- `OrderService`는 `trailingSlash` 설정에 따른 308 redirect를 피하기 위해 `/api/order/`를 호출한다.
- Functions 주문 생성 트랜잭션은 장바구니 문서 읽기를 모든 쓰기보다 먼저 수행하도록 순서를 바꿔 `Firestore transactions require all reads to be executed before all writes.` 오류를 해결했다.
- 상품 가격 계산은 `getProductPricing`/`calculateDiscountedUnitPrice` 기준으로 통합해 `originalPrice > price`인 상품을 다시 할인하지 않는다.
- 장바구니 조회 시 기존에 잘못 저장된 단가/할인 요약은 상품 문서 기준으로 보정해 저장한다.
- 장바구니와 checkout의 인증 가드는 `authLoading`이 끝난 뒤에만 리다이렉트하고, checkout 결제수단/배송지 라벨은 사용자 표시용 한국어로 정리했다.
- 현재 Chrome 실제 구매 완료 확인은 배포된 Cloud Function이 아직 이전 코드라 실패한다. `functions:build`는 통과했으며, 함수 배포 후 다시 전체 구매 완료와 마이페이지 주문 노출을 확인해야 한다.

## 2026-06-05 checkout 반응형 UI 보정
- `/orders/checkout`의 주문 상품, 배송 주소, 결제 방식, 포인트 사용 영역을 실제 `.section` 카드 구조로 감싸 CSS와 JSX 구조를 맞췄다.
- 결제 요약 박스는 `.summaryContent` 래퍼를 추가해 내부 여백을 복구하고, sticky 동작은 1024px 이상에서만 적용한다.
- 금액 행, 상품명, 주소, 포인트 입력/전액 사용 버튼은 모바일 폭에서 줄바꿈과 간격이 깨지지 않도록 gap, min-height, overflow-wrap을 보정했다.
- 배송지와 결제수단은 선택 상태가 카드 표면에서 바로 드러나도록 border/background 상태 스타일을 추가하고, 섹션 간격을 더 조밀하게 낮췄다.

## 2026-06-11 checkout 배송지 수령자 보정
- `/orders/checkout`의 임시 배송지 목록을 `buildCheckoutDeliveryAddresses` 유틸로 분리했다.
- 사용자 프로필이 첫 렌더 이후 로드되어도 배송지 `recipient`가 최신 `userData.name` 또는 Firebase `displayName`으로 갱신되도록 했다.
- 수령자명이 비어 서버의 `deliveryAddress is required.` 검증에 걸리는 회귀를 `deliveryAddress.test.ts`로 방지한다.

## 2026-06-12 카트 진입 링크 보정
- 목 데이터 기반 `/cart`의 추천 이동 링크를 존재하지 않는 `/main/recommend`에서 실제 `/recommend`로 수정했다.
- `/cart`의 주문 CTA는 동작 없는 버튼 대신 실제 장바구니 흐름인 `/orders/cart`로 연결한다.

## 2026-06-22 checkout 복구 흐름 보정
- `/orders/checkout`은 `sessionStorage.orderData`가 없거나 깨졌거나 주문 상품이 비어 있으면 모호한 확인 문구 대신 복구 화면을 보여준다.
- 복구 화면은 `/orders/cart`로 돌아가는 링크를 제공해 장바구니에서 주문 상품을 다시 선택할 수 있게 한다.
- `/orders/cart` 내부 breadcrumb와 뒤로가기성 링크가 mock `/cart`로 빠지지 않도록 실제 주문 장바구니 또는 쇼핑 계속하기 흐름으로 정리했다.

## 2026-06-24 주문 레이어 중복 정리
- 빈 `OrderProvider`와 주문 레이아웃의 중복 `PointProvider`를 제거했다.
- `functions/src/handlers/order.ts`의 주문 파싱/할인/배송비/장바구니 합산 중복 구현을 제거하고 `functions/src/domain/orderDomain.ts` 함수를 재사용한다.

## 2026-06-29 Chrome 주문 흐름 QA
- 로컬 Next dev(`http://localhost:3000`)와 사용자 Chrome에서 일반 회원 빠른 로그인으로 상품 탐색, 옵션 선택, 장바구니 담기, checkout 포인트 5,000P 적용, 서버 주문 생성을 확인했다.
- 생성 주문 `ORD-20260629-UNGAHP`는 주문 완료 화면과 마이페이지 주문 목록에 표시됐고, 관리자 빠른 로그인 후 주문 관리에서 `결제 대기 -> 주문 확인 -> 주문 취소` 상태 변경이 동작했다.
- 취소 후 일반 회원 포인트는 5,000P로 복원됐고, 상품 `CYCLE SAFE` 재고도 38개로 돌아온 것을 상품 상세에서 확인했다.
- 주문 생성 직후 완료 화면 헤더의 장바구니 배지가 한 번 `1`로 남았지만, 이후 장바구니 재조회 시 선택 상품은 제거되어 빈 장바구니가 표시됐다. 클라이언트 캐시 무효화 타이밍은 추가 점검 대상이다.
- 2026-06-29: checkout 주문 생성 성공 직후 장바구니 목록 캐시를 무효화하고 활성화된 장바구니 개수 쿼리를 재조회해 완료 화면 진입 전 헤더 배지 stale 표시를 줄였다.

## 2026-07-10 재고·상품 상태 검증 보강
- 서로 다른 옵션이더라도 같은 `productId`의 수량을 합산해 재고를 상품당 한 번만 차감하고, 취소 시에도 한 번만 복원한다.
- 주문 생성 Function은 `status`가 명시된 상품의 경우 `active` 상태만 허용한다. 상품이 `sizes` 또는 `colors` 배열을 선언하면 요청 옵션도 서버에서 검증한다.
- 구형 상품처럼 상태·옵션 배열이 없는 문서는 기존 구매 흐름을 유지한다.
- `functions/__tests__/httpHandlers.test.ts`에서 합산 재고 부족, 비활성 상품, 선언되지 않은 옵션, 취소 복원 및 구형 상품 호환을 검증한다.

## 2026-07-10 데모 주문·배송지 안내
- checkout은 임시 주소를 생성하지 않고 회원 프로필의 실제 `addresses` 또는 기존 `address` 데이터만 사용한다. 등록된 주소가 없으면 주문을 막고 정보 수정 화면으로 안내한다.
- 실제 PG 연동 전 포트폴리오 범위를 명확히 하기 위해 checkout CTA와 완료 화면에 실제 결제가 없는 데모 주문임을 표시한다.
