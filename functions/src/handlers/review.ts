import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { AuthError, AuthContext, verifyAuthContext } from "../utils/auth";
import { applyNoStoreHeaders } from "../utils/http";

const REVIEWABLE_ORDER_STATUSES = new Set([
  "delivered",
  "배송완료",
  "purchase_confirmed",
  "구매확정",
]);

class ReviewRequestError extends Error {
  constructor(
    public statusCode: number,
    message: string
  ) {
    super(message);
    this.name = "ReviewRequestError";
  }
}

interface ReviewSubmission {
  orderId: string;
  productId: string;
  size: string;
  color: string;
  rating: number;
  title: string;
  content: string;
  images: string[];
  height?: number;
  weight?: number;
  isRecommended: boolean;
}

function toTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function requireString(value: unknown, fieldName: string, maxLength: number): string {
  const result = toTrimmedString(value);
  if (!result || result.length > maxLength) {
    throw new ReviewRequestError(400, `${fieldName} is invalid.`);
  }
  return result;
}

function parseOptionalNumber(value: unknown, fieldName: string): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new ReviewRequestError(400, `${fieldName} is invalid.`);
  }
  return value;
}

function parseImages(value: unknown): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > 5) {
    throw new ReviewRequestError(400, "images is invalid.");
  }

  return value.map((image) => requireString(image, "images", 2_000));
}

function parseReviewSubmission(body: Record<string, unknown> | undefined): ReviewSubmission {
  const rating = body?.rating;
  if (typeof rating !== "number" || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new ReviewRequestError(400, "rating is invalid.");
  }

  if (typeof body?.isRecommended !== "boolean") {
    throw new ReviewRequestError(400, "isRecommended is invalid.");
  }

  return {
    orderId: requireString(body?.orderId, "orderId", 200),
    productId: requireString(body?.productId, "productId", 200),
    size: typeof body?.size === "string" ? body.size.trim() : "",
    color: typeof body?.color === "string" ? body.color.trim() : "",
    rating,
    title: requireString(body?.title, "title", 120),
    content: requireString(body?.content, "content", 2_000),
    images: parseImages(body?.images),
    height: parseOptionalNumber(body?.height, "height"),
    weight: parseOptionalNumber(body?.weight, "weight"),
    isRecommended: body.isRecommended,
  };
}

function getOrderItems(orderData: admin.firestore.DocumentData): Array<Record<string, unknown>> {
  return Array.isArray(orderData.products)
    ? orderData.products.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    : [];
}

function hasPurchasedOption(orderData: admin.firestore.DocumentData, submission: ReviewSubmission): boolean {
  return getOrderItems(orderData).some((item) => (
    toTrimmedString(item.productId) === submission.productId &&
    toTrimmedString(item.size) === submission.size &&
    toTrimmedString(item.color) === submission.color &&
    typeof item.quantity === "number" && item.quantity > 0
  ));
}

function getReviewDocumentId(submission: Pick<ReviewSubmission, "orderId" | "productId" | "size" | "color">): string {
  return Buffer.from(
    JSON.stringify([submission.orderId, submission.productId, submission.size, submission.color]),
    "utf8"
  ).toString("base64url");
}

function getVerifiedUserName(authContext: AuthContext): string {
  const tokenName = toTrimmedString(authContext.token.name);
  return tokenName.slice(0, 80) || "익명";
}

function isReviewableOrderStatus(value: unknown): boolean {
  return REVIEWABLE_ORDER_STATUSES.has(toTrimmedString(value));
}

async function listEligibleOptions(authContext: AuthContext, productId: string) {
  const db = admin.firestore();
  const orderSnapshot = await db.collection("orders").where("userId", "==", authContext.uid).get();
  const candidates = orderSnapshot.docs.flatMap((orderDoc) => {
    const orderData = orderDoc.data() || {};
    if (!isReviewableOrderStatus(orderData.status)) return [];

    return getOrderItems(orderData)
      .filter((item) => toTrimmedString(item.productId) === productId && typeof item.quantity === "number" && item.quantity > 0)
      .map((item) => ({
        orderId: orderDoc.id,
        orderNumber: toTrimmedString(orderData.orderNumber),
        productId,
        size: toTrimmedString(item.size),
        color: toTrimmedString(item.color),
      }));
  });

  const options = await Promise.all(candidates.map(async (candidate) => {
    const reviewRef = db.collection("reviews").doc(getReviewDocumentId(candidate));
    const reviewDoc = await reviewRef.get();
    return reviewDoc.exists ? null : candidate;
  }));

  return options.filter((option): option is NonNullable<typeof option> => option !== null);
}

export const review = onRequest(
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
      const authContext = await verifyAuthContext(req.headers.authorization);
      const body = req.body as Record<string, unknown> | undefined;
      const action = toTrimmedString(body?.action);

      if (action === "eligibleOptions") {
        const productId = requireString(body?.productId, "productId", 200);
        const options = await listEligibleOptions(authContext, productId);
        res.status(200).json({ success: true, data: { options } });
        return;
      }

      const submission = parseReviewSubmission(body);
      const db = admin.firestore();
      const result = await db.runTransaction(async (transaction) => {
        const orderRef = db.collection("orders").doc(submission.orderId);
        const reviewRef = db.collection("reviews").doc(getReviewDocumentId(submission));
        const [orderDoc, existingReview] = await Promise.all([
          transaction.get(orderRef),
          transaction.get(reviewRef),
        ]);

        if (!orderDoc.exists) {
          throw new ReviewRequestError(404, "주문을 찾을 수 없습니다.");
        }

        const orderData = orderDoc.data() || {};
        if (toTrimmedString(orderData.userId) !== authContext.uid) {
          throw new ReviewRequestError(403, "이 주문의 리뷰를 작성할 권한이 없습니다.");
        }
        if (!isReviewableOrderStatus(orderData.status)) {
          throw new ReviewRequestError(400, "배송 완료 또는 구매 확정 후에만 리뷰를 작성할 수 있습니다.");
        }
        if (!hasPurchasedOption(orderData, submission)) {
          throw new ReviewRequestError(400, "주문에 포함되지 않은 상품 옵션입니다.");
        }
        if (existingReview.exists) {
          throw new ReviewRequestError(409, "이 주문 상품 옵션의 리뷰는 이미 작성했습니다.");
        }

        const now = admin.firestore.FieldValue.serverTimestamp();
        transaction.set(reviewRef, {
          orderId: submission.orderId,
          productId: submission.productId,
          userId: authContext.uid,
          userName: getVerifiedUserName(authContext),
          rating: submission.rating,
          title: submission.title,
          content: submission.content,
          images: submission.images,
          size: submission.size,
          color: submission.color,
          ...(submission.height === undefined ? {} : { height: submission.height }),
          ...(submission.weight === undefined ? {} : { weight: submission.weight }),
          isRecommended: submission.isRecommended,
          verifiedPurchase: true,
          createdAt: now,
          updatedAt: now,
        });

        return {
          reviewId: reviewRef.id,
          userName: getVerifiedUserName(authContext),
        };
      });

      res.status(201).json({
        success: true,
        data: {
          id: result.reviewId,
          ...submission,
          userId: authContext.uid,
          userName: result.userName,
          verifiedPurchase: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      if (error instanceof AuthError || error instanceof ReviewRequestError) {
        res.status(error.statusCode).json({ success: false, error: error.message });
        return;
      }

      console.error("Review request error:", error);
      res.status(500).json({ success: false, error: "리뷰 처리에 실패했습니다." });
    }
  }
);
