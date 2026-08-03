'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./adminNav.module.css";

interface AdminNavProps {
  onNavigate?: () => void;
}

const NAV_ITEMS = [
  { href: "/admin", label: "대시보드", exact: true },
  { href: "/admin/categories", label: "카테고리 관리" },
  { href: "/admin/dashboard/products", label: "상품 관리" },
  { href: "/admin/coupons", label: "쿠폰 관리" },
  { href: "/admin/dashboard/orders", label: "주문 관리" },
  { href: "/admin/user-coupons", label: "사용자 쿠폰" },
  { href: "/admin/dashboard/users", label: "사용자 관리" },
  { href: "/admin/events", label: "이벤트 관리" },
  { href: "/admin/inquiries", label: "1:1 문의 관리" },
  { href: "/admin/qna", label: "QnA 관리" },
  { href: "/admin/reviews", label: "리뷰 관리" },
];

function isActivePath(pathname: string, href: string, exact?: boolean): boolean {
  if (exact) {
    return pathname === href || pathname === `${href}/`;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function AdminNav({ onNavigate }: AdminNavProps) {
  const pathname = usePathname();

  return (
    <nav className={styles.adminNav}>
      {NAV_ITEMS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`${styles.navLink} ${isActivePath(pathname, item.href, item.exact) ? styles.active : ''}`}
          onClick={onNavigate}
          aria-current={isActivePath(pathname, item.href, item.exact) ? 'page' : undefined}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
