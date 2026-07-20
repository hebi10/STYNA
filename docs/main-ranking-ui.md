# 메인 베스트 랭킹 UI 문서

## 대상 파일
- `src/app/page.tsx`
- `src/app/_components/ProductSection.tsx`
- `src/app/_components/ProductSection.module.css`
- `src/app/products/_components/ProductCard.tsx`
- `src/app/products/_components/ProductCard.module.css`

## 목적
- 메인 페이지 베스트 랭킹 섹션의 카드 오버레이가 서로 겹치지 않도록 레이아웃 기준을 관리한다.
- 랭킹 번호, 할인 배지, 이미지 상단 정보 배치 충돌 여부를 점검한다.

## 2026-04-23 조정 사항
- 베스트 랭킹 카드의 랭킹 번호를 이미지 좌상단 오버레이에서 카드 상단 별도 칩으로 분리했다.
- `rankingItem` 상단 여백을 랭킹 칩 높이 기준으로 다시 계산해 카드 이미지의 `NEW`·할인 배지 영역과 수직으로 분리했다.
- 모바일 구간에서도 같은 구조를 유지하도록 랭킹 칩 크기와 여백을 CSS 변수로 함께 축소했다.

## 2026-04-24 카피 메모
- `src/app/page.tsx`에서 베스트 랭킹 섹션 설명을 `베스트셀러 상위 8개 상품`으로 축약했다.
- 랭킹 카드 배치와 오버레이 구조는 유지했고, 카피만 정보형 문구로 정리했다.

## 2026-04-24 헤더 메모
- 베스트 랭킹 섹션은 `title + subtitle`만 남기고 `viewAll` 버튼과 eyebrow를 제거했다.
- 카드 영역 전 정보 과밀도를 줄이기 위한 조정이며 랭킹 카드 구조 자체는 그대로 유지했다.

## 2026-04-24 타이포 메모
- `src/app/_components/ProductSection.module.css`의 섹션 제목에서 세리프 폰트를 제거해 메인 공용 섹션 제목도 `Pretendard` 위계로 맞췄다.
- 랭킹 카드 자체 구조는 건드리지 않았고 제목 타이포만 메인 배너 외 전역 원칙에 맞춰 정리했다.

## 2026-04-24 컬러 메모
- `src/app/_components/ProductSection.module.css`, `src/app/_components/FeaturedProducts.module.css`, `src/app/products/_components/ProductCard.module.css`의 `전체 보기` 버튼/링크, 스피너, 카드 hover에서 버건디 포인트를 제거했다.
- 메인 공용 섹션 액션은 검정 기반으로 통일하고, 상품 카드 자체 강조색은 세일 정보 외에는 거의 쓰지 않도록 줄였다.

## 2026-04-24 배지 메모
- `src/app/products/_components/ProductCard.module.css`의 상품 카드 배지에서 blur를 제거하고 단색 배경 + 얇은 보더만 남겨 더 명확한 계층으로 정리했다.
- `sale`과 `out of stock` 배지는 구분감은 유지하되 반투명 효과 없이 읽히도록 맞췄다.

## 2026-05-11 메인 흐름 메모
- 메인 페이지 첫 흐름은 `히어로 -> 카테고리 -> 신상품 -> 시즌오프 안내 -> 베스트셀러 -> 할인 상품 -> 안내 정보` 순서로 조정했다.
- 베스트셀러는 사용자 제공 기존 시안처럼 4열 2줄 상품 매대로 유지하고, 랭킹 번호는 작은 진한 번호 박스로 정리했다.
- 베스트셀러는 `ProductService.getBestSellerProducts()`가 `products` 컬렉션의 `status == active`와 `reviewCount desc` 기준으로 읽으며, 해당 쿼리용 Firestore 인덱스를 추가했다.
- 베스트셀러/상품 매대는 900px 이하에서 2열로 내려가며, 랭킹 번호는 모바일에서도 상품 배지와 겹치지 않도록 좌상단 작은 박스 크기를 줄였다.

## 2026-05-12 모바일/탭 상품 보정
- 메인 모바일 배너 높이와 카피 폭을 줄이고, 페이지네이션 bullet은 모바일에서 원형 8px로 고정했다.
- 모바일 카테고리 카드는 480px 이하에서도 1열이 아니라 2열로 유지한다.
- 신상품 아래에 `CategoryProductTabs`를 추가해 실제 상품 데이터를 카테고리 탭별 4개 상품 매대로 보여준다.

## 2026-07-20 미사용 카테고리 탭 제거
- `CategoryProductTabs`는 후속 홈 편집 개편에서 미사용 상태가 되어 제거했다.
- 현재 메인 카테고리 영역은 `DynamicCategorySection`이 담당한다.

## 2026-05-12 모바일 리뷰 코멘트 반영
- 신상품 등 bordered 섹션 헤더는 모바일에서도 제목/보조문구와 `전체보기` 링크가 같은 줄의 좌우 끝에 남도록 보정했다.
- 베스트셀러 랭킹 카드에만 `ProductCard` 배지를 랭킹 번호 아래로 내리는 전용 옵션을 적용해 순위와 할인율이 겹치지 않게 했다.
- 모바일 배너는 3:1 데스크톱 이미지를 그대로 crop하지 않고 `*_mobile.webp` 이미지를 별도로 사용한다.
- 하단 안내/푸터는 640px 이하에서 좁은 2열 텍스트 뭉침을 피하도록 안내는 1열, 푸터 링크는 compact 2열로 정리했다.

## 작업 시 주의
- 랭킹 번호와 상품 배지는 서로 다른 컴포넌트에서 그려지므로 충돌이 나면 `ProductCard`보다 `ProductSection` 쪽 배치 우선순위를 먼저 본다.
- 베스트 랭킹만 `rankingItem`을 사용하므로, 다른 섹션 카드 오버레이에는 영향이 없도록 범위를 제한한다.
