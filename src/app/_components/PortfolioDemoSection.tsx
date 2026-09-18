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
          <p className={styles.eyebrow}>PORTFOLIO PROJECT</p>
          <h2 id="portfolio-demo-title" className={styles.title}>
            쇼핑 경험과 운영 흐름을 함께 담은 커머스 데모
          </h2>
          <p className={styles.intro}>
            상품 탐색, 장바구니, 주문 흐름부터 관리자 기능까지 하나의 서비스
            흐름으로 구성한 포트폴리오 프로젝트입니다.
          </p>
          <button
            type="button"
            className={styles.guideButton}
            onClick={openSiteGuide}
          >
            프로젝트 둘러보기
            <span aria-hidden="true">→</span>
          </button>
        </header>

        <ul className={styles.capabilities} aria-label="구현 범위">
          <li className={styles.capability}>
            <div className={styles.capabilityHeading}>
              <span className={styles.capabilityIndex}>01</span>
              <h3>쇼핑 경험</h3>
            </div>
            <p>상품 탐색부터 장바구니와 주문 완료까지 전체 흐름을 확인할 수 있습니다.</p>
          </li>
          <li className={styles.capability}>
            <div className={styles.capabilityHeading}>
              <span className={styles.capabilityIndex}>02</span>
              <h3>운영 기능</h3>
            </div>
            <p>
              관리자 화면에서 상품, 주문, 이벤트, 쿠폰의 운영 구조를 살펴볼 수 있습니다.
            </p>
          </li>
          <li className={styles.capability}>
            <div className={styles.capabilityHeading}>
              <span className={styles.capabilityIndex}>03</span>
              <h3>데모 안내</h3>
            </div>
            <div className={styles.demoCopy}>
              <p>{SITE_INFO.demoNotice}</p>
              <p>{buildDemoDataNotice()}</p>
              <p className={styles.benefit}>
                <span className={styles.benefitLabel}>가입 혜택</span>
                {formatSignupBenefit()}
              </p>
            </div>
          </li>
        </ul>
      </div>
    </section>
  );
}
