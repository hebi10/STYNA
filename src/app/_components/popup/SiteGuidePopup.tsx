'use client';

import React from 'react';
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

const SiteGuidePopup: React.FC<SiteGuidePopupProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.popup} onClick={(e) => e.stopPropagation()}>

        {/* 헤더 */}
        <div className={styles.header}>
          <div className={styles.logoSection}>
            <h2>STYNA</h2>
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
              <strong>고객센터</strong>
              {formatSupportHours()} 운영하며 주문/상품 문의는 하단 바로가기를 이용해 주세요.
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
