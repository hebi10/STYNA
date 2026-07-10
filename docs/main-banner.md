# 메인 상단 배너 작업 영역

## 현재 상태
- 메인 화면 상단 배너는 `src/app/_components/MainBanner.tsx`에서 렌더링한다.
- 배너는 5개 슬라이드이며, 각 슬라이드는 좌우 2개의 상품 배너 카드로 구성한다.
- 좌측 카드는 상품 중심 이미지, 우측 카드는 모델 착용 중심 이미지로 구성한다.
- 좌우 카드는 비슷한 컬러 무드를 공유하지만 서로 다른 상품 상세 URL로 이동한다.
- 메인 배너 이미지는 Firebase Storage의 `images/main-banner/{productId}/banner.webp`에서 읽는다.
- 상품 상세 이미지는 Firestore `products/{productId}` 문서의 `mainImage`, `images`, `detailImages` 필드에서 읽으며, 값은 Firebase Storage URL이다.
- 배너 상품 상세는 로컬 fallback 데이터를 사용하지 않는다. Firestore `products/{productId}` 문서가 실제 데이터 원본이다.

## 작업 파일
- `src/app/_components/MainBanner.tsx`
- `src/app/_components/MainBanner.module.css`
- `src/app/_components/MainBanner.test.tsx`
- `src/shared/services/productService.ts`
- `src/shared/services/productService.mainBannerFallback.test.ts`

## Firebase Storage 경로
- 메인 배너: `images/main-banner/{productId}/banner.webp`
- 상품 상세 이미지: `images/{category}/{productId}/main.webp`

## 연결 상품 URL
- 쿨터치 오버핏 반팔 셔츠: `/products/cool-touch-oversized-shirt`
- 쿨터치 와이드 밴딩 팬츠: `/products/cool-touch-wide-banding-pants`
- 린넨 라이크 반팔 셔츠: `/products/linen-like-half-shirt`
- 린넨 라이크 버뮤다 쇼츠: `/products/linen-like-bermuda-shorts`
- 메쉬 로우프로파일 스니커즈: `/products/mesh-low-profile-sneakers`
- 나일론 스트링 크로스백: `/products/nylon-string-crossbody-bag`
- 시어서커 반팔 재킷: `/products/seersucker-half-jacket`
- 유틸리티 빅 토트백: `/products/utility-big-tote-bag`
- 라이트 집업 재킷: `/products/light-zip-up-jacket`
- 워시드 와이드 데님 팬츠: `/products/washed-wide-denim-pants`

## 검증
- `MainBanner.test.tsx`에서 5개 세트, 10개 상품 링크, Firebase Storage 이미지 URL, 이벤트/카테고리 링크 미사용, 수동/자동 슬라이드 이동을 확인한다.
- `productService.mainBannerFallback.test.ts`에서 Firestore에 상품 ID 문서가 없을 때 로컬 fallback 상품 데이터가 반환되지 않는지 확인한다.
- Firestore의 `products/{productId}.mainImage`, `images`, `detailImages`는 `/products/main-banner/*` 같은 로컬 경로가 아니라 `https://firebasestorage.googleapis.com/...` URL이어야 한다.
- 배너 이미지를 바꾸면 브라우저에서 좌측 상품 중심 이미지, 우측 모델 중심 이미지, 좌우 7% 미리보기, 가로 이동 전환을 확인한다.
