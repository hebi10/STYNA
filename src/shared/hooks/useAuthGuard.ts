"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getAuthGuardRedirect } from "@/shared/utils/authRouteGuard";

interface UseAuthGuardOptions {
  loading: boolean;
  hasUser: boolean;
}

export function useAuthGuard({ loading, hasUser }: UseAuthGuardOptions) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const guardRedirect = getAuthGuardRedirect({
      loading,
      hasUser,
      pathname,
    });

    if (guardRedirect) {
      router.replace(guardRedirect);
    }
  }, [hasUser, loading, pathname, router]);
}
