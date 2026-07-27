### 상품 조회 구조 개선 : 6순위

## 완료 범위
- 상품 목록/검색에서 전체 상품을 선로딩하지 않고 `ProductService.queryProducts()` 기반으로 필터·정렬·커서 페이징 적용.
- `ProductList` 및 `SearchClient`에 페이지 상태/커서 캐시를 도입해 페이지 이동 시 재조회 비용 최소화.
- `main/sale`, `recommend`에서 직접 `getAllProducts()`를 호출하던 흐름 제거.
- 카테고리 상위 목록은 `categories` 컬렉션 조회만 사용하도록 정리 (`categories/{id}/products` 읽기 의존 제거).

## 변경 파일
- `src/shared/services/productService.ts`
- `src/app/products/_components/ProductList.tsx`
- `src/app/search/SearchClient.tsx`
- `src/app/main/sale/page.tsx`
- `src/app/recommend/page.tsx`
- `src/context/categoryProvider.tsx`

## 핵심 결과
- 서버쿼리에서 `category/status/price/range/sort`를 우선 반영하고, 필요한 경우 클라이언트에서 `keyword`를 추가 필터링.
- `startAfter` 커서 기반 페이지네이션 도입으로 `page` 이동 시 전체 적재 없이 필요한 구간만 조회.
- 대규모 데이터 환경에서 목록/검색의 Firestore read 패턴이 줄어들도록 구조 전환.
- 홈/섹션용 상품 묶음은 인덱스 생성 대기 상태에서도 화면이 깨지지 않도록 최상위 상품 1회 읽기와 클라이언트 정렬을 사용.

## 완료 기준(6순위)
- 전체 상품 무조건 로드 제거: 목록/검색(`ProductList`, `SearchClient`)은 확인. 홈/섹션 getter는 인덱스 안정성 때문에 최상위 상품 읽기 기반으로 운영 중.
- `legacy categories/{id}/products` 의존도 감소: `categoryProvider`에서 제거, 나머지 경로는 단계적 정리 대상.
- 필터·검색 시 read 비용 감소: 서버 쿼리 범위를 최대화, 커서 기반 조회로 페이지 이동 시 추가 전체 조회 제거.

## 확인 메모
- `ProductService.queryProducts`는 키워드 필터를 Firestore 인덱스 미지원 필드에서 보완적으로 처리하므로, 향후 검색 인덱스 강화 또는 컬렉션 설계 개선이 필요.
- 2026-05-11: `reviewCount` 정렬 사용에 맞춰 `ProductSort.field` 타입을 확장하고, 검색 결과 카드는 실제 props 기반 카드(`src/app/products/_components/ProductCard`)를 사용하도록 정리.
- 2026-05-11: 메인 홈 상품 섹션은 `ProductService.getHomePageProducts()`로 최상위 `products`를 1회 읽은 뒤 `recommended/new/sale/bestseller`를 클라이언트 정렬한다. Firebase 인덱스 생성 대기 중에도 홈 초기 화면이 깨지지 않게 하기 위한 조치다.
- 2026-05-11: 홈 쿼리용 Firestore 인덱스(`status+createdAt+__name__`, `isNew+status+createdAt+__name__`, `isSale+status+createdAt+__name__`, `status+reviewCount+__name__`)도 추가되어 있으며, 데이터가 커지면 배포 완료 후 다시 쿼리 기반 섹션 조회로 돌리는 것이 좋다.
- 2026-05-11: 현재 작업 환경에서는 Firebase 백엔드 연결이 프록시 `127.0.0.1:9 ECONNREFUSED`로 차단되어 실제 문서 수 검증은 불가했다. 네트워크 가능한 환경에서 재확인이 필요하다.
- 2026-05-12: 추천 페이지의 `평점`, `리뷰` 탭은 `queryProducts()` 복합 정렬 대신 `getTopRatedProducts()`, `getReviewPopularProducts()`로 최상위 상품을 읽고 클라이언트 정렬한다. 홈과 같은 이유로 인덱스 생성 대기 중에도 추천 탭이 깨지지 않게 하기 위한 조치다.
- 2026-05-12: 브랜드 페이지는 `brandSummaries` 컬렉션을 우선 읽고, 요약 문서가 없을 때만 상품 기반 요약으로 fallback한다. 공개 읽기 규칙은 `firestore.rules`에 추가했다.
- 2026-05-12: 검색 화면 필터/검색 버튼/태그의 큰 radius와 회색 그라데이션 CTA를 메인 상품 매대와 같은 사각 탭, 검정 CTA 기준으로 낮췄다.
- 2026-05-12: 주문 생성/취소 서버 로직의 상품 조회도 최상위 `products/{productId}` 기준으로 단일화했다. `categories/{id}/products` 전체 스캔 fallback은 제거했으므로 주문 가능한 상품은 최상위 상품 문서가 필요하다.
- 2026-06-05: `queryProducts()`의 Firestore 복합 쿼리가 인덱스/range+orderBy 제약으로 실패하면 최상위 `products`를 1회 읽고 동일 필터·정렬을 클라이언트에서 적용하는 fallback을 추가했다. `/products` 오류 화면과 `/categories/clothing -> tops`의 빈 카테고리 오인 표시를 막기 위한 복구 경로다.
- 2026-06-22: `/categories` 카드의 아이콘 없는 상태에서 `이미지 준비중` 문구를 노출하지 않고 카테고리명을 fallback으로 보여 주도록 정리했다.
- 2026-06-24: 참조되지 않는 옛 `src/components/products/ProductCard` 구현을 삭제하고 실제 상품 카드는 `src/app/products/_components/ProductCard`만 남겼다.
- 2026-06-29: `/products` 카테고리 필터는 `categoryUtils`의 기본 한국어 매핑을 사용해 `accessories`, `bags` 같은 id 대신 표시명을 보여 준다. 상품 목록의 `categoryId + status + createdAt + __name__` 쿼리용 Firestore 인덱스도 추가했다.

