# 메인 상단 배너 작업 영역

## 현재 상태
- 메인 화면 상단 배너는 `src/app/_components/MainBanner.tsx`에서 렌더링한다.
- 배너는 5개 슬라이드이며, `768px` 이상에서는 각 슬라이드가 좌우 2개의 정사각형 상품 배너 카드로 구성된다.
- `767px` 이하에서는 각 슬라이드가 새 세로형 이벤트 배너 한 장으로 구성되며, 배너 전체가 기존 이벤트 상세 페이지로 이동한다.
- 좌측 카드는 상품 중심 이미지, 우측 카드는 모델 착용 중심 이미지로 구성한다.
- 좌우 카드는 비슷한 컬러 무드를 공유하지만 서로 다른 상품 상세 URL로 이동한다.
- 메인 배너 이미지는 Firebase Storage의 `images/main-banner/{productId}/banner.webp`에서 읽는다.
- 모바일 이벤트 배너 이미지는 `public/main/mobile-event-banner/*.webp`의 정적 자산을 사용한다.
- 마운트 당시 첫 슬라이드의 첫 번째 이미지 한 장만 초기 LCP 후보로 `priority`를 사용한다. 자동·수동 이동이나 세션 복원 뒤에는 새 활성 이미지로 `priority`를 옮기지 않는다.
- 상품 상세 이미지는 Firestore `products/{productId}` 문서의 `mainImage`, `images`, `detailImages` 필드에서 읽으며, 값은 Firebase Storage URL이다.
- 배너 상품 상세는 로컬 fallback 데이터를 사용하지 않는다. Firestore `products/{productId}` 문서가 실제 데이터 원본이다.

## 작업 파일
- `src/app/_components/MainBanner.tsx`
- `src/app/_components/MainBanner.module.css`
- `src/app/_components/MainBanner.test.tsx`
- `src/shared/services/productService.ts`
- `src/shared/services/productService.mainBannerFallback.test.ts`
- `public/main/mobile-event-banner/*.webp`

## Firebase Storage 경로
- 메인 배너: `images/main-banner/{productId}/banner.webp`
- 상품 상세 이미지: `images/{category}/{productId}/main.webp`

## 데스크톱·태블릿 연결 상품 URL
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

## 모바일 이벤트 URL

- 라스트 서머 세일 셀렉션: `/events/event-2026-08-summer-sale-edit`
- 프리폴 레이어링 신상: `/events/event-2026-08-prefall-layering-new`
- 늦여름 데일리 리셋: `/events/event-2026-08-late-summer-style`
- 데일리 백 & 액세서리 세일: `/events/event-2026-08-bag-accessory-sale`
- 데일리 백 신상품: `/events/event-2026-08-daily-bag-new`

## 검증
- `MainBanner.test.tsx`에서 5개 세트, 10개 상품 링크, Firebase Storage 이미지 URL, 이벤트/카테고리 링크 미사용, 초기 단일 `priority` 이미지와 수동·자동·세션 복원 뒤 priority 재할당 방지를 확인한다.
- `productService.mainBannerFallback.test.ts`에서 Firestore에 상품 ID 문서가 없을 때 로컬 fallback 상품 데이터가 반환되지 않는지 확인한다.
- Firestore의 `products/{productId}.mainImage`, `images`, `detailImages`는 `/products/main-banner/*` 같은 로컬 경로가 아니라 `https://firebasestorage.googleapis.com/...` URL이어야 한다.
- 배너 이미지를 바꾸면 모바일에서 세로형 이벤트 이미지·이벤트 상세 연결·양옆 프리뷰 없음, `768px` 이상에서 좌우 상품 카드·가변 프리뷰·가로 이동 전환을 확인한다.
## 슬라이드 상호작용

- 이미지 아래 하단 컨트롤 영역에서 이전·다음 버튼, 자동 재생 토글, 5개 세그먼트 바를 제공한다. 현재 슬라이드 세그먼트만 검정색으로 표시한다.
- 좌우 이동 버튼은 회전한 CSS 도형 대신 문자 화살표를 사용하며, 버튼 중앙에 정렬한다.
- 배너를 드래그하는 동안 트랙이 포인터의 X축 이동량을 실시간으로 따라간다.
- 시작 위치에서 좌우로 48px 이상 이동한 상태에서 놓으면 방향에 따라 한 장씩 이동하고, 48px 미만이면 현재 슬라이드로 돌아온다. 세로 스크롤과 상품 링크의 일반 클릭은 유지한다.
- 4px 이상 포인터가 움직였다면 48px 미만의 짧은 드래그라도 상품 링크 클릭으로 처리하지 않는다.
- 슬라이드 전환 중에는 버튼, 페이지네이션, 자동 전환, 새 드래그 이동을 받지 않는다. 빠른 연속 입력으로 트랙이 여러 칸을 역방향 이동하는 현상을 방지한다.
- 무한 순환의 복제 슬라이드 위치 보정은 `transform`의 `transitionend`에서만 처리한다. 고정 시간 타이머를 함께 사용하지 않는다.
- 현재 슬라이드 번호는 브라우저 세션에 저장한다. 상품 상세를 열었다가 뒤로 가기로 돌아오면 마지막으로 보던 배너를 복원한다.

## 2026-07-21 접근성 재생 제어

- 자동 재생 시작·정지 버튼을 제공하며, 사용자가 정지한 상태에서는 자동 전환을 다시 시작하지 않는다.
- 배너에 마우스를 올리거나 키보드 포커스가 머무는 동안 자동 전환을 일시 중지하고 영역을 벗어나면 사용자 재생 설정을 유지한 채 재개한다.
- `prefers-reduced-motion: reduce`에서는 자동 재생 시작 버튼을 비활성화하고 transform 전환을 사용하지 않는다. 설정을 해제하기 전에는 이전·다음·페이지 버튼으로만 즉시 전환한다.
- 전환 중 운영체제의 모션 감소 설정이 켜져도 현재 전환 잠금을 즉시 해제한다. 무한 순환 경계의 복제 슬라이드에 있으면 같은 실제 슬라이드 위치로 즉시 정규화해 설정을 다시 꺼도 여러 칸을 가로지르거나 잠기지 않는다.
- 모바일 세그먼트 바와 이전·다음·자동 재생 버튼은 시각 크기와 별개로 각 44×44px 터치 영역을 제공한다.

## 2026-08-06 반응형 배너 분리

- `768px` 이상에서는 활성 슬라이드 폭을 태블릿 86%, 데스크톱 70%, `1600px` 이상 60%로 두고 양옆 인접 슬라이드를 각각 7%, 15%, 20% 보인다. 각 데스크톱·태블릿 상품 카드는 정사각형 비율을 유지한다.
- `767px` 이하에서는 활성 슬라이드 폭을 100%로 두고 양옆 프리뷰를 보이지 않는다. `mobileBanners`의 세로형 3:4 이벤트 이미지를 렌더링하며, 이벤트 제목과 설명은 이미지 위 UI 텍스트로 제공한다.
- 데스크톱·태블릿과 모바일은 활성 인덱스, 무한 순환, 드래그, 자동 재생, 세션 복원 상태를 공유한다.
