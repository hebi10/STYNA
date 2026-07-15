# 이벤트 상세 커머스 템플릿 리뉴얼 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Firestore 이벤트 22개 상세 화면을 캠페인 이미지, 핵심 행동, 관련 상품, 압축된 안내 순서의 실제 패션몰형 공통 템플릿으로 교체한다.

**Architecture:** `EventDetailClient`는 기존 인증·참여·라우팅 상태를 유지하고, 화면 블록은 상세 경로의 작은 컴포넌트로 분리한다. 상품 선택은 순수한 우선순위 helper와 비동기 쇼케이스 컴포넌트가 담당하며, 기존 `ProductService`와 `ProductCard`를 재사용한다.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, CSS Modules, Firebase/Firestore, Jest, Testing Library

## Global Constraints

- Firestore 이벤트 22개와 기존 참여·쿠폰·로그인·HTML 정화 동작을 보존한다.
- 이벤트 이미지 44개와 Storage 경로는 변경하지 않는다.
- 새 그림자, 그라데이션, 큰 라운드를 추가하지 않는다.
- 데스크톱은 와이드 이미지, 640px 이하는 카드 이미지를 사용한다.
- 상품은 최대 8개만 노출하고 기존 `ProductCard`를 재사용한다.
- 사용자 승인 없이 커밋, 푸시, 배포하지 않는다. 따라서 아래 태스크에는 커밋 단계가 없다.
- 테스트를 먼저 실패시키고 최소 구현으로 통과시키는 TDD 순서를 지킨다.

---

### Task 1: 이벤트 관련 상품 선택 helper

**Files:**
- Create: `src/app/events/[eventId]/eventProductSelection.ts`
- Create: `src/app/events/[eventId]/eventProductSelection.test.ts`

**Interfaces:**
- Consumes: `Event`, `EventUiVariant`, `Product`, `ProductService`
- Produces:
  - `getEventProductSectionMeta(variant: EventUiVariant): EventProductSectionMeta`
  - `loadEventProducts(options: LoadEventProductsOptions): Promise<Product[]>`

- [ ] **Step 1: 상품 섹션 메타데이터와 loader 계약 테스트 작성**

```ts
test.each([
  ['sale', '지금 할인 중인 상품', '/main/sale'],
  ['coupon', '쿠폰과 함께 보기 좋은 상품', '/recommend'],
  ['review', '리뷰가 많은 상품', '/reviews'],
  ['new', '새로 들어온 상품', '/recommend?filter=new'],
  ['special', '함께 보면 좋은 상품', '/recommend'],
])('returns product section metadata for %s', (variant, title, href) => {
  expect(getEventProductSectionMeta(variant as EventUiVariant)).toMatchObject({ title, href });
});
```

- [ ] **Step 2: 명시 상품 → 카테고리 → 타입 fallback 우선순위 테스트 작성**

```ts
test('keeps explicit product order, removes inactive products, and fills to eight', async () => {
  const service = createProductLoader({
    byId: [activeProduct('p2'), inactiveProduct('p1')],
    fallback: [activeProduct('p3'), activeProduct('p2')],
  });

  const products = await loadEventProducts({
    event: createEvent({ targetProducts: ['p2', 'p1'] }),
    variant: 'sale',
    service,
  });

  expect(products.map(product => product.id)).toEqual(['p2', 'p3']);
  expect(service.getSaleProducts).toHaveBeenCalledWith(8);
});

test('deduplicates category products before using the variant fallback', async () => {
  const service = createProductLoader({
    categories: {
      tops: [activeProduct('p1'), activeProduct('p2')],
      outer: [activeProduct('p2'), activeProduct('p3')],
    },
    fallback: [activeProduct('p4')],
  });

  const products = await loadEventProducts({
    event: createEvent({ targetCategories: ['tops', 'outer'] }),
    variant: 'new',
    service,
  });

  expect(products.map(product => product.id)).toEqual(['p1', 'p2', 'p3', 'p4']);
});
```

- [ ] **Step 3: helper 테스트를 실행해 실패 확인**

Run: `npm test -- --runInBand src/app/events/[eventId]/eventProductSelection.test.ts`

Expected: FAIL — `eventProductSelection` 모듈 또는 export가 없음.

- [ ] **Step 4: 상품 선택 helper 최소 구현**

