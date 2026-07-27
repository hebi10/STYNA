'use client';

import { ReactNode, useState } from 'react';
import styles from './layout.module.css';
import AdminNav from './_components/adminNav';
import AuthChecking from './_components/AuthChecking';
import { useAuth } from '@/context/authProvider';

interface AdminShellProps {
  children: ReactNode;
}

export default function AdminShell({ children }: AdminShellProps) {
  const { logout } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <AuthChecking>
      <div className={styles.adminContainer}>
        {isMenuOpen && (
          <button
            className={styles.mobileOverlay}
            onClick={() => setIsMenuOpen(false)}
            aria-label="관리자 메뉴 닫기"
          />
        )}

        {/* 사이드바 */}
        <aside className={`${styles.sidebar} ${isMenuOpen ? styles.open : ''}`}>
          <div className={styles.logo}>
            <h2>Admin Panel</h2>
            <button
              className={styles.sidebarClose}
              onClick={() => setIsMenuOpen(false)}
              aria-label="관리자 메뉴 닫기"
            >
              ×
            </button>
          </div>
          <AdminNav onNavigate={() => setIsMenuOpen(false)} />
        </aside>

        {/* 메인 컨텐츠 */}
        <div className={styles.mainContent}>
          <header className={styles.header}>
            <div className={styles.headerLeft}>
              <button
                className={styles.menuButton}
                onClick={() => setIsMenuOpen(true)}
                aria-label="관리자 메뉴 열기"
              >
                ☰
              </button>
              <h1>관리자 패널</h1>
            </div>
            <div className={styles.userInfo}>
              <span>관리자님 환영합니다</span>
              <button className={styles.logoutBtn} onClick={logout}>로그아웃</button>
            </div>
          </header>
          <main className={styles.content}>
            {children}
          </main>
        </div>
      </div>
    </AuthChecking>
  );
}
