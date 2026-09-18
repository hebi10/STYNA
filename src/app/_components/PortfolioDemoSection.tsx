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
            포트폴리오용 데모 사이트입니다
          </h2>
          <p className={styles.intro}>
            실제 쇼핑몰이 아닌 포트폴리오 시연용 서비스입니다.
            일부 기능과 데이터는 체험을 위해 동작하므로 이용에 참고해 주세요.
          </p>
          <button
            type="button"
            className={styles.guideButton}
            onClick={() => openSiteGuide('portfolio')}
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