```ts
export interface EventProductSectionMeta {
  title: string;
  description: string;
  href: string;
  linkLabel: string;
}

export interface EventProductLoader {
  getProductById(id: string): Promise<Product | null>;
  getProductsByCategory(category: string, limit?: number): Promise<Product[]>;
  getSaleProducts(limit?: number): Promise<Product[]>;
  getRecommendedProducts(limit?: number): Promise<Product[]>;
  getReviewPopularProducts(limit?: number): Promise<Product[]>;
  getNewProducts(limit?: number): Promise<Product[]>;
}

export interface LoadEventProductsOptions {
  event: Event;
  variant: EventUiVariant;
  limit?: number;
  service?: EventProductLoader;
}

const isActive = (product: Product | null): product is Product =>
  Boolean(product && product.status === 'active');

const appendUnique = (target: Product[], products: Product[], limit: number) => {
  const ids = new Set(target.map(product => product.id));
  for (const product of products) {
    if (target.length >= limit) break;
    if (product.status !== 'active' || ids.has(product.id)) continue;
    ids.add(product.id);
    target.push(product);
  }
};
```

구현은 `Promise.allSettled()`로 명시 상품을 병렬 조회하고 원래 ID 배열 순서대로 결과를 복원한다. `targetCategories`에서 `전체`와 빈 문자열을 제거한 뒤 각 카테고리를 최대 8개씩 조회한다. 마지막으로 변형별 `ProductService` 메서드 결과를 `appendUnique()`로 채우고 `slice(0, limit)`을 반환한다.

- [ ] **Step 5: helper 테스트 통과 확인**

Run: `npm test -- --runInBand src/app/events/[eventId]/eventProductSelection.test.ts`

Expected: PASS.

---

### Task 2: 캠페인 히어로와 행동 바

**Files:**
- Create: `src/app/events/[eventId]/_components/EventCommerceHero.tsx`
- Create: `src/app/events/[eventId]/_components/EventActionBar.tsx`
- Create: `src/app/events/[eventId]/_components/EventMobileStickyAction.tsx`
- Create: `src/app/events/[eventId]/_components/EventCommerceBlocks.module.css`
- Create: `src/app/events/[eventId]/_components/EventCommerceBlocks.test.tsx`

**Interfaces:**
- Consumes: 기존 `EventResponsiveImage`, `Event`, 상태 문자열, 계산된 혜택·범위·기간, CTA label/callback/disabled
- Produces: 상단 캠페인 이미지, 의미론적 제목 요약, 데스크톱 행동 바, 모바일 고정 CTA

- [ ] **Step 1: 중복 없는 히어로와 조건부 참여자 테스트 작성**

```tsx
test('renders campaign image first without promotional text overlay', () => {
  const { container } = render(
    <EventCommerceHero
      event={createEvent({ hasMaxParticipants: false, participantCount: 0 })}
      desktopImage="/wide.webp"
      mobileImage="/card.webp"
      statusLabel="진행중"
      periodLabel="2026. 8. 15. - 2026. 8. 31."
    />
  );

  expect(container.querySelector('picture')).not.toBeNull();
  expect(container.querySelector('[data-promotional-overlay]')).toBeNull();
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('라스트 썸머 클리어런스');
  expect(screen.queryByText(/0명/)).toBeNull();
  expect(screen.queryByText(/제한 없음/)).toBeNull();
});

test('shows capacity only for a limited event', () => {
  renderHero(createEvent({ hasMaxParticipants: true, maxParticipants: 500, participantCount: 120 }));
  expect(screen.getByText('120 / 500명')).toBeInTheDocument();
});
```

- [ ] **Step 2: 행동 바와 모바일 CTA 상태 공유 테스트 작성**

```tsx
test('uses the same label and disabled state for desktop and mobile actions', () => {
  const onAction = jest.fn();
  render(
    <>
      <EventActionBar items={summaryItems} label="쿠폰 받기" disabled onAction={onAction} />
      <EventMobileStickyAction statusLabel="진행중" label="쿠폰 받기" disabled onAction={onAction} />
    </>
  );

  expect(screen.getAllByRole('button', { name: '쿠폰 받기' })).toHaveLength(2);
  screen.getAllByRole('button', { name: '쿠폰 받기' }).forEach(button => {
    expect(button).toBeDisabled();
  });
});
```

- [ ] **Step 3: 블록 테스트를 실행해 실패 확인**

