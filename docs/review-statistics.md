# 리뷰 통계 동기화와 백필

## 운영 구조

- `syncReviewProductStats`는 Firestore 위치와 같은 `asia-northeast1`에서 실행하며 실패 시 재시도한다.
- 리뷰 생성·삭제, `rating`, `isRecommended`, `productId` 변경만 재집계한다. 제목·본문·이미지 등 통계와 무관한 수정은 즉시 종료한다.
- `productId`가 바뀌면 이전 상품과 새 상품을 모두 재집계한다.
- 상품 문서에는 목록용 `rating`, `reviewCount`와 아래 `reviewSummary`를 한 번에 확정한다.

```text
reviewSummary: {
  schemaVersion: 1,
  totalReviews,
  averageRating,
  recommendedCount,
  recommendationRate,
  ratingDistribution: { 5, 4, 3, 2, 1 }
}
```

상품 상세의 `ReviewService`는 완전하고 내부 합계가 맞는 `reviewSummary`를 우선 읽는다. 요약이 없거나 손상된 기존 상품은 서버 집계 쿼리로 안전하게 대체한다.

## 동시성 원칙

트리거는 상품별로 이벤트 시각과 실행 소유 토큰을 먼저 기록한 뒤 집계한다. 집계 결과는 여전히 해당 토큰을 소유한 실행만 확정할 수 있다. 같은 시각의 이벤트는 ID 문자열 순서로 선후를 추측하지 않고, 마지막으로 소유권을 얻은 실행이 현재 Firestore 상태를 다시 집계한다. 실패한 실행은 같은 이벤트 재시도로 다시 소유권을 얻을 수 있다.

관리자 클라이언트는 `rating`, `reviewCount`, `reviewSummary`, `reviewStats*` 필드를 수정할 수 없다. 상품 서비스가 편집 payload에서 제거하고 Firestore Rules도 직접 수정을 거부한다. Admin SDK로 실행되는 트리거와 백필만 이 필드를 갱신한다.
신규 상품도 `rating: 0`, `reviewCount: 0`, 완전한 0건 `reviewSummary`로만 생성할 수 있다. 클라이언트가 생성 시 `reviewStatsEventTime` 같은 미래 watermark나 임의 통계를 넣는 요청은 Rules에서 거부한다.

## 기존 데이터 백필

다음 명령은 순서대로 사용한다. 이번 작업에서는 어느 명령도 실제 Firebase 프로젝트에 실행하지 않았다.

```powershell
npm run migrate:review-summary:analyze
npm run migrate:review-summary:dry-run
npm run migrate:review-summary:execute
```

- `analyze`와 `dry-run`은 읽기만 수행한다.
- 쓰기는 이름에 `execute`가 있는 마지막 명령과 내부 `--execute` 플래그가 함께 있어야 시작된다.
- 잘못된 평점·추천 값 또는 삭제된 상품을 참조하는 리뷰가 하나라도 있으면 실행을 차단한다.
- 리뷰의 `productId`는 원문이 앞뒤 공백 제거 결과와 정확히 같아야 한다. 공백이 붙은 레거시 ID를 다른 상품 ID로 재해석하지 않고 invalid 리뷰로 보고해 실행을 차단한다.
- 실행 중에도 트리거와 같은 시각·소유 토큰 절차를 사용한다. 중단된 경우 더 최신 시각으로 같은 execute 명령을 다시 실행해 재조정할 수 있다.
- execute watermark는 실행 머신 시계가 아니라 `migrationRuns` 문서에 확정된 Firestore 서버 시각을 사용한다. 로컬 시계 오차가 후속 리뷰 트리거를 막지 않는다.
- 마이그레이션 런타임은 보고된 프로젝트, 초기화된 Admin 앱, 로컬 서비스 계정의 대상 프로젝트가 모두 같은지 먼저 검증한다. 하나라도 다르면 읽기·쓰기 전에 중단한다.

## 배포·잔여 위험

- Functions, Firestore Rules 배포와 백필 실행은 별도 운영 승인 후 진행해야 한다.
- Functions 배포 전에는 새 리뷰가 상품 요약에 반영되지 않는다.
- 백필 전 기존 상품은 상세 화면에서 집계 fallback을 사용하므로 읽기 비용이 더 든다.
- 백필 분석은 기존 리뷰 전체를 읽는다. 운영 데이터 규모와 예상 읽기 비용을 먼저 확인해야 한다.
- 현재 분석기는 읽은 상품·리뷰를 한 프로세스 메모리에 유지한다. 데이터가 매우 커지기 전 페이지 단위 분석으로 확장해야 한다.
- 리뷰 쓰기가 매우 잦은 시간에는 백필을 피하고, 완료 뒤 analyze를 다시 실행해 `staleProductCount`가 0인지 확인한다.
