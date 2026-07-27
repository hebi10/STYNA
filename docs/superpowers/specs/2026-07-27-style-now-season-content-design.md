# 스타일나우 시즌 콘텐츠 설계

## 배경

메인 페이지 최하단에 봄·여름·가을·겨울 패션을 탐색하는 `스타일나우` 영역을 추가한다. 기존 메인은 Next.js App Router, CSS Modules, TanStack Query, Firebase 상품 데이터와 공용 `ProductCard`를 사용한다. 실제 Firebase 프로젝트 `hebimall`에는 현재 상품 98개가 있으며, `style-now-` 상품 문서와 `images/style-now/` Storage 객체는 없다.

## 목표

- 메인 페이지 최하단에서 네 계절을 탭으로 전환한다.
- 각 계절에 9:27 대표 이미지 1개, 제목, 소개 문구, 상품 20개를 표시한다.
- 상품 카드는 기존 `ProductCard`를 재사용하고 `/products/{productId}` 상세 경로로 연결한다.
- GPT Image 2 기반 생성 이미지 84개를 로컬과 Firebase Storage에 보존한다.
- 기존 상품 스키마와 Storage 규칙을 유지하며 80개 상품을 생성 전용 방식으로 등록한다.
- 모바일, 태블릿, 데스크톱에서 이미지와 상품 목록이 잘리거나 가로로 넘치지 않게 한다.

## 비목표

- 기존 상품, 이미지, 카테고리, 이벤트 데이터를 수정하거나 삭제하지 않는다.
- 새로운 상품 컬렉션이나 별도의 상품 상세 페이지를 만들지 않는다.
- 기존 디자인 시스템, 상품 카드, 메인 페이지의 다른 영역을 재설계하지 않는다.
- Firestore·Storage Rules, Firebase 인덱스, 운영 환경 설정을 변경하거나 배포하지 않는다.
- 커밋, 푸시, 배포를 수행하지 않는다.

## 확인된 기존 구조

### 화면

- 메인 조합 파일은 `src/app/page.tsx`와 `src/app/page.module.css`다.
- 상품 영역은 `ProductSection`과 `ProductCard`를 사용하며 데스크톱 4열, 모바일 2열 패턴을 따른다.
- 이벤트 상세도 공용 `ProductCard`를 재사용한다.
- 기존 UI는 흰 표면, 얇은 보더, 낮은 장식 밀도, 검정 CTA를 사용한다.
- 새 스타일나우 UI에는 `box-shadow`와 `border-radius`를 추가하지 않는다.

### 상품

- 공개 상세 경로는 `/products/{productId}`다.
- 상품 문서 ID가 애플리케이션의 `Product.id`가 되므로 문서 내부 `id` 필드는 필요하지 않다.
- 상품 상세 경로는 문서에 별도 저장하지 않고 기존 규칙대로 문서 ID에서 `/products/{productId}`를 만든다.
- 할인 상품은 기존 가격 계산 규칙에 맞춰 `price`에 실제 판매가, `originalPrice`에 정상가를 저장하고 `saleRate`는 두 가격의 할인율과 일치시킨다.
- 새 상품은 다음 기존 필드를 사용한다.
  - `name`, `description`, `price`, `originalPrice`
  - `brand`, `category`, `categoryId`
  - `images`, `mainImage`
  - `sizes`, `colors`, `stock`
  - `rating`, `reviewCount`, `reviewSummary`
  - `isNew`, `isSale`, `saleRate`
  - `tags`, `status`, `sku`, `schemaVersion`
  - `details.material`, `details.origin`, `details.manufacturer`, `details.precautions`, `details.sizes`
  - `createdAt`, `updatedAt`
- `detailImages`는 현재 상품 생성 흐름의 필수 필드가 아니며 이미지 1개를 상세 본문에서 반복하지 않도록 이번 상품에서는 생략한다.
- 마이그레이션 전용 `legacyPath`와 `migration`은 새 상품에 추가하지 않는다.

### Firebase

- 대상 프로젝트는 `hebimall`, 버킷은 `hebimall.firebasestorage.app`이다.
- 상품 이미지 기존 경로는 `images/{category}/{productId}/{filename}.webp`다.
- `tops` 카테고리는 현재 비활성 상태이므로 의류 상품은 활성 `clothing` 카테고리를 사용한다.
- 새 상품에서 사용할 활성 카테고리는 `clothing`, `bottoms`, `shoes`, `bags`, `accessories`다.

## 선택한 화면 방향

계절 탭형 공통 패널을 사용한다.

- 탭 순서는 봄, 여름, 가을, 겨울로 고정한다.
- 첫 진입에서는 봄을 선택한다.
- 탭은 `role="tablist"`, 각 버튼은 `role="tab"`, 콘텐츠는 `role="tabpanel"` 구조를 사용한다.
- 키보드 방향키로 탭을 이동하고 선택 상태를 `aria-selected`로 전달한다.
- 활성 계절만 상품을 조회해 초기 Firestore 읽기와 메인 페이지 길이를 제한한다.
- 계절을 다시 선택하면 TanStack Query 캐시를 재사용한다.

