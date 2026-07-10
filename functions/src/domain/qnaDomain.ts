export type QnARecord = Record<string, unknown>;

export interface QnAResponsePayload {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  category: string;
  title: string;
  content: string;
  images?: string[];
  isSecret: boolean;
  status: string;
  views: number;
  isNotified: boolean;
  createdAt: string;
  updatedAt: string;
  productId?: string;
  productName?: string;
  answer?: {
    content: string;
    answeredBy: string;
    answeredAt: string;
    isAdmin: boolean;
  };
}

export function ensureString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function dateLikeToString(value: unknown): string {
  if (typeof value === "string") return value;
  if (!value) return "";
  if (value && typeof value === "object" && "toDate" in value) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return "";
}

export function toSafeQnA(id: string, data: QnARecord): QnAResponsePayload {
  return {
    id,
    userId: ensureString(data.userId),
    userEmail: ensureString(data.userEmail),
    userName: ensureString(data.userName),
    category: ensureString(data.category),
    title: ensureString(data.title),
    content: ensureString(data.content),
    images: Array.isArray(data.images) ? data.images.filter((value): value is string => typeof value === "string") : undefined,
    isSecret: data.isSecret === true,
    status: ensureString(data.status),
    views: typeof data.views === "number" ? data.views : 0,
    isNotified: data.isNotified === true,
    createdAt: dateLikeToString(data.createdAt),
    updatedAt: dateLikeToString(data.updatedAt),
    productId: data.productId ? ensureString(data.productId) : undefined,
    productName: data.productName ? ensureString(data.productName) : undefined,
    answer: data.answer && typeof data.answer === "object"
      ? {
          content: ensureString((data.answer as QnARecord).content),
          answeredBy: ensureString((data.answer as QnARecord).answeredBy),
          answeredAt: dateLikeToString((data.answer as QnARecord).answeredAt),
          isAdmin: (data.answer as QnARecord).isAdmin === true,
        }
      : undefined,
  };
}
