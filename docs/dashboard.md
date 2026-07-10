# 관리자 대시보드

## 구조

```
src/app/admin/
  page.tsx                     # 대시보드 페이지
  _components/
    Chart.tsx                  # 차트
    ErrorBoundary.tsx          # 에러 바운더리
    LoadingSpinner.tsx         # 로딩 컴포넌트
src/shared/
  services/dashboardService.ts # 데이터 서비스
  services/userService.ts      # Firebase 사용자 조회
  hooks/useDashboardQuery.ts   # React Query Hook
```

## 데이터 레이어

- `DashboardService`: users, products, orders, coupons, events, QnA, 1:1 문의를 각각 조회한 뒤 통계를 가공한다.
- 조회는 `Promise.allSettled`로 분리되어 일부 컬렉션이 실패해도 나머지 지표를 표시한다.
- `useDashboardQuery`: 통계는 5분 간격, 사용자 수 보조 조회는 1분 간격으로 갱신한다.

## 차트

- `Chart` 컴포넌트: 막대/선/원 그래프 지원
- 매출 추이 (최근 6개월), 주문 상태 분포, 카테고리별 판매량
- 데이터가 없으면 해당 차트 숨김

## 통계 카드

- 사용자, 상품, 쿠폰, 이벤트, 주문, 매출 카드
- 최근 7일과 직전 7일을 비교한 증감률 표시
- `dataAvailability` 필드로 각 데이터 소스 가용 여부를 추적하고, 데이터가 없는 카드는 숨긴다.

## 표시 로직

- 모든 지표는 Firestore 조회 결과를 사용한다. 데이터가 없거나 접근하지 못한 지표는 임의 수치로 대체하지 않는다.
- 매출은 취소·반품·교환 주문을 제외한 주문 합계이며, 카테고리 차트는 판매량이 없으면 등록 상품 수를 표시한다.
- 차트는 해당 데이터가 존재하는 경우에만 렌더링한다.

## 에러 처리

- `ErrorBoundary` 컴포넌트로 렌더링 오류 격리
- 네트워크 오류 시 재시도
- 기본값 fallback 처리

## 2026-05-12 운영 지표 정리

- `/admin` 루트 대시보드의 카테고리 차트에서 `Math.random()` 임시 값을 제거했다.
- 차트는 `DashboardService.getCategoryBreakdown()` 결과를 사용하며 주문 판매량이 있으면 판매량, 없으면 등록 상품 수를 표시한다.
- 카테고리명 조회 실패 시에도 집계 ID를 표시하고 임의 숫자는 만들지 않는다.

## 2026-05-12 배포 런타임 오류 수정

- `/admin` 호스팅 페이지에서 `Cannot read properties of undefined (reading 'resolveSettledValue')` 오류가 발생했다.
- 원인은 React Query에 `DashboardService.getDashboardStats` 정적 메서드 참조를 그대로 넘겨 호출 컨텍스트의 `this`가 사라진 것이다.
- `DashboardService` 내부 정적 호출을 클래스명 기준으로 바꾸고, `useDashboardQuery`의 `queryFn`은 래퍼 함수로 호출하도록 정리했다.
- 분리 호출 회귀 테스트 `src/shared/services/dashboardService.test.ts`를 추가했다.

## 2026-06-24 대시보드 중복 정리

- `DashboardService`가 호환용 `UserService` 래퍼 대신 `AdminUserService.getAllUsersSimple()`을 직접 호출하도록 정리했다.
- 참조되지 않던 옛 `useDashboard` 훅은 제거하고 React Query 기반 `useDashboardQuery`만 유지한다.

## 현재 한계

- 대시보드는 운영 분석 도구가 아닌 포트폴리오 데모이며, 실제 매출·비용·SLA를 보장하지 않는다.
- 화면의 일일 비용 추정과 일부 운영 상태 문구는 계산 근거가 연결되지 않은 안내용 표현이므로 실제 운영 의사결정에 사용하면 안 된다.
