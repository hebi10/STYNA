# 메인 배너 데스크톱 정사각형·모바일 세로형 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** PC·태블릿의 기존 정사각형 상품 배너는 유지하고, 모바일에서는 새 세로형 이벤트 배너 5장을 슬라이드로 보여 주며 하단 바 네비게이션을 제공한다.

**Architecture:** `MainBanner`는 공통 5단계 캐러셀 상태를 유지하면서 미디어 쿼리에 따라 데스크톱·태블릿의 기존 상품 쌍 또는 모바일의 이벤트 배너를 하나만 렌더링한다. 모바일 이벤트 데이터는 컴포넌트 상수로 두고, 새 정적 이미지 5장은 `public/main/mobile-event-banner/`에서 제공한다. 슬라이드 수가 두 환경 모두 5개이므로 무한 순환·드래그·세션 복원 상태는 재사용한다.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, CSS Modules, Next Image, Jest, Testing Library, ImageGen, Sharp

## Global Constraints

- PC·태블릿의 기존 상품 카드 데이터, Firebase Storage 이미지 URL, 상품 상세 링크를 변경하지 않는다.
- 모바일에서는 3:4 비율의 새 세로형 이벤트 이미지 5장과 기존 `/events/{eventId}` 상세 경로만 사용한다.
- 자동 재생, 무한 순환, 드래그 48px 임계값, 4px 클릭 억제, 세션 복원, hover·focus 일시 정지, reduced motion 정책을 보존한다.
- 이미지에 한국어 텍스트나 로고를 합성하지 않고, 제목은 접근 가능한 UI 텍스트로 표시한다.
- 새 UI에 `box-shadow`나 큰 `border-radius`를 추가하지 않는다.
- 기존 사용자 변경 파일은 건드리지 않는다. 커밋·푸시·배포는 사용자가 명시적으로 요청할 때만 수행한다.

---

## 파일 구조

- `public/main/mobile-event-banner/*.webp`: 모바일 전용 3:4 이벤트 배너 원본 5장
- `src/app/_components/MainBanner.tsx`: 미디어 쿼리 기반 렌더링 분기, 모바일 이벤트 데이터, 공통 캐러셀 상태와 하단 컨트롤 마크업
- `src/app/_components/MainBanner.module.css`: 데스크톱 프리뷰 폭, 모바일 세로형 레이아웃, 하단 세그먼트 바 스타일
- `src/app/_components/MainBanner.test.tsx`: 뷰포트별 링크·이미지·우선 로딩·세그먼트 바 회귀 테스트
- `docs/main-banner.md`: 실제 데이터 모델·반응형 배너·조작 방식 최신화

### Task 1: 모바일 세로형 이벤트 이미지 5장 제작

**Files:**
- Create: `public/main/mobile-event-banner/summer-sale-edit.webp`
- Create: `public/main/mobile-event-banner/prefall-layering-new.webp`
- Create: `public/main/mobile-event-banner/late-summer-style.webp`
- Create: `public/main/mobile-event-banner/bag-accessory-sale.webp`
- Create: `public/main/mobile-event-banner/daily-bag-new.webp`

**Interfaces:**
- Consumes: 각 이벤트 ID와 아래 이미지 주제
- Produces: `MobileBanner.image`에서 참조하는 1440×1920 WebP 정적 경로

- [x] **Step 1: ImageGen으로 텍스트 없는 세로 원본 5장을 생성한다**

  아래 프롬프트를 각각 사용한다. 모든 프롬프트에는 `vertical 3:4 fashion editorial campaign, no text, no logo, no watermark, Korean contemporary fashion e-commerce, soft natural film grain, realistic photography`를 공통으로 포함한다.

  | 파일 | 개별 장면 지시 |
  | --- | --- |
  | `summer-sale-edit` | 늦여름 오후의 도심 보행로, 가벼운 셔츠와 와이드 팬츠를 입은 모델, 따뜻한 회색·크림 색감 |
  | `prefall-layering-new` | 흐린 초가을 아침, 얇은 재킷과 니트 레이어링, 차분한 차콜·올리브 색감 |
  | `late-summer-style` | 그늘진 건축물 앞, 반팔 셔츠와 버뮤다 쇼츠, 절제된 블루·베이지 색감 |
  | `bag-accessory-sale` | 스톤 벤치 위 가죽 숄더백과 액세서리, 손과 의상의 일부가 자연스럽게 보이는 클로즈업 |
  | `daily-bag-new` | 출근길의 미니멀한 인물, 데일리 토트백을 중심으로 한 전신 스타일링, 검정·회색 중심 색감 |

