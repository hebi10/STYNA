import Link from "next/link";
import styles from "../layout.module.css";

interface SidebarMenuProps {
  activeTab: string;
  logout: () => void;
}

const menuItems = [
  { activeTab: 'overview', href: '/mypage', label: '나의 쇼핑 현황' },
  { activeTab: 'orders', href: '/mypage/order-list', label: '주문내역' },
  { activeTab: 'reviews', href: '/cs/inquiry?tab=list', label: '문의관리' },
  { activeTab: 'wishlist', href: '/mypage/recently-viewed', label: '최근본상품' },
  { activeTab: 'favorite', href: '/mypage/wishlist', label: '찜한상품' },
  { activeTab: 'coupons', href: '/mypage/coupons', label: '쿠폰관리' },
  { activeTab: 'point', href: '/mypage/point', label: '적립금' },
  { activeTab: 'profile', href: '/mypage/info-edit', label: '회원정보수정' },
];

export default function SidebarMenu({ activeTab, logout }: SidebarMenuProps) {
  const renderMenuLinks = () => menuItems.map((item) => {
    const isActive = activeTab === item.activeTab;

    return (
      <Link
        key={item.href}
        href={item.href}
        className={`${styles.menuItem} ${isActive ? styles.active : ''}`}
        aria-current={isActive ? 'page' : undefined}
      >
        {item.label}
      </Link>
    );
  });

  return (
    <>
      <div className={styles.sidebar}>
        <div className={styles.sidebarCard}>
          <h3 className={styles.sidebarTitle}>마이메뉴</h3>
          <nav className={styles.sidebarMenu} aria-label="마이페이지 메뉴">
            {renderMenuLinks()}
            <button className={styles.menuItem} type="button" onClick={logout}>
              로그아웃
            </button>
          </nav>
        </div>
      </div>

      <nav className={styles.mobileMenu} aria-label="마이페이지 모바일 메뉴">
        {renderMenuLinks()}
        <button className={styles.menuItem} type="button" onClick={logout}>
          로그아웃
        </button>
      </nav>
    </>
  );
}
