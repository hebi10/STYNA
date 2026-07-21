export type QnARecord = Record<string, unknown>;

export interface QnAResponsePayload {
  id: string;
  userName: string;
  category: string;
  title: string;
  content: string;
  images?: string[];
  isSecret: boolean;
  status: string;
  views: number;
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

export interface PublicQnAListRequest {
  filters: {
    category?: string;
    status?: string;
    productId?: string;
  };
  page: number;
  limit: number;
}

const QNA_CATEGORIES = [
  "product",
  "size",
  "delivery",
  "return",
  "payment",
  "general",
  "other",
] as const;

const QNA_STATUSES = ["waiting", "answered", "closed"] as const;

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

function maskPublicName(value: unknown): string {
  if (typeof value !== "string") return "사용자";

  const name = value.trim();
  const characters = Array.from(name);
  if (characters.length < 2 || /\s/.test(name)) return "사용자";

  return `${characters[0]}${"*".repeat(characters.length - 1)}`;
}

export function parsePublicQnAListRequest(input: unknown): PublicQnAListRequest | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;

  const request = input as QnARecord;
  const rawFilters = request.filters ?? {};
  if (!rawFilters || typeof rawFilters !== "object" || Array.isArray(rawFilters)) return null;

  const filters = rawFilters as QnARecord;
  const filterKeys = Object.keys(filters);
  if (!filterKeys.every((key) => ["category", "status", "productId"].includes(key))) {
    return null;
  }
  if (filterKeys.length > 1) return null;

  const category = filters.category;
  if (category !== undefined &&
      (typeof category !== "string" || !QNA_CATEGORIES.includes(category as typeof QNA_CATEGORIES[number]))) {
    return null;
  }

  const status = filters.status;
  if (status !== undefined &&
      (typeof status !== "string" || !QNA_STATUSES.includes(status as typeof QNA_STATUSES[number]))) {
    return null;
  }

  const productId = filters.productId;
  if (productId !== undefined &&
      (typeof productId !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(productId))) {
    return null;
  }

  const page = request.page === undefined ? 1 : request.page;
  const limit = request.limit === undefined ? 10 : request.limit;
  if (typeof page !== "number" || !Number.isInteger(page) || page !== 1) {
    return null;
  }
  if (typeof limit !== "number" || !Number.isInteger(limit) || limit < 1 || limit > 50) {
    return null;
  }

  return {
    filters: {
      ...(typeof category === "string" ? { category } : {}),
      ...(typeof status === "string" ? { status } : {}),
      ...(typeof productId === "string" ? { productId } : {}),
    },
    page,
    limit,
  };
}

export function toSafeQnA(id: string, data: QnARecord): QnAResponsePayload {
  return {
    id,
    userName: maskPublicName(data.userName),
    category: ensureString(data.category),
    title: ensureString(data.title),
    content: ensureString(data.content),
    images: Array.isArray(data.images) ? data.images.filter((value): value is string => typeof value === "string") : undefined,
    isSecret: data.isSecret !== false,
    status: ensureString(data.status),
    views: typeof data.views === "number" ? data.views : 0,
    createdAt: dateLikeToString(data.createdAt),
    updatedAt: dateLikeToString(data.updatedAt),
    productId: data.productId ? ensureString(data.productId) : undefined,
    productName: data.productName ? ensureString(data.productName) : undefined,
    answer: data.answer && typeof data.answer === "object"
      ? {
          content: ensureString((data.answer as QnARecord).content),
          answeredBy: "관리자",
          answeredAt: dateLikeToString((data.answer as QnARecord).answeredAt),
          isAdmin: (data.answer as QnARecord).isAdmin === true,
        }
      : undefined,
  };
}
