import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import type { Response } from "express";
import { verifyAuthContext, requireAdmin, AuthError } from "../utils/auth";
import { applyNoStoreHeaders, SENSITIVE_FUNCTION_CORS } from "../utils/http";

const SIGNUP_BONUS_AMOUNT = 5000;
const SIGNUP_BONUS_DESCRIPTION = "신규 회원가입 적립";

function toHistoryDocId(type: string, orderId?: string): string {
  return `${type}_${orderId || ""}`.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 160);
}

export const points = onRequest(
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
      const { action, ...payload } = req.body;

      switch (action) {
        case "add": {
          const adminContext = await requireAdmin(req.headers.authorization);
          await handleAdd(adminContext.uid, payload, res);
          return;
        }
        case "refund": {
          const adminContext = await requireAdmin(req.headers.authorization);
          await handleRefund(adminContext.uid, payload, res);
          return;
        }
        case "subtract": {
          await requireAdmin(req.headers.authorization);
          await handleSubtract(payload, res);
          return;
        }
        case "signupBonus": {
          const authContext = await verifyAuthContext(req.headers.authorization);
          await handleSignupBonus(authContext.uid, res);
          return;
        }
        case "use": {
          const authContext = await verifyAuthContext(req.headers.authorization);
          await handleUse(authContext.uid, payload, res);
          return;
        }
        case "balance": {
          const authContext = await verifyAuthContext(req.headers.authorization);
          await handleBalance(authContext.uid, res);
          return;
        }
        case "history": {
          const authContext = await verifyAuthContext(req.headers.authorization);
          await handleHistory(authContext.uid, payload, res);
          return;
        }
        default:
          res.status(400).json({ success: false, error: `Unsupported action: ${action}` });
      }
    } catch (error) {
      if (error instanceof AuthError) {
        res.status(error.statusCode).json({ success: false, error: error.message });
        return;
      }

      console.error("Points API error:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      });
    }
  }
);

async function mutateBalance(params: {
  targetUserId: string;
  amount: number;
  type: "earn" | "refund" | "use";
  description: string;
  orderId?: string;
  direction: "increment" | "decrement";
}) {
  const { targetUserId, amount, type, description, orderId, direction } = params;

  return admin.firestore().runTransaction(async (transaction) => {
    const userRef = admin.firestore().collection("users").doc(targetUserId);
    const userSnap = await transaction.get(userRef);
    const historyRef = orderId
      ? userRef.collection("pointHistory").doc(toHistoryDocId(type, orderId))
      : userRef.collection("pointHistory").doc();
    const historySnap = orderId ? await transaction.get(historyRef) : null;

    if (!userSnap.exists) {
      throw new Error("User document was not found.");
    }

    const currentBalance = userSnap.data()?.pointBalance ?? 0;
    if (historySnap?.exists) {
      return { newBalance: currentBalance, alreadyApplied: true };
    }

    if (direction === "decrement" && currentBalance < amount) {
      throw new Error(`Insufficient point balance. current=${currentBalance}`);
    }

    const newBalance =
      direction === "increment" ? currentBalance + amount : currentBalance - amount;

    transaction.update(userRef, { pointBalance: newBalance });
    transaction.set(historyRef, {
      type,
      amount,
      description,
      orderId: orderId || null,
      date: admin.firestore.FieldValue.serverTimestamp(),
      balanceAfter: newBalance,
      expired: false,
    });

    return { newBalance, alreadyApplied: false };
  });
}

async function handleAdd(
  actorUserId: string,
  data: { userId?: string; amount?: number; description?: string; orderId?: string },
  res: Response
): Promise<void> {
  const { amount, description, orderId, userId } = data;
  const targetUserId = userId || actorUserId;

  if (!amount || amount <= 0) {
    res.status(400).json({ success: false, error: "amount must be greater than zero." });
    return;
  }

  if (!description) {
    res.status(400).json({ success: false, error: "description is required." });
    return;
  }

  const result = await mutateBalance({
    targetUserId,
    amount,
    type: "earn",
    description,
    orderId,
    direction: "increment",
  });

  res.status(200).json({ success: true, data: { ...result, userId: targetUserId } });
}

async function handleRefund(
  actorUserId: string,
  data: { userId?: string; amount?: number; description?: string; orderId?: string },
  res: Response
): Promise<void> {
  const { amount, description, orderId, userId } = data;
  const targetUserId = userId || actorUserId;

  if (!amount || amount <= 0) {
    res.status(400).json({ success: false, error: "amount must be greater than zero." });
    return;
  }

  if (!orderId) {
    res.status(400).json({ success: false, error: "orderId is required." });
    return;
  }

  const result = await mutateBalance({
    targetUserId,
    amount,
    type: "refund",
    description: description || "Point refund",
    orderId,
    direction: "increment",
  });

  res.status(200).json({
    success: true,
    data: { ...result, refundedAmount: amount, userId: targetUserId },
  });
}

