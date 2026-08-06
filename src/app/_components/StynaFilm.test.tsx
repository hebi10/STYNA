import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import StynaFilm from './StynaFilm';

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

jest.mock('./StynaFilm.module.css', () => ({
  __esModule: true,
  default: new Proxy({}, { get: (_target, key) => String(key) }),
}), { virtual: true });

let observerCallback: IntersectionObserverCallback;
const play = jest.fn().mockResolvedValue(undefined);

function setViewportVisibility(isIntersecting: boolean) {
  act(() => {
    observerCallback([{ isIntersecting } as IntersectionObserverEntry], {} as IntersectionObserver);
  });
}

async function startNextVideo() {
  const nextVideo = await screen.findByTestId('styna-film-next-video');
  fireEvent.canPlay(nextVideo);
  fireEvent.playing(nextVideo);
  return screen.getByTestId('styna-film-video');
}

beforeEach(() => {
  observerCallback = jest.fn();
  window.IntersectionObserver = jest.fn().mockImplementation((callback: IntersectionObserverCallback) => {
    observerCallback = callback;
    return {
      observe: jest.fn(),
      unobserve: jest.fn(),
      disconnect: jest.fn(),
      root: null,
      rootMargin: '',
      thresholds: [],
      takeRecords: jest.fn(() => []),
    };
  });
  window.matchMedia = jest.fn().mockReturnValue({
    matches: false,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  });
  Object.defineProperty(HTMLMediaElement.prototype, 'play', {
    configurable: true,
    value: play,
  });
  Object.defineProperty(HTMLMediaElement.prototype, 'pause', {
    configurable: true,
    value: jest.fn(),
  });
  play.mockClear();
});

describe('StynaFilm', () => {
  test('renders four video selection buttons and one product detail link without native playback controls', () => {
    render(<StynaFilm />);

    expect(screen.getByRole('heading', { name: 'THE EVERYDAY MOTION' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /영상 선택$/ })).toHaveLength(4);
    expect(screen.getByRole('button', { name: '쿨터치 오버핏 반팔 셔츠 영상 선택' }))
      .toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('link', { name: '쿨터치 오버핏 반팔 셔츠 상품 보러가기' }))
      .toHaveAttribute('href', '/products/cool-touch-oversized-shirt');
    expect(screen.getByTestId('styna-film-video')).toHaveProperty('muted', true);
    expect(screen.getByTestId('styna-film-video')).toHaveAttribute('playsinline');
    expect(screen.getByTestId('styna-film-video')).not.toHaveAttribute('controls');
  });

  test('places the selected product action before the video selection strip', () => {
    render(<StynaFilm />);

    const action = screen.getByRole('link', { name: '쿨터치 오버핏 반팔 셔츠 상품 보러가기' });
    const selectionStrip = screen.getByRole('navigation', { name: 'STYNA FILM 상품' });

    expect(action.compareDocumentPosition(selectionStrip) & Node.DOCUMENT_POSITION_FOLLOWING)
      .toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  test('changes the active video and product detail link when a chapter button is clicked', async () => {
    render(<StynaFilm />);
    setViewportVisibility(true);

    fireEvent.click(screen.getByRole('button', { name: '유틸리티 빅 토트백 영상 선택' }));
    await startNextVideo();

    await waitFor(() => expect(screen.getByTestId('styna-film-video'))
      .toHaveAttribute('src', expect.stringContaining('utility-big-tote-bag')));
    expect(screen.getByRole('button', { name: '유틸리티 빅 토트백 영상 선택' }))
      .toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('link', { name: '유틸리티 빅 토트백 상품 보러가기' }))
      .toHaveAttribute('href', '/products/utility-big-tote-bag');
  });

  test('keeps the current video visible until the selected video starts playing', async () => {
    render(<StynaFilm />);
    setViewportVisibility(true);

    const currentVideo = screen.getByTestId('styna-film-video');
    fireEvent.click(screen.getByRole('button', { name: '유틸리티 빅 토트백 영상 선택' }));

    const nextVideo = await screen.findByTestId('styna-film-next-video');
    expect(currentVideo).toHaveAttribute('src', expect.stringContaining('cool-touch-oversized-shirt'));
    expect(nextVideo).toHaveAttribute('src', expect.stringContaining('utility-big-tote-bag'));

    fireEvent.canPlay(nextVideo);
    fireEvent.playing(nextVideo);

    expect(screen.getByTestId('styna-film-video'))
      .toHaveAttribute('src', expect.stringContaining('utility-big-tote-bag'));
  });

  test('plays each chapter once in order and stops after the fourth video', async () => {
    render(<StynaFilm />);
    setViewportVisibility(true);

    const video = screen.getByTestId('styna-film-video');
    expect(video).toHaveAttribute('src', expect.stringContaining('cool-touch-oversized-shirt'));

    fireEvent.ended(video);
    await startNextVideo();
    await waitFor(() => expect(screen.getByTestId('styna-film-video'))
      .toHaveAttribute('src', expect.stringContaining('mesh-low-profile-sneakers')));

    fireEvent.ended(screen.getByTestId('styna-film-video'));
    await startNextVideo();
    await waitFor(() => expect(screen.getByTestId('styna-film-video'))
      .toHaveAttribute('src', expect.stringContaining('utility-big-tote-bag')));

    fireEvent.ended(screen.getByTestId('styna-film-video'));
    await startNextVideo();
    await waitFor(() => expect(screen.getByTestId('styna-film-video'))
      .toHaveAttribute('src', expect.stringContaining('light-zip-up-jacket')));

    fireEvent.ended(screen.getByTestId('styna-film-video'));
    expect(screen.getByTestId('styna-film-video'))
      .toHaveAttribute('src', expect.stringContaining('light-zip-up-jacket'));
    expect(play).toHaveBeenCalledTimes(4);
  });

  test('resets to the first chapter when the section is entered again', async () => {
    render(<StynaFilm />);
    setViewportVisibility(true);
    fireEvent.ended(screen.getByTestId('styna-film-video'));
    await startNextVideo();
    await waitFor(() => expect(screen.getByTestId('styna-film-video'))
      .toHaveAttribute('src', expect.stringContaining('mesh-low-profile-sneakers')));

    setViewportVisibility(false);
    setViewportVisibility(true);

    expect(screen.getByTestId('styna-film-video'))
      .toHaveAttribute('src', expect.stringContaining('cool-touch-oversized-shirt'));
  });

  test('does not autoplay when the visitor prefers reduced motion', () => {
    window.matchMedia = jest.fn().mockReturnValue({
      matches: true,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    });

    render(<StynaFilm />);
    setViewportVisibility(true);

    expect(play).not.toHaveBeenCalled();
  });
});
