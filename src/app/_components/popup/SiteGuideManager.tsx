'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import SiteGuidePopup from './SiteGuidePopup';
import styles from './SiteGuideManager.module.css';
import {
  OPEN_SITE_GUIDE_EVENT,
  type SiteGuideEventDetail,
  type SiteGuideMode,
} from '@/shared/utils/siteGuide';
import { getFloatingUiPolicy } from '@/shared/utils/floatingUi';

const SiteGuideManager: React.FC = () => {
  const pathname = usePathname();
  const floatingUiPolicy = getFloatingUiPolicy(pathname);
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [guideMode, setGuideMode] = useState<SiteGuideMode>('shopping');
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (floatingUiPolicy.hideGuide) {
      setIsPopupOpen(false);
      return;
    }

    const handleSharedGuideOpen = (event: Event) => {
      const customEvent = event as CustomEvent<SiteGuideEventDetail>;
      setGuideMode(customEvent.detail?.mode === 'portfolio' ? 'portfolio' : 'shopping');
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
    setGuideMode('shopping');
    setIsPopupOpen(true);
  };

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
        <Image
          className={styles.buttonIcon}
          src="/icons/shopping-guide-icon.png"
          alt=""
          width={24}
          height={24}
          unoptimized
        />
      </button>

      <SiteGuidePopup
        isOpen={isPopupOpen}
        onClose={handleClosePopup}
        mode={guideMode}
      />
    </div>
  );
};

export default SiteGuideManager;
