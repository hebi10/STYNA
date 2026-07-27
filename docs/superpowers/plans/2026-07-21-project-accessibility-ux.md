# 프로젝트 접근성·사용자 경험 개선 실행 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 승인된 안정화 설계의 단계 4를 기존 화면 구조와 Firebase 데이터 흐름을 보존하면서 WCAG 기반 키보드·스크린리더·모바일 사용성으로 구현한다.

**Architecture:** 각 작업은 현재 컴포넌트 경계를 유지하고 Testing Library 실패 테스트를 먼저 추가한다. 폼은 입력-오류 연결, 오버레이는 포커스 수명주기, 콘텐츠는 유효한 인터랙티브 DOM, 마이페이지는 기존 TanStack Query 결과를 단일 원본으로 사용한다.

**Tech Stack:** React 19, TypeScript, Next.js 15, TanStack Query 5, Firebase, Jest 30, Testing Library

## Global Constraints

- Firebase만 사용하며 Supabase 코드는 추가하지 않는다.
- 기존 화면의 정보 구조와 정책 문구를 보존하고 관련 없는 리팩터링을 하지 않는다.
- 카드·버튼에 그림자나 큰 라운드를 새로 추가하지 않는다.
- 각 작업은 실패 테스트 → 최소 구현 → 집중 테스트 → 리뷰 순서로 진행한다.
- seed, migration write, Firebase 배포, 커밋과 푸시는 수행하지 않는다.

---

### Task 1: 폼 입력과 오류 연결

**Files:**
- Create: `src/app/_components/Input.test.tsx`
- Modify: `src/app/_components/Input.tsx`
- Modify: `src/app/auth/signup/page.tsx`
- Modify: `src/app/auth/signup/page.test.tsx`
- Modify: `src/app/auth/signup/page.module.css`
- Modify: `src/app/mypage/info-edit/page.tsx`
- Modify: `src/app/mypage/info-edit/page.test.tsx`
- Modify: `src/app/mypage/info-edit/page.module.css`

**Interfaces:**
- `Input`은 `${inputId}-error`, `${inputId}-helper`를 만들고 기존 `aria-describedby`와 병합한다.
- 회원가입·정보 수정의 각 컨트롤은 안정적인 `id`, `required`, `autoComplete`, `aria-invalid`, `aria-describedby`를 제공한다.
- 검증 실패 후 `requestAnimationFrame`에서 오류 순서상 첫 컨트롤의 `focus()`를 호출한다.

- [x] **Step 1: 공용 Input 실패 테스트 작성**

```tsx
render(<Input id="email" label="이메일" error="필수 입력입니다" required autoComplete="email" />);
const input = screen.getByLabelText('이메일');
expect(input).toHaveAttribute('aria-invalid', 'true');
expect(input).toHaveAttribute('aria-describedby', 'email-error');
expect(screen.getByText('필수 입력입니다')).toHaveAttribute('id', 'email-error');
```

- [x] **Step 2: 회원가입·정보 수정 실패 테스트 작성**

```tsx
fireEvent.click(screen.getByRole('button', { name: '회원가입' }));
expect(screen.getByLabelText(/이메일/)).toHaveAttribute('aria-invalid', 'true');
expect(screen.getByLabelText(/이메일/)).toHaveFocus();
expect(screen.getByRole('group', { name: '필수 안내 확인' })).toBeInTheDocument();
expect(screen.getByRole('checkbox', { name: /데모 이용 안내/ })).toBeRequired();
```

- [x] **Step 3: 실패 확인**

Run: `npm test -- --runInBand src/app/_components/Input.test.tsx src/app/auth/signup/page.test.tsx src/app/mypage/info-edit/page.test.tsx`

Expected: 오류 ID·ARIA·fieldset·첫 오류 포커스 단언이 FAIL.

- [x] **Step 4: 최소 구현**

```tsx
const describedBy = [props['aria-describedby'], error && `${inputId}-error`, !error && helperText && `${inputId}-helper`]
  .filter(Boolean)
  .join(' ') || undefined;
<input aria-invalid={error ? true : props['aria-invalid']} aria-describedby={describedBy} {...rest} />
{error ? <p id={`${inputId}-error`} role="alert">{error}</p> : null}
```

회원가입 약관은 `<fieldset><legend>필수 안내 확인</legend>`로, 생년월일·성별도 그룹 라벨과 그룹 오류 ID로 연결한다. 정보 수정의 Firebase 필드 오류도 해당 입력으로 포커스를 이동하고 일반 오류는 `role="alert"`로 알린다.

