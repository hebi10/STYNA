import { buildDemoDataNotice } from '@/shared/constants/commercePolicy';
import { SITE_INFO } from '@/shared/constants/siteInfo';
import styles from './page.module.css';

export default function TermsPage() {
  return (
    <div className={styles.container}>
      <div className={styles.section}>
        <h1 className={styles.title}>포트폴리오 데모 이용 안내</h1>

        <div className={styles.important}>
          <strong>안내:</strong> 이 문서는 실제 이용약관이 아닙니다. STYNA의 화면과 기능을 검토할 때 필요한
          데모 범위만 설명합니다.
        </div>

        <div className={styles.article}>
          <div className={styles.articleNumber}>서비스 범위</div>
          <div className={styles.content}>
            {SITE_INFO.demoNotice} 실제 쇼핑몰이나 법인 서비스를 운영하지 않으며,
            실제 구매계약·결제·배송 또는 법정 고객센터를 제공하지 않습니다.
          </div>
        </div>

        <div className={styles.article}>
          <div className={styles.articleNumber}>계정과 데이터</div>
          <div className={styles.content}>
            {buildDemoDataNotice()} 기능 검토에 필요하지 않은 민감한 개인정보나 실제 결제정보는 입력하지 마세요.
          </div>
        </div>

        <div className={styles.article}>
          <div className={styles.articleNumber}>주문과 혜택</div>
          <div className={styles.content}>
            상품, 주문, 포인트, 쿠폰과 배송 상태는 포트폴리오 기능 시연용입니다. 화면에 표시된 정책과
            Firebase에 저장된 데모 기록을 기준으로 동작하며 실제 승인·청구·출고로 이어지지 않습니다.
          </div>
        </div>

        <div className={styles.article}>
          <div className={styles.articleNumber}>문의 기능</div>
          <div className={styles.content}>
            1:1 문의는 작성·저장·상태 관리 흐름을 보여주는 데모입니다. 답변 여부와 시점은 보장하지 않습니다.
            포트폴리오 검토 문의는 {SITE_INFO.supportEmail}로 보내 주세요.
          </div>
        </div>

        <div className={styles.note}>
          이 안내는 법적 권리·의무, 분쟁 관할, 환불 또는 배송 책임을 정하는 약관이 아닙니다.
        </div>
      </div>
    </div>
  );
}
