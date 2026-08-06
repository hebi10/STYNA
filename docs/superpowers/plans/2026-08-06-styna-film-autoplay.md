# STYNA FILM 무음 자동 재생 섹션 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 홈에 네 개의 10초 AI 상품 영상을 1회만 순차 자동 재생하는 STYNA FILM 브랜드 무드 섹션을 추가한다.

**Architecture:** 독립 클라이언트 컴포넌트 `StynaFilm`이 `IntersectionObserver`로 섹션 진입·이탈을 감지하고, 활성 챕터의 단일 `<video>`만 렌더링한다. 영상 종료 이벤트는 다음 챕터로만 이동하며 네 번째 종료 뒤에는 완료 상태를 유지한다. 홈 페이지는 추천 섹션 바로 뒤에 이 컴포넌트만 조합한다.

**Tech Stack:** Next.js App Router, React 19, TypeScript, CSS Modules, Jest, Testing Library

## Global Constraints

- 영상 4편은 무음(`muted`)·인라인(`playsInline`)으로만 재생하며 음소거 해제·볼륨·순서 변경 컨트롤을 제공하지 않는다.
- 섹션 재진입은 1번 영상 0초부터 시작하고, 4번 종료 뒤에는 반복하지 않는다.
- `prefers-reduced-motion: reduce`에서는 자동 재생하지 않고 대표 이미지만 보인다.
- 새 라이브러리를 추가하지 않으며, 기존 검정·회색 기반 디자인과 반응형 간격 규칙을 따른다.
- 기존의 미커밋 파일은 사용자의 작업이므로 수정·스테이징·커밋하지 않는다. 이 작업의 커밋은 사용자가 별도로 요청할 때만 생성한다.

---

### Task 1: 영상 자산과 챕터 계약 추가

**Files:**
- Create: `public/videos/styna-film/cool-touch-oversized-shirt.mp4`
- Create: `public/videos/styna-film/mesh-low-profile-sneakers.mp4`
- Create: `public/videos/styna-film/utility-big-tote-bag.mp4`
- Create: `public/videos/styna-film/light-zip-up-jacket.mp4`
- Create: `src/app/_components/StynaFilm.tsx`
- Test: `src/app/_components/StynaFilm.test.tsx`

**Interfaces:**
- Produces: `STYNA_FILM_CHAPTERS`, 각 항목의 `id`, `name`, `brand`, `href`, `videoSrc`, `posterSrc`.
- Produces: `StynaFilm` 기본 export. 홈은 별도 props 없이 렌더링한다.

- [ ] **Step 1: 다운로드 영상 네 개의 존재와 파일명을 확인한다.**

Run:

```powershell
Get-Item `
  'C:\Users\박도영\Downloads\제공된_하늘색_반팔_셔츠_상품_이미지를_기반으로_프리미.mp4', `
  'C:\Users\박도영\Downloads\제공된_화이트와_블루_컬러의_스니커즈_상품_이미지를_기.mp4', `
  'C:\Users\박도영\Downloads\제공된_블랙_토트백_상품_이미지를_기반으로_프리미엄_라.mp4', `
  'C:\Users\박도영\Downloads\제공된_베이지_경량_재킷_상품_이미지를_기반으로_프리미.mp4'
```

Expected: 네 파일이 모두 존재하고 복사 대상과 1:1로 대응한다.

- [ ] **Step 2: 컴포넌트 계약을 검증하는 실패 테스트를 작성한다.**

```tsx
import { STYNA_FILM_CHAPTERS } from './StynaFilm';

test('defines the four ordered STYNA FILM chapters', () => {
  expect(STYNA_FILM_CHAPTERS.map(({ id }) => id)).toEqual([
    'cool-touch-oversized-shirt',
    'mesh-low-profile-sneakers',
    'utility-big-tote-bag',
    'light-zip-up-jacket',
  ]);
  expect(STYNA_FILM_CHAPTERS.every(({ videoSrc, href }) => (
    videoSrc.startsWith('/videos/styna-film/') && href.startsWith('/products/')
  ))).toBe(true);
});
```

- [ ] **Step 3: 테스트가 컴포넌트 미존재로 실패하는지 확인한다.**

Run: `npm test -- --runTestsByPath src/app/_components/StynaFilm.test.tsx`