- [x] **Step 5: 집중 검증**

Run: `npm test -- --runInBand src/app/_components/Input.test.tsx src/app/auth/signup/page.test.tsx src/app/mypage/info-edit/page.test.tsx`

Expected: PASS.

---

### Task 2: 안내 팝업과 모바일 메뉴 포커스 수명주기

**Files:**
- Modify: `src/app/_components/popup/SiteGuidePopup.tsx`
- Modify: `src/app/_components/popup/SiteGuidePopup.test.tsx`
- Modify: `src/app/_components/popup/SiteGuidePopup.module.css`
- Modify: `src/app/_components/header/Header.tsx`
- Modify: `src/app/_components/header/Header.test.tsx`
- Modify: `src/app/_components/header/Header.module.css`

**Interfaces:**
- 팝업은 `role="dialog"`, `aria-modal="true"`, `aria-labelledby="site-guide-title"`을 제공한다.
- 열기 직전 `document.activeElement`를 보관하고 닫을 때 복귀한다.
- 모바일 메뉴는 열린 동안 `document.body.style.overflow = 'hidden'`을 적용하고 기존 값을 복원한다.

- [x] **Step 1: dialog·Escape·Tab·복귀 실패 테스트 작성**

```tsx
expect(screen.getByRole('dialog', { name: 'STYNA 쇼핑 안내' })).toHaveAttribute('aria-modal', 'true');
fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
expect(onClose).toHaveBeenCalledTimes(1);
```

- [x] **Step 2: 모바일 메뉴 스크롤·포커스 실패 테스트 작성**

```tsx
fireEvent.click(screen.getByRole('button', { name: '메뉴 열기' }));
expect(document.body.style.overflow).toBe('hidden');
fireEvent.keyDown(document, { key: 'Escape' });
expect(screen.getByRole('button', { name: '메뉴 열기' })).toHaveFocus();
```

- [x] **Step 3: 실패 확인**

Run: `npm test -- --runInBand src/app/_components/popup/SiteGuidePopup.test.tsx src/app/_components/header/Header.test.tsx`

Expected: dialog 의미·Escape·스크롤 잠금·포커스 복귀 단언이 FAIL.

- [x] **Step 4: 최소 구현**

팝업은 열릴 때 첫 닫기 버튼으로 포커스를 옮기고, Tab/Shift+Tab을 팝업 내부 focusable 목록에서 순환시킨다. overlay 클릭·두 닫기 버튼·Escape는 하나의 `closeDialog()`를 사용한다. 메뉴는 버튼 ref와 effect cleanup으로 스크롤·포커스를 복원하며 overlay는 `aria-hidden="true"`를 사용한다.

- [x] **Step 5: 집중 검증**

Run: `npm test -- --runInBand src/app/_components/popup/SiteGuidePopup.test.tsx src/app/_components/header/Header.test.tsx`

Expected: PASS.

---

### Task 3: 도움말 챗봇 ARIA와 최초 포커스

**Files:**
- Modify: `src/app/_components/chat/ChatWidget.tsx`
- Modify: `src/app/_components/chat/ChatWidget.test.tsx`
- Modify: `src/app/_components/chat/ChatWidget.module.css`

**Interfaces:**
- 토글은 `aria-expanded`, `aria-controls="help-chat-window"`를 제공한다.
- 창은 `id="help-chat-window"`, 제목 연결과 비표시 시 `aria-hidden`을 제공한다.
- 메시지 목록은 `role="log"`, `aria-live="polite"`, 입력은 `aria-label="도움말 질문"`을 제공한다.

- [x] **Step 1: ARIA·포커스 실패 테스트 작성**

```tsx
const toggle = screen.getByRole('button', { name: '채팅 열기' });
fireEvent.click(toggle);
expect(toggle).toHaveAttribute('aria-expanded', 'true');
expect(screen.getByRole('log')).toBeInTheDocument();
expect(screen.getByRole('button', { name: '주문/배송' })).toHaveFocus();
expect(screen.getByRole('textbox', { name: '도움말 질문' })).toBeDisabled();
```

- [x] **Step 2: 실패 확인**

Run: `npm test -- --runInBand src/app/_components/chat/ChatWidget.test.tsx`

Expected: ARIA 연결·log·입력 라벨·첫 사용 가능 선택지 포커스가 FAIL.

- [x] **Step 3: 최소 구현**

