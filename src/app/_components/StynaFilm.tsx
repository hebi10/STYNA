'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import styles from './StynaFilm.module.css';

const STORAGE_BUCKET = 'hebimall.firebasestorage.app';
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
type VideoSlot = 0 | 1;

const storageUrl = (path: string) =>
  `https://firebasestorage.googleapis.com/v0/b/${STORAGE_BUCKET}/o/${encodeURIComponent(path)}?alt=media`;

export const STYNA_FILM_CHAPTERS = [
  {
    id: 'cool-touch-oversized-shirt',
    name: '쿨터치 오버핏 반팔 셔츠',
    brand: 'STYNA',
    href: '/products/cool-touch-oversized-shirt',
    videoSrc: '/videos/styna-film/cool-touch-oversized-shirt.mp4',
    posterSrc: storageUrl('images/main-banner/cool-touch-oversized-shirt/banner.webp'),
    line: 'Cool air, easy shape.',
  },
  {
    id: 'mesh-low-profile-sneakers',
    name: '메쉬 로우프로파일 스니커즈',
    brand: 'STYNA',
    href: '/products/mesh-low-profile-sneakers',
    videoSrc: '/videos/styna-film/mesh-low-profile-sneakers.mp4',
    posterSrc: storageUrl('images/main-banner/mesh-low-profile-sneakers/banner.webp'),
    line: 'A lighter step, all day.',
  },
  {
    id: 'utility-big-tote-bag',
    name: '유틸리티 빅 토트백',
    brand: 'STYNA',
    href: '/products/utility-big-tote-bag',
    videoSrc: '/videos/styna-film/utility-big-tote-bag.mp4',
    posterSrc: storageUrl('images/main-banner/utility-big-tote-bag/banner.webp'),
    line: 'Carry the day with room to move.',
  },
  {
    id: 'light-zip-up-jacket',
    name: '라이트 집업 재킷',
    brand: 'STYNA',
    href: '/products/light-zip-up-jacket',
    videoSrc: '/videos/styna-film/light-zip-up-jacket.mp4',
    posterSrc: storageUrl('images/main-banner/light-zip-up-jacket/banner.webp'),
    line: 'An easy layer for what comes next.',
  },
] as const;

