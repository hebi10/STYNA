# Style Now Season Content Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 메인 페이지 최하단에 계절 탭형 스타일나우를 추가하고, GPT Image 2 이미지 84개와 기존 스키마 상품 80개를 Firebase에 생성 전용 방식으로 등록한다.

**Architecture:** 이미지·상품 메타데이터는 하나의 JSON 매니페스트에서 관리하고, 공개 화면은 결정적 상품 ID 20개를 기존 상품 서비스로 조회해 공용 `ProductCard`에 전달한다. Firebase 동기화는 `analyze → upload → verify-upload → apply-draft → verify-draft → activate → verify` 단계로 분리해 기존 객체·문서 덮어쓰기를 차단한다.

**Tech Stack:** Next.js 15, React 19, TypeScript, CSS Modules, TanStack Query, Jest, Firebase Firestore/Storage, Firebase Admin SDK, Sharp, GPT Image 2.

## Global Constraints

- 모든 응답과 UI 문구는 한국어로 작성한다.
- 기존 사용자의 미완료 변경을 되돌리거나 덮어쓰지 않는다.
- 요청과 무관한 파일은 수정하지 않는다.
- 신규 UI에는 `box-shadow`와 `border-radius`를 추가하지 않는다.
- SVG, CSS 도형, 외부 URL, 복사 이미지로 생성 이미지를 대체하지 않는다.
- Firebase 기존 데이터와 객체는 삭제하거나 덮어쓰지 않는다.
- 커밋, 푸시, 배포를 수행하지 않는다.
- 상품은 기존 `products` 스키마와 `/products/{productId}` 상세 경로를 사용한다.
- 이미지 파일명은 영문 소문자와 하이픈만 사용한다.

---

### Task 1: 스타일나우 매니페스트 계약

**Files:**
- Create: `scripts/style-now-image-manifest.json`
- Create: `scripts/style-now-manifest.js`
- Test: `scripts/style-now-manifest.test.js`
- Modify: `package.json`

**Interfaces:**
- Produces: `loadStyleNowManifest()`와 `validateStyleNowManifest()`가 4개 시즌, 84개 자산, 80개 상품의 구조와 고유성을 검증한다.
- Produces: 결정적 ID `style-now-{season}-{01..20}`, 계절 태그, SKU, 로컬·Storage 경로, 이미지 프롬프트, 기존 상품 필드를 제공한다.

- [x] **Step 1: 실패 테스트 작성**

```js
expect(summary.seasons).toBe(4);
expect(summary.heroAssets).toBe(4);
expect(summary.productAssets).toBe(80);
expect(summary.productsBySeason).toEqual({
  spring: 20,
  summer: 20,
  autumn: 20,
  winter: 20,
});
expect(summary.uniqueProductIds).toBe(80);
expect(summary.uniqueSkus).toBe(80);
expect(summary.uniqueStoragePaths).toBe(84);
expect(summary.uniquePrompts).toBe(84);
```

- [x] **Step 2: 실패 확인**

Run: `npm test -- scripts/style-now-manifest.test.js`

Expected: `style-now-manifest.js` 또는 매니페스트가 없어 FAIL.

- [x] **Step 3: 계절·상품 목록과 필수 메타데이터 작성**

계절별 정확한 상품명은 다음 순서를 사용한다.

