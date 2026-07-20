import Link from "next/link";
import styles from "../layout.module.css";

interface SidebarMenuProps {
  activeTab: string;
  logout: () => void;
}

export default function SidebarMenu({ activeTab, logout }: SidebarMenuProps) {
  return (
    <div className={styles.sidebar}>
      <div className={styles.sidebarCard}>
        <h3 className={styles.sidebarTitle}>마이메뉴</h3>
        <nav className={styles.sidebarMenu}>
          <Link
            href="/mypage"
            className={`${styles.menuItem} ${activeTab === 'overview' ? styles.active : ''}`}
            aria-current={activeTab === 'overview' ? 'page' : undefined}
          >
            나의 쇼핑 현황
          </Link>
          <Link 
            href="/mypage/order-list" 
            className={`${styles.menuItem} ${activeTab === 'orders' ? styles.active : ''}`}
            aria-current={activeTab === 'orders' ? 'page' : undefined}
          >
            주문내역
          </Link>
          <Link 
            href="/mypage/qa" 
            className={`${styles.menuItem} ${activeTab === 'reviews' ? styles.active : ''}`}
          >
            문의관리
          </Link>
          <Link 
            href="/mypage/recently-viewed" 
            className={`${styles.menuItem} ${activeTab === 'wishlist' ? styles.active : ''}`}
          >
            최근본상품
          </Link>
          <Link 
            href="/mypage/wishlist" 
            className={`${styles.menuItem} ${activeTab === 'favorite' ? styles.active : ''}`}
          >
            찜한상품
          </Link>
          <Link 
            href="/mypage/coupons" 
            className={`${styles.menuItem} ${activeTab === 'coupons' ? styles.active : ''}`}
          >
            쿠폰관리
          </Link>
          <Link 
            href="/mypage/point" 
            className={`${styles.menuItem} ${activeTab === 'point' ? styles.active : ''}`}
          >
            적립금
          </Link>
          <Link 
            href="/mypage/info-edit" 
            className={`${styles.menuItem} ${activeTab === 'profile' ? styles.active : ''}`}
          >
            회원정보수정
          </Link>
          <button
            className={styles.menuItem}
            onClick={logout}
          >
            로그아웃
          </button>
        </nav>
      </div>
    </div>
  );
}
