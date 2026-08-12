'use client';

import Link from 'next/link';
import { ReactNode } from 'react';
import { useAuth } from '@/context/authProvider';
import styles from './AuthChecking.module.css';

interface AuthCheckingProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export default function AuthChecking({ children, fallback }: AuthCheckingProps) {
  const { user, isAdmin, isDemoAdmin, loading: authLoading, isUserDataLoading } = useAuth();

  if (authLoading || isUserDataLoading) {
    return (
      fallback || (
        <div className={styles.gate}>
          <div className={styles.gateContent}>
            <p>관리자 페이지 접근 권한을 확인 중입니다.</p>
            <small>
              인증: {authLoading ? '로딩 중' : '완료'}, 사용자 정보: {isUserDataLoading ? '로딩 중' : '완료'}
            </small>
          </div>
        </div>
      )
    );
  }

  if (!user) {
    return (
      <div className={styles.gate}>
        <div className={styles.gateContent}>
          <p>로그인이 필요합니다.</p>
          <Link href="/auth/login" className={styles.gateButton}>
            로그인 페이지로 이동
          </Link>
        </div>
      </div>
    );
  }

  if (!isAdmin && !isDemoAdmin) {
    return (
      <div className={styles.gate}>
        <div className={styles.gateContent}>
          <p className={styles.denied}>관리자 권한이 없습니다.</p>
          <small>관리자 계정으로 로그인한 뒤 다시 접근해 주세요.</small>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