```text
봄: 라이트 트렌치 재킷, 파스텔 코튼 가디건, 스트라이프 옥스퍼드 셔츠, 아이보리 새틴 블라우스, 민트 리브 니트, 라이트 워시 와이드 데님, 플리츠 미디 스커트, 플로럴 랩 원피스, 캔버스 로우 스니커즈, 스웨이드 미니 숄더백, 크롭 필드 재킷, 세이지 린넨 셔츠, 라벤더 니트 베스트, 크림 테이퍼드 팬츠, 데님 셔츠 원피스, 메리제인 플랫, 나일론 드로스트링 백, 실크 스카프, 코튼 볼캡, 라이트 레더 벨트
여름: 쿨링 코튼 티셔츠, 립 민소매 톱, 화이트 린넨 셔츠, 나일론 버뮤다 쇼츠, 코튼 밴딩 쇼츠, 리넨 슬립 원피스, 시어서커 셔츠 원피스, 스트랩 레더 샌들, 메쉬 슬라이드, 와이드 브림 버킷햇, 틴트 선글라스, 라탄 토트백, 비치 셔츠 셋업, 홀터넥 스윔웨어, 크로셰 카디건, 테리 폴로 셔츠, 아이스 데님 팬츠, 라이트 크로스백, 실버 체인 네크리스, 패커블 윈드브레이커
가을: 클래식 트렌치코트, 빈티지 레더 재킷, 헤링본 울 재킷, 카멜 케이블 니트, 브릭 모크넥 니트, 체크 플란넬 셔츠, 옥스퍼드 레이어드 셔츠, 차콜 와이드 슬랙스, 인디고 스트레이트 데님, 브라운 플리츠 롱스커트, 페니 로퍼, 스웨이드 앵클부츠, 버건디 숄더백, 캔버스 헬멧백, 퀼팅 베스트, 코듀로이 팬츠, 니트 폴로, 울 베레, 레더 글러브, 체크 울 머플러
겨울: 롱 구스다운 패딩, 숏 푸퍼 재킷, 더블 울 코트, 캐시미어 블렌드 코트, 헤비 케이블 니트, 노르딕 울 니트, 메리노 터틀넥, 기모 와이드 팬츠, 브러시드 데님, 벨벳 겨울 원피스, 퍼 라이닝 부츠, 레더 첼시부츠, 캐시미어 머플러, 퀼팅 장갑, 울 비니, 패딩 토트백, 퍼 미니백, 보아 플리스 집업, 울 니트 스커트, 써멀 레이어 톱
```

각 상품은 기존 필드와 다음 계약을 만족한다.

```js
{
  id, name, description, price, originalPrice, brand,
  category, categoryId, images: [], mainImage: "",
  sizes, colors, stock, rating: 0, reviewCount: 0,
  isNew, isSale, saleRate, tags, status: "draft", sku,
  schemaVersion: 2,
  details: { material, origin, manufacturer, precautions, sizes }
}
```

- [x] **Step 4: 84개 최종 이미지 프롬프트 작성**

대표 이미지는 계절 분위기·장소·모델/제품 배치·주요 색상·조명·1:3 구도·패션 화보·무문자를 명시한다. 상품 이미지는 상품 종류·색상·소재·형태·촬영 각도·배경·조명·카탈로그 사진·고유 특징·무문자를 각각 명시한다.

- [x] **Step 5: 검증기와 package 스크립트 구현**

```json
{
  "style-now:manifest:validate": "node scripts/style-now-manifest.js validate"
}
```

- [x] **Step 6: 테스트와 UTF-8 문구 검증**

Run: `npm test -- scripts/style-now-manifest.test.js`

Run: `npm run style-now:manifest:validate`

Expected: 4 seasons, 84 assets, 80 products, season counts 20/20/20/20.

---

### Task 2: 이미지 정규화·검증 도구

**Files:**
- Create: `scripts/style-now-assets.js`
- Test: `scripts/style-now-assets.test.js`
- Modify: `package.json`
- Create: `public/style-now/{season}/*.webp`

**Interfaces:**
- Consumes: `loadStyleNowManifest()`.
- Produces: `normalize`은 생성 원본을 WebP로 변환하고, `validate`는 84개 파일의 경로·MIME·규격·고유 SHA-256을 확인한다.

- [x] **Step 1: 실패 테스트 작성**

대표 이미지는 `900×2700`, 상품 이미지는 `1200×1200`, MIME은 WebP, 해시는 84개 모두 고유해야 한다.

- [x] **Step 2: 실패 확인**

Run: `npm test -- scripts/style-now-assets.test.js`

- [x] **Step 3: Sharp 정규화 구현**

