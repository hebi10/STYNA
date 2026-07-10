import Link from 'next/link';
import styles from './Footer.module.css';
import { SITE_INFO } from '@/shared/constants/siteInfo';

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.container}>
        <div className={styles.grid}>
          <div className={styles.section}>
            <h3>고객센터</h3>
            <div className={styles.linkList}>
              <Link href="/cs/faq" className={styles.link}>
                자주 묻는 질문
              </Link>
              <Link href="/cs/notice_list" className={styles.link}>
                공지사항
              </Link>
              <Link href="/cs/inquiry" className={styles.link}>
                1:1 문의
              </Link>
              <Link href="/qna" className={styles.link}>
                상품문의
              </Link>
            </div>
          </div>

          <div className={styles.section}>
            <h3>회사정보</h3>
            <div className={styles.linkList}>
              <Link href="/legal/business-info" className={styles.link}>
                사업자 정보
              </Link>
              <Link href="/legal/terms" className={styles.link}>
                이용약관
              </Link>
              <Link href="/legal/privacy" className={styles.link}>
                개인정보처리방침
              </Link>
              <Link href="/events" className={styles.link}>
                기획전
              </Link>
            </div>
          </div>

          <div className={styles.section}>
            <h3>쇼핑안내</h3>
            <div className={styles.linkList}>
              <Link href="/support/offline" className={styles.link}>
                오프라인 매장
              </Link>
              <Link href="/orders/delivery" className={styles.link}>
                배송조회
              </Link>
              <Link href="/reviews" className={styles.link}>
                리뷰
              </Link>
            </div>
          </div>

          <div className={styles.section}>
            <h3>소셜</h3>
            <div className={styles.linkList}>
              <span className={styles.link}>소셜 채널은 포트폴리오 데모에서 제공하지 않습니다.</span>
            </div>
          </div>
        </div>

        <div className={styles.copyright}>
          <p>{SITE_INFO.demoNotice}</p>
          <p>{SITE_INFO.supportEmail} · {SITE_INFO.supportPhone} · {SITE_INFO.supportHours}</p>
          <strong>© {new Date().getFullYear()} {SITE_INFO.brandName}. All rights reserved.</strong>
        </div>
      </div>
    </footer>
  );
}
