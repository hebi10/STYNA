import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { requireAdmin, AuthError } from "../utils/auth";
import { applyNoStoreHeaders } from "../utils/http";

type UserRole = "user" | "admin";
type UserStatus = "active" | "inactive" | "banned";

type AdminUserAction =
  | { action: "setRole"; userId: string; role: UserRole }
  | { action: "setStatus"; userId: string; status: UserStatus }
  | { action: "deleteUser"; userId: string };

function assertValidRole(role: unknown): role is UserRole {
  return role === "user" || role === "admin";
}

function assertValidStatus(status: unknown): status is UserStatus {
  return status === "active" || status === "inactive" || status === "banned";
}

function buildRoleClaims(
  customClaims: Record<string, unknown> | undefined,
  role: UserRole
): Record<string, unknown> {
  const claims: Record<string, unknown> = { ...(customClaims || {}), role };
  if (role === "admin") {
    claims.admin = true;
  } else {
    delete claims.admin;
  }
  return claims;
}

function claimsMatchRole(
  customClaims: Record<string, unknown> | undefined,
  role: UserRole
): boolean {
  if (role === "admin") {
    return customClaims?.role === "admin" && customClaims?.admin === true;
  }

  return customClaims?.role === "user" && customClaims?.admin === undefined;
}

function assertValidUserId(userId: unknown): userId is string {
  return typeof userId === "string"
    && userId.length > 0
    && userId.length <= 128
    && userId === userId.trim()
    && !userId.includes("/");
}

function parseAdminUserAction(body: unknown): AdminUserAction | null {
  if (!body || typeof body !== "object") {
    return null;
  }

  const payload = body as Record<string, unknown>;
  if (!assertValidUserId(payload.userId)) {
    return null;
  }
  const userId = payload.userId;

  if (payload.action === "setRole" && assertValidRole(payload.role)) {
    return { action: "setRole", userId, role: payload.role };
  }

  if (payload.action === "setStatus" && assertValidStatus(payload.status)) {
    return { action: "setStatus", userId, status: payload.status };
  }

  if (payload.action === "deleteUser") {
    return { action: "deleteUser", userId };
  }

  return null;
}

export const adminUsers = onRequest(
  {
    cors: true,
    region: "us-central1",
    memory: "256MiB",
    timeoutSeconds: 60,
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

    try {
      await requireAdmin(req.headers.authorization);

      const request = parseAdminUserAction(req.body);
      if (!request) {
        res.status(400).json({ success: false, error: "Invalid admin user action." });
        return;
      }

      const userRef = admin.firestore().collection("users").doc(request.userId);
      const userSnapshot = await userRef.get();
      if (!userSnapshot.exists) {
        res.status(404).json({ success: false, error: "User document not found." });
        return;
      }

      const currentUserData = userSnapshot.data() || {};
      const isSameRole = request.action === "setRole"
        && currentUserData.role === request.role;
      const isSameStatus = request.action === "setStatus"
        && currentUserData.status === request.status;

      if (isSameRole || isSameStatus) {
        const expectedRole: UserRole = request.action === "setRole"
          ? request.role
          : currentUserData.role === "admin" ? "admin" : "user";
        const expectedIsAdmin = expectedRole === "admin";
        const rolePairMismatch = currentUserData.role !== expectedRole
          || currentUserData.isAdmin !== expectedIsAdmin;
        const auth = admin.auth();
        const authUser = await auth.getUser(request.userId);
        const claimsMismatch = !claimsMatchRole(authUser.customClaims, expectedRole);
        const shouldBeDisabled = currentUserData.status !== "active";
        const authMismatch = authUser.disabled !== shouldBeDisabled;
        let synchronized = false;

        if (claimsMismatch) {
          await auth.setCustomUserClaims(
            request.userId,
            buildRoleClaims(authUser.customClaims, expectedRole)
          );
          synchronized = true;
        }

        if (authMismatch && shouldBeDisabled) {
          await auth.updateUser(request.userId, { disabled: true });
          synchronized = true;
        }

        if (claimsMismatch || authMismatch) {
          await auth.revokeRefreshTokens(request.userId);
        }

        if (authMismatch && !shouldBeDisabled) {
          await auth.updateUser(request.userId, { disabled: false });
          synchronized = true;
        }

        if (rolePairMismatch) {
          await userRef.update({
            role: expectedRole,
            isAdmin: expectedIsAdmin,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          synchronized = true;
        }

        res.status(200).json({
          success: true,
          data: {
            userId: request.userId,
            ...(request.action === "setRole"
              ? { role: request.role }
              : { status: request.status }),
            ...(synchronized ? { synchronized: true } : { unchanged: true }),
          },
        });
        return;
      }

      const auth = admin.auth();
      const updatedAt = admin.firestore.FieldValue.serverTimestamp();

      if (request.action === "setRole") {
        const authUser = await auth.getUser(request.userId);
        const nextClaims = buildRoleClaims(authUser.customClaims, request.role);

        if (request.role === "admin") {
          await auth.setCustomUserClaims(request.userId, nextClaims);
          await auth.revokeRefreshTokens(request.userId);
          if (authUser.disabled && currentUserData.status === "active") {
            await auth.updateUser(request.userId, { disabled: false });
          }
          await userRef.update({
            role: request.role,
            isAdmin: true,
            updatedAt,
          });
        } else {
          await userRef.update({
            role: request.role,
            isAdmin: false,
            updatedAt,
          });
          await auth.setCustomUserClaims(request.userId, nextClaims);
          await auth.revokeRefreshTokens(request.userId);
        }

        res.status(200).json({
          success: true,
          data: {
            userId: request.userId,
            role: request.role,
          },
        });
        return;
      }

      if (request.action === "setStatus") {
        if (request.status === "active") {
          await auth.updateUser(request.userId, { disabled: false });
          await auth.revokeRefreshTokens(request.userId);
          await userRef.update({ status: request.status, updatedAt });
        } else {
          await userRef.update({ status: request.status, updatedAt });
          await auth.updateUser(request.userId, { disabled: true });
          await auth.revokeRefreshTokens(request.userId);
        }

        res.status(200).json({
          success: true,
          data: {
            userId: request.userId,
            status: request.status,
          },
        });
        return;
      }

      const deleteUpdates: Record<string, unknown> = {
        status: "deleted",
        updatedAt,
      };
      if (currentUserData.deletedAt === undefined || currentUserData.deletedAt === null) {
        deleteUpdates.deletedAt = updatedAt;
      }

      await userRef.update(deleteUpdates);
      await auth.updateUser(request.userId, { disabled: true });
      await auth.revokeRefreshTokens(request.userId);

      res.status(200).json({
        success: true,
        data: {
          userId: request.userId,
          status: "deleted",
        },
      });
    } catch (error) {
      if (error instanceof AuthError) {
        res.status(error.statusCode).json({ success: false, error: error.message });
        return;
      }

      console.error("Admin users API error:", error);
      res.status(503).json({
        success: false,
        error: "Account update result is uncertain. Retry the same request.",
        retryable: true,
        outcome: "unknown",
      });
    }
  }
);