Run: `npm test -- --runInBand src/app/events/[eventId]/_components/EventCommerceBlocks.test.tsx`

Expected: FAIL — 세 컴포넌트가 없음.

- [ ] **Step 4: 히어로·행동 컴포넌트 구현**

`EventCommerceHero`는 `<section>` 안에서 `EventResponsiveImage`를 가장 먼저 렌더링하고, 그 뒤에 status badge, `<h1>`, description, period, 선택적 capacity만 렌더링한다. `EventActionBar`는 정확히 세 개 이하의 요약 item과 버튼 하나를 렌더링한다. `EventMobileStickyAction`은 같은 버튼 props를 사용하고 `aria-label="이벤트 핵심 행동"`을 가진다.

CSS는 보더와 2px 타입 accent만 사용한다. `border-radius`, `box-shadow`, `filter: drop-shadow`, gradient 선언을 새로 만들지 않는다.

- [ ] **Step 5: 블록 테스트 통과 확인**

Run: `npm test -- --runInBand src/app/events/[eventId]/_components/EventCommerceBlocks.test.tsx`

Expected: PASS.

---

### Task 3: 상품 쇼케이스와 압축 정보 영역

**Files:**
- Create: `src/app/events/[eventId]/_components/EventProductShowcase.tsx`
- Create: `src/app/events/[eventId]/_components/EventProductShowcase.module.css`
- Create: `src/app/events/[eventId]/_components/EventProductShowcase.test.tsx`
- Create: `src/app/events/[eventId]/_components/EventInformationSections.tsx`
- Create: `src/app/events/[eventId]/_components/EventInformationSections.test.tsx`

**Interfaces:**
- Consumes: Task 1의 `loadEventProducts`, `getEventProductSectionMeta`, 기존 `ProductCard`, 정화된 HTML, 혜택·방법·유의사항 배열
- Produces: 최대 8개 상품 그리드와 세 개 상세 정보 영역

- [ ] **Step 1: 상품 로딩·오류·빈 상태 테스트 작성**

```tsx
test('renders at most eight products with the shared ProductCard', async () => {
  mockedLoadEventProducts.mockResolvedValue(products(10));
  render(<EventProductShowcase event={event} variant="sale" />);
  expect(await screen.findAllByTestId('event-product-card')).toHaveLength(8);
});

test('isolates product errors and retries without failing the event page', async () => {
  mockedLoadEventProducts
    .mockRejectedValueOnce(new Error('load failed'))
    .mockResolvedValueOnce([product('p1')]);
  render(<EventProductShowcase event={event} variant="sale" />);
  await userEvent.click(await screen.findByRole('button', { name: '상품 다시 불러오기' }));
  expect(await screen.findByTestId('event-product-card')).toBeInTheDocument();
});
```

- [ ] **Step 2: 정보 영역 중복 제거와 모바일 toggle 테스트 작성**

```tsx
test('renders exactly three information sections and keeps only the first open initially', () => {
  render(
    <EventInformationSections
      contentHtml="<p>이벤트 소개</p>"
      benefitItems={['최대 70% 할인']}
      participationSteps={['대상 상품을 확인합니다.']}
      noticeItems={['재고에 따라 종료될 수 있습니다.']}
    />
  );

  expect(screen.getAllByRole('button', { expanded: true })).toHaveLength(1);
  expect(screen.getAllByRole('button')).toHaveLength(3);
  expect(screen.getByText('이벤트 소개')).toBeInTheDocument();
});
```

- [ ] **Step 3: 두 테스트 파일을 실행해 실패 확인**

Run: `npm test -- --runInBand src/app/events/[eventId]/_components/EventProductShowcase.test.tsx src/app/events/[eventId]/_components/EventInformationSections.test.tsx`

Expected: FAIL — 컴포넌트가 없음.

- [ ] **Step 4: 상품 쇼케이스 구현**

`EventProductShowcase`는 `useCallback(load)`과 `useEffect`로 상품을 불러온다. unmount 후 state 갱신을 막는 `cancelled` flag를 사용한다. 성공 시 8개로 자르고 `ProductCard`에 `id`, `name`, `brand`, `price`, `originalPrice`, `mainImage || images[0]`, `isNew`, `isSale`, `saleRate`, `rating`, `reviewCount`, `stock`을 전달한다. 오류 시 재시도 버튼과 메타의 `href` 링크를, 빈 상태 시 링크만 렌더링한다.

