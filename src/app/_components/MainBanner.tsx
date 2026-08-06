'use client';

import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, DragEvent, PointerEvent, TransitionEvent } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import styles from './MainBanner.module.css';

const SLIDE_DELAY_MS = 4500;
const DRAG_THRESHOLD_PX = 48;
const CLICK_SUPPRESSION_THRESHOLD_PX = 4;
const ACTIVE_SLIDE_STORAGE_KEY = 'hebimall.main-banner.active-index';
const STORAGE_BUCKET = 'hebimall.firebasestorage.app';
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

const storageUrl = (path: string) =>
  `https://firebasestorage.googleapis.com/v0/b/${STORAGE_BUCKET}/o/${encodeURIComponent(path)}?alt=media`;

type BannerCard = {
  id: string;
  href: string;
  image: string;
  alt: string;
};

type BannerPair = {
  id: string;
  left: BannerCard;
  right: BannerCard;
};

type MobileBanner = {
  id: string;
  href: string;
  image: string;
  title: string;
  description: string;
};

const bannerPairs: BannerPair[] = [
  {
    id: 'cool-touch-office',
    left: {
      id: 'cool-touch-oversized-shirt',
      href: '/products/cool-touch-oversized-shirt',
      image: storageUrl('images/main-banner/cool-touch-oversized-shirt/banner.webp'),
      alt: '쿨터치 오버핏 반팔 셔츠 상품 배너',
    },
    right: {
      id: 'cool-touch-wide-banding-pants',
      href: '/products/cool-touch-wide-banding-pants',
      image: storageUrl('images/main-banner/cool-touch-wide-banding-pants/banner.webp'),
      alt: '쿨터치 와이드 밴딩 팬츠 착용 배너',
    },
  },
  {
    id: 'linen-vacation',
    left: {
      id: 'linen-like-half-shirt',
      href: '/products/linen-like-half-shirt',
      image: storageUrl('images/main-banner/linen-like-half-shirt/banner.webp'),
      alt: '린넨 라이크 반팔 셔츠 상품 배너',
    },
    right: {
      id: 'linen-like-bermuda-shorts',
      href: '/products/linen-like-bermuda-shorts',
      image: storageUrl('images/main-banner/linen-like-bermuda-shorts/banner.webp'),
      alt: '린넨 라이크 버뮤다 쇼츠 착용 배너',
    },
  },
  {
    id: 'summer-street',
    left: {
      id: 'mesh-low-profile-sneakers',
      href: '/products/mesh-low-profile-sneakers',
      image: storageUrl('images/main-banner/mesh-low-profile-sneakers/banner.webp'),
      alt: '메쉬 로우프로파일 스니커즈 상품 배너',
    },
    right: {
      id: 'nylon-string-crossbody-bag',
      href: '/products/nylon-string-crossbody-bag',
      image: storageUrl('images/main-banner/nylon-string-crossbody-bag/banner.webp'),
      alt: '나일론 스트링 크로스백 착용 배너',
    },
  },
  {
    id: 'office-casual',
    left: {
      id: 'seersucker-half-jacket',
      href: '/products/seersucker-half-jacket',
      image: storageUrl('images/main-banner/seersucker-half-jacket/banner.webp'),
      alt: '시어서커 반팔 재킷 상품 배너',
    },
    right: {
      id: 'utility-big-tote-bag',
      href: '/products/utility-big-tote-bag',
      image: storageUrl('images/main-banner/utility-big-tote-bag/banner.webp'),
      alt: '유틸리티 빅 토트백 착용 배너',
    },
  },
  {
    id: 'pre-fall-layer',
    left: {
      id: 'light-zip-up-jacket',
      href: '/products/light-zip-up-jacket',
      image: storageUrl('images/main-banner/light-zip-up-jacket/banner.webp'),
      alt: '라이트 집업 재킷 상품 배너',
    },
    right: {
      id: 'washed-wide-denim-pants',
      href: '/products/washed-wide-denim-pants',
      image: storageUrl('images/main-banner/washed-wide-denim-pants/banner.webp'),
      alt: '워시드 와이드 데님 팬츠 착용 배너',
    },
  },
];

const carouselPairs = [
  bannerPairs[bannerPairs.length - 1],
  ...bannerPairs,
  bannerPairs[0],
];