첫 빠른 선택 버튼 ref를 추가하고 채팅이 열린 다음 프레임에 그 버튼으로 포커스를 이동한다. 직접 질문 모드로 바뀌면 활성화된 textarea로 포커스를 옮긴다. reduced-motion이면 메시지 스크롤 behavior를 `auto`, 아니면 `smooth`로 선택한다.

- [x] **Step 4: 44px 터치 영역 보정**

모바일 토글, 빠른 선택, 시작, 닫기·초기화, 전송 버튼에 `min-width`/`min-height: 44px`을 적용하고 시각 크기는 내부 텍스트·아이콘으로 유지한다.

- [x] **Step 5: 집중 검증**

Run: `npm test -- --runInBand src/app/_components/chat/ChatWidget.test.tsx`

Expected: PASS.

---

### Task 4: 메인 캐러셀 재생 제어와 reduced motion

**Files:**
- Modify: `src/app/_components/MainBanner.tsx`
- Modify: `src/app/_components/MainBanner.test.tsx`
- Modify: `src/app/_components/MainBanner.module.css`
- Modify: `docs/main-banner.md`

**Interfaces:**
- 사용자 상태 `isAutoPlayEnabled`, 일시 상태 `isInteractionPaused`, 미디어 상태 `prefersReducedMotion`을 분리한다.
- interval 조건은 세 값과 `isAnimating`, `isDragging`, `isSlideStateReady`를 모두 확인한다.

- [x] **Step 1: 재생·정지·hover/focus·reduced-motion 실패 테스트 작성**

```tsx
fireEvent.click(screen.getByRole('button', { name: '배너 자동 재생 정지' }));
act(() => jest.advanceTimersByTime(4500));
expect(track.style.getPropertyValue('--track-index')).toBe('1');
fireEvent.mouseEnter(screen.getByLabelText('메인 상품 배너'));
fireEvent.focusIn(screen.getByLabelText('메인 상품 배너'));
```

`window.matchMedia('(prefers-reduced-motion: reduce)')`가 true일 때 interval이 시작되지 않는 단언을 추가한다.

- [x] **Step 2: 실패 확인**

Run: `npm test -- --runInBand src/app/_components/MainBanner.test.tsx`

Expected: 재생 제어와 일시정지 단언이 FAIL.

- [x] **Step 3: 최소 구현**

재생 버튼의 이름을 상태에 따라 `배너 자동 재생 정지`/`배너 자동 재생 시작`으로 바꾸고 `aria-pressed`를 제공한다. section의 `onMouseEnter/Leave`, `onFocusCapture/onBlurCapture`로 interaction pause를 관리한다. reduced-motion에서는 자동 재생과 transform transition을 사용하지 않으며 수동 이동 후 잠금이 `transitionend` 없이 해제되도록 분기한다.

- [x] **Step 4: 모바일 페이지 점 터치 영역 구현**

페이지 버튼은 44×44px로 만들고 작은 시각 점은 `::before`에 그린다. 기존 active 표현은 버튼 배경이 아니라 내부 점에 적용한다.

- [x] **Step 5: 집중 검증**

Run: `npm test -- --runInBand src/app/_components/MainBanner.test.tsx`

Expected: 기존 드래그·무한 순환 테스트와 신규 접근성 테스트 모두 PASS.

---

### Task 5: 상품 카드와 이벤트 목록의 유효한 의미 구조

**Files:**
- Modify: `src/app/products/_components/ProductCard.tsx`
- Modify: `src/app/products/_components/ProductCard.test.tsx`
- Modify: `src/app/products/_components/ProductCard.module.css`
- Modify: `src/app/events/page.tsx`
- Modify: `src/app/events/_components/EventList.tsx`
- Modify: `src/app/events/_components/EventList.test.tsx`
- Modify: `src/app/events/_components/EventList.module.css`
- Modify: `docs/event-page-review.md`

**Interfaces:**
- 상품 카드는 비인터랙티브 `<article>` 안에서 상세 `<Link>`와 찜 `<button>`을 형제로 배치한다.
- 찜 버튼은 `aria-pressed`와 `위시리스트에 추가`/`위시리스트에서 제거` 이름을 상태에 맞게 제공한다.
- 이벤트 목록은 한 개의 `h1`, 카드별 `h2`, 설명 텍스트, 필터 `aria-pressed`, 현재 페이지 `aria-current="page"`를 제공한다.

- [x] **Step 1: ProductCard 실패 테스트 작성**

