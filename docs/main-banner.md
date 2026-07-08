# 메인 상단 배너 작업 영역

## 현재 상태
- 메인 화면 상단 배너는 `src/app/_components/MainBanner.tsx`에서 렌더링한다.
- 배너는 5개 슬라이드로 구성하며, 한 슬라이드에는 왼쪽 상품 배너 1개와 오른쪽 이벤트 배너 1개가 정사각형으로 노출된다.
- 슬라이드는 페이드가 아니라 가로 `transform` 이동으로 전환한다.
- 중앙 슬라이드는 전체 폭의 86%를 차지하고, 좌우 이전/다음 슬라이드가 각각 약 7%씩 보인다.
- 좌우에 보이는 비활성 슬라이드는 CSS 오버레이로 어둡게 처리한다.
- 사용자에게 보이는 배너 문구는 런타임 HTML 텍스트가 아니라 `public/main/top_banner_*.webp` 이미지 안에 포함한다.
- 링크 접근성을 위해 각 이미지 링크에는 `aria-label`과 `alt`를 유지한다.
- 좌우 버튼이나 페이지 점을 누르면 자동 전환 타이머가 다시 4.5초부터 시작된다.

## 작업 파일
- `src/app/_components/MainBanner.tsx`
- `src/app/_components/MainBanner.module.css`
- `src/app/_components/MainBanner.test.tsx`
- `public/main/top_banner_01_product_cool_touch.webp`
- `public/main/top_banner_01_event_midyear_sale.webp`
- `public/main/top_banner_02_product_vacation_linen.webp`
- `public/main/top_banner_02_event_vacation_coupon.webp`
- `public/main/top_banner_03_product_daily_sneakers.webp`
- `public/main/top_banner_03_event_photo_review.webp`
- `public/main/top_banner_04_product_office_bag.webp`
- `public/main/top_banner_04_event_cool_touch.webp`
- `public/main/top_banner_05_product_prefall_layer.webp`
- `public/main/top_banner_05_event_prefall_open.webp`

## 연결 링크
- 상품 배너: `/categories/tops`, `/categories/shoes`, `/categories/bags`
- 이벤트 배너:
  - `/events/event-2026-06-midyear-sale`
  - `/events/event-2026-07-vacation-coupon`
  - `/events/event-2026-07-summer-review`
  - `/events/event-2026-07-cool-touch`
  - `/events/event-2026-08-pre-fall`

## 검증
- `MainBanner.test.tsx`에서 5개 세트, 이벤트 링크, 수동/자동 슬라이드 이동을 확인한다.
- 타입체크와 변경 파일 ESLint를 통과해야 한다.
- 브라우저에서 중앙 2개 정사각형 배너, 좌우 7% 미리보기, 어두운 비활성 슬라이드, 가로 이동 전환을 확인한다.
