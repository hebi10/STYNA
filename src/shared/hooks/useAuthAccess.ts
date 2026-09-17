"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { User } from "firebase/auth";
import { userKeys } from "@/shared/hooks/queryKeys";
import {
  AUTH_ACCESS_CHANGED_EVENT,
  hasActiveAccount,
  hasDemoAdminAccess,
  hasStrictAdminAccess,
} from "@/shared/utils/authAccess";

interface UseAuthAccessOptions {
  user: User | null;
  userData: Record<string, unknown> | null | undefined;
  userDataError: unknown;
  enabled?: boolean;
}

export function useAuthAccess({
  user,
  userData,
  userDataError,
  enabled = true,
}: UseAuthAccessOptions) {
  const queryClient = useQueryClient();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isDemoAdmin, setIsDemoAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [accessRevision, setAccessRevision] = useState(0);

  useEffect(() => {
    if (!user) {
      return;
    }

    const handleAccessChanged = (event: Event) => {
      const { userId } = (event as CustomEvent<{ userId?: string }>).detail || {};
      if (userId !== user.uid) {
        return;
      }

      setIsAdmin(false);
      setIsDemoAdmin(false);
      setAccessRevision((revision) => revision + 1);
      void queryClient.invalidateQueries({ queryKey: userKeys.detail(user.uid) });
    };

    window.addEventListener(AUTH_ACCESS_CHANGED_EVENT, handleAccessChanged);
    return () => {
      window.removeEventListener(AUTH_ACCESS_CHANGED_EVENT, handleAccessChanged);
    };
  }, [queryClient, user]);

  useEffect(() => {
    let cancelled = false;

    const resolveAccess = async () => {
      if (!enabled || !user || userDataError || !hasActiveAccount(userData)) {
        setIsAdmin(false);
        setIsDemoAdmin(false);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const tokenResult = await user.getIdTokenResult(true);
        if (cancelled) {
          return;
        }

        setIsAdmin(hasStrictAdminAccess(tokenResult.claims, userData));
        setIsDemoAdmin(hasDemoAdminAccess(tokenResult.claims, userData));
      } catch (error) {
        console.error("관리자 권한 토큰 확인 실패:", error);
        if (!cancelled) {
          setIsAdmin(false);
          setIsDemoAdmin(false);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void resolveAccess();
    return () => {
      cancelled = true;
    };
  }, [accessRevision, enabled, user, userData, userDataError]);

  return {
    isAdmin,
    isDemoAdmin,
    isLoading,
  };
}
