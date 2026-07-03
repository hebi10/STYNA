'use client';

import React, { useEffect } from 'react';
import styles from './SiteGuidePopup.module.css';
import Link from 'next/link';

interface SiteGuidePopupProps {
  isOpen: boolean;
  onClose: () => void;
}

const SiteGuidePopup: React.FC<SiteGuidePopupProps> = ({
  isOpen,
  onClose,
}) => {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={styles.popup}
        role="dialog"
        aria-modal="true"
        aria-labelledby="site-guide-title"
        onClick={(e) => e.stopPropagation()}
      >

        {/* 헤더 */}
        <div className={styles.header}>
          <div className={styles.logoSection}>
            <h2 id="site-guide-title">STYNA</h2>
            <span className={styles.subtitle}>쇼핑 안내</span>
          </div>
          <button className={styles.closeButton} onClick={onClose} aria-label="닫기">
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
              평일 오후 2시 이전 주문은 당일 출고되며, 5만원 이상 구매 시 무료배송입니다.
            </li>
            <li>
              <strong>교환/반품</strong>
              상품 수령 후 7일 이내 신청할 수 있고, 태그와 포장 상태가 유지되어야 합니다.
            </li>
            <li>
              <strong>쿠폰/혜택</strong>
              신규 회원 쿠폰, 생일 쿠폰, 구매 적립금은 마이페이지에서 확인할 수 있습니다.
            </li>
            <li>
              <strong>고객센터</strong>
              평일 10:00~18:00 운영하며 주문/상품 문의는 하단 바로가기를 이용해 주세요.
            </li>
          </ul>

          <p className={styles.notice}>
            운영시간 외 문의는 1:1 문의로 남겨주시면 순차적으로 확인합니다.
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
          <button className={styles.closeButtonSecondary} onClick={onClose}>
            닫기
          </button>
        </div>

      </div>
    </div>
  );
};

export default SiteGuidePopup;
