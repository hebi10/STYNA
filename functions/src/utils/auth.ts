import * as admin from "firebase-admin";

export interface ApiResponse {
  success: boolean;
  data?: unknown;
  error?: string;
}

export interface AuthContext {
  uid: string;
  token: admin.auth.DecodedIdToken;
  role?: string;
  isAdmin: boolean;
  isDemoAdmin?: boolean;
  authTime?: number | null;
}

export async function verifyAuthContext(authHeader: string | undefined): Promise<AuthContext> {
  if (!authHeader?.startsWith("Bearer ")) {
    throw new AuthError(401, "Authentication token is required.");
  }

  const token = authHeader.split("Bearer ")[1];

  try {
    const decodedToken = await admin.auth().verifyIdToken(token, true);
    const userSnapshot = await admin.firestore().collection("users").doc(decodedToken.uid).get();
    const userData = userSnapshot.exists ? userSnapshot.data() : undefined;
    if (userData?.status !== "active") {
      throw new AuthError(403, "This account is not active.");
    }
    const role = typeof userData.role === "string" ? userData.role : undefined;
    const hasAdminClaim = decodedToken.admin === true || decodedToken.role === "admin";
    const isAdmin = hasAdminClaim && role === "admin";
    const isDemoAdmin = decodedToken.demoAdmin === true && role === "demo_admin";
    const authTime = Number.isSafeInteger(decodedToken.auth_time)
      ? Number(decodedToken.auth_time)
      : null;

    return {
      uid: decodedToken.uid,
      token: decodedToken,
      role,
      isAdmin,
      isDemoAdmin,
      authTime,
    };
  } catch (error) {
    if (error instanceof AuthError) {
      throw error;
    }
    throw new AuthError(401, "Invalid authentication token.");
  }
}

export async function requireRecentAdmin(
  authHeader: string | undefined,
  maxAgeSeconds = 300,
): Promise<AuthContext> {
  const context = await requireAdmin(authHeader);
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (
    context.authTime == null
    || context.authTime > nowSeconds
    || nowSeconds - context.authTime > maxAgeSeconds
  ) {
    throw new AuthError(403, "Recent administrator reauthentication is required.");
  }

  return context;
}

export async function verifyAuth(authHeader: string | undefined): Promise<string> {
  const context = await verifyAuthContext(authHeader);
  return context.uid;
}

export async function requireAdmin(authHeader: string | undefined): Promise<AuthContext> {
  const context = await verifyAuthContext(authHeader);
  if (!context.isAdmin) {
    throw new AuthError(403, "Admin privileges are required.");
  }

  return context;
}

export class AuthError extends Error {
  constructor(
    public statusCode: number,
    message: string
  ) {
    super(message);
    this.name = "AuthError";
  }
}