Expected: FAIL with module resolution error for `./StynaFilm`.

- [ ] **Step 4: 영어 파일명으로 영상을 공개 정적 경로에 복사하고 챕터 상수를 구현한다.**

```powershell
New-Item -ItemType Directory -Force -Path 'public\videos\styna-film' | Out-Null
Copy-Item -LiteralPath 'C:\Users\박도영\Downloads\제공된_하늘색_반팔_셔츠_상품_이미지를_기반으로_프리미.mp4' -Destination 'public\videos\styna-film\cool-touch-oversized-shirt.mp4'
Copy-Item -LiteralPath 'C:\Users\박도영\Downloads\제공된_화이트와_블루_컬러의_스니커즈_상품_이미지를_기.mp4' -Destination 'public\videos\styna-film\mesh-low-profile-sneakers.mp4'
Copy-Item -LiteralPath 'C:\Users\박도영\Downloads\제공된_블랙_토트백_상품_이미지를_기반으로_프리미엄_라.mp4' -Destination 'public\videos\styna-film\utility-big-tote-bag.mp4'
Copy-Item -LiteralPath 'C:\Users\박도영\Downloads\제공된_베이지_경량_재킷_상품_이미지를_기반으로_프리미.mp4' -Destination 'public\videos\styna-film\light-zip-up-jacket.mp4'
```

```tsx
const storageUrl = (path: string) =>
  `https://firebasestorage.googleapis.com/v0/b/hebimall.firebasestorage.app/o/${encodeURIComponent(path)}?alt=media`;

export const STYNA_FILM_CHAPTERS = [
  { id: 'cool-touch-oversized-shirt', name: '쿨터치 오버핏 반팔 셔츠', brand: 'STYNA', href: '/products/cool-touch-oversized-shirt', videoSrc: '/videos/styna-film/cool-touch-oversized-shirt.mp4', posterSrc: storageUrl('images/main-banner/cool-touch-oversized-shirt/banner.webp') },
  { id: 'mesh-low-profile-sneakers', name: '메쉬 로우프로파일 스니커즈', brand: 'STYNA', href: '/products/mesh-low-profile-sneakers', videoSrc: '/videos/styna-film/mesh-low-profile-sneakers.mp4', posterSrc: storageUrl('images/main-banner/mesh-low-profile-sneakers/banner.webp') },
  { id: 'utility-big-tote-bag', name: '유틸리티 빅 토트백', brand: 'STYNA', href: '/products/utility-big-tote-bag', videoSrc: '/videos/styna-film/utility-big-tote-bag.mp4', posterSrc: storageUrl('images/main-banner/utility-big-tote-bag/banner.webp') },
  { id: 'light-zip-up-jacket', name: '라이트 집업 재킷', brand: 'STYNA', href: '/products/light-zip-up-jacket', videoSrc: '/videos/styna-film/light-zip-up-jacket.mp4', posterSrc: storageUrl('images/main-banner/light-zip-up-jacket/banner.webp') },
] as const;
```

- [ ] **Step 5: 챕터 계약 테스트를 통과시킨다.**

Run: `npm test -- --runTestsByPath src/app/_components/StynaFilm.test.tsx`

Expected: PASS.

### Task 2: 순차 자동 재생과 상품 스트립 구현

**Files:**
- Modify: `src/app/_components/StynaFilm.tsx`
- Create: `src/app/_components/StynaFilm.module.css`
- Modify: `src/app/_components/StynaFilm.test.tsx`

**Interfaces:**
- Consumes: `STYNA_FILM_CHAPTERS`.
- Produces: 진입 시 시작, 이탈 시 초기화, 종료 시 다음 챕터 진행, 네 번째 뒤 정지의 재생 상태 머신.

- [ ] **Step 1: 재생 상태 머신의 실패 테스트를 추가한다.**

```tsx
let observerCallback: IntersectionObserverCallback;
const play = jest.fn().mockResolvedValue(undefined);