## 2026-06-29 상품/카테고리 중복 정리

- URL만 React Query에 넣어 돌려주던 이미지 캐시 레이어를 제거하고 `ProductCard`는 `next/image`를 직접 사용한다.
- 카테고리 기본 id/name은 `categoryUtils`로 단일화했고 Header, CategoryProvider, fallback UI가 같은 기본값을 재사용한다.

## 2026-06-30 상품 상세 경로 정리

- `/categories/[category]/products/[productId]` 중복 상세 화면을 제거하고 `/products/[productId]`로 redirect하도록 정리했다.
- 미사용 `CategoryClient`와 루트 `components/*` 빈 파일을 제거했다.

## 2026-07-10 목록 쿼리·페이지 커서 보정
- 목록의 기본 가격 범위(0원~100만원)는 실제 Firestore 가격 조건으로 보내지 않는다. 사용자가 범위를 좁힌 경우에만 가격 range 쿼리를 추가해 불필요한 인덱스 fallback을 줄인다.
- 다음 페이지 커서는 표시한 마지막 상품 문서를 기준으로 유지한다. 조회 한도보다 하나 더 읽은 문서를 커서로 사용해 상품이 건너뛰는 문제를 방지했다.

## 2026-07-21 공개 목록 공통화

- `/products`, `/categories/[category]`, `/search`는 같은 cursor 조회 계약을 사용한다. 카테고리 상세는 공용 `ProductList`에 고정 카테고리를 전달한다.
- `q`, `category`, `sort`, `minPrice`, `maxPrice`는 URL과 동기화하며 검색어는 NFKC 정규화, 앞뒤 공백 제거, 연속 공백 축소를 거친다.
- 뒤로 가기·앞으로 가기로 URL 필터가 바뀌면 화면 상태를 먼저 복원하며, 자체 URL 갱신 확인은 재조회로 취급하지 않는다. 검색 제출 중에는 이전 URL 검색어가 새 입력을 되돌리지 않는다.
- 목록·검색 요청은 query signature와 요청 generation을 함께 확인해 필터 변경 전에 시작한 페이지 응답이 현재 결과와 cursor cache를 덮지 못하게 한다.
- Firestore 복합 쿼리 fallback에서도 클라이언트 offset cursor를 반환해 첫 페이지 이후 상품이 숨겨지지 않는다.
- 공개 fallback은 `status == "active"` 단순 쿼리로만 원본을 읽고 나머지 필터를 적용한다. Firestore cursor를 사용하던 다음 페이지에서 fallback으로 전환돼도 마지막 표시 상품 다음부터 이어서 중복 첫 페이지를 만들지 않는다.
- 공개 상세는 문서 ID와 `status == "active"`를 함께 제한한 query를 사용해 미노출 상품은 `null`, 네트워크·권한 오류는 예외로 구분한다. 관리자 `getAllProducts()`의 전체 상태 조회는 유지한다.
- 홈·상세·최근 본 상품·찜·리뷰의 상품 조회는 TanStack Query 키를 공유한다. 관리자 전체 상품 Provider는 `/admin/dashboard`에만 두고 공개 화면용 미사용 상태와 로더는 제거했다.
- 상품 상세의 리뷰 요약은 상품 문서의 검증된 `reviewSummary`를 먼저 읽는다. 아직 백필되지 않은 기존 상품만 Firestore count/average와 평점별 count 집계를 사용하며 리뷰 문서 전체는 내려받지 않는다.
- `syncReviewProductStats` Firestore trigger는 리뷰 생성·삭제와 평점·추천 여부·상품 연결 변경 뒤 실제 리뷰 통계를 다시 집계한다. 상품 문서에는 `reviewCount`·`rating`과 상세 `reviewSummary`를 함께 저장한다. 이벤트 시각과 실행 소유 토큰으로 역순 완료를 막으므로 같은 시각의 무순서 이벤트 ID에 의존하지 않는다. Functions 배포 전에는 이 동기화가 운영 환경에 적용되지 않는다.
- 같은 정규화 검색어를 다시 제출하면 현재 결과를 유지한 채 1페이지를 명시 재조회하고, URL이 이미 같으면 불필요한 `router.push()`를 호출하지 않는다.
- 오류 재시도나 동일 검색어 갱신으로 1페이지를 강제 조회할 때는 2페이지 이후 cache, cursor, `hasMore`를 먼저 폐기해 서로 다른 조회 시점의 페이지가 섞이지 않게 한다.
- 상품 목록에서 검색·카테고리·정렬·가격 조건이 바뀌면 이전 상품을 제거하고 `aria-busy` 스켈레톤을 노출한다. 검색 화면의 진행 상태는 `status`, 오류는 `alert`로 전달한다.
- 활성 query signature는 렌더 중 ref를 변경하지 않고 커밋된 effect에서만 갱신한다. 요청 generation과 함께 지연 응답의 상태 반영을 차단한다.
- Next App Router의 `push()`/`replace()`는 완료 여부를 반환하지 않는다. 검색 제출 직후에는 로컬 결과를 낙관적으로 유지하고 이전 URL을 일시적으로 무시하되, 목표 또는 다른 실제 URL 변화가 관찰되면 URL을 최종 상태로 채택한다. 탐색이 끝내 반영되지 않으면 주소창과 로컬 결과가 일시적으로 다를 수 있으며 새로고침 시 URL 상태가 우선한다.
- 홈 상품의 섹션 쿼리와 최상위 fallback이 모두 실패하거나 추천 설정·상품 조회가 실패하면 빈 정상 결과로 숨기지 않는다. 홈 섹션은 오류 안내와 TanStack Query 재시도 버튼을 노출한다.
- 관리자 상품 생성·수정·삭제 성공 시 `productKeys.all`을 무효화해 홈·목록·상세·추천 캐시가 다음 조회에서 최신 상품을 사용한다.
- 상품별 리뷰 조회는 `productId` 조건 뒤 `createdAt desc` 정렬과 페이지 제한을 적용해 최신 리뷰부터 반환한다.
- 헤더는 활성 카테고리 조회 전이나 조회 실패 시 존재 여부를 확인할 수 없는 상세 링크를 만들지 않고 `/categories` 허브만 노출한다.
- 메인 카테고리 큐레이션은 실제 활성 데이터에 존재하는 항목만 사용하며, 누락된 기본 ID를 임의로 생성하지 않는다.

## 2026-07-27 공개 목록 상태 구분

- 목록 조회 오류는 빈 결과로 흡수하지 않는다. 오류 상태에는 사용자용 안내와 `다시 시도`, `/products`로 돌아가는 `전체 상품 보기` 경로를 제공하며 내부 오류 문자열은 노출하지 않는다.
- `조건에 맞는 상품이 없습니다.`와 `조건 초기화`는 조회가 성공했고 현재 페이지 상품이 0개일 때만 표시한다. 오류 상태에서는 통계, 필터, 상품 grid, 페이지 이동과 빈 결과를 함께 표시하지 않는다.
- 재시도는 첫 페이지를 강제 조회하면서 기존 2페이지 이후 cache·cursor·`hasMore`를 폐기하는 기존 계약을 유지한다.

## 2026-07-27 상품 상태 메타데이터 정리

- 상품 카드의 신규·세일 상태는 `ProductCard`의 기존 배지로만 표시한다. 홈 섹션은 같은 의미의 별도 운영 라벨을 전달하지 않는다.
- `/products`는 현재 페이지 결과 수를 유지하고, 신규·세일 건수를 다시 요약한 통계 타일은 표시하지 않는다.
