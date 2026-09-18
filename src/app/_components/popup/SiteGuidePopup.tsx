'use client';

import React, { useCallback, useEffect, useRef } from 'react';
import Link from 'next/link';
import styles from './SiteGuidePopup.module.css';
import {
  formatShippingPolicy,
  formatSignupBenefit,
} from '@/shared/constants/commercePolicy';
import type { SiteGuideMode } from '@/shared/utils/siteGuide';

interface SiteGuidePopupProps {
  isOpen: boolean;
  onClose: () => void;
  mode?: SiteGuideMode;
}

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

const PORTFOLIO_STEPS = [
  ['01', '홈과 스타일', '홈 구성과 STYLE NOW, 상품 섹션의 화면 흐름을 확인합니다.'],
  ['02', '상품 탐색', '상품 목록과 상세에서 옵션 선택, 장바구니 진입을 확인합니다.'],
  ['03', '일반 사용자 체험', '별도 계정 입력 없이 일반 사용자 체험으로 로그인합니다.'],
  ['04', '구매 흐름', '장바구니 → 체크아웃 → 주문내역 순서로 데모 주문 흐름을 확인합니다.'],
  ['05', '관리자 페이지 체험', '조회 전용 관리자 체험으로 운영 화면에 진입합니다.'],
  ['06', '운영 구조', '대시보드 → 상품 → 주문 → 이벤트 → 쿠폰 순서로 살펴봅니다.'],
] as const;

const SiteGuidePopup: React.FC<SiteGuidePopupProps> = ({
  isOpen,
  onClose,
  mode = 'shopping',
}) => {
  const popupRef = useRef<HTMLDivElement>(null);
  const initialFocusRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const isPortfolioGuide = mode === 'portfolio';

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
        className={isPortfolioGuide ? styles.popup + ' ' + styles.portfolioPopup : styles.popup}
        role="dialog"
        aria-modal="true"
        aria-labelledby="site-guide-title"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleTabKey}
      >
        <div className={styles.header}>
          <div className={styles.logoSection}>
            <h2 id="site-guide-title">
              <span>STYNA</span>
              <span className={styles.subtitle}>
                {isPortfolioGuide ? '포트폴리오 체험 가이드' : '쇼핑 안내'}
              </span>
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

        {isPortfolioGuide ? (
          <>
            <div className={styles.content}>
              <p className={styles.intro}>
                5~10분이면 사용자 쇼핑 흐름과 관리자 운영 구조를 핵심 순서대로 확인할 수 있습니다.
              </p>
              <p className={styles.portfolioNotice}>
                실제 결제는 진행되지 않으며 관리자 체험은 조회 전용입니다.
              </p>

              <ol className={styles.tourList} aria-label="추천 체험 순서">
                {PORTFOLIO_STEPS.map(([index, title, description]) => (
                  <li key={index}>
                    <span className={styles.stepIndex}>{index}</span>
                    <div>
                      <strong>{title}</strong>
                      <p>{description}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            <div className={styles.portfolioLinks}>
              <Link href="/products" className={styles.linkButton}>
                상품부터 보기
              </Link>
              <Link
                href="/auth/login?redirect=/orders/cart#portfolio-demo-login"
                className={styles.linkButton}
              >
                일반 사용자 체험
              </Link>
              <Link
                href="/auth/login#portfolio-demo-login"
                className={styles.linkButtonPrimary}
              >
                관리자 페이지 체험
              </Link>
            </div>
          </>
        ) : (
          <>
            <div className={styles.content}>
              <p className={styles.intro}>
                배송과 회원 혜택을 빠르게 확인하세요.
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
              </ul>
            </div>

            <div className={styles.linkSection}>
              <Link href="/orders/delivery" className={styles.linkButton}>
                배송조회
              </Link>
              <Link href="/cs/inquiry" className={styles.linkButtonPrimary}>
                1:1 문의
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default SiteGuidePopup;
