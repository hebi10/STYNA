'use client';

import { useEffect, useRef, useState } from 'react';
import {
  FEEDBACK_EVENT_NAME,
  FeedbackMessage,
} from '@/shared/utils/feedback';
import styles from './FeedbackRegion.module.css';

interface VisibleFeedback extends FeedbackMessage {
  id: number;
}

export default function FeedbackRegion() {
  const [feedback, setFeedback] = useState<VisibleFeedback | null>(null);
  const nextId = useRef(0);

  useEffect(() => {
    const handleFeedback = (event: Event) => {
      const customEvent = event as CustomEvent<FeedbackMessage>;
      const detail = customEvent.detail;
      if (!detail?.message) {
        return;
      }

      nextId.current += 1;
      setFeedback({ ...detail, id: nextId.current });
    };

    window.addEventListener(FEEDBACK_EVENT_NAME, handleFeedback);
    return () => window.removeEventListener(FEEDBACK_EVENT_NAME, handleFeedback);
  }, []);

  useEffect(() => {
    if (!feedback) {
      return;
    }

    const timeoutId = window.setTimeout(
      () => setFeedback((current) => current?.id === feedback.id ? null : current),
      feedback.duration ?? 4000,
    );

    return () => window.clearTimeout(timeoutId);
  }, [feedback]);

  if (!feedback) {
    return null;
  }

  const isError = feedback.tone === 'error';

  return (
    <div className={styles.region} aria-live={isError ? undefined : 'polite'} aria-atomic="true">
      <div
        className={`${styles.message} ${isError ? styles.error : ''}`}
        role={isError ? 'alert' : 'status'}
      >
        <span>{feedback.message}</span>
        <button
          type="button"
          className={styles.closeButton}
          onClick={() => setFeedback(null)}
          aria-label="알림 닫기"
        >
          ×
        </button>
      </div>
    </div>
  );
}
