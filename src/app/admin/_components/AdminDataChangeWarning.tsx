'use client';

import { useCallback, useEffect, useRef } from 'react';
import styles from './AdminDataChangeWarning.module.css';

interface AdminDataChangeWarningProps {
  onClose: () => void;
}

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export default function AdminDataChangeWarning({ onClose }: AdminDataChangeWarningProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const confirmationButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const closeDialog = useCallback(() => {
    onClose();
  }, [onClose]);

  useEffect(() => {
    previousFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    confirmationButtonRef.current?.focus();

    return () => {
      if (previousFocusRef.current?.isConnected) {
        previousFocusRef.current.focus();
      }
      previousFocusRef.current = null;
    };
  }, []);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeDialog();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [closeDialog]);

  const handleTabKey = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab') return;

    const focusableElements = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? [],
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (!firstElement || !lastElement) {
      event.preventDefault();
      return;
    }

    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
    } else if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  };

  return (
    <div
      className={styles.overlay}
      data-testid="admin-data-warning-overlay"
      onClick={closeDialog}
    >
      <div
        ref={dialogRef}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-data-change-warning-title"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={handleTabKey}
      >
        <header className={styles.noticeBar}>
          <h2 id="admin-data-change-warning-title">데이터 수정 전 안내</h2>
        </header>

        <div className={styles.content}>
          <p>관리자 기능은 모두 정상적으로 사용할 수 있습니다.</p>
          <p>기존 데이터를 수정·삭제·추가하지 말아 주세요.</p>
          <span>변경 사항은 사이트 화면과 통계에 반영될 수 있습니다.</span>
        </div>

        <div className={styles.actions}>
          <button
            ref={confirmationButtonRef}
            type="button"
            className={styles.confirmButton}
            onClick={closeDialog}
          >
            확인했습니다
          </button>
        </div>
      </div>
    </div>
  );
}