const mobileBanners: MobileBanner[] = [
  {
    id: 'summer-sale-edit',
    href: '/events/event-2026-08-summer-sale-edit',
    image: '/main/mobile-event-banner/summer-sale-edit.webp',
    title: '라스트 서머 세일 셀렉션',
    description: '가벼운 여름 스타일을 만나보세요.',
  },
  {
    id: 'prefall-layering-new',
    href: '/events/event-2026-08-prefall-layering-new',
    image: '/main/mobile-event-banner/prefall-layering-new.webp',
    title: '프리폴 레이어링 신상',
    description: '계절 사이를 위한 새 스타일.',
  },
  {
    id: 'late-summer-style',
    href: '/events/event-2026-08-late-summer-style',
    image: '/main/mobile-event-banner/late-summer-style.webp',
    title: '늦여름 데일리 리셋',
    description: '지금 입기 좋은 데일리 셀렉션.',
  },
  {
    id: 'bag-accessory-sale',
    href: '/events/event-2026-08-bag-accessory-sale',
    image: '/main/mobile-event-banner/bag-accessory-sale.webp',
    title: '데일리 백 & 액세서리 세일',
    description: '매일 함께할 포인트 아이템.',
  },
  {
    id: 'daily-bag-new',
    href: '/events/event-2026-08-daily-bag-new',
    image: '/main/mobile-event-banner/daily-bag-new.webp',
    title: '데일리 백 신상품',
    description: '새 시즌의 가방을 확인하세요.',
  },
];

const mobileCarouselBanners = [
  mobileBanners[mobileBanners.length - 1],
  ...mobileBanners,
  mobileBanners[0],
];

