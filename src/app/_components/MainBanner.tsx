'use client';

import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent, TransitionEvent } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import styles from './MainBanner.module.css';

const SLIDE_DELAY_MS = 4500;
const DRAG_THRESHOLD_PX = 48;
const ACTIVE_SLIDE_STORAGE_KEY = 'hebimall.main-banner.active-index';
const STORAGE_BUCKET = 'hebimall.firebasestorage.app';

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

export default function MainBanner() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [trackIndex, setTrackIndex] = useState(1);
  const [rotationKey, setRotationKey] = useState(0);
  const [isJumping, setIsJumping] = useState(false);
  const [isSlideStateReady, setIsSlideStateReady] = useState(false);
  const pointerStartXRef = useRef<number | null>(null);
  const didDragRef = useRef(false);

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
    if (!isSlideStateReady) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      const nextIndex = (activeIndex + 1) % bannerPairs.length;

      setActiveIndex(nextIndex);
      setTrackIndex(nextIndex === 0 ? bannerPairs.length + 1 : nextIndex + 1);
    }, SLIDE_DELAY_MS);

    return () => window.clearInterval(timer);
  }, [activeIndex, isSlideStateReady, rotationKey]);

  useEffect(() => {
    if (!isJumping) {
      return undefined;
    }

    const frame = window.requestAnimationFrame(() => setIsJumping(false));
    return () => window.cancelAnimationFrame(frame);
  }, [isJumping]);

  useEffect(() => {
    if (trackIndex !== 0 && trackIndex !== bannerPairs.length + 1) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setIsJumping(true);
      setTrackIndex(trackIndex === 0 ? bannerPairs.length : 1);
    }, 620);

    return () => window.clearTimeout(timer);
  }, [trackIndex]);

  const showPrevious = () => {
    const nextIndex = (activeIndex - 1 + bannerPairs.length) % bannerPairs.length;

    setIsJumping(false);
    setActiveIndex(nextIndex);
    setTrackIndex(activeIndex === 0 ? 0 : nextIndex + 1);
    setRotationKey((key) => key + 1);
  };

  const showNext = () => {
    const nextIndex = (activeIndex + 1) % bannerPairs.length;

    setIsJumping(false);
    setActiveIndex(nextIndex);
    setTrackIndex(nextIndex === 0 ? bannerPairs.length + 1 : nextIndex + 1);
    setRotationKey((key) => key + 1);
  };

  const showSlide = (index: number) => {
    setIsJumping(false);
    setActiveIndex(index);
    setTrackIndex(index + 1);
    setRotationKey((key) => key + 1);
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button > 0) {
      return;
    }

    pointerStartXRef.current = event.clientX;
    didDragRef.current = false;
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const startX = pointerStartXRef.current;
    pointerStartXRef.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);

    if (startX === null) {
      return;
    }

    const dragDistance = event.clientX - startX;
    if (Math.abs(dragDistance) < DRAG_THRESHOLD_PX) {
      return;
    }

    didDragRef.current = true;
    if (dragDistance < 0) {
      showNext();
    } else {
      showPrevious();
    }

    window.setTimeout(() => {
      didDragRef.current = false;
    }, 0);
  };

  const handlePointerCancel = () => {
    pointerStartXRef.current = null;
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
    }

    if (trackIndex === bannerPairs.length + 1) {
      setIsJumping(true);
      setTrackIndex(1);
    }
  };

  const trackStyle = {
    '--track-index': trackIndex,
  } as CSSProperties;

  return (
    <section className={styles.bannerSection} aria-label="메인 상품 배너">
      <div className={styles.bannerStage}>
        <div
          className={styles.bannerViewport}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          onClickCapture={handleBannerClickCapture}
        >
          <div
            className={`${styles.bannerTrack} ${isJumping ? styles.bannerTrackJumping : ''}`}
            style={trackStyle}
            onTransitionEnd={handleTrackTransitionEnd}
          >
            {carouselPairs.map((pair, index) => {
              const realIndex = (index - 1 + bannerPairs.length) % bannerPairs.length;
              const isActive = realIndex === activeIndex && index === trackIndex;
              const shouldRenderImages = Math.abs(index - trackIndex) <= 1;

              return (
                <article
                  key={`${pair.id}-${index}`}
                  className={`${styles.bannerPair} ${isActive ? styles.activePair : ''}`}
                  aria-hidden={!isActive}
                >
                  {[pair.left, pair.right].map((card) => (
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
                        priority={index === trackIndex}
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

        <button
          type="button"
          className={`${styles.navButton} ${styles.prevButton}`}
          aria-label="이전 배너"
          onClick={showPrevious}
        >
          <span aria-hidden="true">‹</span>
        </button>
        <button
          type="button"
          className={`${styles.navButton} ${styles.nextButton}`}
          aria-label="다음 배너"
          onClick={showNext}
        >
          <span aria-hidden="true">›</span>
        </button>

        <div className={styles.pagination} aria-label="배너 순서">
          {bannerPairs.map((pair, index) => (
            <button
              key={pair.id}
              type="button"
              className={`${styles.paginationDot} ${index === activeIndex ? styles.activeDot : ''}`}
              aria-label={`${index + 1}번 배너 보기`}
              aria-current={index === activeIndex}
              onClick={() => showSlide(index)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
