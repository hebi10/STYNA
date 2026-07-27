'use client';

import { useEffect, useState } from 'react';
import EventNavigation from '@/app/admin/events/_components/EventNavigation';
import EventForm from '@/app/admin/events/_components/EventForm';
import { EventService } from '@/shared/services/eventService';
import type { Event } from '@/shared/types/event';
import styles from './page.module.css';

interface EditEventLoaderProps {
  eventId: string;
}

export default function EditEventLoader({ eventId }: EditEventLoaderProps) {
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    const loadEvent = async () => {
      setLoading(true);
      setError(null);

      try {
        const nextEvent = await EventService.getAdminEventById(eventId);
        if (isActive) {
          setEvent(nextEvent);
        }
      } catch (loadError) {
        console.error('Error loading admin event:', loadError);
        if (isActive) {
          setEvent(null);
          setError('이벤트 정보를 불러오지 못했습니다.');
        }
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    };

    void loadEvent();

    return () => {
      isActive = false;
    };
  }, [eventId]);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>이벤트 수정</h1>
        <p className={styles.description}>이벤트 정보를 수정할 수 있습니다.</p>
      </div>

      <EventNavigation />

      <div className={styles.content}>
        {loading && <p role="status">이벤트 정보를 불러오는 중입니다.</p>}
        {!loading && error && <p role="alert">{error}</p>}
        {!loading && !error && !event && <p>이벤트를 찾을 수 없습니다.</p>}
        {!loading && !error && event && <EventForm event={event} isEdit />}
      </div>
    </div>
  );
}
