'use client';

import Link from 'next/link';
import Button from '@/app/_components/Button';
import { getEventUiMeta } from '@/shared/constants/eventUiMeta';
import { getEventDisplayImages } from '@/shared/utils/eventImages';
import styles from './EventList.module.css';
import { useEvent } from '@/context/eventProvider';
import EventResponsiveImage from './EventResponsiveImage';
import { isPublicEventReady } from '@/shared/utils/eventPublicPolicy';

const FILTER_OPTIONS = [
  { type: 'all', label: '전체' },
  { type: 'sale', label: '세일' },
  { type: 'coupon', label: '쿠폰' },
  { type: 'special', label: '특별 이벤트' },
  { type: 'new', label: '신상품' },
] as const;

type EventFilterButton = (typeof FILTER_OPTIONS)[number]['type'];

const formatDate = (date: Date) =>
  date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

function EventListHeading() {
  return (
    <header className={styles.pageHeader}>
      <h1 className={styles.pageTitle}>이벤트</h1>
      <p className={styles.pageDescription}>검증이 완료된 이벤트와 이용 조건을 확인하세요.</p>
    </header>
  );
}

export default function EventList() {
  const {
    events,
    filteredEvents,
    filter,
    currentPage,
    eventsPerPage,
    loading,
    error,
    setFilter,
    setCurrentPage,
    refreshEvents,
  } = useEvent();

  const activeFilterType: EventFilterButton = filter.eventType ?? 'all';
  const publicEvents = filteredEvents.filter(isPublicEventReady);
  const totalPages = Math.max(1, Math.ceil(publicEvents.length / eventsPerPage));
  const startIndex = (currentPage - 1) * eventsPerPage;
  const endIndex = startIndex + eventsPerPage;
  const displayedEvents = publicEvents.slice(startIndex, endIndex);

  const handleFilterChange = (type: EventFilterButton) => {
    setFilter(type === 'all' ? {} : { eventType: type });
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <EventListHeading />
        <div className={`${styles.statePanel} ${styles.loadingState}`} role="status" aria-live="polite">
          <span>이벤트를 불러오는 중입니다.</span>
          <p className={styles.stateTitle}>이벤트를 불러오는 중입니다.</p>
          <p className={styles.stateDescription}>
            최신 이벤트 정보와 배너를 준비하고 있습니다.
          </p>
          <div className={styles.loadingEventGrid}>
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className={styles.loadingEventCard} aria-label="이벤트 로딩 카드">
                <span className={styles.loadingEventImage} />
                <span className={styles.loadingEventLine} />
                <span className={styles.loadingEventLineShort} />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <EventListHeading />
        <div className={`${styles.statePanel} ${styles.errorState}`}>
          <p className={styles.stateTitle}>이벤트 정보를 불러오지 못했습니다.</p>
          <p className={styles.stateDescription}>{error}</p>
          <Button variant="outline" onClick={refreshEvents}>
            다시 시도
          </Button>
        </div>
      </div>
    );
  }

  const emptyStateMessage =
    events.length === 0
      ? '진행 중인 이벤트가 없습니다.'
      : activeFilterType === 'all'
      ? '현재 노출할 이벤트가 없습니다.'
      : `"${FILTER_OPTIONS.find(option => option.type === activeFilterType)?.label}" 조건에 맞는 이벤트가 없습니다.`;
  const showEmptyState = publicEvents.length === 0;

  return (
    <div className={styles.container}>
      <EventListHeading />
      <section className={styles.bannerSection} aria-label="이벤트 안내">
        <div className={styles.posterHero}>
          <EventResponsiveImage
            desktopSrc="/events/event-hub-hero.webp"
            mobileSrc="/events/event-hub-hero.webp"
            alt="STYNA EVENTS - 새로운 스타일과 혜택을 만나보세요"
            width={2700}
            height={900}
            className={styles.posterHeroImage}
            priority
          />
        </div>
      </section>

      <div className={styles.eventToolbar}>
        <div className={styles.filters} aria-label="이벤트 유형 필터">
          {FILTER_OPTIONS.map(option => (
            <button
              type="button"
              key={option.type}
              className={`${styles.filterButton} ${activeFilterType === option.type ? styles.active : ''}`}
              aria-pressed={activeFilterType === option.type}
              onClick={() => handleFilterChange(option.type)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <p className={styles.eventCount}>{publicEvents.length.toLocaleString()}개 이벤트</p>
      </div>

      {showEmptyState ? (
        <div className={`${styles.statePanel} ${styles.emptyState}`}>
          <p className={styles.stateTitle}>{emptyStateMessage}</p>
          <p className={styles.stateDescription}>
            {events.length === 0
              ? '등록된 이벤트가 아직 없어 준비되는 대로 바로 노출됩니다.'
              : '다른 필터를 선택하면 현재 노출 가능한 이벤트를 다시 확인할 수 있습니다.'}
          </p>
        </div>
      ) : (
        <>
          <div className={styles.eventGrid}>
            {displayedEvents.map(event => {
              const uiMeta = getEventUiMeta(event);
              const displayImages = getEventDisplayImages(event);

              return (
                <Link
                  key={event.id}
                  href={`/events/${event.id}`}
                  className={styles.eventPosterCard}
                  aria-label={`${event.title}: ${event.description}`}
                >
                  <div className={styles.posterCardMedia}>
                    <EventResponsiveImage
                      desktopSrc={displayImages.thumbnailImage}
                      mobileSrc={displayImages.thumbnailImage}
                      alt={event.title}
                      width={1000}
                      height={1250}
                      className={styles.posterCardImage}
                    />
                  </div>
                  <div className={styles.eventFooter}>
                    <div className={styles.eventCopy}>
                      <h2 className={styles.eventTitle}>{event.title}</h2>
                      <p className={styles.eventDescription}>{event.description}</p>
                    </div>
                    <div className={styles.eventMeta}>
                      <span className={styles.eventPeriod}>
                        {formatDate(event.startDate)} - {formatDate(event.endDate)}
                      </span>
                      <span className={styles.cardCta}>{uiMeta.cardCtaLabel}</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className={styles.pagination}>
              <button
                type="button"
                className={styles.pageButton}
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
              >
                이전
              </button>

              {Array.from({ length: totalPages }, (_, index) => index + 1).map(page => (
                <button
                  type="button"
                  key={page}
                  className={`${styles.pageButton} ${currentPage === page ? styles.active : ''}`}
                  aria-current={currentPage === page ? 'page' : undefined}
                  onClick={() => setCurrentPage(page)}
                >
                  {page}
                </button>
              ))}

              <button
                type="button"
                className={styles.pageButton}
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
              >
                다음
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
