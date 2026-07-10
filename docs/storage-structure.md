# Firebase Storage 구조

## 상품 이미지 경로

상품 이미지는 카테고리와 상품 ID 기준으로 분리해 저장한다.

```text
images/
  tops/{productId}/{filename}.webp
  bottoms/{productId}/{filename}.webp
  shoes/{productId}/{filename}.webp
  accessories/{productId}/{filename}.webp
  bags/{productId}/{filename}.webp
  others/{productId}/{filename}.webp
```

관리자 상품 업로드는 최종 파일을 WebP로 저장하고, Firestore 상품 문서의 `mainImage`, `images`, `detailImages`에는 Firebase Storage 다운로드 URL을 저장한다.

## 메인 배너 이미지

메인 배너 상품 이미지는 다음 경로를 사용한다.

```text
images/main-banner/{productId}/banner.webp
```

배너 클릭 후 이동하는 상품 상세 이미지는 다음 경로를 사용한다.

```text
images/{category}/{productId}/main.webp
```

Firestore `products/{productId}`의 `mainImage`, `images`, `detailImages`는 `/products/...` 같은 로컬 경로가 아니라 `https://firebasestorage.googleapis.com/...` 다운로드 URL이어야 한다.

## Storage Rules

- 읽기: 상품, 카테고리, 이벤트 이미지 공개 허용
- 쓰기: 관리자 custom claim(`admin == true` 또는 `role == "admin"`) 사용자만 허용
- 제한: 이미지 파일, 5MB 이하

현재 공개 읽기 허용 경로:

```text
images/{category}/{productId}/{filename}
categories/{filename}
events/{type}/{filename}
```

## 관련 스크립트

기존 상품 이미지 WebP 마이그레이션:

```bash
npm run migrate:product-images:analyze
npm run migrate:product-images:dry-run
npm run migrate:product-images:execute
npm run migrate:product-images:validate
npm run migrate:product-images:delete-originals
```

콘텐츠 이미지 WebP 마이그레이션:

```bash
npm run migrate:content-images:analyze
npm run migrate:content-images:dry-run
npm run migrate:content-images:execute
npm run migrate:content-images:validate
npm run migrate:content-images:delete-originals
```

## 주의사항

- 상품 상세가 로컬 fallback 상품 데이터를 사용하지 않도록 Firestore 문서와 Storage URL을 먼저 준비한다.
- 배너 상품 이미지를 교체하면 Storage 업로드 후 Firestore 이미지 URL과 `MainBanner.tsx`의 배너 URL을 함께 확인한다.
- Storage 파일 삭제는 Firestore 문서가 더 이상 해당 URL을 참조하지 않는 것을 확인한 뒤 진행한다.
