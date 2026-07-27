'use client';

import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import SiteGuidePopup from './SiteGuidePopup';
import styles from './SiteGuideManager.module.css';
import { OPEN_SITE_GUIDE_EVENT } from '@/shared/utils/siteGuide';
import { getFloatingUiPolicy } from '@/shared/utils/floatingUi';

const SiteGuideManager: React.FC = () => {
  const pathname = usePathname();
  const floatingUiPolicy = getFloatingUiPolicy(pathname);
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [isClient, setIsClient] = useState(false);

  // 클라이언트 사이드에서만 실행
  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (floatingUiPolicy.hideGuide) {
      setIsPopupOpen(false);
      return;
    }

    const handleSharedGuideOpen = () => {
      setIsPopupOpen(true);
    };

    window.addEventListener(OPEN_SITE_GUIDE_EVENT, handleSharedGuideOpen);

    return () => {
      window.removeEventListener(OPEN_SITE_GUIDE_EVENT, handleSharedGuideOpen);
    };
  }, [floatingUiPolicy.hideGuide]);

  const handleClosePopup = () => {
    setIsPopupOpen(false);
  };

  const handleOpenPopup = () => {
    setIsPopupOpen(true);
  };

  // 서버 사이드 렌더링에서는 아무것도 렌더링하지 않음
  if (!isClient) {
    return null;
  }

  if (floatingUiPolicy.hideGuide) {
    return null;
  }

  return (
    <div
      className={floatingUiPolicy.suppressGuideOnMobile ? styles.mobileSuppressed : undefined}
      data-testid="site-guide-manager"
    >
      <button
        className={styles.fixedButton}
        onClick={handleOpenPopup}
        aria-label="쇼핑 안내 열기"
        title="쇼핑 안내"
      >
        <span className={styles.buttonText}>쇼핑 안내</span>
      </button>

      {/* 팝업 */}
      <SiteGuidePopup
        isOpen={isPopupOpen}
        onClose={handleClosePopup}
      />
    </div>
  );
};

export default SiteGuideManager;
