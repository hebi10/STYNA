'use client';

import styles from './DemoAdminDashboard.module.css';

const DEMO_SUMMARY = [
  ['상품', '178개'],
  ['카테고리', '8개'],
  ['관리 화면', '11개'],
] as const;

export default function DemoAdminDashboard() {
  return (
    <section className={styles.dashboard} aria-labelledby="demo-admin-title">
      <p className={styles.eyebrow}>PORTFOLIO DEMO</p>
      <h2 id="demo-admin-title">읽기 전용 관리자 화면입니다</h2>
      <p className={styles.description}>
        실제 사용자, 주문, 문의 정보는 표시하지 않으며 상품 운영 구조와 화면 흐름만 확인할 수 있습니다.
      </p>
      <dl className={styles.summary}>
        {DEMO_SUMMARY.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <p className={styles.notice}>
        데이터 수정, 권한 변경, 포인트 지급, 주문 상태 변경은 포트폴리오 데모에서 사용할 수 없습니다.
      </p>
    </section>
  );
}
