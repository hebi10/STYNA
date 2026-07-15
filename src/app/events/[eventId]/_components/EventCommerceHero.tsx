import EventResponsiveImage from '../../_components/EventResponsiveImage';
import { Event } from '@/shared/types/event';
import styles from './EventCommerceBlocks.module.css';

interface EventCommerceHeroProps {
  event: Event;
  desktopImage: string;
  mobileImage: string;
  statusLabel: string;
  periodLabel: string;
}

const formatParticipantCount = (count: number) => count.toLocaleString('ko-KR');

export default function EventCommerceHero({
  event,
  desktopImage,
  mobileImage,
  statusLabel,
  periodLabel,
}: EventCommerceHeroProps) {
  const hasCapacity = Boolean(
    event.hasMaxParticipants
    && event.maxParticipants
    && event.maxParticipants > 0
  );

  return (
    <section className={styles.hero}>
      <EventResponsiveImage
        desktopSrc={desktopImage}
        mobileSrc={mobileImage}
        alt={event.title}
        width={1600}
        height={820}
        className={styles.campaignImage}
        priority
      />
      <div className={styles.heroSummary}>
        <span className={styles.statusBadge}>{statusLabel}</span>
        <h1 className={styles.heroTitle}>{event.title}</h1>
        <p className={styles.heroDescription}>{event.description}</p>
        <p className={styles.heroPeriod}>{periodLabel}</p>
        {hasCapacity && (
          <p className={styles.capacity}>
            {formatParticipantCount(event.participantCount)} / {formatParticipantCount(event.maxParticipants!)}명
          </p>
        )}
      </div>
    </section>
  );
}
