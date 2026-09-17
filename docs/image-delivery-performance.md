# 이미지 전송 성능

## 현재 적용

- 메인 카테고리 4장은 기존 PNG 대신 `public/category/*_q75.webp`를 사용한다. 합계 전송 크기는 약 6MB에서 약 92KB로 줄었다.
- Cloud Functions의 이미지 최적화 경로가 원격 이미지를 거부하지 않도록 `next.config.ts`의 `unoptimized`를 활성화한다. `next/image`는 반응형 레이아웃만 담당하고 브라우저는 로컬 또는 Firebase Storage 원본 URL을 직접 요청한다.
- 신규 상품·카테고리·이벤트 이미지 업로드는 WebP q75, 긴 변 최대 1600px, `public, max-age=31536000, immutable` 메타데이터를 사용한다.
- 관리자 카테고리 아이콘은 256×256 투명 WebP로 저장하고 `categories/admin-icon-{categoryId}-v{yyyymmdd}.webp` 경로에 `public, max-age=31536000, immutable` 캐시 정책을 사용한다.
- 메인 배너는 활성 슬라이드와 양옆 슬라이드의 이미지 6장만 렌더링한다. 활성 슬라이드의 첫 번째 LCP 후보 한 장만 `priority`로 요청하고 나머지는 기본 지연 로딩 정책을 따른다. 링크·이미지의 브라우저 기본 드래그는 막아 가로 스와이프가 취소되지 않게 한다.
- Firebase Hosting에서 이벤트 목록 HTML로 리다이렉트하는 `/events/2026`, `/events/2026-v2`, `/events/2026-v3` 하위 경로와 `/events/2026-editorial/*-20260715-*.webp`, `*-20260721-*.webp`는 이미지 URL로 사용하지 않고 기존 에디토리얼 이미지로 대체한다. Firebase Storage의 인코딩된 객체 URL은 이 판정에 포함하지 않는다.
- 이벤트 이미지 소스는 `/`로 시작하는 로컬 절대 경로 또는 `https:` URL만 허용한다. `javascript:`, `data:`, `http:`, protocol-relative 및 상대 경로는 `next/image`에 전달하지 않고 에디토리얼 이미지로 대체하며, 유효한 URL의 앞뒤 공백은 제거한다.
- 상품 WebP 마이그레이션은 `images`, `mainImage`, `detailImages`를 모두 대상으로 삼는다.

## 업로드와 전송 크기 기준

현재 브라우저 업로드 최적화는 `src/shared/libs/firebase/imageOptimization.ts`를 기준으로 WebP q75, 긴 변 최대 1600px로 변환한다. Storage Rules의 5MB 제한은 보안상 상한이며 목표 전송 크기가 아니다.

`images.unoptimized: true` 상태에서는 Firebase Storage에 저장된 원본 WebP 크기가 브라우저 전송량에 직접 영향을 주므로 다음을 운영 예산으로 사용한다.

| 용도 | 권장 전송 크기 | 비고 |
| --- | ---: | --- |
| 상품 카드/썸네일 | 250KB 이하 | 목록에서 여러 장이 동시에 노출되므로 우선순위가 가장 높다. |
| 상품 상세 이미지 | 500KB 이하 | 확대 품질과 모바일 전송량을 함께 본다. |
| 메인 배너/이벤트 에디토리얼 | 750KB 이하 | 화면을 크게 사용하지만 한 화면의 동시 eager 요청 수를 제한한다. |
| 아이콘/소형 장식 이미지 | 100KB 이하 | 가능하면 실제 표시 크기에 가까운 원본을 사용한다. |

위 값은 Storage Rules의 hard limit가 아니라 성능 예산이다. 이미지 종류별 품질 검증 없이 더 낮은 수치로 강제 압축하지 않는다.

### 확인 절차

배포 또는 이미지 교체 뒤 Chrome DevTools Network에서 `Img` 필터를 사용해 다음을 확인한다.

1. 캐시를 비운 첫 진입에서 `Transferred`와 `Resource Size`를 기록한다.
2. 상품 목록은 첫 viewport에 표시되는 이미지 합계와 개별 250KB 초과 파일을 확인한다.
3. 상품 상세는 대표 이미지와 상세 이미지 중 500KB 초과 파일을 확인한다.
4. 메인 배너는 LCP 후보가 불필요한 다른 슬라이드 이미지보다 먼저 시작되는지 확인한다.
5. 새로고침 후 immutable Storage 이미지가 메모리/디스크 캐시를 재사용하는지 확인한다.

Firebase Storage의 운영 이미지 크기는 저장소 정적 파일만으로 정확히 측정할 수 없으므로, 문서에는 실제 측정값과 목표 예산을 구분해서 기록한다. 측정하지 않은 값을 현재 전송량으로 표기하지 않는다.

## Next Image/CDN 후속 판단

현재는 Firebase Hosting/Functions 배포 단순성과 기존 원격 이미지 호환성을 위해 `images.unoptimized: true`를 유지한다. 다음 조건이 충족되면 CDN 또는 Next Image 최적화 경로 재도입을 검토한다.

- Storage 원본을 충분히 압축해도 모바일 LCP 이미지 전송량이 예산을 지속적으로 초과하는 경우
- 동일 원본에 대해 카드·상세·배너 등 여러 해상도 파생본이 반복적으로 필요한 경우
- 이미지 최적화 Functions/CDN 비용과 캐시 적중률을 관측할 수 있는 운영 지표가 준비된 경우

전환 시에는 Firebase Storage remote pattern, Functions 런타임, `/_next/image` 캐시, 배포 크기를 한 번에 검증한다.

## Firebase Storage 후속 작업

기존 메인 배너 10개에는 아래 캐시 정책 적용 및 검증을 완료했다. 이후 배너 파일을 교체한 경우에만 다음 명령을 다시 실행한다.

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

## Functions 런타임 설정

- `nextjsServer`는 `functions/.next/required-server-files.json`에 직렬화된 빌드 설정을 읽는다. 이미지 요청은 `unoptimized` 설정에 따라 `/_next/image`를 우회한다.
- `npm run deploy:functions`와 직접 `firebase deploy --only functions` 모두 Firebase predeploy에서 최신 Next 빌드를 `functions/.next`에 복사하고 생성된 상담 route의 provider 경계를 검증한다.
- 배포 없이 로컬 산출물만 준비·검증하려면 `npm run deploy:prep`, 전체 품질 검증 후 배포하려면 `npm run deploy:firebase`를 사용한다.