- [ ] **Step 5: 정보 영역 구현**

세 버튼은 각각 `aria-expanded`, `aria-controls`를 가진다. 데스크톱에서는 CSS로 내용이 항상 보이고, 640px 이하에서는 React open state에 따라 숨긴다. 첫 영역은 기본 `true`, 나머지는 `false`다. 정화된 HTML 문자열만 `dangerouslySetInnerHTML`에 전달하고 컴포넌트 내부에서 원본 HTML을 다시 처리하지 않는다.

- [ ] **Step 6: 두 테스트 파일 통과 확인**

Run: `npm test -- --runInBand src/app/events/[eventId]/_components/EventProductShowcase.test.tsx src/app/events/[eventId]/_components/EventInformationSections.test.tsx`

Expected: PASS.

---

### Task 4: EventDetailClient 공통 템플릿 통합

**Files:**
- Modify: `src/app/events/[eventId]/EventDetailClient.tsx`
- Replace focused styles in: `src/app/events/[eventId]/EventDetailClient.module.css`
- Create: `src/app/events/[eventId]/EventDetailClient.test.tsx`

**Interfaces:**
- Consumes: Tasks 1–3의 컴포넌트와 상품 section metadata
- Produces: 이벤트 22개가 공유하는 최종 커머스형 상세 템플릿

- [ ] **Step 1: 세일·쿠폰·리뷰·신상품·특별 통합 렌더링 테스트 작성**

```tsx
test.each([
  ['sale', '할인 상품 보러가기', '지금 할인 중인 상품'],
  ['coupon', '쿠폰 받기', '쿠폰과 함께 보기 좋은 상품'],
  ['review', '리뷰 쓰고 참여하기', '리뷰가 많은 상품'],
  ['new', '신상품 보러가기', '새로 들어온 상품'],
  ['special', '이벤트 참여하기', '함께 보면 좋은 상품'],
])('renders the %s commerce variant', async (variant, actionLabel, productTitle) => {
  renderDetail(createEventForVariant(variant));
  expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  expect(screen.getAllByRole('button', { name: actionLabel }).length).toBeGreaterThanOrEqual(1);
  expect(await screen.findByText(productTitle)).toBeInTheDocument();
});
```

리뷰 variant는 `special` eventType과 제목의 `리뷰` 키워드로 만든다. 쿠폰 직접 지급 테스트는 `couponType: 'auto'`와 `rewardCouponId`를 사용한다.

- [ ] **Step 2: 예정·종료·정원 표시와 기존 참여 회귀 테스트 작성**

```tsx
test('does not show unlimited participant metadata', () => {
  renderDetail(createEvent({ participantCount: 0, hasMaxParticipants: false }));
  expect(screen.queryByText(/0명/)).toBeNull();
  expect(screen.queryByText(/제한 없음/)).toBeNull();
});

test('keeps the existing participation request connected', async () => {
  mockedEventService.participateInEvent.mockResolvedValue({ participantCount: 121 });
  renderDetail(createOngoingCouponEvent());
  await userEvent.click(screen.getAllByRole('button', { name: '쿠폰 받기' })[0]);
  expect(mockedEventService.participateInEvent).toHaveBeenCalledWith(event.id);
});
```

- [ ] **Step 3: 통합 테스트를 실행해 실패 확인**

Run: `npm test -- --runInBand src/app/events/[eventId]/EventDetailClient.test.tsx`

Expected: FAIL — 기존 반복 레이아웃 또는 새 컴포넌트 미연결.

- [ ] **Step 4: 기존 계산·행동 로직을 보존하면서 JSX 교체**

최종 순서는 다음과 같다.

```tsx
<div className={`${styles.eventDetail} ${styles[`${uiVariant}Theme`]}`}>
  <EventCommerceHero {...heroProps} />
  <EventActionBar {...actionProps} />
  <EventProductShowcase event={event} variant={uiVariant} />
  <EventInformationSections
    contentHtml={isHtmlContent ? sanitizeEventHtml(rawContent) : undefined}
    contentParagraphs={contentParagraphs}
    benefitItems={benefitItems}
    participationSteps={participationSteps}
    noticeItems={noticeItems}
  />
  <nav className={styles.bottomLinks} aria-label="이벤트 후속 이동">...</nav>
  <EventMobileStickyAction {...mobileActionProps} />
  <p className={styles.ctaFeedback} aria-live="polite">{ctaFeedback?.message}</p>
</div>
```