async function handleSubtract(
  data: { userId?: string; amount?: number; description?: string; orderId?: string },
  res: Response
): Promise<void> {
  const { amount, description, orderId, userId } = data;

  if (!userId) {
    res.status(400).json({ success: false, error: "userId is required." });
    return;
  }

  if (!amount || amount <= 0) {
    res.status(400).json({ success: false, error: "amount must be greater than zero." });
    return;
  }

  if (!description) {
    res.status(400).json({ success: false, error: "description is required." });
    return;
  }

  const result = await mutateBalance({
    targetUserId: userId,
    amount,
    type: "use",
    description,
    orderId,
    direction: "decrement",
  });

  res.status(200).json({ success: true, data: { ...result, userId, subtractedAmount: amount } });
}

async function handleSignupBonus(userId: string, res: Response): Promise<void> {
  const result = await admin.firestore().runTransaction(async (transaction) => {
    const userRef = admin.firestore().collection("users").doc(userId);
    const userSnap = await transaction.get(userRef);

    if (!userSnap.exists) {
      throw new Error("User document was not found.");
    }

    const userData = userSnap.data() || {};
    const currentBalance = userData.pointBalance ?? 0;
    if (userData.signupBonusGrantedAt) {
      return {
        newBalance: currentBalance,
        alreadyGranted: true,
      };
    }

    const newBalance = currentBalance + SIGNUP_BONUS_AMOUNT;
    const now = admin.firestore.FieldValue.serverTimestamp();
    transaction.update(userRef, {
      pointBalance: newBalance,
      signupBonusGrantedAt: now,
      updatedAt: now,
    });
    transaction.set(userRef.collection("pointHistory").doc(), {
      type: "earn",
      amount: SIGNUP_BONUS_AMOUNT,
      description: SIGNUP_BONUS_DESCRIPTION,
      orderId: null,
      date: now,
      balanceAfter: newBalance,
      expired: false,
      source: "signupBonus",
    });

    return {
      newBalance,
      alreadyGranted: false,
    };
  });

  res.status(200).json({ success: true, data: { ...result, userId } });
}

async function handleUse(
  userId: string,
  data: { amount?: number; description?: string; orderId?: string },
  res: Response
): Promise<void> {
  const { amount, description, orderId } = data;

  if (!amount || amount <= 0) {
    res.status(400).json({ success: false, error: "amount must be greater than zero." });
    return;
  }

  if (!orderId) {
    res.status(400).json({ success: false, error: "orderId is required." });
    return;
  }

  const result = await mutateBalance({
    targetUserId: userId,
    amount,
    type: "use",
    description: description || "Point use",
    orderId,
    direction: "decrement",
  });

  res.status(200).json({
    success: true,
    data: { ...result, usedAmount: amount, userId },
  });
}

async function handleBalance(userId: string, res: Response): Promise<void> {
  const userDoc = await admin.firestore().collection("users").doc(userId).get();

  if (!userDoc.exists) {
    res.status(404).json({ success: false, error: "User document was not found." });
    return;
  }

  const pointBalance = userDoc.data()?.pointBalance ?? 0;
  res.status(200).json({ success: true, data: { pointBalance } });
}

async function handleHistory(
  userId: string,
  data: { limit?: number; lastDocId?: string },
  res: Response
): Promise<void> {
  const limitCount = data.limit ?? 50;

  let queryRef = admin
    .firestore()
    .collection("users")
    .doc(userId)
    .collection("pointHistory")
    .orderBy("date", "desc")
    .limit(limitCount);

  if (data.lastDocId) {
    const lastDoc = await admin
      .firestore()
      .collection("users")
      .doc(userId)
      .collection("pointHistory")
      .doc(data.lastDocId)
      .get();

    if (lastDoc.exists) {
      queryRef = queryRef.startAfter(lastDoc);
    }
  }

  const snapshot = await queryRef.get();
  const history = snapshot.docs.map((historyDoc) => ({
    id: historyDoc.id,
    ...historyDoc.data(),
  }));

  res.status(200).json({
    success: true,
    data: {
      history,
      hasMore: snapshot.docs.length === limitCount,
      lastDocId: snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1].id : null,
    },
  });
}