```tsx
expect(container.querySelector('a button')).toBeNull();
expect(screen.getByRole('button', { name: '위시리스트에 추가' })).toHaveAttribute('aria-pressed', 'false');
```

찜 상태 mock에서는 이름 `위시리스트에서 제거`, `aria-pressed="true"`를 확인한다.

- [x] **Step 2: EventList 실패 테스트 작성**

```tsx
expect(screen.getByRole('heading', { level: 1, name: '이벤트' })).toBeInTheDocument();
expect(screen.getByRole('heading', { level: 2, name: '바캉스 쿠폰팩' })).toBeInTheDocument();
expect(screen.getByRole('button', { name: '전체' })).toHaveAttribute('aria-pressed', 'true');
expect(screen.getByRole('button', { name: '1' })).toHaveAttribute('aria-current', 'page');
```

- [x] **Step 3: 실패 확인**

Run: `npm test -- --runInBand src/app/products/_components/ProductCard.test.tsx src/app/events/_components/EventList.test.tsx`

Expected: nested button·찜 상태·heading·filter/page 상태가 FAIL.

- [x] **Step 4: 최소 구현과 스타일 보존**

이미지와 정보는 하나의 상세 링크 안에 유지하고 찜 버튼을 article의 절대 위치 형제로 옮긴다. 이벤트 카드의 이미지 아래 정보 영역에 제목, 설명, 기간, CTA를 텍스트로 표시하되 기존 4/2/1열과 정책 gate를 보존한다.

- [x] **Step 5: 집중 검증**

Run: `npm test -- --runInBand src/app/products/_components/ProductCard.test.tsx src/app/events/_components/EventList.test.tsx src/app/events/[eventId]/EventDetailClient.test.tsx`

Expected: PASS.

---

### Task 6: 주문 필터와 마이페이지 실제 카운트

**Files:**
- Create: `src/shared/utils/orderListFilters.ts`
- Create: `src/shared/utils/orderListFilters.test.ts`
- Modify: `src/app/mypage/order-list/page.tsx`
- Modify: `src/app/mypage/order-list/page.test.tsx`
- Modify: `src/app/mypage/order-list/page.module.css`
- Modify: `src/app/mypage/page.tsx`
- Create: `src/app/mypage/page.test.tsx`
- Modify: `src/app/mypage/layout.tsx`
- Modify: `src/app/mypage/layout.test.tsx`

**Interfaces:**
- `filterOrders(orders, { status, period, now })`은 status와 주문일을 AND로 적용한다.
- period는 `1개월 | 3개월 | 6개월 | 1년`, 날짜 경계는 같은 시각의 calendar month/year 차감으로 계산한다.
- 마이페이지는 `useOrders(user.uid, 50)`와 `useCoupon().couponStats.available`을 실제 카운트 원본으로 사용한다.

- [x] **Step 1: 순수 기간 필터 실패 테스트 작성**

```ts
expect(filterOrders(orders, { status: '전체', period: '3개월', now: new Date('2026-07-21T00:00:00+09:00') }))
  .toEqual([recentOrder]);
```

- [x] **Step 2: UI와 실제 카운트 실패 테스트 작성**

기간 버튼 클릭 후 오래된 주문이 사라지고, status 버튼에 `aria-pressed`가 반영되는지 확인한다. 마이페이지에는 mock 주문 2건과 사용 가능 쿠폰 3장이 각각 `2`, `3`으로 표시되는지 확인한다.

- [x] **Step 3: 실패 확인**

Run: `npm test -- --runInBand src/shared/utils/orderListFilters.test.ts src/app/mypage/order-list/page.test.tsx src/app/mypage/page.test.tsx src/app/mypage/layout.test.tsx`

Expected: 기간 필터·영문 status CSS·실제 카운트 단언이 FAIL.

- [x] **Step 4: 최소 구현**

`status-${order.status}`에 맞게 CSS selector를 `.status-pending` 등 영문 키로 바꾸고 그림자는 추가하지 않는다. `layout.tsx`의 user 문서 기반 orders/coupons 값을 제거하고 실제 query 결과를 `ProfileSection`에 전달한다. 로딩 중 카운트는 숫자 0으로 오해되지 않도록 `-` 또는 `aria-busy` 상태를 사용한다.

- [x] **Step 5: 집중 검증**

Run: `npm test -- --runInBand src/shared/utils/orderListFilters.test.ts src/app/mypage/order-list/page.test.tsx src/app/mypage/page.test.tsx src/app/mypage/layout.test.tsx`

