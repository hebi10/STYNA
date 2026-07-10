# 이미지 전송 성능

## 현재 적용

- 메인 카테고리 4장은 기존 PNG 대신 `public/category/*_q75.webp`를 사용한다. 합계 전송 크기는 약 6MB에서 약 92KB로 줄었다.
- `next.config.ts`는 `next/image` 최적화를 활성화하고, 최적화 결과를 하루 동안 캐시한다.
- 신규 상품·카테고리·이벤트 이미지 업로드는 WebP q75, 긴 변 최대 1600px, `public, max-age=31536000, immutable` 메타데이터를 사용한다.
- 메인 배너는 활성 슬라이드와 양옆 슬라이드의 이미지 6장만 렌더링한다. 활성 슬라이드의 양쪽 카드는 우선 로드한다.
- 상품 WebP 마이그레이션은 `images`, `mainImage`, `detailImages`를 모두 대상으로 삼는다.

## Firebase Storage 후속 작업

현재 로컬 환경에는 Firebase Admin 자격 증명이 없어 기존 Storage 객체의 메타데이터 변경은 실행하지 못했다. 자격 증명을 준비한 뒤 다음 명령을 실행한다.

```bash
npm run storage:main-banner-cache:execute
npm run storage:main-banner-cache:validate
```

이 명령은 기존 메인 배너 10개에 아래 캐시 정책을 설정한다. 파일명이 고정된 배너는 향후 교체를 고려해 `immutable`을 사용하지 않는다.

```text
public, max-age=86400, stale-while-revalidate=604800
```

카테고리 이미지를 Firebase Storage로 옮길 때는 원본을 삭제하지 않는 다음 명령을 사용한다.

```bash
npm run migrate:category-images:analyze
npm run migrate:category-images:execute
npm run migrate:category-images:validate
```

업로드가 검증된 뒤에만 `src/shared/constants/categoryImages.ts`의 로컬 WebP 경로를 Storage URL로 바꾼다.