beforeEach(() => {
  observerCallback = jest.fn();
  window.IntersectionObserver = jest.fn().mockImplementation((callback) => {
    observerCallback = callback;
    return { observe: jest.fn(), unobserve: jest.fn(), disconnect: jest.fn() };
  });
  window.matchMedia = jest.fn().mockReturnValue({
    matches: false,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  });
  Object.defineProperty(HTMLMediaElement.prototype, 'play', { configurable: true, value: play });
  Object.defineProperty(HTMLMediaElement.prototype, 'pause', { configurable: true, value: jest.fn() });
  play.mockClear();
});

test('starts from chapter one on entry, advances after each ending, and stops after chapter four', async () => {
  render(<StynaFilm />);
  act(() => observerCallback([{ isIntersecting: true } as IntersectionObserverEntry]));
  expect(await screen.findByTestId('styna-film-video')).toHaveAttribute('src', expect.stringContaining('cool-touch-oversized-shirt'));

  fireEvent.ended(screen.getByTestId('styna-film-video'));
  expect(screen.getByTestId('styna-film-video')).toHaveAttribute('src', expect.stringContaining('mesh-low-profile-sneakers'));

  fireEvent.ended(screen.getByTestId('styna-film-video'));
  fireEvent.ended(screen.getByTestId('styna-film-video'));
  fireEvent.ended(screen.getByTestId('styna-film-video'));
  expect(screen.getByText('01 — 04')).toBeInTheDocument();
  expect(screen.getByTestId('styna-film-video')).toHaveAttribute('src', expect.stringContaining('light-zip-up-jacket'));
  expect(play).toHaveBeenCalledTimes(4);
});

test('resets to chapter one after exit and the next entry', () => {
  render(<StynaFilm />);
  act(() => observerCallback([{ isIntersecting: true } as IntersectionObserverEntry]));
  fireEvent.ended(screen.getByTestId('styna-film-video'));
  act(() => observerCallback([{ isIntersecting: false } as IntersectionObserverEntry]));
  act(() => observerCallback([{ isIntersecting: true } as IntersectionObserverEntry]));
  expect(screen.getByTestId('styna-film-video')).toHaveAttribute('src', expect.stringContaining('cool-touch-oversized-shirt'));
});
```

- [ ] **Step 2: 새 재생 테스트가 실패하는지 확인한다.**

Run: `npm test -- --runTestsByPath src/app/_components/StynaFilm.test.tsx`

Expected: FAIL because `StynaFilm`은 아직 영상 렌더링과 observer 동작을 제공하지 않는다.

- [ ] **Step 3: 단일 활성 비디오와 observer 기반 재생 상태를 최소 구현한다.**

```tsx
const [chapterIndex, setChapterIndex] = useState(0);
const [hasCompleted, setHasCompleted] = useState(false);
const [isInView, setIsInView] = useState(false);
const videoRef = useRef<HTMLVideoElement>(null);

const resetFilm = () => {
  setChapterIndex(0);
  setHasCompleted(false);
};

const handleEnded = () => {
  if (chapterIndex === STYNA_FILM_CHAPTERS.length - 1) {
    setHasCompleted(true);
    return;
  }
  setChapterIndex((current) => current + 1);
};

const handleVideoError = handleEnded;
```

`IntersectionObserver` 콜백에서 진입 시 `resetFilm()`과 `setIsInView(true)`를 호출하고, 이탈 시 `setIsInView(false)` 뒤 `resetFilm()`을 호출한다. `isInView && !hasCompleted && !prefersReducedMotion`일 때만 `videoRef.current?.play().catch(() => undefined)`를 호출한다. 비디오는 `muted`, `playsInline`, `preload="metadata"`, `onEnded={handleEnded}`, `onError={handleVideoError}`를 가지며 `controls` 속성은 추가하지 않는다. 비디오 오류도 다음 챕터로 넘기고 마지막 챕터 오류면 완료 상태로 끝낸다.

- [ ] **Step 4: 하단 상품 스트립과 반응형 스타일을 구현한다.**

```tsx
<nav className={styles.productStrip} aria-label="STYNA FILM 상품">
  {STYNA_FILM_CHAPTERS.map((chapter, index) => (
    <Link key={chapter.id} href={chapter.href} className={styles.productLink}>
      <Image src={chapter.posterSrc} alt="" width={56} height={56} />
      <span><span>{String(index + 1).padStart(2, '0')}</span><strong>{chapter.name}</strong></span>
    </Link>
  ))}
