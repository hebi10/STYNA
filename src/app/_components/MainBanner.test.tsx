import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import MainBanner from './MainBanner';

jest.mock('./MainBanner.module.css', () => ({
  __esModule: true,
  default: new Proxy({}, {
    get: (_target, prop) => String(prop),
  }),
}));

jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: React.ImgHTMLAttributes<HTMLImageElement> & { priority?: boolean }) => {
    const { alt, ...imageProps } = props;
    delete imageProps.priority;
    delete (imageProps as React.ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean }).fill;

    return React.createElement('img', { alt, ...imageProps });
  },
}));

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({
    href,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe('MainBanner', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  test('renders five two-up banner sets with image-only links', () => {
    const { container } = render(<MainBanner />);
    const links = Array.from(container.querySelectorAll<HTMLAnchorElement>('a.bannerCard'));

    expect(screen.getByLabelText('메인 상품 및 이벤트 배너')).toBeInTheDocument();
    expect(container.querySelectorAll('.bannerPair')).toHaveLength(7);
    expect(container.querySelectorAll('.bannerCard')).toHaveLength(14);
    expect(screen.getAllByRole('button', { name: /번 배너 보기/ })).toHaveLength(5);

    expect(links.some((link) => link.href.endsWith('/events/event-2026-06-midyear-sale'))).toBe(true);
    expect(links.some((link) => link.href.endsWith('/events/event-2026-07-vacation-coupon'))).toBe(true);
    expect(links.some((link) => link.href.endsWith('/events/event-2026-07-summer-review'))).toBe(true);
    expect(links.some((link) => link.href.endsWith('/events/event-2026-07-cool-touch'))).toBe(true);
    expect(links.some((link) => link.href.endsWith('/events/event-2026-08-pre-fall'))).toBe(true);
  });

  test('moves the horizontal track by one two-up set on next navigation', () => {
    const { container } = render(<MainBanner />);
    const track = container.querySelector<HTMLElement>('.bannerTrack');

    expect(track?.style.getPropertyValue('--track-index')).toBe('1');
    expect(screen.getByRole('button', { name: '1번 배너 보기' })).toHaveAttribute('aria-current', 'true');

    fireEvent.click(screen.getByRole('button', { name: '다음 배너' }));

    expect(track?.style.getPropertyValue('--track-index')).toBe('2');
    expect(screen.getByRole('button', { name: '2번 배너 보기' })).toHaveAttribute('aria-current', 'true');
  });

  test('restarts auto rotation after manual navigation', () => {
    jest.useFakeTimers();
    const { container } = render(<MainBanner />);
    const track = container.querySelector<HTMLElement>('.bannerTrack');

    act(() => {
      jest.advanceTimersByTime(4400);
    });
    fireEvent.click(screen.getByRole('button', { name: '다음 배너' }));

    expect(track?.style.getPropertyValue('--track-index')).toBe('2');

    act(() => {
      jest.advanceTimersByTime(100);
    });

    expect(track?.style.getPropertyValue('--track-index')).toBe('2');

    act(() => {
      jest.advanceTimersByTime(4400);
    });

    expect(track?.style.getPropertyValue('--track-index')).toBe('3');
  });
});
