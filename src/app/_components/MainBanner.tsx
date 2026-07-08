'use client';

import { useEffect, useState } from 'react';
import type { CSSProperties, TransitionEvent } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import styles from './MainBanner.module.css';

const SLIDE_DELAY_MS = 4500;

type BannerCard = {
  id: string;
  href: string;
  image: string;
  alt: string;
};

type BannerPair = {
  id: string;
  product: BannerCard;
  event: BannerCard;
};

const bannerPairs: BannerPair[] = [
  {
    id: 'cool-touch-midyear-sale',
    product: {
      id: 'product-cool-touch-daily',
      href: '/categories/tops',
      image: '/main/top_banner_01_product_cool_touch.webp',
      alt: '쿨터치 티셔츠 셋업 상품 배너',
    },
    event: {
      id: 'event-midyear-sale',
      href: '/events/event-2026-06-midyear-sale',
      image: '/main/top_banner_01_event_midyear_sale.webp',
      alt: '상반기 결산 최대 60% 이벤트 배너',
    },
  },
  {
    id: 'vacation-linen-coupon',
    product: {
      id: 'product-vacation-linen',
      href: '/categories/tops',
      image: '/main/top_banner_02_product_vacation_linen.webp',
      alt: '린넨 셔츠와 쇼츠 상품 배너',
    },
    event: {
      id: 'event-vacation-coupon',
      href: '/events/event-2026-07-vacation-coupon',
      image: '/main/top_banner_02_event_vacation_coupon.webp',
      alt: '휴가룩 쿠폰팩 3종 이벤트 배너',
    },
  },
  {
    id: 'daily-sneakers-photo-review',
    product: {
      id: 'product-daily-sneakers',
      href: '/categories/shoes',
      image: '/main/top_banner_03_product_daily_sneakers.webp',
      alt: '클래식 캔버스 슈즈 상품 배너',
    },
    event: {
      id: 'event-photo-review',
      href: '/events/event-2026-07-summer-review',
      image: '/main/top_banner_03_event_photo_review.webp',
      alt: '리뷰 작성 시 적립금 이벤트 배너',
    },
  },
  {
    id: 'office-bag-cool-touch-week',
    product: {
      id: 'product-office-bag',
      href: '/categories/bags',
      image: '/main/top_banner_04_product_office_bag.webp',
      alt: '오피스 레더 토트 상품 배너',
    },
    event: {
      id: 'event-cool-touch-week',
      href: '/events/event-2026-07-cool-touch',
      image: '/main/top_banner_04_event_cool_touch.webp',
      alt: '쿨터치 최대 35% 이벤트 배너',
    },
  },
  {
    id: 'prefall-layer-open',
    product: {
      id: 'product-prefall-layer',
      href: '/categories/tops',
      image: '/main/top_banner_05_product_prefall_layer.webp',
      alt: '가디건 레이어드 셋업 상품 배너',
    },
    event: {
      id: 'event-prefall-open',
      href: '/events/event-2026-08-pre-fall',
      image: '/main/top_banner_05_event_prefall_open.webp',
      alt: '프리폴 선공개 이벤트 배너',
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

  useEffect(() => {
    const timer = window.setInterval(() => {
      const nextIndex = (activeIndex + 1) % bannerPairs.length;

      setActiveIndex(nextIndex);
      setTrackIndex(nextIndex === 0 ? bannerPairs.length + 1 : nextIndex + 1);
    }, SLIDE_DELAY_MS);

    return () => window.clearInterval(timer);
  }, [activeIndex, rotationKey]);

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
    <section className={styles.bannerSection} aria-label="메인 상품 및 이벤트 배너">
      <div className={styles.bannerStage}>
        <div className={styles.bannerViewport}>
          <div
            className={`${styles.bannerTrack} ${isJumping ? styles.bannerTrackJumping : ''}`}
            style={trackStyle}
            onTransitionEnd={handleTrackTransitionEnd}
          >
            {carouselPairs.map((pair, index) => {
              const realIndex = (index - 1 + bannerPairs.length) % bannerPairs.length;
              const isActive = realIndex === activeIndex && index === trackIndex;

              return (
                <article
                  key={`${pair.id}-${index}`}
                  className={`${styles.bannerPair} ${isActive ? styles.activePair : ''}`}
                  aria-hidden={!isActive}
                >
                  {[pair.product, pair.event].map((card, cardIndex) => (
                    <Link
                      key={card.id}
                      href={card.href}
                      className={styles.bannerCard}
                      aria-label={card.alt}
                      tabIndex={isActive ? 0 : -1}
                    >
                      <Image
                        src={card.image}
                        alt={card.alt}
                        fill
                        priority={index === 1 && cardIndex === 0}
                        sizes="(min-width: 1920px) 826px, 43vw"
                        className={styles.bannerImage}
                      />
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
          ‹
        </button>
        <button
          type="button"
          className={`${styles.navButton} ${styles.nextButton}`}
          aria-label="다음 배너"
          onClick={showNext}
        >
          ›
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