export default function StynaFilm() {
  const sectionRef = useRef<HTMLElement>(null);
  const videoRefs = useRef<Array<HTMLVideoElement | null>>([null, null]);
  const activeSlotRef = useRef<VideoSlot>(0);
  const [chapterIndex, setChapterIndex] = useState(0);
  const [activeSlot, setActiveSlot] = useState<VideoSlot>(0);
  const [slotChapters, setSlotChapters] = useState<[number, number | null]>([0, null]);
  const [loadingSlot, setLoadingSlot] = useState<VideoSlot | null>(null);
  const [isInView, setIsInView] = useState(false);
  const [hasCompleted, setHasCompleted] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const chapter = STYNA_FILM_CHAPTERS[chapterIndex];
  const activeChapterIndex = slotChapters[activeSlot] ?? 0;
  const activeChapter = STYNA_FILM_CHAPTERS[activeChapterIndex];

  const resetFilm = () => {
    videoRefs.current.forEach((video) => {
      video?.pause();
      if (video) {
        video.currentTime = 0;
      }
    });
    setChapterIndex(0);
    setActiveSlot(0);
    setSlotChapters([0, null]);
    setLoadingSlot(null);
    setHasCompleted(false);
  };

  useEffect(() => {
    activeSlotRef.current = activeSlot;
  }, [activeSlot]);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') {
      return undefined;
    }

    const mediaQuery = window.matchMedia(REDUCED_MOTION_QUERY);
    const updatePreference = (matches: boolean) => setPrefersReducedMotion(matches);
    const handleChange = (event: MediaQueryListEvent) => updatePreference(event.matches);

    updatePreference(mediaQuery.matches);
    mediaQuery.addEventListener?.('change', handleChange);
    return () => mediaQuery.removeEventListener?.('change', handleChange);
  }, []);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section || typeof IntersectionObserver === 'undefined') {
      return undefined;
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) {
        resetFilm();
        setIsInView(true);
        return;
      }

      setIsInView(false);
      resetFilm();
    }, { threshold: 0 });

    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isInView || hasCompleted || prefersReducedMotion) {
      return;
    }

    void videoRefs.current[activeSlotRef.current]?.play().catch(() => undefined);
  }, [hasCompleted, isInView, prefersReducedMotion]);

  const queueChapter = (nextChapterIndex: number) => {
    if (nextChapterIndex === activeChapterIndex) {
      const activeVideo = videoRefs.current[activeSlot];
      if (activeVideo) {
        activeVideo.currentTime = 0;
        void activeVideo.play().catch(() => undefined);
      }
      setChapterIndex(nextChapterIndex);
      setHasCompleted(false);
      return;
    }

    const nextSlot: VideoSlot = activeSlot === 0 ? 1 : 0;
    setChapterIndex(nextChapterIndex);
    setSlotChapters((currentSlots) => {
      const updatedSlots: [number, number | null] = [...currentSlots];
      updatedSlots[nextSlot] = nextChapterIndex;
      return updatedSlots;
    });
    setLoadingSlot(nextSlot);
    setHasCompleted(false);
  };

  const showNextChapter = (currentChapterIndex: number) => {
    if (currentChapterIndex === STYNA_FILM_CHAPTERS.length - 1) {
      setHasCompleted(true);
      return;
    }

    queueChapter(currentChapterIndex + 1);
  };

  const selectChapter = (index: number) => {
    queueChapter(index);
  };

  const handleBufferedVideoCanPlay = (slot: VideoSlot) => {
    if (slot !== loadingSlot || !isInView || prefersReducedMotion) {
      return;
    }

    void videoRefs.current[slot]?.play().catch(() => undefined);
  };

  const handleBufferedVideoPlaying = (slot: VideoSlot) => {
    if (slot !== loadingSlot) {
      return;
    }

    setActiveSlot(slot);
    setLoadingSlot(null);
  };

  const handleBufferedVideoError = (slot: VideoSlot) => {
    if (slot !== loadingSlot) {
      return;
    }

    const failedChapterIndex = slotChapters[slot];
    if (failedChapterIndex === null || failedChapterIndex === STYNA_FILM_CHAPTERS.length - 1) {
      setLoadingSlot(null);
      setHasCompleted(true);
      return;
    }

    queueChapter(failedChapterIndex + 1);
  };

  return (
    <section ref={sectionRef} className={styles.section} aria-labelledby="styna-film-title">
      <div className={styles.container}>
        <header className={styles.header}>
          <span className={styles.eyebrow}>STYNA FILM</span>
          <div className={styles.headingRow}>
            <h2 id="styna-film-title" className={styles.title}>THE EVERYDAY MOTION</h2>
            <div className={styles.headerActions}>
              <span className={styles.chapterCount} aria-label={`현재 ${chapterIndex + 1}번째 영상, 총 4개`}>
                {String(chapterIndex + 1).padStart(2, '0')} — {String(STYNA_FILM_CHAPTERS.length).padStart(2, '0')}
              </span>
              <Link href={chapter.href} className={styles.productAction} aria-label={`${chapter.name} 상품 보러가기`}>
                상품 보러가기
              </Link>
            </div>
          </div>
          <p className={styles.description}>일상에 자연스럽게 스며드는 네 가지 움직임을 담았습니다.</p>
        </header>

        <div className={styles.videoFrame}>
          {slotChapters.map((slotChapterIndex, slot) => {
            if (slotChapterIndex === null) {
              return null;
            }

            const slotNumber = slot as VideoSlot;
            const slotChapter = STYNA_FILM_CHAPTERS[slotChapterIndex];
            const isActiveSlot = slotNumber === activeSlot;
            const isLoadingSlot = slotNumber === loadingSlot;

            return (
              <video
                key={slotNumber}
                ref={(video) => {
                  videoRefs.current[slotNumber] = video;
                }}
                data-testid={isActiveSlot ? 'styna-film-video' : isLoadingSlot ? 'styna-film-next-video' : undefined}
                className={`${styles.video} ${isActiveSlot ? styles.activeVideo : styles.bufferedVideo}`}
                src={slotChapter.videoSrc}
                poster={slotChapter.posterSrc}
                muted
                playsInline
                preload={isActiveSlot ? 'metadata' : 'auto'}
                onCanPlay={isLoadingSlot ? () => handleBufferedVideoCanPlay(slotNumber) : undefined}
                onPlaying={isLoadingSlot ? () => handleBufferedVideoPlaying(slotNumber) : undefined}
                onEnded={isActiveSlot ? () => showNextChapter(slotChapterIndex) : undefined}
                onError={isActiveSlot ? () => showNextChapter(slotChapterIndex) : () => handleBufferedVideoError(slotNumber)}
                aria-label={`${slotChapter.name} 영상`}
              />
            );
          })}
          <div className={styles.videoCaption} aria-hidden="true">
            <strong>{activeChapter.line}</strong>
            <span>{activeChapter.name}</span>
          </div>
        </div>

        <nav className={styles.productStrip} aria-label="STYNA FILM 상품">
          {STYNA_FILM_CHAPTERS.map((item, index) => (
            <button
              key={item.id}
              type="button"
              className={`${styles.productButton} ${index === chapterIndex ? styles.activeProduct : ''}`}
              aria-label={`${item.name} 영상 선택`}
              aria-pressed={index === chapterIndex}
              onClick={() => selectChapter(index)}
            >
              <span className={styles.thumbnail}>
                <Image src={item.posterSrc} alt="" fill sizes="56px" className={styles.thumbnailImage} />
              </span>
              <span className={styles.productCopy}>
                <span className={styles.productNumber}>{String(index + 1).padStart(2, '0')}</span>
                <span className={styles.productBrand}>{item.brand}</span>
                <strong className={styles.productName}>{item.name}</strong>
              </span>
            </button>
          ))}
        </nav>
      </div>
    </section>
  );
}