네 계절을 모두 세로로 쌓는 방식은 상품 80개가 메인 페이지에 동시에 렌더링되어 길이와 초기 읽기 비용이 커지므로 사용하지 않는다. 계절별 별도 페이지 방식은 메인에서 관련 상품을 바로 보여 달라는 요청과 맞지 않아 사용하지 않는다.

## 레이아웃

### 섹션 헤더

- `STYLE NOW` eyebrow, `스타일나우` 제목, 한 줄 안내를 표시한다.
- 기존 메인 섹션과 같은 최대 폭 1200px과 구분선 기준을 사용한다.

### 계절 탭

- 네 탭을 한 줄에 배치하고 활성 탭만 검정 배경과 흰 글자로 구분한다.
- 작은 화면에서도 네 탭을 유지하되 각 탭은 동일 폭으로 줄어든다.
- 탭과 패널에 그림자와 라운드를 사용하지 않는다.

### 계절 패널

- 데스크톱은 대표 이미지 열과 상품 콘텐츠 열의 2열 편집형 레이아웃을 사용한다.
- 대표 이미지는 `aspect-ratio: 1 / 3`, `object-fit: contain`으로 전체를 표시한다.
- 상품 콘텐츠 열에는 계절 제목, 소개, `20개 상품` 표기와 4열 상품 그리드를 둔다.
- 태블릿은 대표 이미지와 콘텐츠를 세로로 전환하고 상품을 2열로 표시한다.
- 모바일 대표 이미지는 전체 폭으로 늘려 과도하게 길어지지 않도록 최대 폭을 제한하고 가운데 배치한다.
- 모바일 상품은 기존 메인 상품 영역과 같은 2열을 유지한다.

## 콘텐츠와 상품 구성

계절별 상품 ID는 다음 규칙을 사용한다.

```text
style-now-spring-01 ... style-now-spring-20
style-now-summer-01 ... style-now-summer-20
style-now-autumn-01 ... style-now-autumn-20
style-now-winter-01 ... style-now-winter-20
```

각 문서는 공통 `style-now` 태그와 계절 태그 하나를 가진다.

```text
style-now-spring
style-now-summer
style-now-autumn
style-now-winter
```

상품 구성은 의류, 하의, 신발, 가방, 액세서리를 계절별로 섞는다. 색상, 소재, 형태, 촬영 구도를 상품마다 다르게 작성하며 계절별 20개 이름·SKU·가격·재고도 중복되지 않게 관리한다.

화면은 정적 계절 설정에 저장한 문서 ID 20개를 원래 순서대로 조회한다. 조회 후 다음 조건을 모두 검증한다.

- 문서가 존재한다.
- `status === "active"`다.
- `tags`에 해당 계절 태그가 있다.
- 계절별 결과가 정확히 20개다.

## 이미지 생성과 파일 관리

### 생성 명령어

- `scripts/style-now-image-manifest.json`에 대표 이미지 4개와 상품 이미지 80개의 최종 프롬프트를 저장한다.
- 각 프롬프트는 사용자 명세의 계절 분위기, 배경, 상품, 색상, 소재, 구도, 조명, 쇼핑몰 사진 스타일, 반복 방지 요소와 텍스트·가격·로고·워터마크 금지를 포함한다.
- 대표 이미지는 `photorealistic-natural`, 상품 이미지는 `product-mockup` 용도로 작성한다.
- 서로 다른 자산은 GPT Image 2 이미지 생성 기능을 각각 한 번씩 호출한다.

### 로컬 파일

```text
public/style-now/spring/style-now-spring-main.webp
public/style-now/spring/style-now-spring-product-01.webp
...
public/style-now/winter/style-now-winter-product-20.webp
```

- 원본 생성 결과는 Sharp로 WebP 변환한다.
- 대표 이미지는 자르지 않고 여백 확장 방식으로 `900×2700`에 맞춘다.
- 상품 이미지는 기존 정사각 상품 카드에 맞춰 `1200×1200` WebP로 정규화한다.
- 84개 파일의 MIME, 크기, 픽셀 규격과 고유 해시를 검증한다.
- 해시 중복이 있으면 해당 이미지만 다시 생성한다.

### Storage 경로

대표 이미지:

```text
images/style-now/{season}/style-now-{season}-main.webp
```

상품 이미지:

```text
images/{category}/{productId}/style-now-{season}-product-{number}.webp
```

모든 객체는 `ifGenerationMatch: 0` 생성 전용 조건으로 업로드한다. 같은 경로가 있으면 중단하며 덮어쓰지 않는다.

## Firebase 등록 절차

전용 동기화 스크립트는 다음 명령 단계를 제공한다.

1. `analyze`
   - 프로젝트·버킷 일치 확인
   - 로컬 84개 파일, 상품 80개, 계절별 20개 확인
   - Firestore 문서 ID와 Storage 경로 충돌 확인
