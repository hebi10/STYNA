'use client';

import React, { useCallback, useEffect, useRef } from 'react';
import styles from './SiteGuidePopup.module.css';
import Link from 'next/link';
import {
  buildDemoDataNotice,
  formatShippingPolicy,
  formatSignupBenefit,
  formatSupportHours,
} from '@/shared/constants/commercePolicy';

interface SiteGuidePopupProps {
  isOpen: boolean;
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

const SiteGuidePopup: React.FC<SiteGuidePopupProps> = ({
  isOpen,
  onClose,
}) => {
  const popupRef = useRef<HTMLDivElement>(null);
  const initialFocusRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const closeDialog = useCallback(() => {
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;

    previousFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    initialFocusRef.current?.focus();

    return () => {
      const previousFocus = previousFocusRef.current;
      if (previousFocus?.isConnected) {
        previousFocus.focus();
      }
      previousFocusRef.current = null;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeDialog();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [closeDialog, isOpen]);

  const handleTabKey = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab') return;

    const focusableElements = Array.from(
      popupRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? [],
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
      return;
    }

    if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={closeDialog}>
      <div
        ref={popupRef}
        className={styles.popup}
        role="dialog"
        aria-modal="true"
        aria-labelledby="site-guide-title"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleTabKey}
      >

        {/* 헤더 */}
        <div className={styles.header}>
          <div className={styles.logoSection}>
            <h2 id="site-guide-title">
              <span>STYNA</span>
              <span className={styles.subtitle}>쇼핑 안내</span>
            </h2>
          </div>
          <button
            ref={initialFocusRef}
            className={styles.closeButton}
            onClick={closeDialog}
            aria-label="닫기"
          >
            ×
          </button>
        </div>

        {/* 메인 컨텐츠 */}
        <div className={styles.content}>
          <p className={styles.intro}>
            주문 전후에 자주 확인하는 쇼핑 정보를 모았습니다.
          </p>

          <ul className={styles.guideList}>
            <li>
              <strong>배송</strong>
              {formatShippingPolicy()}
            </li>
            <li>
              <strong>회원 혜택</strong>
              {formatSignupBenefit()}
            </li>
            <li>
              <strong>데모 안내</strong>
              {buildDemoDataNotice()}
            </li>
            <li>
              <strong>포트폴리오 문의 안내</strong>
              {formatSupportHours()}은 화면 구성용 참고 시간이며, 문의 기록은 하단 바로가기에서 확인할 수 있습니다.
            </li>
          </ul>

          <p className={styles.notice}>
            1:1 문의 기록은 저장되지만 답변 여부와 시점은 보장하지 않습니다.
          </p>
        </div>

        {/* 쇼핑 바로가기 */}
        <div className={styles.linkSection}>
          <Link
            href="/orders/delivery"
            className={styles.linkButton}
          >
            배송조회
          </Link>
          <Link
            href="/cs/inquiry"
            className={styles.linkButtonPrimary}
          >
            1:1 문의
          </Link>
        </div>

        {/* 하단 */}
        <div className={styles.footer}>
          <button className={styles.closeButtonSecondary} onClick={closeDialog}>
            닫기
          </button>
        </div>

      </div>
    </div>
  );
};

export default SiteGuidePopup;
