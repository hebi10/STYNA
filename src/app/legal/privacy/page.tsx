import { SITE_INFO } from '@/shared/constants/siteInfo';
import styles from '../terms/page.module.css';

export default function PrivacyPage() {
  return (
    <div className={styles.container}>
      <section className={styles.section}>
        <h1 className={styles.title}>개인정보 안내</h1>
        <div className={styles.important}>
          <strong>안내:</strong> {SITE_INFO.demoNotice}
        </div>
        <div className={styles.content}>
          이 페이지는 실제 개인정보처리방침이 아닙니다. 실제 결제·배송·고객지원 서비스를 제공하지 않으므로,
          법정 고지나 개인정보 보유 기간, 제3자 제공, 담당자 정보를 임의로 안내하지 않습니다.
        </div>
        <div className={styles.content}>
          포트폴리오 검토를 위한 문의는 {SITE_INFO.supportEmail}로 보내 주세요.
        </div>
      </section>
    </div>
  );
}
