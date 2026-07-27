# 프로젝트 성능·SEO 개선 실행 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 승인된 안정화 설계의 단계 5를 Firebase 데이터 모델과 기존 화면 동작을 보존하면서 불필요한 전역 조회, 중복 상세 조회, 과도한 이미지 우선 로드와 잘못된 검색 메타데이터를 줄이는 방식으로 구현한다.

**Architecture:** 루트에는 인증과 TanStack Query만 두고, 상품·카테고리·이벤트·쿠폰·사용자 활동 데이터는 실제 소비 경로가 소유한다. 공개 목록은 공통 cursor 조회와 URL 상태를 사용하고, 상세 서버 조회는 React `cache`로 메타데이터와 본문을 공유한다. SEO 값은 중앙 상수와 헬퍼에서 canonical, OG 이미지 MIME, robots를 일관되게 생성한다.

**Tech Stack:** React 19, TypeScript, Next.js 15, TanStack Query 5, Firebase Auth/Firestore/Storage, Jest 30, Testing Library

## Global Constraints

- Firebase만 사용하며 Supabase 코드는 추가하지 않는다.
- Firestore Rules, 인덱스와 기존 문서 구조를 이번 단계에서 바꾸지 않는다.
- 네트워크 오류를 존재하지 않는 리소스로 바꾸지 않으며, 확인된 `null`만 404로 처리한다.
- 기존 공개 URL과 상품·이벤트 정책 gate를 유지한다.
- 카드·버튼에 그림자나 큰 라운드를 새로 추가하지 않는다.
- 각 작업은 실패 테스트 → 최소 구현 → 집중 테스트 → 독립 리뷰 순서로 진행한다.
- seed, migration write, Firebase 배포, 커밋과 푸시는 수행하지 않는다.

---

### Task 1: 전역 Provider 선조회 제거와 공용 Query 키

**Files:**
- Modify: `src/app/_components/providers/RootProviders.tsx`
- Modify: `src/shared/hooks/queryKeys.ts`
- Create: `src/shared/hooks/useProducts.ts`
- Create: `src/shared/hooks/useProducts.test.tsx`
- Modify: `src/context/productProvider.tsx`
- Modify: `src/app/_components/ProductSection.tsx`
- Modify: `src/app/_components/ProductSection.test.tsx`
- Modify: 실제 데이터 소비 route layout/page 파일

**Interfaces:**
- 루트 Provider는 `ReactQueryProvider`, `AuthProvider`, `ScrollToTop`만 유지한다.
- `productKeys`, `categoryKeys`, `eventKeys`, `activityKeys`, `featuredProductKeys`는 입력을 포함한 안정적인 query key를 제공한다.
- `useHomeProducts`, `useRelatedProducts`, `useProductsByIds`, `useCategoriesWithNames`가 Firebase service 호출을 공유하고 동일 입력의 요청을 dedupe한다.
- 관리자 상품 Provider는 관리자 경로에서만 전체 목록을 초기 로드한다.

- [x] **Step 1: 루트 렌더와 query dedupe 실패 테스트 작성**
- [x] **Step 2: 최근·찜·리뷰 상품 일부 조회 실패 상태 테스트 작성**
- [x] **Step 3: 실패 확인**

Run: `npm test -- --runInBand src/app/_components/ProductSection.test.tsx src/shared/hooks/useProducts.test.tsx`

Expected: 루트 Provider 축소, 동일 query dedupe, 일부 실패 표시 단언이 FAIL.

- [x] **Step 4: Query 키·훅과 route 소유 Provider 최소 구현**
- [x] **Step 5: 상품 Provider 소비처를 조회 훅 또는 해당 route Provider로 전환**
- [x] **Step 6: 집중 검증**

Run: `npm test -- --runInBand src/app/_components/ProductSection.test.tsx src/shared/hooks/useProducts.test.tsx src/app/mypage/_components src/app/reviews`

Expected: PASS이며 공개 경로 진입만으로 전체 상품·이벤트·쿠폰·사용자 활동 조회가 시작되지 않는다.

---

### Task 2: 상품·카테고리 목록 공통화와 검색 URL 상태

**Files:**
- Modify: `src/app/products/_components/ProductList.tsx`
- Modify: `src/app/products/_components/ProductList.test.tsx`
- Modify: `src/app/categories/[category]/page.tsx`
- Modify: `src/app/search/SearchClient.tsx`
- Modify: `src/app/search/SearchClient.test.tsx`
- Modify: `src/shared/services/productService.ts`
- Modify: `src/shared/services/productService.test.ts`
- Modify: `docs/product-listing-structure.md`

