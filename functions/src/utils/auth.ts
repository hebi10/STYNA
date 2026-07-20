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

    return {
      uid: decodedToken.uid,
      token: decodedToken,
      role,
      isAdmin,
    };
  } catch (error) {
    if (error instanceof AuthError) {
      throw error;
    }
    throw new AuthError(401, "Invalid authentication token.");
  }
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
