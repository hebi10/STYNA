import { onRequest } from "firebase-functions/v2/https";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { issueUserCouponInTransaction, CouponIssuanceError } from "../domain/couponIssuance";
import { verifyAuth, AuthError } from "../utils/auth";
import { applyNoStoreHeaders } from "../utils/http";

class EventParticipationError extends Error {
  constructor(
    public statusCode: number,
    message: string
  ) {
    super(message);
    this.name = "EventParticipationError";
  }
}

function ensureString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function toDate(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (value && typeof value === "object" && "toDate" in value) {
    const date = (value as { toDate: () => Date }).toDate();
    return Number.isFinite(date.getTime()) ? date : null;
  }
  const date = new Date(ensureString(value));
  return Number.isFinite(date.getTime()) ? date : null;
}

function toCount(value: unknown): number {
  const count = typeof value === "number" ? value : Number(value);
  return Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
}

export const event = onRequest(
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
      const userId = await verifyAuth(req.headers.authorization);
      const eventId = ensureString(req.body?.eventId);
      if (!eventId) {
        res.status(400).json({ success: false, error: "eventId is required." });
        return;
      }

      const db = getFirestore();
      const result = await db.runTransaction(async (transaction) => {
        const eventRef = db.collection("events").doc(eventId);
        const participantRef = db.collection("eventParticipants").doc(`${eventId}_${userId}`);
        const [eventDoc, participantDoc] = await Promise.all([
          transaction.get(eventRef),
          transaction.get(participantRef),
        ]);

        if (!eventDoc.exists) {
          throw new EventParticipationError(404, "존재하지 않는 이벤트입니다.");
        }

        const eventData = eventDoc.data() || {};
        if (participantDoc.exists) {
          return {
            alreadyParticipated: true,
            participantCount: toCount(eventData.participantCount),
            rewardIssued: Boolean(participantDoc.data()?.rewardCouponId),
          };
        }

        const now = new Date();
        const startDate = toDate(eventData.startDate);
        const endDate = toDate(eventData.endDate);
        if (!eventData.isActive) throw new EventParticipationError(403, "비활성화된 이벤트입니다.");
        if (!startDate || now < startDate) throw new EventParticipationError(409, "아직 시작되지 않은 이벤트입니다.");
        if (!endDate || now > endDate) throw new EventParticipationError(409, "종료된 이벤트입니다.");
        if (eventData.eventType === "coupon" && eventData.couponType === "manual") {
          throw new EventParticipationError(403, "수동 쿠폰 이벤트는 직접 참여할 수 없습니다.");
        }

        const participantCount = toCount(eventData.participantCount);
        const maxParticipants = toCount(eventData.maxParticipants);
        if (eventData.hasMaxParticipants === true && maxParticipants > 0 && participantCount >= maxParticipants) {
          throw new EventParticipationError(409, "참여 인원이 마감되었습니다.");
        }

        const rewardCouponId = ensureString(eventData.rewardCouponId);
        const reward = rewardCouponId
          ? await issueUserCouponInTransaction(transaction, db, { userId, couponId: rewardCouponId })
          : null;

        transaction.set(participantRef, {
          eventId,
          userId,
          participatedAt: FieldValue.serverTimestamp(),
          rewardCouponId: rewardCouponId || null,
          userCouponId: reward?.userCouponId || null,
          couponUsed: false,
        });
        transaction.update(eventRef, {
          participantCount: FieldValue.increment(1),
          updatedAt: FieldValue.serverTimestamp(),
        });

        return {
          alreadyParticipated: false,
          participantCount: participantCount + 1,
          rewardIssued: Boolean(reward),
          userCouponId: reward?.userCouponId,
        };
      });

      res.status(200).json({ success: true, data: result });
    } catch (error) {
      if (error instanceof AuthError || error instanceof EventParticipationError || error instanceof CouponIssuanceError) {
        res.status(error.statusCode).json({ success: false, error: error.message });
        return;
      }
      console.error("Event participation error:", error);
      res.status(500).json({ success: false, error: "이벤트 참여 처리에 실패했습니다." });
    }
  }
);