**Interfaces:**
- 카테고리 상세는 별도 전체 조회 UI 대신 공용 `ProductList`와 Firestore cursor paging을 사용한다.
- 검색어는 `NFKC`, 앞뒤 제거, 연속 공백 한 칸으로 정규화하고 query key와 URL `q`에 같은 값을 사용한다.
- 공개 목록의 `q`, `category`, `sort`, `minPrice`, `maxPrice`는 URL query와 동기화한다.
- 전체 개수를 모르는 cursor 결과는 `총 N개`로 표현하지 않고 현재 페이지 결과임을 명시한다.

- [x] **Step 1: 검색 정규화·URL 상태·카테고리 cursor 실패 테스트 작성**
- [x] **Step 2: 실패 확인**

Run: `npm test -- --runInBand src/shared/services/productService.test.ts src/app/products/_components/ProductList.test.tsx src/app/search/SearchClient.test.tsx`

Expected: 연속 공백, URL 복원, 공용 category paging 단언이 FAIL.

- [x] **Step 3: 서비스 정규화와 공용 목록 입력 구현**
- [x] **Step 4: 카테고리·검색 페이지 전환**
- [x] **Step 5: 집중 검증**

Run: `npm test -- --runInBand src/shared/services/productService.test.ts src/app/products/_components/ProductList.test.tsx src/app/search/SearchClient.test.tsx`

Expected: PASS.

---

### Task 3: 편집 추천 상품 단일 조회와 안전한 내부 링크

**Files:**
- Modify: `src/shared/services/featuredProductService.ts`
- Create: `src/shared/services/featuredProductService.test.ts`
- Modify: `src/app/_components/FeaturedProducts.tsx`
- Create: `src/app/_components/FeaturedProducts.test.tsx`
- Modify: `src/app/page.tsx`
- Modify: `src/app/page.test.tsx`
- Modify: `src/shared/services/siteContentService.ts`
- Modify: `src/shared/services/siteContentService.test.ts`
- Modify: `docs/static-content.md`

**Interfaces:**
- `getFeaturedSection()`은 추천 설정을 한 번 읽고 상품 문서는 병렬 조회한 뒤 관리자 설정 순서를 보존한다.
- 홈은 이 단일 편집 추천 섹션을 렌더링하고 설정이 없거나 유효 상품이 없으면 섹션을 숨긴다.
- 배너 링크는 `/`로 시작하는 동일 사이트 경로만 허용하며 외부 URL, protocol-relative, `javascript:`, `data:`는 안전한 내부 fallback으로 바꾼다.

- [x] **Step 1: 단일 설정 조회·순서·안전 링크 실패 테스트 작성**
- [x] **Step 2: 실패 확인**
- [x] **Step 3: 서비스와 홈 섹션 최소 구현**
- [x] **Step 4: 집중 검증**

Run: `npm test -- --runInBand src/shared/services/featuredProductService.test.ts src/app/_components/FeaturedProducts.test.tsx src/shared/services/siteContentService.test.ts src/app/page.test.tsx`

Expected: PASS.

---

### Task 4: 상세 조회 캐시, 오류 경계와 Product 구조화 데이터

**Files:**
- Create: `src/shared/constants/seo.ts`
- Create: `src/shared/constants/seo.test.ts`
- Modify: `src/app/products/[productId]/page.tsx`
- Create: `src/app/products/[productId]/page.test.tsx`
- Create: `src/app/products/[productId]/error.tsx`
- Modify: `src/app/events/[eventId]/page.tsx`
- Modify: `src/app/events/[eventId]/page.test.tsx`
- Create: `src/app/events/[eventId]/error.tsx`

**Interfaces:**
- 상세 loader는 React `cache`로 감싸 metadata와 본문에서 같은 결과를 공유한다.
- service reject는 error boundary로 전달하고, 확인된 `null` 또는 공개 정책 미충족만 404로 처리한다.
- 공개 상품은 `status === 'active'`, 공개 이벤트는 `isActive === true`와 기존 공개 정책을 모두 만족할 때만 상세·메타데이터에 노출한다.
- Product JSON-LD는 이름, 이미지, 브랜드, KRW 가격, 재고 상태와 유효한 평점만 포함하며 `<`를 escape한다.
- OG 이미지 MIME은 파일 확장자에서 판정하고 모르는 형식은 거짓 MIME을 선언하지 않는다.

- [x] **Step 1: 캐시·오류 전파·JSON-LD·MIME 실패 테스트 작성**
- [x] **Step 2: 실패 확인**
- [x] **Step 3: 공용 SEO 헬퍼와 상세 loader 최소 구현**
- [x] **Step 4: 상세 오류 경계 구현**
- [x] **Step 5: 집중 검증**

Run: `npm test -- --runInBand src/shared/constants/seo.test.ts src/app/products/[productId]/page.test.tsx src/app/events/[eventId]/page.test.tsx`

Expected: PASS.

---

### Task 5: 경로별 canonical·robots와 배너 이미지 우선순위

