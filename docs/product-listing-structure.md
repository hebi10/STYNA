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
