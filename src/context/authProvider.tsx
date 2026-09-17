"use client";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { User, UserCredential } from "firebase/auth";
import { useAuthUser } from "../shared/hooks/useAuthUser";
import {
  logout as firebaseLogout,
  loginOneSession as firebaseSignIn,
  loginKeepAlive as firebaseLoginKeepAlive,
  loginWithCustomToken as firebaseLoginWithCustomToken,
  signUp as firebaseSignUp
} from "../shared/libs/firebase/auth";
import {
  isUserDataNotFoundError,
  useUserData,
} from "../shared/hooks/useUserData";
import { getErrorMessage } from "../shared/utils/authErrorMessages";
import { db } from "../shared/libs/firebase/firebase";
import {
  AUTH_ACCESS_CHANGED_EVENT,
  hasActiveAccount,
  hasDemoAdminAccess,
  hasStrictAdminAccess,
} from "../shared/utils/authAccess";
import { getAuthGuardRedirect } from "../shared/utils/authRouteGuard";
import { useSignupBonusReconciliation } from "../shared/hooks/useSignupBonusReconciliation";

type DemoLoginRole = "user" | "admin";

interface DemoLoginResponse {
  success?: boolean;
  data?: {
    customToken?: unknown;
  };
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string, keepAlive: boolean) => Promise<UserCredential>;
  loginDemo: (role: DemoLoginRole) => Promise<UserCredential>;
  logout: () => Promise<void>;
  signUp: (
    email: string,
    password: string,
    createProfile: (user: User) => Promise<void>
  ) => Promise<UserCredential>;
  loading: boolean;
  userData: Record<string, unknown> | null | undefined;
  isAdmin: boolean;
  isDemoAdmin: boolean;
  error: string | null;
  clearError: () => void;
  isUserDataLoading: boolean;
}

function getAuthErrorCode(error: unknown): string {
  return typeof error === "object" && error !== null && "code" in error
    ? String((error as { code?: unknown }).code)
    : "";
}

function getErrorMessageValue(error: unknown): string | undefined {
  return error instanceof Error ? error.message : undefined;
}

