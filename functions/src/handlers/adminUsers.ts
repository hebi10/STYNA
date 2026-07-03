import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { requireAdmin, AuthError } from "../utils/auth";
import { applyNoStoreHeaders, SENSITIVE_FUNCTION_CORS } from "../utils/http";

type UserRole = "user" | "admin";

interface SetRolePayload {
  action?: string;
  userId?: string;
  role?: UserRole;
  status?: "active" | "inactive" | "banned" | "deleted";
  name?: string;
  email?: string;
}

function assertValidRole(role: unknown): role is UserRole {
  return role === "user" || role === "admin";
}

export const adminUsers = onRequest(
  {
    cors: SENSITIVE_FUNCTION_CORS,
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

      const { action, userId, role, status, name, email } = req.body as SetRolePayload;
      const users = admin.firestore().collection("users");

      if (action === "setRole") {
        if (!userId || !assertValidRole(role)) {
          res.status(400).json({ success: false, error: "userId and valid role are required." });
          return;
        }

        const authUser = await admin.auth().getUser(userId);
        const nextClaims: Record<string, unknown> = { ...(authUser.customClaims || {}), role };

        if (role === "admin") {
          nextClaims.admin = true;
        } else {
          delete nextClaims.admin;
        }

        await admin.auth().setCustomUserClaims(userId, nextClaims);
        await users.doc(userId).set(
          {
            role,
            isAdmin: role === "admin",
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        res.status(200).json({ success: true, data: { userId, role, claims: nextClaims } });
        return;
      }

      if (action === "setStatus") {
        if (!userId || !status || !["active", "inactive", "banned"].includes(status)) {
          res.status(400).json({ success: false, error: "userId and valid status are required." });
          return;
        }

        await users.doc(userId).set({ status, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
        res.status(200).json({ success: true, data: { userId, status } });
        return;
      }

      if (action === "delete") {
        if (!userId) {
          res.status(400).json({ success: false, error: "userId is required." });
          return;
        }

        await users.doc(userId).set({
          status: "deleted",
          deletedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        res.status(200).json({ success: true, data: { userId, status: "deleted" } });
        return;
      }

      if (action === "create") {
        const cleanName = typeof name === "string" ? name.trim() : "";
        const cleanEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
        const nextRole = assertValidRole(role) ? role : "user";
        const nextStatus = status === "inactive" ? "inactive" : "active";

        if (!cleanName || !cleanEmail) {
          res.status(400).json({ success: false, error: "name and email are required." });
          return;
        }

        const userRef = users.doc();
        await userRef.set({
          name: cleanName,
          email: cleanEmail,
          role: nextRole,
          status: nextStatus,
          orders: 0,
          totalSpent: 0,
          pointBalance: 0,
          isAdmin: nextRole === "admin",
          joinDate: new Date().toISOString().split("T")[0],
          lastLogin: admin.firestore.FieldValue.serverTimestamp(),
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          phone: "",
          gender: "male",
          grade: "bronze",
          addresses: [],
          preferences: {
            favoriteCategories: [],
            favoriteBrands: [],
            sizes: {},
            newsletter: false,
            smsMarketing: false,
          },
        });
        res.status(200).json({ success: true, data: { userId: userRef.id } });
        return;
      }

      res.status(400).json({ success: false, error: `Unsupported action: ${action}` });
    } catch (error) {
      if (error instanceof AuthError) {
        res.status(error.statusCode).json({ success: false, error: error.message });
        return;
      }

      console.error("Admin users API error:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      });
    }
  }
);
