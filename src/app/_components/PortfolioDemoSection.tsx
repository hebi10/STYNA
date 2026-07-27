'use client';

import { SITE_INFO } from '@/shared/constants/siteInfo';
import {
  buildDemoDataNotice,
  formatSignupBenefit,
} from '@/shared/constants/commercePolicy';
import { openSiteGuide } from '@/shared/utils/siteGuide';
import styles from './PortfolioDemoSection.module.css';

export default function PortfolioDemoSection() {
  return (
    <section className={styles.section} aria-labelledby="portfolio-demo-title">
      <div className={styles.content}>
        <p className={styles.eyebrow}>PORTFOLIO DEMO</p>
        <h2 id="portfolio-demo-title" className={styles.title}>
          포트폴리오 데모 안내
        </h2>
        <p className={styles.notice}>{SITE_INFO.demoNotice}</p>
        <p className={styles.notice}>{buildDemoDataNotice()}</p>
        <p className={styles.benefit}>{formatSignupBenefit()}</p>
        <div className={styles.scope}>
          <p>
            일반 회원 화면에서는 쇼핑과 주문 흐름을 확인할 수 있으며, 관리자
            화면에서는 상품, 이벤트, 쿠폰 관리 화면을 확인할 수 있습니다.
          </p>
        </div>
        <button
          type="button"
          className={styles.guideButton}
          onClick={openSiteGuide}
        >
          구현 범위 자세히 보기
        </button>
      </div>
    </section>
  );
}