- [x] **Step 2: 각 원본을 1440×1920 WebP로 정규화한다**

  각 이미지에서 인물·가방의 핵심 피사체가 가운데 안전 영역에 남는지 확인한 뒤, 아래 Sharp 스크립트를 파일별로 실행한다.

  ```powershell
  node -e "const sharp=require('sharp'); sharp('SOURCE.png').resize(1440,1920,{fit:'cover',position:'centre'}).webp({quality:88}).toFile('public/main/mobile-event-banner/TARGET.webp')"
  ```

- [x] **Step 3: 파일 수·형식·크기를 검증한다**

  ```powershell
  node -e "const fs=require('fs'); const sharp=require('sharp'); const files=['summer-sale-edit','prefall-layering-new','late-summer-style','bag-accessory-sale','daily-bag-new']; Promise.all(files.map(async n=>{const p='public/main/mobile-event-banner/'+n+'.webp'; if(!fs.existsSync(p)) throw new Error('missing '+p); const m=await sharp(p).metadata(); if(m.width!==1440||m.height!==1920||m.format!=='webp') throw new Error('invalid '+p+' '+m.width+'x'+m.height+' '+m.format); })).then(()=>console.log('mobile event banners PASS'))"
  ```

  Expected: `mobile event banners PASS`

### Task 2: 뷰포트별 배너 데이터와 렌더링 회귀 테스트

**Files:**
- Modify: `src/app/_components/MainBanner.test.tsx`
- Modify: `src/app/_components/MainBanner.tsx`

**Interfaces:**
- Consumes: `window.matchMedia('(max-width: 767px)')`, 기존 `bannerPairs`, 새 `mobileBanners`
- Produces: `isMobileViewport` 상태와 활성 인덱스를 공유하는 데스크톱 상품·모바일 이벤트 렌더링

- [x] **Step 1: 뷰포트 모킹 도우미와 실패 테스트를 추가한다**

  `setReducedMotion`을 아래처럼 확장해 모션과 모바일 미디어 쿼리를 함께 제어한다.

  ```tsx
  const setMediaPreferences = ({ reducedMotion = false, mobile = false } = {}) => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: jest.fn().mockImplementation((query: string) => ({
        matches: query === '(prefers-reduced-motion: reduce)' ? reducedMotion : query === '(max-width: 767px)' ? mobile : false,
        media: query,
        onchange: null,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      })),
    });
  };
  ```

  모바일 렌더링 테스트는 이벤트 링크와 첫 번째 세로 이미지 우선 로딩을 검증한다.

  ```tsx
  test('renders five portrait event slides on mobile', () => {
    setMediaPreferences({ mobile: true });
    const { container } = render(<MainBanner />);
    expect(container.querySelectorAll('.mobileBannerCard')).toHaveLength(7);
    expect(screen.getByRole('link', { name: '라스트 서머 세일 셀렉션 이벤트 보기' }))
      .toHaveAttribute('href', '/events/event-2026-08-summer-sale-edit');
    expect(container.querySelector('img[alt="라스트 서머 세일 셀렉션 이벤트 배너"]'))
      .toHaveAttribute('data-priority', 'true');
  });
  ```

- [x] **Step 2: 대상 테스트가 현재 구현에서 실패하는지 확인한다**

  Run: `npm test -- src/app/_components/MainBanner.test.tsx`

  Expected: 모바일 이벤트 링크와 `.mobileBannerCard`가 아직 없어 실패