2. `upload`
   - Storage 객체 84개 생성 전용 업로드
3. `verify-upload`
   - 객체 수, MIME, 크기, 해시와 대표 이미지 규격 확인
4. `apply-draft`
   - Firestore batch `create`로 상품 80개를 `draft` 상태로 생성
5. `verify-draft`
   - 문서 수, 필드, 이미지 URL, 계절 태그, `draft` 상태 확인
6. `activate`
   - 검증된 80개 문서만 batch update로 `active` 전환
7. `verify`
   - 총 80개와 계절별 활성 상품 20개, Storage URL 응답을 확인

업로드 후 실패하더라도 기존 객체나 문서를 삭제하지 않는다. 재실행 시 이미 완료된 단계와 충돌을 보고하고 안전하게 중단한다. 이 기능에서는 삭제·롤백 명령을 제공하지 않는다.

## 컴포넌트와 파일 경계

- `src/app/_components/style-now/styleNowData.ts`
  - 계절 제목, 설명, 대표 이미지 URL, 상품 ID, 태그를 관리한다.
- `src/app/_components/style-now/StyleNowSection.tsx`
  - 탭 상태, 키보드 조작, 계절별 상품 조회와 렌더링을 담당한다.
- `src/app/_components/style-now/StyleNowSection.module.css`
  - 섹션, 탭, 9:27 이미지, 반응형 상품 그리드를 담당한다.
- `src/app/page.tsx`
  - 서비스 안내 다음 메인 최하단에 `StyleNowSection`을 배치한다.
- `src/shared/services/productService.ts`
  - 입력 ID 순서를 보존하는 공개 상품 묶음 조회 함수를 제공한다.
- `scripts/style-now-image-manifest.json`
  - 이미지 프롬프트와 상품 메타데이터의 단일 소스다.
- `scripts/style-now-assets.js`
  - 로컬 이미지 규격·해시 검증과 WebP 정규화를 담당한다.
- `scripts/style-now-firebase-sync.js`
  - 생성 전용 Storage 업로드와 단계별 Firestore 등록·검증을 담당한다.

## 오류와 불완전 상태

- 상품 조회 중에는 계절 패널 안에 로딩 상태를 표시한다.
- 조회 실패는 섹션 내부 `role="alert"`와 다시 시도 버튼으로 격리한다.
- 문서가 없거나 비활성·잘못된 태그로 20개를 채우지 못하면 정상 목록처럼 숨기지 않고 기대 수량과 실제 수량을 알린다.
- 대표 이미지 로드 실패는 계절 제목이 포함된 대체 텍스트로 접근 가능하게 유지한다.
- 한 계절의 오류가 메인 페이지의 다른 섹션을 중단시키지 않는다.

## 테스트와 검증

### 정적·단위 검증

- 매니페스트 자산 84개, 상품 80개, 계절별 20개, ID·SKU·경로·프롬프트 고유성
- 상품 필수 필드와 기존 타입 일치
- 공개 상품 묶음 조회의 입력 순서, 누락·비활성 처리
- 탭 접근성, 계절 전환, 로딩·오류·수량 부족 상태
- 기존 `ProductCard`와 `/products/{id}` 링크 사용
- 메인 페이지 최하단 배치
- CSS의 9:27 비율과 데스크톱 4열·모바일 2열

### Firebase 검증

- Storage 84개와 Firestore 80개
- 계절별 활성 상품 20개
- 모든 이미지 URL 응답
- 문서 이미지 URL과 실제 Storage 객체 일치
- 생성 전용 충돌 방지

### 프로젝트 검증

```bash
npm run typecheck
npm run lint -- --max-warnings=0
npm test
npm run test:rules
npm run functions:build
npm run build
```

### 브라우저 검증

- 데스크톱 1440×1000, 태블릿 768×1024, 모바일 390×844
- 네 계절 탭, 계절별 상품 20개, 대표 이미지 전체 노출
- 상품 상세 링크 이동과 새로고침
- 가로 오버플로우, 이미지 깨짐, 콘솔·네트워크 오류
- 기존 메인 섹션과 헤더·푸터 회귀 여부

## 완료 기준

- 로컬과 Storage에 고유 이미지 84개가 존재한다.
- Firestore에 신규 활성 상품이 정확히 80개 존재하고 계절별 20개로 구분된다.
- 메인 최하단 스타일나우에서 네 계절을 전환하며 각 계절 상품 20개를 확인할 수 있다.
- 모든 상품 카드가 기존 상세 페이지로 이동한다.
- 대표 이미지가 9:27로 표시되고 세 화면 크기에서 깨지거나 과도하게 잘리지 않는다.
- 관련 테스트와 프로젝트 품질 게이트, 브라우저 및 Firebase 검증이 통과한다.
- 기존 데이터와 파일은 삭제·덮어쓰기 되지 않고 커밋·푸시·배포도 수행되지 않는다.
