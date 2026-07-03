import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { randomBytes } from "crypto";
import {
  ensureString,
  hashQnAPassword,
  QnARecord,
  toSafeQnA,
  verifyQnASecret,
} from "../domain/qnaDomain";
import { AuthError, verifyAuthContext } from "../utils/auth";
import { applyNoStoreHeaders, SENSITIVE_FUNCTION_CORS } from "../utils/http";

interface VerifySecretRequest {
  qnaId?: unknown;
  password?: unknown;
}

const PASSWORD_RATE_LIMIT_WINDOW_MS = 60 * 1000;
const PASSWORD_RATE_LIMIT_MAX_ATTEMPTS = 10;
const passwordAttemptLog = new Map<string, number[]>();

function getClientKey(req: { headers?: Record<string, unknown>; ip?: string; socket?: { remoteAddress?: string } }): string {
  const forwardedFor = req.headers?.["x-forwarded-for"];
  if (typeof forwardedFor === "string" && forwardedFor.trim()) {
    return forwardedFor.split(",")[0].trim();
  }

  return req.ip || req.socket?.remoteAddress || "unknown";
}

function isPasswordRateLimited(key: string, now = Date.now()): boolean {
  const recentAttempts = (passwordAttemptLog.get(key) ?? [])
    .filter(timestamp => now - timestamp < PASSWORD_RATE_LIMIT_WINDOW_MS);

  if (recentAttempts.length >= PASSWORD_RATE_LIMIT_MAX_ATTEMPTS) {
    passwordAttemptLog.set(key, recentAttempts);
    return true;
  }

  recentAttempts.push(now);
  passwordAttemptLog.set(key, recentAttempts);
  return false;
}

export const qna = onRequest(
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

    const body = req.body as VerifySecretRequest;
    const qnaId = ensureString(body.qnaId);

    if (!qnaId) {
      res.status(400).json({ success: false, error: "qnaId is required." });
      return;
    }

    try {
      let actorUid: string | undefined;
      let actorIsAdmin = false;

      if (req.headers.authorization) {
        try {
          const actorContext = await verifyAuthContext(req.headers.authorization);
          actorUid = actorContext.uid;
          actorIsAdmin = actorContext.isAdmin;
        } catch (error) {
          if (!(error instanceof AuthError) || error.statusCode !== 401) {
            throw error;
          }
        }
      }

      const qnaRef = admin.firestore().collection("qna").doc(qnaId);
      const qnaSnapshot = await qnaRef.get();
      if (!qnaSnapshot.exists) {
        res.status(404).json({ success: false, error: "Question not found." });
        return;
      }

      const qnaData = qnaSnapshot.data() as QnARecord;
      const isSecret = qnaData.isSecret === true;
      const password = ensureString(body.password);
      const actorUidFromData = ensureString(qnaData.userId);
      const isOwner = actorUid === actorUidFromData;

      if (isSecret) {
        const isOwnerOrAdmin = actorIsAdmin || isOwner;
        if (!isOwnerOrAdmin && password && isPasswordRateLimited(`${qnaId}:${getClientKey(req)}`)) {
          res.status(429).json({ success: false, error: "Too many password attempts." });
          return;
        }

        const hasAccess = isOwnerOrAdmin || verifyQnASecret(qnaData, password);

        if (!hasAccess) {
          res.status(401).json({
            success: false,
            needsPassword: true,
            error: "비밀번호가 일치하지 않습니다.",
          });
          return;
        }

        // legacy migration: migrate plain password to salted hash (single time)
        const legacyPassword = ensureString(qnaData.password);
        if (password && legacyPassword && !ensureString(qnaData.passwordHash) && !ensureString(qnaData.passwordSalt)) {
          const salt = randomBytes(16).toString("base64");
          const passwordHash = hashQnAPassword(password, salt);
          await qnaRef.update({
            passwordHash,
            passwordSalt: salt,
            password: admin.firestore.FieldValue.delete(),
          });
        }

        await qnaRef.update({
          views: admin.firestore.FieldValue.increment(1),
        });
        res.status(200).json({ success: true, qna: toSafeQnA(qnaId, qnaData) });
        return;
      }

      await qnaRef.update({
        views: admin.firestore.FieldValue.increment(1),
      });
      res.status(200).json({ success: true, qna: toSafeQnA(qnaId, qnaData) });
    } catch (error) {
      if (error instanceof AuthError) {
        res.status(error.statusCode).json({ success: false, error: error.message });
        return;
      }

      console.error("QnA verify error:", error);
      res.status(500).json({ success: false, error: "Internal server error" });
    }
  }
);
