# 상품 데이터 접근·캐시 정책

## 목적

상품 데이터 계층은 Firestore SDK 호출, Firestore 문서 정규화, 검색·정렬·추천 규칙, React Query 캐시 책임을 분리한다. 화면 컴포넌트가 Firestore 구현 세부사항을 직접 알지 않게 하고, 순수 도메인 로직은 Firebase 없이 단위 테스트할 수 있게 유지한다.

## 책임 분리

| 계층 | 책임 |
| --- | --- |
| `productRepository.ts` | Firestore query/read/write, cursor document, batch write |
| `productMapper.ts` | Firestore document → `Product`, 날짜·카테고리 기본값, write payload 정리 |
| `productDomain.ts` | 검색어 정규화, 필터, 정렬, keyset cursor 비교, 추천·랭킹 순수 함수 |
| `productService.ts` | use case 조합, fallback 정책, 공개/관리자 조회 경계, 오류 정책 |
| `useProducts.ts` | React Query key, staleTime, 화면에서 사용할 read API |

`productDomain.ts`와 `productMapper.ts`는 Firebase SDK를 import하지 않는다. Firebase 변경이 검색·정렬·추천 테스트에 전파되지 않도록 하는 것이 기준이다.

## React Query 기준

상품 query key는 `src/shared/hooks/queryKeys.ts`의 `productKeys`를 단일 기준으로 사용한다.

- 상품 목록·상세·홈·연관상품: 기본 `staleTime` 5분
- 카테고리 이름 목록: `staleTime` 10분
- 상세 상품은 `productKeys.detail(productId)`로 공유해 여러 화면에서 동일 캐시를 재사용한다.
- 상품 생성·수정·삭제 뒤에는 `productKeys.all` 범위를 invalidation 대상으로 삼아 목록/홈/상세 파생 캐시가 오래 남지 않게 한다.
- 화면별 임의 문자열 query key를 추가하지 않는다.

## 다중 ID 조회 정책

현재 `useProductsByIds()`는 중복 ID를 제거한 뒤 ID별 `productKeys.detail(id)` query를 사용한다. 이 방식은 Firestore read 수가 ID 수에 비례하지만 다음 장점이 있다.

1. 상품 상세 캐시와 동일한 캐시 엔트리를 재사용한다.
2. 일부 ID가 없을 때 다른 상품 결과를 유지하기 쉽다.
3. 개별 상품의 staleTime·invalidaton 의미가 단순하다.
4. 소수의 추천/에디토리얼 상품 목록에서는 별도 batch 결과 캐시를 만드는 비용이 더 크다.

따라서 현재는 구조를 유지한다. 다음 조건 중 하나가 실제 측정에서 반복될 때 batch 조회를 검토한다.

- 한 화면에서 동시에 필요한 고유 상품 ID가 상시 10~20개 이상인 경우
- 동일한 ID 묶음 때문에 Firestore read가 반복적으로 증가하는 것이 Analytics/사용량에서 확인되는 경우
- 대량 편집·관리 화면처럼 개별 상세 캐시 재사용보다 한 번의 묶음 조회가 더 중요한 경우

batch 전환 시 Firestore `in` 쿼리 제한에 맞춘 chunking, `status=active` 공개 경계, 요청 순서 복원, 부분 실패 정책을 함께 설계해야 한다. 단순히 `Promise.all`을 `in` 쿼리로 바꾸는 작업은 하지 않는다.

## 홈/추천 조회

`getHomePageProducts()`는 신규·할인·베스트셀러를 필요한 개수만큼 우선 조회한다. 인덱스 또는 query 조건 문제로 해당 조회가 실패할 때만 active 상품 fallback 스캔을 사용한다.

추천·랭킹은 Firestore 문서를 모두 아는 함수가 아니라 `Product[]`을 입력받는 순수 함수로 유지한다. 점수식이나 tie-break 규칙을 바꿀 때는 `productDomain` 테스트를 먼저 수정한다.

## 검색과 fallback

Firestore가 처리할 수 있는 상태·카테고리·브랜드·가격·평점·정렬 조건은 repository query에 맡긴다. 자유 텍스트 keyword는 현재 상품명·브랜드·설명·카테고리·태그에 대해 클라이언트 도메인 함수에서 정규화해 필터링한다.

복합 인덱스가 없거나 일시적인 paged query 실패가 발생하면 기존 keyset cursor 의미를 유지한 채 client fallback을 사용한다. fallback은 정상 경로가 아니라 복구 경로이며, 상품 수가 크게 증가하면 전문 검색 인덱스 또는 서버 검색 API로 이전하는 것을 우선 검토한다.

## 성능 점검 기준

성능 변경 전후에는 다음을 함께 본다.

- Firestore document read 수
- 첫 상품 목록 응답 시간
- 동일 상품 상세 재방문 시 React Query cache hit 여부
- 홈 섹션 간 같은 상품 중복 조회 여부
- 검색 fallback 발생 빈도

읽기 수를 줄이기 위해 캐시 정합성이나 공개 상품 `status=active` 경계를 약화시키지 않는다.