대표 이미지는 `fit: "contain"`과 계절 팔레트 배경 확장을 사용해 자르지 않는다. 상품 이미지는 `fit: "cover"`를 사용하되 생성 프롬프트에서 상품 주변 안전 여백을 확보한다.

- [x] **Step 4: package 스크립트 추가**

```json
{
  "style-now:assets:normalize": "node scripts/style-now-assets.js normalize",
  "style-now:assets:validate": "node scripts/style-now-assets.js validate"
}
```

- [x] **Step 5: 테스트 통과 확인**

Run: `npm test -- scripts/style-now-assets.test.js`

Expected: 도구 단위 테스트 PASS. 실제 자산 검증은 생성 완료 전까지 안전하게 FAIL.

---

### Task 3: 공개 상품 묶음 조회

**Files:**
- Modify: `src/shared/services/productService.ts`
- Test: `src/shared/services/productService.test.ts`

**Interfaces:**
- Produces: `ProductService.getPublicProductsByIds(productIds: string[]): Promise<Product[]>`.
- Contract: 중복 제거, 입력 순서 보존, 존재하지 않거나 비활성인 상품 제외, 서비스 오류 전파.

- [x] **Step 1: 실패 테스트 작성**

```ts
const products = await ProductService.getPublicProductsByIds(['b', 'missing', 'a']);
expect(products.map(product => product.id)).toEqual(['b', 'a']);
```

- [x] **Step 2: 실패 확인**

Run: `npm test -- src/shared/services/productService.test.ts`

- [x] **Step 3: 최소 구현**

기존 `getPublicProductById()`를 병렬 호출하고 ID별 결과 맵을 만든 뒤 입력 순서로 복원한다.

- [x] **Step 4: 통과 확인**

Run: `npm test -- src/shared/services/productService.test.ts`

---

### Task 4: 스타일나우 설정과 계절 탭 UI

**Files:**
- Create: `src/app/_components/style-now/styleNowData.ts`
- Create: `src/app/_components/style-now/styleNowData.test.ts`
- Create: `src/app/_components/style-now/StyleNowSection.tsx`
- Create: `src/app/_components/style-now/StyleNowSection.test.tsx`
- Create: `src/app/_components/style-now/StyleNowSection.module.css`

**Interfaces:**
- Produces: `STYLE_NOW_SEASONS`, `getStyleNowProductIds(season)`, `getStyleNowStorageUrl(path)`.
- Produces: 접근 가능한 `StyleNowSection` 클라이언트 컴포넌트.
- Consumes: `ProductService.getPublicProductsByIds()`와 기존 `ProductCard`.

- [x] **Step 1: 설정 실패 테스트 작성**

```ts
expect(STYLE_NOW_SEASONS).toHaveLength(4);
expect(getStyleNowProductIds('spring')).toHaveLength(20);
expect(new Set(STYLE_NOW_SEASONS.flatMap(item => item.productIds))).toHaveProperty('size', 80);
```

- [x] **Step 2: 컴포넌트 실패 테스트 작성**

테스트는 다음을 검증한다.

- `스타일나우` 제목과 탭 4개
- 초기 봄 탭의 `aria-selected="true"`
- 계절 변경 시 해당 20개 ID 조회
- 기존 `ProductCard`에 ID·이미지·가격 전달
- 로딩, 오류, 20개 미만 상태
- 방향키 탭 이동

- [x] **Step 3: 실패 확인**

Run: `npm test -- src/app/_components/style-now/styleNowData.test.ts src/app/_components/style-now/StyleNowSection.test.tsx`

- [x] **Step 4: 설정과 UI 구현**

`useQuery` 키는 `['products', 'style-now', season]`을 사용한다. 결과는 해당 계절 태그와 활성 상태를 다시 검사하고 정확히 20개가 아닐 때 오류 상태로 표시한다.

- [x] **Step 5: CSS 구현**

```css
.heroImage {
  aspect-ratio: 1 / 3;
  object-fit: contain;
}

.productGrid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

@media (max-width: 900px) {
  .productGrid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
```

