'use client';

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import PointService from '@/shared/services/pointService';
import { hasActiveAccount } from '@/shared/utils/authAccess';
import { pointKeys } from './queryKeys';

interface SignupBonusReconciliationOptions {
  userId: string | null;
  userData: Record<string, unknown> | null | undefined;
  enabled: boolean;
}

export function useSignupBonusReconciliation({
  userId,
  userData,
  enabled,
}: SignupBonusReconciliationOptions): void {
  const queryClient = useQueryClient();
  const attemptedUserIdsRef = useRef(new Set<string>());

  useEffect(() => {
    if (
      !enabled
      || !userId
      || !userData
      || !hasActiveAccount(userData)
      || userData.signupBonusGrantedAt
      || attemptedUserIdsRef.current.has(userId)
    ) {
      return;
    }

    attemptedUserIdsRef.current.add(userId);

    void PointService.addSignupPoint()
      .then(async () => {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['user', userId] }),
          queryClient.invalidateQueries({ queryKey: pointKeys.all(userId) }),
        ]);
      })
      .catch((error) => {
        attemptedUserIdsRef.current.delete(userId);
        console.error('회원가입 보너스 포인트 동기화 실패:', error);
      });
  }, [enabled, queryClient, userData, userId]);
}