export default function MainBanner() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [trackIndex, setTrackIndex] = useState(1);
  const [rotationKey, setRotationKey] = useState(0);
  const [isJumping, setIsJumping] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [isSlideStateReady, setIsSlideStateReady] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [isAutoPlayEnabled, setIsAutoPlayEnabled] = useState(true);
  const [isHoverPaused, setIsHoverPaused] = useState(false);
  const [isFocusPaused, setIsFocusPaused] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const pointerStartXRef = useRef<number | null>(null);
  const didDragRef = useRef(false);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') {
      return undefined;
    }

    const mediaQuery = window.matchMedia(REDUCED_MOTION_QUERY);
    const updateMotionPreference = (matches: boolean) => {
      setPrefersReducedMotion(matches);
      if (matches) {
        setIsAutoPlayEnabled(false);
        setIsAnimating(false);
        setIsJumping(false);
        setTrackIndex((currentIndex) => {
          if (currentIndex === 0) {
            return bannerPairs.length;
          }
          if (currentIndex === bannerPairs.length + 1) {
            return 1;
          }
          return currentIndex;
        });
        setIsDragging(false);
        setDragOffset(0);
        pointerStartXRef.current = null;
        didDragRef.current = false;
      }
    };
    const handleChange = (event: MediaQueryListEvent) => updateMotionPreference(event.matches);

    updateMotionPreference(mediaQuery.matches);
    mediaQuery.addEventListener?.('change', handleChange);
    return () => mediaQuery.removeEventListener?.('change', handleChange);
  }, []);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') {
      return undefined;
    }

    const mediaQuery = window.matchMedia('(max-width: 767px)');
    const updateViewport = (matches: boolean) => setIsMobileViewport(matches);
    const handleChange = (event: MediaQueryListEvent) => updateViewport(event.matches);

    updateViewport(mediaQuery.matches);
    mediaQuery.addEventListener?.('change', handleChange);
    return () => mediaQuery.removeEventListener?.('change', handleChange);
  }, []);

  useEffect(() => {
    const storedIndex = Number(window.sessionStorage.getItem(ACTIVE_SLIDE_STORAGE_KEY));
    const isValidStoredIndex = Number.isInteger(storedIndex)
      && storedIndex >= 0
      && storedIndex < bannerPairs.length;

    if (isValidStoredIndex) {
      setActiveIndex(storedIndex);
      setTrackIndex(storedIndex + 1);
    }

    setIsSlideStateReady(true);
  }, []);

  useEffect(() => {
    if (!isSlideStateReady) {
      return;
    }

    window.sessionStorage.setItem(ACTIVE_SLIDE_STORAGE_KEY, String(activeIndex));
  }, [activeIndex, isSlideStateReady]);

  useEffect(() => {
    if (
      !isSlideStateReady
      || !isAutoPlayEnabled
      || prefersReducedMotion
      || isHoverPaused
      || isFocusPaused
      || isAnimating
      || isDragging
    ) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      const nextIndex = (activeIndex + 1) % bannerPairs.length;

      setIsAnimating(true);
      setActiveIndex(nextIndex);
      setTrackIndex(nextIndex === 0 ? bannerPairs.length + 1 : nextIndex + 1);
    }, SLIDE_DELAY_MS);

    return () => window.clearInterval(timer);
  }, [
    activeIndex,
    isAnimating,
    isAutoPlayEnabled,
    isDragging,
    isFocusPaused,
    isHoverPaused,
    isSlideStateReady,
    prefersReducedMotion,
    rotationKey,
  ]);

  useEffect(() => {
    if (!isJumping) {
      return undefined;
    }

    const frame = window.requestAnimationFrame(() => {
      setIsJumping(false);
      setIsAnimating(false);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [isJumping]);

  const moveBy = (direction: -1 | 1) => {
    const nextIndex = (activeIndex + direction + bannerPairs.length) % bannerPairs.length;

    setIsJumping(false);
    setIsAnimating(!prefersReducedMotion);
    setActiveIndex(nextIndex);
    setTrackIndex(
      prefersReducedMotion
        ? nextIndex + 1
        : direction === -1 && activeIndex === 0
          ? 0
          : direction === 1 && activeIndex === bannerPairs.length - 1
            ? bannerPairs.length + 1
            : nextIndex + 1,
    );
    setRotationKey((key) => key + 1);
  };

  const showPrevious = () => {
    if (isAnimating || isDragging) {
      return;
    }

    moveBy(-1);
  };

  const showNext = () => {
    if (isAnimating || isDragging) {
      return;
    }

    moveBy(1);
  };

  const showSlide = (index: number) => {
    if (isAnimating || isDragging || index === activeIndex) {
      return;
    }

    setIsJumping(false);
    setIsAnimating(!prefersReducedMotion);
    setActiveIndex(index);
    setTrackIndex(index + 1);
    setRotationKey((key) => key + 1);
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button > 0 || isAnimating) {
      return;
    }

    pointerStartXRef.current = event.clientX;
    didDragRef.current = false;
    setDragOffset(0);
    setIsDragging(true);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const startX = pointerStartXRef.current;

    if (startX === null) {
      return;
    }

    const nextDragOffset = event.clientX - startX;
    setDragOffset(nextDragOffset);

    if (Math.abs(nextDragOffset) >= CLICK_SUPPRESSION_THRESHOLD_PX) {
      didDragRef.current = true;
    }
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const startX = pointerStartXRef.current;
    pointerStartXRef.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);

    if (startX === null) {
      return;
    }

    const dragDistance = event.clientX - startX;
    setIsDragging(false);
    setDragOffset(0);

    if (Math.abs(dragDistance) >= CLICK_SUPPRESSION_THRESHOLD_PX) {
      didDragRef.current = true;
    }

    if (didDragRef.current) {
      window.setTimeout(() => {
        didDragRef.current = false;
      }, 0);
    }

    if (Math.abs(dragDistance) < DRAG_THRESHOLD_PX) {
      if (dragDistance !== 0 && !prefersReducedMotion) {
        setIsAnimating(true);
      }
      return;
    }

    if (dragDistance < 0) {
      moveBy(1);
    } else {
      moveBy(-1);
    }
  };

  const handlePointerCancel = () => {
    pointerStartXRef.current = null;
    setIsDragging(false);
    setDragOffset(0);

    if (dragOffset !== 0 && !prefersReducedMotion) {
      setIsAnimating(true);
    }
  };

  const handleNativeDragStart = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const handleBannerClickCapture = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!didDragRef.current) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
  };

  const handleTrackTransitionEnd = (event: TransitionEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget || event.propertyName !== 'transform') {
      return;
    }

    if (trackIndex === 0) {
      setIsJumping(true);
      setTrackIndex(bannerPairs.length);
      return;
    }

    if (trackIndex === bannerPairs.length + 1) {
      setIsJumping(true);
      setTrackIndex(1);
      return;
    }

    setIsAnimating(false);
  };

  const trackStyle = {
    '--track-index': trackIndex,
    '--drag-offset': `${dragOffset}px`,
  } as CSSProperties;

  return (
    <section
      className={styles.bannerSection}
      aria-label="메인 상품 배너"
      onMouseEnter={() => setIsHoverPaused(true)}
      onMouseLeave={() => setIsHoverPaused(false)}
      onFocusCapture={() => setIsFocusPaused(true)}
      onBlurCapture={(event) => {
        const nextTarget = event.relatedTarget;
        if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) {
          setIsFocusPaused(false);
        }
      }}
    >
      <div className={styles.bannerStage}>
        <div
          className={styles.bannerViewport}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          onDragStart={handleNativeDragStart}
          onClickCapture={handleBannerClickCapture}
        >
          <div
            className={`${styles.bannerTrack} ${isMobileViewport ? styles.mobileTrack : ''} ${isJumping ? styles.bannerTrackJumping : ''} ${isDragging ? styles.bannerTrackDragging : ''} ${prefersReducedMotion ? styles.bannerTrackReducedMotion : ''}`}
            style={trackStyle}
            onTransitionEnd={handleTrackTransitionEnd}
          >
            {isMobileViewport
              ? mobileCarouselBanners.map((banner, index) => {
                const realIndex = (index - 1 + mobileBanners.length) % mobileBanners.length;
                const isActive = realIndex === activeIndex && index === trackIndex;
                const shouldRenderImage = Math.abs(index - trackIndex) <= 1;

                return (
                  <article
                    key={`${banner.id}-${index}`}
                    className={`${styles.mobileBannerSlide} ${isActive ? styles.activePair : ''}`}
                    aria-hidden={!isActive}
                  >
                    <Link
                      href={banner.href}
                      className={styles.mobileBannerCard}
                      aria-label={`${banner.title} 이벤트 보기`}
                      tabIndex={isActive ? 0 : -1}
                    >
                      {shouldRenderImage ? (
                        <Image
                          src={banner.image}
                          alt={`${banner.title} 이벤트 배너`}
                          fill
                          priority={index === 1}
                          sizes="100vw"
                          className={styles.bannerImage}
                        />
                      ) : null}
                      <span className={styles.mobileBannerCopy}>
                        <strong>{banner.title}</strong>
                        <span>{banner.description}</span>
                      </span>
                    </Link>
                  </article>
                );
              })
              : carouselPairs.map((pair, index) => {
                const realIndex = (index - 1 + bannerPairs.length) % bannerPairs.length;
                const isActive = realIndex === activeIndex && index === trackIndex;
                const shouldRenderImages = Math.abs(index - trackIndex) <= 1;

                return (
                  <article
                    key={`${pair.id}-${index}`}
                    className={`${styles.bannerPair} ${isActive ? styles.activePair : ''}`}
                    aria-hidden={!isActive}
                  >
                    {[pair.left, pair.right].map((card, cardIndex) => (
                      <Link
                        key={card.id}
                        href={card.href}
                        className={styles.bannerCard}
                        aria-label={card.alt}
                        tabIndex={isActive ? 0 : -1}
                      >
                        {shouldRenderImages ? (
                          <Image
                            src={card.image}
                            alt={card.alt}
                            fill
                            priority={index === 1 && cardIndex === 0}
                            sizes="(min-width: 1920px) 826px, 43vw"
                            className={styles.bannerImage}
                          />
                        ) : null}
                      </Link>
                    ))}
                  </article>
                );
              })}
          </div>
        </div>
      </div>

      <div className={styles.bannerControls}>
        <button
          type="button"
          className={`${styles.navButton} ${styles.prevButton}`}
          aria-label="이전 배너"
          disabled={isAnimating}
          onClick={showPrevious}
        >
          <span aria-hidden="true">‹</span>
        </button>
        <div className={styles.pagination} aria-label="배너 순서">
          {bannerPairs.map((pair, index) => (
            <button
              key={pair.id}
              type="button"
              className={`${styles.paginationSegment} ${index === activeIndex ? styles.activeSegment : ''}`}
              aria-label={`${index + 1}번 배너 보기`}
              aria-current={index === activeIndex}
              disabled={isAnimating}
              onClick={() => showSlide(index)}
            />
          ))}
        </div>
        <button
          type="button"
          className={`${styles.navButton} ${styles.nextButton}`}
          aria-label="다음 배너"
          disabled={isAnimating}
          onClick={showNext}
        >
          <span aria-hidden="true">›</span>
        </button>
        <button
          type="button"
          className={styles.autoPlayButton}
          aria-label={isAutoPlayEnabled ? '배너 자동 재생 정지' : '배너 자동 재생 시작'}
          aria-pressed={isAutoPlayEnabled}
          disabled={prefersReducedMotion}
          onClick={() => setIsAutoPlayEnabled((enabled) => !enabled)}
        >
          <span aria-hidden="true">{isAutoPlayEnabled ? 'Ⅱ' : '▶'}</span>
        </button>
      </div>
    </section>
  );
}
