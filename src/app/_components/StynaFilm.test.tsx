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
  test('renders the four linked product chapters without native playback controls', () => {
    render(<StynaFilm />);

    expect(screen.getByRole('heading', { name: 'THE EVERYDAY MOTION' })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /상품 보기$/ })).toHaveLength(4);
    expect(screen.getByRole('link', { name: '쿨터치 오버핏 반팔 셔츠 상품 보기' }))
      .toHaveAttribute('href', '/products/cool-touch-oversized-shirt');
    expect(screen.getByTestId('styna-film-video')).toHaveProperty('muted', true);
    expect(screen.getByTestId('styna-film-video')).toHaveAttribute('playsinline');
    expect(screen.getByTestId('styna-film-video')).not.toHaveAttribute('controls');
  });

  test('plays each chapter once in order and stops after the fourth video', async () => {
    render(<StynaFilm />);
    setViewportVisibility(true);

    const video = screen.getByTestId('styna-film-video');
    expect(video).toHaveAttribute('src', expect.stringContaining('cool-touch-oversized-shirt'));

    fireEvent.ended(video);
    await waitFor(() => expect(screen.getByTestId('styna-film-video'))
      .toHaveAttribute('src', expect.stringContaining('mesh-low-profile-sneakers')));

    fireEvent.ended(screen.getByTestId('styna-film-video'));
    await waitFor(() => expect(screen.getByTestId('styna-film-video'))
      .toHaveAttribute('src', expect.stringContaining('utility-big-tote-bag')));

    fireEvent.ended(screen.getByTestId('styna-film-video'));
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
