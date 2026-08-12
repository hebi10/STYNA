'use client';

import { FormEvent, useState } from 'react';
import { EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { useAuth } from '@/context/authProvider';
import styles from './AdminReauthentication.module.css';

interface AdminReauthenticationProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onVerified: () => void;
}

export default function AdminReauthentication({
  isOpen,
  onOpenChange,
  onVerified,
}: AdminReauthenticationProps) {
  const { user } = useAuth();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const close = (force = false) => {
    if (isSubmitting && !force) return;
    onOpenChange(false);
    setPassword('');
    setError(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user?.email || !password) return;

    setIsSubmitting(true);
    setError(null);
    try {
      const credential = EmailAuthProvider.credential(user.email, password);
      await reauthenticateWithCredential(user, credential);
      await user.getIdToken(true);
      close(true);
      onVerified();
    } catch {
      setError('비밀번호를 확인한 뒤 다시 시도해 주세요.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <button className={styles.trigger} type="button" onClick={() => onOpenChange(true)}>
        변경 권한 인증
      </button>
      {isOpen && (
        <div className={styles.overlay} role="presentation" onMouseDown={() => close()}>
          <form
            className={styles.dialog}
            aria-labelledby="admin-reauth-title"
            onSubmit={handleSubmit}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <h2 id="admin-reauth-title">관리자 비밀번호 확인</h2>
            <p>수정 권한은 인증 후 5분 동안만 유지됩니다.</p>
            <label htmlFor="admin-reauth-password">현재 비밀번호</label>
            <input
              id="admin-reauth-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={isSubmitting}
              required
            />
            {error && <p className={styles.error} role="alert">{error}</p>}
            <div className={styles.actions}>
              <button type="button" onClick={() => close()} disabled={isSubmitting}>취소</button>
              <button type="submit" disabled={isSubmitting || !password}>
                {isSubmitting ? '확인 중' : '인증 후 변경 허용'}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