- [x] **Step 3: 최소 렌더링 분기를 구현한다**

  `MainBanner.tsx`에 아래 타입과 데이터를 추가한다.

  ```tsx
  type MobileBanner = {
    id: string;
    href: string;
    image: string;
    title: string;
    description: string;
  };

  const mobileBanners: MobileBanner[] = [
    { id: 'summer-sale-edit', href: '/events/event-2026-08-summer-sale-edit', image: '/main/mobile-event-banner/summer-sale-edit.webp', title: '라스트 서머 세일 셀렉션', description: '가벼운 여름 스타일을 만나보세요.' },
    { id: 'prefall-layering-new', href: '/events/event-2026-08-prefall-layering-new', image: '/main/mobile-event-banner/prefall-layering-new.webp', title: '프리폴 레이어링 신상', description: '계절 사이를 위한 새 스타일.' },
    { id: 'late-summer-style', href: '/events/event-2026-08-late-summer-style', image: '/main/mobile-event-banner/late-summer-style.webp', title: '늦여름 데일리 리셋', description: '지금 입기 좋은 데일리 셀렉션.' },
    { id: 'bag-accessory-sale', href: '/events/event-2026-08-bag-accessory-sale', image: '/main/mobile-event-banner/bag-accessory-sale.webp', title: '데일리 백 & 액세서리 세일', description: '매일 함께할 포인트 아이템.' },
    { id: 'daily-bag-new', href: '/events/event-2026-08-daily-bag-new', image: '/main/mobile-event-banner/daily-bag-new.webp', title: '데일리 백 신상품', description: '새 시즌의 가방을 확인하세요.' },
  ];
  ```

  `isMobileViewport`를 `(max-width: 767px)` 미디어 쿼리의 초기값과 변경 이벤트로 동기화한다. 캐러셀의 복제 배열과 `activeIndex`는 5개 항목으로 유지하고, `isMobileViewport`일 때는 활성 항목만 탭 가능하도록 `Link.mobileBannerCard`와 제목·설명을 렌더링한다. 768px 이상 분기에는 기존 `bannerPair` 마크업과 상품 링크를 변경 없이 남긴다.

- [x] **Step 4: 렌더링·기존 상품 링크 테스트를 통과시킨다**

  Run: `npm test -- src/app/_components/MainBanner.test.tsx`

  Expected: 모바일 이벤트 링크 5개와 기존 데스크톱 상품 링크·드래그·세션 복원 테스트가 모두 통과

### Task 3: 가변 프리뷰와 하단 세그먼트 바 스타일 구현

**Files:**
- Modify: `src/app/_components/MainBanner.module.css`
- Modify: `src/app/_components/MainBanner.tsx`
- Modify: `src/app/_components/MainBanner.test.tsx`

**Interfaces:**
- Consumes: `--side-preview`, `--active-slide-width`, `activeIndex`, `isMobileViewport`
- Produces: 화면 폭별 트랙 이동, 모바일 세로형 카드, `paginationBar` 세그먼트 버튼과 하단 컨트롤 영역

- [x] **Step 1: 세그먼트 바와 모바일 프리뷰 없음에 대한 실패 테스트를 추가한다**

  ```tsx
  test('uses five segment buttons rather than visual dots', () => {
    const { container } = render(<MainBanner />);
    expect(container.querySelectorAll('.paginationSegment')).toHaveLength(5);
    expect(container.querySelectorAll('.paginationDot')).toHaveLength(0);
    expect(screen.getByRole('button', { name: '1번 배너 보기' })).toHaveAttribute('aria-current', 'true');
  });
  ```

  ```tsx
  test('does not expose adjacent slide previews on mobile', () => {
    setMediaPreferences({ mobile: true });
    const { container } = render(<MainBanner />);
    expect(container.querySelector('.bannerTrack')).toHaveClass('mobileTrack');
  });
  ```

- [x] **Step 2: 대상 테스트가 현재 구현에서 실패하는지 확인한다**

  Run: `npm test -- src/app/_components/MainBanner.test.tsx`

  Expected: `.paginationSegment`와 `.mobileTrack`이 없어 실패