async function requestDemoCustomToken(role: DemoLoginRole): Promise<string> {
  const response = await fetch("/api/demo-login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ role }),
    cache: "no-store",
  });
  const payload = await response.json().catch(() => null) as DemoLoginResponse | null;
  const customToken = payload?.data?.customToken;

  if (!response.ok || payload?.success !== true || typeof customToken !== "string" || !customToken) {
    throw new Error("DEMO_LOGIN_UNAVAILABLE");
  }

  return customToken;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  login: async () => {
    throw new Error("AuthProvider is not mounted.");
  },
  loginDemo: async () => {
    throw new Error("AuthProvider is not mounted.");
  },
  logout: () => Promise.resolve(),
  signUp: async () => {
    throw new Error("AuthProvider is not mounted.");
  },
  loading: true,
  userData: null,
  isAdmin: false,
  isDemoAdmin: false,
  error: null,
  clearError: () => {},
  isUserDataLoading: false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuthUser();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isDemoAdmin, setIsDemoAdmin] = useState(false);
  const [isUserDataLoading, setIsUserDataLoading] = useState(true);
  const [adminClaimsLoading, setAdminClaimsLoading] = useState(false);
  const [isLoginValidating, setIsLoginValidating] = useState(false);
  const isLoginValidatingRef = useRef(false);
  const [isProvisioning, setIsProvisioning] = useState(false);
  const isProvisioningRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();

  const validateAuthenticatedAccount = async (userCredential: UserCredential) => {
    const userDoc = await import("firebase/firestore").then(module =>
      module.getDoc(module.doc(db, "users", userCredential.user.uid))
    );
    const accountData = userDoc.exists() ? userDoc.data() : null;

    if (!hasActiveAccount(accountData)) {
      if (accountData?.status === "inactive") {
        throw new Error("ACCOUNT_INACTIVE");
      }

      if (accountData?.status === "banned") {
        throw new Error("ACCOUNT_BANNED");
      }

      throw new Error("ACCOUNT_UNAVAILABLE");
    }

    queryClient.setQueryData(["user", userCredential.user.uid], accountData);
    return userCredential;
  };

  const getLoginErrorMessage = (err: unknown) => {
    if (getErrorMessageValue(err) === "ACCOUNT_INACTIVE") {
      return "이용이 중지된 사용자입니다. 관리자에게 문의하세요.";
    }

    if (getErrorMessageValue(err) === "ACCOUNT_BANNED") {
      return "정지된 계정입니다. 관리자에게 문의하세요.";
    }

    if (getErrorMessageValue(err) === "ACCOUNT_UNAVAILABLE") {
      return "사용할 수 없는 계정입니다. 관리자에게 문의하세요.";
    }

    if (getErrorMessageValue(err) === "DEMO_LOGIN_UNAVAILABLE") {
      return "데모 로그인을 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.";
    }

    return getErrorMessage(getAuthErrorCode(err));
  };

  const runValidatedLogin = async (authenticate: () => Promise<UserCredential>) => {
    isLoginValidatingRef.current = true;
    setIsLoginValidating(true);
    let authenticated = false;

    try {
      setError(null);
      const userCredential = await authenticate();
      authenticated = true;
      return await validateAuthenticatedAccount(userCredential);
    } catch (err) {
      if (authenticated) {
        try {
          await firebaseLogout();
        } catch (logoutError) {
          console.error("로그인 계정 검증 실패 후 로그아웃 실패:", logoutError);
        }
      }

      setError(getLoginErrorMessage(err));
      throw err;
    } finally {
      isLoginValidatingRef.current = false;
      setIsLoginValidating(false);
    }
  };

  const login = async (email: string, password: string, keepAlive: boolean) => {
    return runValidatedLogin(() => (
      keepAlive
        ? firebaseLoginKeepAlive(email, password)
        : firebaseSignIn(email, password)
    ));
  };

  const loginDemo = async (role: DemoLoginRole) => {
    return runValidatedLogin(async () => {
      const customToken = await requestDemoCustomToken(role);
      return firebaseLoginWithCustomToken(customToken);
    });
  };

  const logout = async () => {
    try {
      await firebaseLogout();
      if (typeof window !== "undefined") {
        window.location.href = "/auth/login";
      }
    } catch (error) {
      console.error("Logout error:", error);
      if (typeof window !== "undefined") {
        window.location.href = "/auth/login";
      }
    }
  };

  const signUp = async (
    email: string,
    password: string,
    createProfile: (user: User) => Promise<void>
  ) => {
    isProvisioningRef.current = true;
    setIsProvisioning(true);
    let authCreated = false;

    try {
      setError(null);
      const userCredential = await firebaseSignUp(email, password);
      authCreated = true;

      await createProfile(userCredential.user);
      await queryClient.invalidateQueries({
        queryKey: ["user", userCredential.user.uid],
        refetchType: "none",
      });
      await queryClient.refetchQueries({
        queryKey: ["user", userCredential.user.uid],
        type: "active",
      });

      return userCredential;
    } catch (err) {
      if (authCreated) {
        try {
          await firebaseLogout();
        } catch (logoutError) {
          console.error("회원가입 프로필 실패 후 로그아웃 실패:", logoutError);
        }
      }

      const errorMessage = getErrorMessage(getAuthErrorCode(err));
      setError(errorMessage);
      throw err;
    } finally {
      isProvisioningRef.current = false;
      setIsProvisioning(false);
    }
  };

  const clearError = () => setError(null);

  const {
    data: userData,
    isLoading: userDataLoading,
    error: userDataError,
  } = useUserData(user?.uid || "");

  useSignupBonusReconciliation({
    userId: user?.uid || null,
    userData,
    enabled: !loading
      && !userDataLoading
      && !userDataError
      && !isLoginValidating
      && !isLoginValidatingRef.current
      && !isProvisioning
      && !isProvisioningRef.current,
  });

  useEffect(() => {
    const guardRedirect = getAuthGuardRedirect({
      loading,
      hasUser: Boolean(user),
      pathname,
    });

    if (guardRedirect) {
      router.replace(guardRedirect);
    }
  }, [user, loading, pathname, router]);

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
      void queryClient.invalidateQueries({ queryKey: ["user", user.uid] });
    };

    window.addEventListener(AUTH_ACCESS_CHANGED_EVENT, handleAccessChanged);
    return () => {
      window.removeEventListener(AUTH_ACCESS_CHANGED_EVENT, handleAccessChanged);
    };
  }, [queryClient, user]);

  useEffect(() => {
    if (
      !user
      || loading
      || userDataLoading
      || isLoginValidating
      || isLoginValidatingRef.current
      || isProvisioning
      || isProvisioningRef.current
    ) {
      return;
    }

    const userDataMissing = isUserDataNotFoundError(userDataError);

    if (userDataError && !userDataMissing) {
      setIsAdmin(false);
      setIsDemoAdmin(false);
      return;
    }

    if (!userData && !userDataMissing) {
      setIsAdmin(false);
      setIsDemoAdmin(false);
      return;
    }

    if (!userDataMissing && hasActiveAccount(userData)) {
      return;
    }

    const blockedStatus = userDataMissing
      || userData?.status === "inactive"
      || userData?.status === "banned"
      || userData?.status === "deleted";

    setIsAdmin(false);
    setIsDemoAdmin(false);
    if (!blockedStatus) {
      return;
    }

    let cancelled = false;
    setError("사용할 수 없는 계정입니다. 관리자에게 문의하세요.");

    void firebaseLogout().catch((logoutError) => {
      if (!cancelled) {
        console.error("비활성 계정 로그아웃 실패:", logoutError);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [isLoginValidating, isProvisioning, loading, user, userData, userDataError, userDataLoading]);

  useEffect(() => {
    let cancelled = false;

    const loadAdminClaims = async () => {
      if (
        !user
        || isLoginValidating
        || isLoginValidatingRef.current
        || userDataError
        || !hasActiveAccount(userData)
      ) {
        setIsAdmin(false);
        setIsDemoAdmin(false);
        setAdminClaimsLoading(false);
        return;
      }

      setAdminClaimsLoading(true);
      try {
        const tokenResult = await user.getIdTokenResult(true);
        const claims = tokenResult.claims;
        const nextIsAdmin = hasStrictAdminAccess(claims, userData);
        const nextIsDemoAdmin = hasDemoAdminAccess(claims, userData);

        if (!cancelled) {
          setIsAdmin(nextIsAdmin);
          setIsDemoAdmin(nextIsDemoAdmin);
        }
      } catch (error) {
        console.error("관리자 권한 토큰 확인 실패:", error);
        if (!cancelled) {
          setIsAdmin(false);
          setIsDemoAdmin(false);
        }
      } finally {
        if (!cancelled) {
          setAdminClaimsLoading(false);
        }
      }
    };

    loadAdminClaims();

    return () => {
      cancelled = true;
    };
  }, [isLoginValidating, user, userData, userDataError]);

  useEffect(() => {
    setIsUserDataLoading(
      userDataLoading
      || loading
      || adminClaimsLoading
      || isLoginValidating
      || isProvisioning
    );
  }, [userDataLoading, loading, adminClaimsLoading, isLoginValidating, isProvisioning]);

  return (
    <AuthContext.Provider value={{
      user,
      login,
      loginDemo,
      logout,
      signUp,
      userData,
      loading,
      isUserDataLoading,
      isAdmin,
      isDemoAdmin,
      error,
      clearError,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("AuthProvider에서 벗어났습니다.");
  }
  return context;
}