기존 `handlePrimaryCta`, `handleSecondaryCta`, 참여 여부 조회, 에러 코드 변환, 라우팅 switch는 삭제하지 않는다. 중복된 기존 hero, `bannerFeaturePanel`, `detailsGrid`, `infoPanelGrid`, `bottomCta` JSX만 제거한다. 기존 `eventUiMeta`는 변경하지 않고 상품 section title은 Task 1 helper만 단일 소스로 사용한다.

- [ ] **Step 5: 상세 CSS를 커머스 구조로 정리**

- 최대 콘텐츠 폭 1280px, 히어로 이미지 비율 1600/820, 모바일 4/5를 사용한다.
- 상품 섹션은 히어로 아래 두 뷰포트 높이 안에 시작한다.
- 데스크톱 product grid 4열, 900px 이하 3열, 640px 이하 2열이다.
- 모바일 고정 CTA 높이를 CSS 변수로 선언하고 상세 root에 같은 크기의 bottom padding을 준다.
- `overflow-wrap: anywhere`를 행사명, 기간, 쿠폰 코드, CTA에 적용한다.
- 기존 타입별 accent는 2px top border와 badge에만 사용한다.

- [ ] **Step 6: 통합·관련 테스트 통과 확인**

Run: `npm test -- --runInBand src/app/events/[eventId]/EventDetailClient.test.tsx src/app/events/[eventId]/_components src/app/events/_components/EventResponsiveImage.test.tsx src/shared/utils/eventHtml.test.ts`

Expected: PASS.

- [ ] **Step 7: 타입체크와 린트 확인**

Run: `npm run typecheck && npm run lint -- --max-warnings=0`

Expected: exit 0, warning 0.

---

### Task 5: 브라우저 QA, 문서, 전체 검증

**Files:**
- Modify: `docs/event-page-review.md`
- Modify: `.superpowers/sdd/progress.md` (ignored execution ledger)

**Interfaces:**
- Consumes: 최종 통합 화면과 기존 Firebase 이벤트 22개
- Produces: 재현 가능한 QA 기록과 완료 증거

- [ ] **Step 1: 로컬 서버와 데스크톱 대표 5종 QA**

대표 이벤트는 Firestore에서 실제 존재하는 세일, 쿠폰, 리뷰, 신상품, 특별 variant를 각각 하나 선택한다. 1440×1000에서 다음을 확인한다.

```text
- campaign image loaded
- product cards <= 8 and loaded
- primary CTA present
- exactly 3 information section controls
- no horizontal overflow
- no console errors
```

- [ ] **Step 2: 모바일 대표 5종 QA**

390×844에서 같은 5개 URL을 확인하고 카드 이미지 source, 2열 상품, mobile sticky CTA, accordion toggle, 플로팅 UI 비겹침, 가로 overflow 0을 기록한다.

- [ ] **Step 3: 이벤트 상세 22개 전체 경로 상태 점검**

`/events` 4페이지에서 상세 href 22개를 추출하고 모든 경로가 HTTP 200인지 확인한다. 각 상세가 캠페인 이미지와 공통 template root를 가지는지 확인한다.

- [ ] **Step 4: 문서 갱신**

`docs/event-page-review.md`에 2026-07-15 리뉴얼 섹션을 추가해 새 정보 순서, 타입별 상품 소스, 참여자 조건부 표시, 모바일 고정 CTA, 검증 결과를 기록한다. `docs/README.md`에는 이미 설계 링크가 있으므로 중복 항목을 만들지 않는다.

- [ ] **Step 5: 전체 품질 게이트**

Run: `npm run verify`

Expected: typecheck, lint, all Jest suites, Functions build, Next production build exit 0.

- [ ] **Step 6: 이미지·Firebase 회귀 검증**

Run: `npm run event-images:validate && npm run event-images:firebase:verify`

Expected: local WebP 44/44, Firestore 22/22, reachable images 44/44.

- [ ] **Step 7: 최종 diff 검사와 코드 리뷰**

Run: `git diff --check && git status --short`

Expected: whitespace error 0. 별도 reviewer는 Critical/Important/Minor 순으로 전체 변경을 검토하고 `APPROVED` 또는 수정 항목을 반환한다. reviewer는 파일 수정, Firebase 쓰기, 커밋, 푸시, 배포를 하지 않는다.