- [x] **Step 3: CSS 변수와 하단 컨트롤 마크업을 구현한다**

  `bannerTrack`의 이동과 각 데스크톱 슬라이드 폭을 아래 변수를 사용하도록 바꾼다.

  ```css
  .bannerSection { --side-preview: 20%; --active-slide-width: 60%; }
  .bannerTrack { transform: translateX(calc(var(--side-preview) - (var(--track-index) * var(--active-slide-width)) + var(--drag-offset))); }
  .bannerPair { flex: 0 0 var(--active-slide-width); }
  @media (max-width: 1599px) { .bannerSection { --side-preview: 15%; --active-slide-width: 70%; } }
  @media (max-width: 1279px) { .bannerSection { --side-preview: 7%; --active-slide-width: 86%; } }
  @media (max-width: 767px) { .bannerSection { --side-preview: 0%; --active-slide-width: 100%; } .mobileTrack { transform: translateX(calc(-1 * var(--track-index) * var(--active-slide-width) + var(--drag-offset))); } }
  ```

  기존 `paginationDot` 마크업은 아래 세그먼트 버튼 구조로 교체하고, 버튼들은 이미지 밖의 `bannerControls`에 배치한다.

  ```tsx
  <div className={styles.bannerControls}>
    <button type="button" className={`${styles.navButton} ${styles.prevButton}`} aria-label="이전 배너" disabled={isAnimating} onClick={showPrevious}>‹</button>
    <div className={styles.pagination} aria-label="배너 순서">
      {bannerPairs.map((pair, index) => (
        <button key={pair.id} className={`${styles.paginationSegment} ${index === activeIndex ? styles.activeSegment : ''}`} aria-label={`${index + 1}번 배너 보기`} aria-current={index === activeIndex} disabled={isAnimating} onClick={() => showSlide(index)} />
      ))}
    </div>
    <button type="button" className={`${styles.navButton} ${styles.nextButton}`} aria-label="다음 배너" disabled={isAnimating} onClick={showNext}>›</button>
    <button type="button" className={styles.autoPlayButton} aria-label={isAutoPlayEnabled ? '배너 자동 재생 정지' : '배너 자동 재생 시작'} aria-pressed={isAutoPlayEnabled} disabled={prefersReducedMotion} onClick={() => setIsAutoPlayEnabled((enabled) => !enabled)}><span aria-hidden="true">{isAutoPlayEnabled ? 'Ⅱ' : '▶'}</span></button>
  </div>
  ```

  모바일에서는 `.bannerStage`를 3:4 비율로, `.mobileBannerCard`와 이미지를 전체 채움으로 설정한다. 767px 이하에서 양옆 프리뷰·데스크톱 카드만 숨기고, 바 버튼은 화면상 얇아도 각 버튼의 실제 터치 영역을 44×44px 이상으로 둔다.

- [x] **Step 4: 네비게이션·반응형 회귀 테스트를 통과시킨다**

  Run: `npm test -- src/app/_components/MainBanner.test.tsx`

  Expected: 세그먼트 클릭·전환 잠금·모바일 프리뷰 없음·기존 reduced motion 테스트가 모두 통과

### Task 4: 문서 갱신과 전체 검증

**Files:**
- Modify: `docs/main-banner.md`

**Interfaces:**
- Consumes: 구현된 데스크톱 상품 카드와 모바일 이벤트 배너 계약
- Produces: 현재 데이터 원본·뷰포트별 링크·컨트롤 정책을 설명하는 운영 문서

- [x] **Step 1: `docs/main-banner.md`의 현재 상태와 검증 항목을 갱신한다**

  데스크톱·태블릿의 기존 Firebase 상품 카드 2개 구조와 모바일의 `public/main/mobile-event-banner/*.webp` 이벤트 카드 5개 구조를 분리해 기록한다. 모바일 이벤트 경로 5개, 767px 이하 프리뷰 없음, 768px 이상 프리뷰 기준, 하단 세그먼트 바와 44px 조작 영역을 명시한다.

- [x] **Step 2: 정적 검증을 실행한다**

  Run: `npm run typecheck`

  Expected: exit code 0

  Run: `npm run lint -- --max-warnings=0`

  Expected: exit code 0

- [x] **Step 3: 메인 배너 테스트와 이미지 검증을 다시 실행한다**

  Run: `npm test -- src/app/_components/MainBanner.test.tsx`

  Expected: exit code 0

  Run: `node -e "const fs=require('fs'); const files=['summer-sale-edit','prefall-layering-new','late-summer-style','bag-accessory-sale','daily-bag-new']; for(const name of files){if(!fs.existsSync('public/main/mobile-event-banner/'+name+'.webp')) throw new Error(name)} console.log('five portrait banners present')"`

  Expected: `five portrait banners present`

- [x] **Step 4: 브라우저에서 제한된 화면 확인을 수행한다**

  `npm run dev`로 로컬 서버를 실행해 `/`를 확인한다. 390px에서는 세로형 이벤트 배너·이벤트 상세 링크·프리뷰 없음·바 네비게이션을, 768px·1024px·1280px·1600px에서는 기존 정사각형 상품 카드·프리뷰 비율·드래그·자동재생을 확인한다. 확인이 끝난 로컬 서버는 종료한다.