</nav>
```

CSS는 큰 영상 영역, 얇은 구분선, 4열 스트립을 사용한다. 768px 이하에서는 스트립을 고정 폭 카드의 `overflow-x: auto`로 바꾸고, `border-radius`와 `box-shadow`를 추가하지 않는다.

- [ ] **Step 5: 무음 고정·모션 감소·상품 링크 테스트를 추가하고 통과시킨다.**

```tsx
test('keeps playback muted without native controls and exposes four product links', () => {
  render(<StynaFilm />);
  const video = screen.getByTestId('styna-film-video');
  expect(video).toHaveProperty('muted', true);
  expect(video).toHaveAttribute('playsinline');
  expect(video).not.toHaveAttribute('controls');
  expect(screen.getAllByRole('link', { name: /상품 보기$/ })).toHaveLength(4);
});

test('does not start video playback when the visitor prefers reduced motion', () => {
  window.matchMedia = jest.fn().mockReturnValue({ matches: true, addEventListener: jest.fn(), removeEventListener: jest.fn() });
  render(<StynaFilm />);
  act(() => observerCallback([{ isIntersecting: true } as IntersectionObserverEntry]));
  expect(play).not.toHaveBeenCalled();
});

test('advances to the next chapter after an active video load error', () => {
  render(<StynaFilm />);
  act(() => observerCallback([{ isIntersecting: true } as IntersectionObserverEntry]));
  fireEvent.error(screen.getByTestId('styna-film-video'));
  expect(screen.getByTestId('styna-film-video')).toHaveAttribute('src', expect.stringContaining('mesh-low-profile-sneakers'));
});
```

Run: `npm test -- --runTestsByPath src/app/_components/StynaFilm.test.tsx`

Expected: PASS.

### Task 3: 홈 조합과 회귀 검증

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/page.test.tsx`
- Modify: `docs/README.md`

**Interfaces:**
- Consumes: `StynaFilm` 기본 export.
- Produces: 카테고리 → STYNA SELECT → STYNA FILM → 신상품의 홈 순서.

- [ ] **Step 1: 홈 배치 순서를 검증하는 실패 테스트를 추가한다.**

```tsx
jest.mock('./_components/StynaFilm', () => ({
  __esModule: true,
  default: () => <section data-testid="home-styna-film">STYNA FILM</section>,
}));

const film = screen.getByTestId('home-styna-film');
const orderedSections = [
  banner,
  category,
  featured,
  film,
  newArrivals,
  ranking,
  sale,
  portfolio,
  styleNow,
];
const positions = orderedSections.map((section) =>
  Array.from(container.querySelectorAll('section')).indexOf(section!),
);
expect(positions).toEqual([...positions].sort((left, right) => left - right));
```

The ordered list must place `home-styna-film` directly after `home-featured` and before `home-new`.

- [ ] **Step 2: 홈 순서 테스트가 실패하는지 확인한다.**

Run: `npm test -- --runTestsByPath src/app/page.test.tsx`

Expected: FAIL because the mock has not been rendered by `Home`.

- [ ] **Step 3: `FeaturedProducts` 바로 뒤에 `StynaFilm`을 조합한다.**

```tsx
import StynaFilm from './_components/StynaFilm';

<FeaturedProducts sectionClassName={styles.productBand} viewAllLabel="전체보기" />
<StynaFilm />
<section id="new-arrivals" className={styles.productBand}>
```

- [ ] **Step 4: 홈·컴포넌트 테스트와 정적 검증을 실행한다.**

Run:

```powershell
npm test -- --runTestsByPath src/app/_components/StynaFilm.test.tsx src/app/page.test.tsx
npm run typecheck
npm run lint -- --max-warnings=0
npm run build
```

Expected: 모두 PASS. 빌드에서 네 동영상의 정적 URL이 정상적으로 포함된다.

- [ ] **Step 5: 브라우저에서 데스크톱과 모바일을 한 번씩 확인한다.**

Verify: 섹션 진입 시 첫 영상 무음 재생, 각 10초 종료 뒤 다음 영상 진행, 네 번째 뒤 정지, 섹션 이탈·재진입 시 첫 영상 재시작, 모바일 상품 스트립 가로 스크롤, 상품 링크 이동을 확인한다.