**Files:**
- Modify: `src/app/layout.tsx`
- Create/Modify: 공개 route의 `layout.tsx` 또는 `page.tsx` metadata
- Create/Modify: 인증·주문·마이페이지·관리자 route layout
- Create: `src/app/robots.ts`
- Create: `src/app/sitemap.ts`
- Create: `src/app/robots.test.ts`
- Create: `src/app/sitemap.test.ts`
- Modify: `src/app/_components/MainBanner.tsx`
- Modify: `src/app/_components/MainBanner.test.tsx`
- Modify: `docs/main-banner.md`
- Modify: `docs/image-delivery-performance.md`

**Interfaces:**
- 공개 index route는 자기 경로의 절대 canonical을 제공한다.
- 검색 결과와 인증·주문·마이페이지·관리자 경로는 `noindex, follow`를 제공한다.
- 루트 canonical이 자식 경로에 홈페이지 URL로 잘못 상속되지 않는다.
- robots는 `/admin`, `/auth`, `/mypage`, `/orders`, `/api`를 크롤링 대상에서 제외하고 sitemap은 공개 정적 경로와 active 상품·이벤트만 포함한다.
- 메인 배너는 화면에 필요한 인접 이미지는 렌더링하되 초기 LCP 후보 한 장만 `priority`로 preload한다.

- [x] **Step 1: metadata·배너 priority 실패 테스트 작성**
- [x] **Step 2: 실패 확인**

Run: `npm test -- --runInBand src/app/_components/MainBanner.test.tsx src/shared/constants/seo.test.ts src/app/robots.test.ts src/app/sitemap.test.ts`

Expected: canonical/robots와 priority 한 장 단언이 FAIL.

- [x] **Step 3: route metadata와 private noindex 구현**
- [x] **Step 4: 배너 priority 최소 구현**
- [x] **Step 5: 집중 검증과 문서 갱신**

Run: `npm test -- --runInBand src/app/_components/MainBanner.test.tsx src/app/products/[productId]/page.test.tsx src/app/events/[eventId]/page.test.tsx`

Run: `npm run typecheck`

Run: `npm run lint -- --max-warnings=0`

Expected: PASS.

---

### Task 6: 차단된 이벤트 이미지와 전송 설정 위험 정리

**Files:**
- Modify: `src/shared/utils/eventImages.ts`
- Modify: `src/shared/utils/eventImages.test.ts`
- Modify: `docs/image-delivery-performance.md`

**Interfaces:**
- Firebase Hosting이 `/events/` HTML로 redirect하는 `/events/2026*` 구형 경로는 유효 이미지로 사용하지 않고 기존 편집형 fallback으로 교체한다.
- Firebase Functions 호환을 위해 `images.unoptimized`는 임의로 켜거나 끄지 않고, 원본 전송 비용과 승인 호스트 제한의 남은 위험을 문서화한다.

- [x] **Step 1: redirect 대상 이미지 fallback 실패 테스트 작성**
- [x] **Step 2: 최소 구현과 집중 검증**

Run: `npm test -- --runInBand src/shared/utils/eventImages.test.ts`

Expected: PASS이며 HTML redirect 경로가 `next/image` 소스로 남지 않는다.

---

### Task 7: 단계 전체 검증과 실제 브라우저 확인

- [x] **Step 1: 성능·SEO 관련 전체 Jest 검증**
- [x] **Step 2: 타입체크와 ESLint 경고 0건 확인**
- [x] **Step 3: production build에서 metadata·route 오류 확인**
- [x] **Step 4: 390×844와 1440×900에서 홈·상품·카테고리·검색·상세 화면 확인**
- [x] **Step 5: 네트워크 실패/빈 결과/404를 구분하고 가로 overflow·영문/한글 깨짐 확인**
- [x] **Step 6: 독립 코드 리뷰 후 Critical/Important 0건 확인**

Run: `npm run sync:chat-responses`

Run: `npm run typecheck`

Run: `npm run lint -- --max-warnings=0`

Run: `npm test -- --runInBand`

Run: `npm run build`

Expected: 모든 명령 PASS. Firestore/Storage Rules와 Functions 전체 검증은 최종 단계 6에서 다시 실행한다.

## Self-review

- 단계 5의 전역 선조회, 공용 query key, 목록 cursor/URL, 추천 설정, 상세 오류, canonical/robots, JSON-LD와 이미지 priority 요구를 Task 1~6에 매핑했다.
- Firestore 데이터 구조, Rules, 인덱스, seed와 배포를 변경하지 않는다.
- 서비스 오류와 404를 구분하며 공개 정책 gate를 우회하지 않는다.
- 커밋 단계는 사용자·프로젝트의 커밋 금지 지시 때문에 의도적으로 제외했다.
