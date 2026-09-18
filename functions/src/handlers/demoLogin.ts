import * as admin from "firebase-admin";
import { onRequest } from "firebase-functions/v2/https";
import { ALLOWED_WEB_ORIGINS } from "../config/httpPolicy";
import { applyNoStoreHeaders } from "../utils/http";

type DemoRole = "user" | "admin";
type DemoLoginFailureCode =
  | "demo_auth_lookup_failed"
  | "demo_profile_lookup_failed"
  | "demo_token_sign_failed";

interface DemoAccountConfig {
  uid?: string;
  email?: string;
}

interface DemoUserData {
  role?: unknown;
  status?: unknown;
}

class DemoLoginStageError extends Error {
  constructor(
    public readonly code: DemoLoginFailureCode,
    public readonly cause: unknown,
  ) {
    super(code);
    this.name = "DemoLoginStageError";
  }
}

function isDemoLoginEnabled(): boolean {
  return process.env.ENABLE_DEMO_LOGIN === "true";
}

function getDemoAccountConfig(role: DemoRole): DemoAccountConfig {
  if (role === "admin") {
    return {
      uid: process.env.PORTFOLIO_DEMO_ADMIN_UID?.trim() || undefined,
      email: process.env.PORTFOLIO_DEMO_ADMIN_EMAIL?.trim() || "test@test.com",
    };
  }

  return {
    uid: process.env.PORTFOLIO_DEMO_USER_UID?.trim() || undefined,
    email: process.env.PORTFOLIO_DEMO_USER_EMAIL?.trim() || "test01@test.com",
  };
}

function hasExpectedDemoAccess(
  role: DemoRole,
  customClaims: Record<string, unknown> | undefined,
  userData: DemoUserData,
): boolean {
  if (userData.status !== "active") {
    return false;
  }

  if (role === "admin") {
    return customClaims?.demoAdmin === true
      && customClaims?.admin !== true
      && customClaims?.role === "demo_admin"
      && userData.role === "demo_admin";
  }

  return userData.role === "user"
    && customClaims?.admin !== true
    && customClaims?.demoAdmin !== true
    && customClaims?.role !== "admin";
}

async function resolveDemoUser(
  auth: admin.auth.Auth,
  config: DemoAccountConfig,
): Promise<admin.auth.UserRecord> {
  if (config.uid) {
    return auth.getUser(config.uid);
  }

  if (config.email) {
    return auth.getUserByEmail(config.email);
  }

  throw new Error("Demo account is not configured.");
}

async function resolveDemoUserSafely(
  auth: admin.auth.Auth,
  config: DemoAccountConfig,
): Promise<admin.auth.UserRecord> {
  try {
    return await resolveDemoUser(auth, config);
  } catch (error) {
    throw new DemoLoginStageError("demo_auth_lookup_failed", error);
  }
}

async function resolveDemoProfileSafely(uid: string): Promise<DemoUserData | undefined> {
  try {
    const userSnapshot = await admin.firestore().collection("users").doc(uid).get();
    return userSnapshot.exists
      ? (userSnapshot.data() as DemoUserData | undefined)
      : undefined;
  } catch (error) {
    throw new DemoLoginStageError("demo_profile_lookup_failed", error);
  }
}

async function createDemoCustomTokenSafely(
  auth: admin.auth.Auth,
  uid: string,
): Promise<string> {
  try {
    return await auth.createCustomToken(uid);
  } catch (error) {
    throw new DemoLoginStageError("demo_token_sign_failed", error);
  }
}

export const demoLogin = onRequest(
  {
    cors: [...ALLOWED_WEB_ORIGINS],
    region: "us-central1",
    memory: "256MiB",
    timeoutSeconds: 30,
  },
  async (req, res) => {
    applyNoStoreHeaders(res);

    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }

    if (req.method !== "POST") {
      res.status(405).json({ success: false, error: "Method not allowed" });
      return;
    }

    if (!isDemoLoginEnabled()) {
      res.status(404).json({ success: false, error: "Demo login is disabled." });
      return;
    }

    const role = req.body?.role;
    if (role !== "user" && role !== "admin") {
      res.status(400).json({ success: false, error: "Invalid demo role." });
      return;
    }

    try {
      const auth = admin.auth();
      const authUser = await resolveDemoUserSafely(auth, getDemoAccountConfig(role));
      const userData = await resolveDemoProfileSafely(authUser.uid);

      if (!userData || !hasExpectedDemoAccess(role, authUser.customClaims, userData)) {
        res.status(403).json({ success: false, error: "Demo account is not available." });
        return;
      }

      const customToken = await createDemoCustomTokenSafely(auth, authUser.uid);
      res.status(200).json({
        success: true,
        data: {
          customToken,
          role,
        },
      });
    } catch (error) {
      if (error instanceof DemoLoginStageError) {
        console.error("Demo login stage failed:", error.code, error.cause);
        res.status(503).json({
          success: false,
          error: "Demo login is temporarily unavailable.",
          code: error.code,
        });
        return;
      }

      console.error("Demo login API error:", error);
      res.status(503).json({
        success: false,
        error: "Demo login is temporarily unavailable.",
        code: "demo_unavailable",
      });
    }
  },
);
