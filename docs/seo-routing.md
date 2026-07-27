# SEO 경로 정책

## canonical

- 루트 레이아웃은 canonical을 선언하지 않는다. 하위 경로가 홈 URL을 잘못 상속하는 것을 막기 위함이다.
- 홈과 상품, 카테고리, 이벤트, 브랜드, 추천, 리뷰 등 공개 목록 경로는 각 경로의 canonical을 직접 선언한다.
- 동적 상품·이벤트·카테고리 상세는 실제 식별자가 포함된 canonical을 생성하며, 상품·이벤트 식별자는 URL 경계에서 인코딩한다.
- `trailingSlash: true` 설정과 일치하도록 canonical URL은 `/`로 끝난다.
- 활성 카테고리 목록에 없는 동적 카테고리 경로는 본문에서 404 처리하고 metadata에는 canonical 없이 `noindex, nofollow`를 사용한다. 카테고리 조회 장애는 404로 숨기지 않고 오류 경계로 전달한다.

## 검색 제외 경로

- 검색 결과와 인증, 주문, 마이페이지, 관리자, 문의 작성·조회 경로는 `noindex, follow`를 사용한다.
- `robots.txt`는 `/admin`, `/auth`, `/mypage`, `/orders`, `/api`, `/cart` prefix의 크롤링을 차단한다.

## sitemap

- 공개 정적 경로와 활성 카테고리, 활성 상품, 공개 정책 검증을 통과한 활성 이벤트만 포함한다.
- 상품은 sitemap 전용 Firestore 조회 경로에서 `status == active`, `createdAt desc`, `documentId desc` 순서의 keyset cursor로 페이지당 한 번씩만 전진한다. 일반 상품 조회의 전체 컬렉션 fallback은 사용하지 않는다.
- 카테고리·상품·이벤트 Firebase 조회 실패는 부분 sitemap이나 빈 정상 결과로 바꾸지 않고 생성 오류로 전달한다.
- 정적·카테고리·이벤트·상품 URL을 중복 제거한 뒤 전체 50,000개 제한을 적용한다. 제한을 넘기기 직전에 `SitemapUrlLimitExceededError`를 발생시키며 조용히 절단하지 않는다.
- 현재 규모에서는 root metadata route인 `/sitemap.xml` 하나를 유지하고 `robots.txt`도 같은 URL을 참조한다. Next 15 `generateSitemaps`는 경로를 `/sitemap/[id].xml`로 바꾸지만 root sitemap index를 자동 생성하지 않으므로, 50,000개를 넘기기 전 명시적 sitemap index와 cursor shard 경계를 별도 설계해야 한다.
- 전용 조회에는 `products(status ASC, createdAt DESC, __name__ DESC)` 컬렉션 인덱스가 필요하다.
- 동적 sitemap은 1시간 단위로 재검증한다.

## 검증

- `src/shared/constants/routeMetadata.test.ts`
- `src/app/privateMetadata.test.ts`
- `src/app/robots.test.ts`
- `src/app/sitemap.test.ts`
- `src/shared/services/sitemapFirestoreService.test.ts`
