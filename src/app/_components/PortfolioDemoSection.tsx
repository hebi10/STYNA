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
        <header className={styles.summary}>
          <p className={styles.eyebrow}>PORTFOLIO DEMO</p>
          <h2 id="portfolio-demo-title" className={styles.title}>
            포트폴리오로 구현한 쇼핑몰
          </h2>
          <p className={styles.intro}>
            상품 탐색부터 주문과 운영 화면까지 연결한 커머스 프로젝트입니다.
          </p>
          <button
            type="button"
            className={styles.guideButton}
            onClick={openSiteGuide}
          >
            구현 범위 자세히 보기
          </button>
        </header>

        <ul className={styles.capabilities} aria-label="구현 범위">
          <li className={styles.capability}>
            <h3>쇼핑 경험</h3>
            <p>상품 탐색, 장바구니, 주문 흐름을 직접 확인할 수 있습니다.</p>
          </li>
          <li className={styles.capability}>
            <h3>운영 기능</h3>
            <p>
              관리자 화면에서 상품, 이벤트, 쿠폰 관리 기능을 확인할 수 있습니다.
            </p>
          </li>
          <li className={styles.capability}>
            <h3>데모 환경</h3>
            <div>
              <p>{SITE_INFO.demoNotice}</p>
              <p>{buildDemoDataNotice()}</p>
              <p className={styles.benefit}>{formatSignupBenefit()}</p>
            </div>
          </li>
        </ul>
      </div>
    </section>
  );
}
