import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import type { Response } from "express";
import {
  ensureString,
  parsePublicQnAListRequest,
  QnARecord,
  toSafeQnA,
} from "../domain/qnaDomain";
import { AuthError, verifyAuthContext } from "../utils/auth";

interface VerifySecretRequest {
  action?: unknown;
  qnaId?: unknown;
  filters?: unknown;
  page?: unknown;
  limit?: unknown;
}

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  Pragma: "no-cache",
  Expires: "0",
};

function applyNoStoreHeaders(res: Response): void {
  Object.entries(NO_STORE_HEADERS).forEach(([key, value]) => {
    res.set(key, value);
  });
}

export const qna = onRequest(
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

    const body = req.body as VerifySecretRequest;
    const action = ensureString(body.action);

    if (action === "publicList") {
      const publicRequest = parsePublicQnAListRequest(body);
      if (!publicRequest) {
        res.status(400).json({ success: false, error: "Invalid public QnA list request." });
        return;
      }

      try {
        const qnaCollection = admin.firestore().collection("qna");
        let publicQuery = qnaCollection.where("isSecret", "==", false);
        const { filters, page, limit } = publicRequest;

        if (filters.category) {
          publicQuery = publicQuery.where("category", "==", filters.category);
        } else if (filters.status) {
          publicQuery = publicQuery.where("status", "==", filters.status);
        } else if (filters.productId) {
          publicQuery = publicQuery.where("productId", "==", filters.productId);
        }

        const [listSnapshot, countSnapshot] = await Promise.all([
          publicQuery
            .orderBy("createdAt", "desc")
            .offset((page - 1) * limit)
            .limit(limit)
            .get(),
          publicQuery.count().get(),
        ]);
        const totalCount = countSnapshot.data().count;

        res.status(200).json({
          success: true,
          qnas: listSnapshot.docs.map((snapshot) =>
            toSafeQnA(snapshot.id, snapshot.data() as QnARecord)
          ),
          pagination: {
            page,
            limit,
            totalCount,
            totalPages: Math.ceil(totalCount / limit),
          },
        });
      } catch (error) {
        console.error("Public QnA list error:", error);
        res.status(500).json({ success: false, error: "Internal server error" });
      }
      return;
    }

    if (action && action !== "getDetail") {
      res.status(400).json({ success: false, error: "Unsupported QnA action." });
      return;
    }

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
      const isPublic = qnaData.isSecret === false;
      const actorUidFromData = ensureString(qnaData.userId);
      const isOwner = actorUid === actorUidFromData;

      if (!isPublic) {
        const isOwnerOrAdmin = actorIsAdmin || isOwner;

        if (!actorUid) {
          res.status(401).json({
            success: false,
            error: "로그인이 필요합니다.",
          });
          return;
        }

        if (!isOwnerOrAdmin) {
          res.status(403).json({
            success: false,
            error: "이 비밀글을 조회할 권한이 없습니다.",
          });
          return;
        }

        await qnaRef.update({
          views: admin.firestore.FieldValue.increment(1),
        });
        res.status(200).json({
          success: true,
          qna: toSafeQnA(qnaId, qnaData),
        });
        return;
      }

      await qnaRef.update({
        views: admin.firestore.FieldValue.increment(1),
      });
      res.status(200).json({
        success: true,
        qna: toSafeQnA(qnaId, qnaData),
      });
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