새 스타일에 `box-shadow`와 `border-radius`를 작성하지 않는다.

- [x] **Step 6: 통과 확인**

Run: `npm test -- src/app/_components/style-now/styleNowData.test.ts src/app/_components/style-now/StyleNowSection.test.tsx`

---

### Task 5: 메인 최하단 통합

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/page.test.tsx`

**Interfaces:**
- Consumes: `StyleNowSection`.
- Produces: 기존 `serviceInfo` 다음, 메인 컨테이너의 마지막 콘텐츠로 스타일나우를 렌더링한다.

- [x] **Step 1: 실패 테스트 작성**

```ts
expect(markup).toContain('mock style now');
expect(markup.lastIndexOf('mock style now')).toBeGreaterThan(markup.lastIndexOf('PORTFOLIO'));
```

- [x] **Step 2: 실패 확인**

Run: `npm test -- src/app/page.test.tsx`

- [x] **Step 3: 최소 통합**

`StyleNowSection`을 import하고 기존 `serviceInfo` 바로 뒤에 배치한다.

- [x] **Step 4: 통과 확인**

Run: `npm test -- src/app/page.test.tsx`

---

### Task 6: Firebase 생성 전용 동기화

**Files:**
- Create: `scripts/style-now-firebase-sync.js`
- Test: `scripts/style-now-firebase-sync.test.js`
- Modify: `package.json`

**Interfaces:**
- Consumes: 매니페스트와 검증된 84개 WebP.
- Produces: `analyze`, `upload`, `verify-upload`, `apply-draft`, `verify-draft`, `activate`, `verify`.

- [x] **Step 1: 실패 테스트 작성**

테스트는 다음 계약을 고정한다.

- 프로젝트와 버킷 불일치 시 초기화 거부
- Storage upload `preconditionOpts.ifGenerationMatch === 0`
- 기존 문서·객체 발견 시 쓰기 전 실패
- Firestore `batch.create()`로 80개 draft 생성
- 검증되지 않은 draft는 활성화하지 않음
- 활성화 batch는 정확한 80개 ID만 update
- 삭제 API와 rollback 명령 없음

- [x] **Step 2: 실패 확인**

Run: `npm test -- scripts/style-now-firebase-sync.test.js`

- [x] **Step 3: 단계별 구현**

다운로드 URL은 다음 형식을 사용한다.

```js
`https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(storagePath)}?alt=media`
```

Firestore 문서는 `createdAt`과 `updatedAt`을 서버 Timestamp로 기록하며 `rating`, `reviewCount`, `reviewSummary`는 0으로 초기화한다.

- [x] **Step 4: package 스크립트 추가**

```json
{
  "style-now:firebase:analyze": "node scripts/style-now-firebase-sync.js analyze",
  "style-now:firebase:upload": "node scripts/style-now-firebase-sync.js upload",
  "style-now:firebase:verify-upload": "node scripts/style-now-firebase-sync.js verify-upload",
  "style-now:firebase:apply-draft": "node scripts/style-now-firebase-sync.js apply-draft",
  "style-now:firebase:verify-draft": "node scripts/style-now-firebase-sync.js verify-draft",
  "style-now:firebase:activate": "node scripts/style-now-firebase-sync.js activate",
  "style-now:firebase:verify": "node scripts/style-now-firebase-sync.js verify"
}
```

- [x] **Step 5: 테스트 통과 확인**

Run: `npm test -- scripts/style-now-firebase-sync.test.js`

---

### Task 7: GPT Image 2 자산 84개 생성

**Files:**
- Create: `public/style-now/spring/*.webp`
- Create: `public/style-now/summer/*.webp`
- Create: `public/style-now/autumn/*.webp`
- Create: `public/style-now/winter/*.webp`

**Interfaces:**
- Consumes: 매니페스트의 84개 프롬프트.
- Produces: 대표 이미지 4개와 상품 이미지 80개.

- [x] **Step 1: 대표 이미지 4개 생성**

GPT Image 2 기반 이미지 생성 기능을 자산별로 호출한다. 각 결과를 로컬 계절 폴더에 복사하고 `normalize`로 900×2700 WebP를 만든다.

- [x] **Step 2: 봄 상품 이미지 20개 생성**

- [x] **Step 3: 여름 상품 이미지 20개 생성**

- [x] **Step 4: 가을 상품 이미지 20개 생성**

- [x] **Step 5: 겨울 상품 이미지 20개 생성**

- [x] **Step 6: 실제 자산 검증**

Run: `npm run style-now:assets:validate`

Expected: 84/84, 대표 4개 900×2700, 상품 80개 1200×1200, SHA-256 중복 0.

---

### Task 8: Firebase Storage·Firestore 등록

**Files:**
- External: Firebase Storage `hebimall.firebasestorage.app`
- External: Firestore `products`

**Interfaces:**
- Consumes: 검증된 자산과 상품 80개.
- Produces: Storage 84개, Firestore 활성 상품 80개.

- [x] **Step 1: 충돌 분석**

Run: `npm run style-now:firebase:analyze`

Expected: product conflicts 0, storage conflicts 0, local assets 84.

- [x] **Step 2: Storage 업로드와 검증**

Run: `npm run style-now:firebase:upload`

Run: `npm run style-now:firebase:verify-upload`

Expected: 84/84.

- [x] **Step 3: draft 등록과 검증**

Run: `npm run style-now:firebase:apply-draft`

Run: `npm run style-now:firebase:verify-draft`

Expected: draft 80, season counts 20/20/20/20.

- [x] **Step 4: 활성화와 최종 검증**

Run: `npm run style-now:firebase:activate`

Run: `npm run style-now:firebase:verify`

Expected: active 80, season counts 20/20/20/20, image responses 84/84.

---

### Task 9: 통합 품질·브라우저 검증

**Files:**
- Modify: `docs/README.md`
- Modify: `docs/superpowers/specs/2026-07-27-style-now-season-content-design.md` only if implemented behavior differs
- Modify: this plan to mark completed checkboxes

**Interfaces:**
- Produces: 코드, Firebase, 화면을 모두 포함한 완료 증거.

- [x] **Step 1: 관련 테스트**

Run:

```bash
npm test -- scripts/style-now-manifest.test.js scripts/style-now-assets.test.js scripts/style-now-firebase-sync.test.js src/shared/services/productService.test.ts src/app/_components/style-now/styleNowData.test.ts src/app/_components/style-now/StyleNowSection.test.tsx src/app/page.test.tsx
```

- [x] **Step 2: 전체 품질 게이트**

Run:

```bash
npm run typecheck
npm run lint -- --max-warnings=0
npm test
npm run test:rules
npm run functions:build
npm run build
```

- [x] **Step 3: 브라우저 1차 검증**

1440×1000, 768×1024, 390×844에서 메인 최하단과 네 계절 탭을 확인한다. 계절별 20개, 대표 이미지 전체 노출, 상품 상세 이동·새로고침, 가로 오버플로우, 콘솔·네트워크 오류를 한 번에 수집한다.

- [x] **Step 4: 발견 사항 일괄 수정**

UI 파일 편집 직전에 Impeccable `craft-floor.md`를 읽고, 1차 검증에서 확인한 관련 문제만 한 번에 수정한다.

- [x] **Step 5: 최종 브라우저 확인과 detector**

데스크톱·모바일 최종 캡처를 한 번 더 확인하고 다음 detector를 한 번만 실행한다.

```bash
node C:\Users\박도영\.agents\skills\impeccable\scripts\detect.mjs --json src/app/_components/style-now/StyleNowSection.tsx src/app/_components/style-now/StyleNowSection.module.css src/app/page.tsx
```

- [x] **Step 6: 최종 상태 확인**

Run: `git diff --check`

Run: `git status --short`

기존 변경과 이번 변경을 구분해 보고하고, 커밋·푸시·배포가 없음을 확인한다.
