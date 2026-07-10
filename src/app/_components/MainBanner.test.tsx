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

const storageUrl = (path: string) =>
  `https://firebasestorage.googleapis.com/v0/b/hebimall.firebasestorage.app/o/${encodeURIComponent(path)}?alt=media`;

const expectedCards = [
  {
    href: '/products/cool-touch-oversized-shirt',
    image: storageUrl('images/main-banner/cool-touch-oversized-shirt/banner.webp'),
    alt: '쿨터치 오버핏 반팔 셔츠 상품 배너',
  },
  {
    href: '/products/cool-touch-wide-banding-pants',
    image: storageUrl('images/main-banner/cool-touch-wide-banding-pants/banner.webp'),
    alt: '쿨터치 와이드 밴딩 팬츠 착용 배너',
  },
  {
    href: '/products/linen-like-half-shirt',
    image: storageUrl('images/main-banner/linen-like-half-shirt/banner.webp'),
    alt: '린넨 라이크 반팔 셔츠 상품 배너',
  },
  {
    href: '/products/linen-like-bermuda-shorts',
    image: storageUrl('images/main-banner/linen-like-bermuda-shorts/banner.webp'),
    alt: '린넨 라이크 버뮤다 쇼츠 착용 배너',
  },
  {
    href: '/products/mesh-low-profile-sneakers',
    image: storageUrl('images/main-banner/mesh-low-profile-sneakers/banner.webp'),
    alt: '메쉬 로우프로파일 스니커즈 상품 배너',
  },
  {
    href: '/products/nylon-string-crossbody-bag',
    image: storageUrl('images/main-banner/nylon-string-crossbody-bag/banner.webp'),
    alt: '나일론 스트링 크로스백 착용 배너',
  },
  {
    href: '/products/seersucker-half-jacket',
    image: storageUrl('images/main-banner/seersucker-half-jacket/banner.webp'),
    alt: '시어서커 반팔 재킷 상품 배너',
  },
  {
    href: '/products/utility-big-tote-bag',
    image: storageUrl('images/main-banner/utility-big-tote-bag/banner.webp'),
    alt: '유틸리티 빅 토트백 착용 배너',
  },
  {
    href: '/products/light-zip-up-jacket',
    image: storageUrl('images/main-banner/light-zip-up-jacket/banner.webp'),
    alt: '라이트 집업 재킷 상품 배너',
  },
  {
    href: '/products/washed-wide-denim-pants',
    image: storageUrl('images/main-banner/washed-wide-denim-pants/banner.webp'),
    alt: '워시드 와이드 데님 팬츠 착용 배너',
  },
];

describe('MainBanner', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  test('renders five two-up product banner sets with Firebase Storage images and product detail links', () => {
    const { container } = render(<MainBanner />);
    const links = Array.from(container.querySelectorAll<HTMLAnchorElement>('a.bannerCard'));
    const uniqueHrefs = new Set(links.map((link) => link.getAttribute('href')));
    const images = Array.from(container.querySelectorAll<HTMLImageElement>('img'));
    const uniqueImages = new Set(images.map((image) => image.getAttribute('src')));

    expect(screen.getByLabelText('메인 상품 배너')).toBeInTheDocument();
    expect(container.querySelectorAll('.bannerPair')).toHaveLength(7);
    expect(container.querySelectorAll('.bannerCard')).toHaveLength(14);
    expect(container.querySelectorAll('.bannerCopy')).toHaveLength(0);
    expect(screen.getAllByRole('button', { name: /번 배너 보기/ })).toHaveLength(5);

    expectedCards.forEach((card) => {
      expect(uniqueHrefs.has(card.href)).toBe(true);
      expect(uniqueImages.has(card.image)).toBe(true);
      expect(screen.getAllByAltText(card.alt).length).toBeGreaterThan(0);
    });

    expect(links.some((link) => link.getAttribute('href')?.startsWith('/events/'))).toBe(false);
    expect(links.some((link) => link.getAttribute('href')?.startsWith('/categories/'))).toBe(false);
    expect([...uniqueImages].every((image) => image?.startsWith('https://firebasestorage.googleapis.com/'))).toBe(true);
    expect([...uniqueImages].some((image) => image?.startsWith('/main/'))).toBe(false);
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
