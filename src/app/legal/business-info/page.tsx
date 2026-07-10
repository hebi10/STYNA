import { SITE_INFO } from '@/shared/constants/siteInfo';
import styles from './page.module.css';

export default function BusinessInfoPage() {
  return (
    <div className={styles.container}>
      <section className={styles.section}>
        <h1 className={styles.title}>서비스 안내</h1>
        <div className={styles.infoGrid}>
          <div className={styles.infoLabel}>서비스명</div>
          <div className={styles.infoValue}>{SITE_INFO.brandName}</div>

          <div className={styles.infoLabel}>프로젝트 목적</div>
          <div className={styles.infoValue}>패션 이커머스 UI·브랜딩 포트폴리오</div>

          <div className={styles.infoLabel}>프로젝트 운영자</div>
          <div className={styles.infoValue}>{SITE_INFO.portfolioOwner}</div>

          <div className={styles.infoLabel}>문의</div>
          <div className={styles.infoValue}>
            {SITE_INFO.supportEmail}
            <br />
            {SITE_INFO.supportPhone} ({SITE_INFO.supportHours})
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.title}>데모 이용 범위</h2>
        <p className={styles.note}>
          {SITE_INFO.demoNotice} 실제 사업자 정보, 결제, 배송, 고객센터 운영을 제공하지 않으며,
          화면에 표시된 주문·쿠폰·회원 데이터는 기능 시연을 위한 데이터입니다.
        </p>
      </section>
    </div>
  );
}