Expected: PASS.

---

### Task 7: 모바일 상품 필터와 마이페이지 대체 내비게이션

**Files:**
- Modify: `src/app/products/_components/ProductList.tsx`
- Modify: `src/app/products/_components/ProductList.test.tsx`
- Modify: `src/app/products/_components/ProductList.module.css`
- Modify: `src/app/mypage/_components/SidebarMenu.tsx`
- Modify: `src/app/mypage/_components/SidebarMenu.test.tsx`
- Modify: `src/app/mypage/layout.module.css`
- Modify: `docs/mypage-ui.md`
- Modify: `docs/design-system-refactor.md`

**Interfaces:**
- 상품 필터는 모바일에서 하나의 disclosure 버튼으로 열고 닫으며 `aria-expanded`/`aria-controls`를 제공한다.
- 장식 통계는 모바일에서 축약하고 필터·정렬·페이지 버튼의 터치 영역은 44px 이상이다.
- `SidebarMenu`는 데스크톱 sidebar와 모바일 가로 스크롤 nav를 같은 링크 데이터에서 렌더링하며 모든 활성 링크에 `aria-current="page"`를 제공한다.

- [x] **Step 1: 모바일 disclosure와 내비 실패 테스트 작성**

```tsx
expect(screen.getByRole('button', { name: '상품 필터 열기' })).toHaveAttribute('aria-expanded', 'false');
fireEvent.click(screen.getByRole('button', { name: '상품 필터 열기' }));
expect(screen.getByRole('region', { name: '상품 필터' })).toBeVisible();
expect(screen.getByRole('navigation', { name: '마이페이지 모바일 메뉴' })).toBeInTheDocument();
```

- [x] **Step 2: 실패 확인**

Run: `npm test -- --runInBand src/app/products/_components/ProductList.test.tsx src/app/mypage/_components/SidebarMenu.test.tsx`

Expected: disclosure·모바일 nav·전체 `aria-current` 단언이 FAIL.

- [x] **Step 3: 최소 구현**

상품 필터의 기존 category/sort/price 컨트롤을 새 데이터 흐름 없이 한 wrapper에 묶고 모바일에서만 토글한다. 데스크톱에서는 항상 열린 상태를 CSS로 유지한다. 마이페이지 링크 정의를 배열로 추출해 desktop/mobile 렌더가 같은 href·active 판정을 사용하도록 한다.

- [x] **Step 4: CSS 터치·밀도 보정**

페이지 버튼, 필터 버튼, select와 모바일 메뉴 링크에 `min-height: 44px`을 적용한다. 장식 통계는 모바일에서 핵심 한 줄만 남기고 기존 상품 수를 실제 전체 수로 오인시키는 문구는 만들지 않는다.

- [x] **Step 5: 단계 전체 검증과 문서 갱신**

Run: `npm test -- --runInBand src/app/_components/Input.test.tsx src/app/auth/signup/page.test.tsx src/app/mypage/info-edit/page.test.tsx src/app/_components/popup/SiteGuidePopup.test.tsx src/app/_components/header/Header.test.tsx src/app/_components/chat/ChatWidget.test.tsx src/app/_components/MainBanner.test.tsx src/app/products/_components/ProductCard.test.tsx src/app/products/_components/ProductList.test.tsx src/app/events/_components/EventList.test.tsx src/app/mypage/order-list/page.test.tsx src/app/mypage/page.test.tsx src/app/mypage/layout.test.tsx src/app/mypage/_components/SidebarMenu.test.tsx`

Run: `npm run typecheck`

Run: `npm run lint -- --max-warnings=0`

Expected: 모든 명령 PASS. 이후 390×844와 1440×900 브라우저에서 키보드 포커스, 메뉴·팝업·채팅, 가로 오버플로를 확인한다.

## Self-review

- 단계 4의 폼, 오버레이, 채팅, 캐러셀, 상품, 이벤트, 주문 필터, 실제 카운트, 모바일 밀도와 대체 내비게이션 요구를 모두 Task 1~7에 매핑했다.
- placeholder, 미정 인터페이스와 Supabase 참조가 없다.
- 기간 필터, query hook, ARIA 이름과 ID는 소비 파일과 테스트에서 같은 이름을 사용한다.
- 커밋 단계는 사용자·프로젝트의 커밋 금지 지시 때문에 의도적으로 제외했다.
