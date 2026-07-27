import { getFirestore } from "firebase-admin/firestore";
import { onRequest } from "firebase-functions/v2/https";
import { getMenuResponse, getAIFallbackResponse } from "../chatResponses";
import { buildChatPolicyPrompt } from "../commercePolicy";
import { secrets } from "../config/environment";
import {
  createChatRateLimitSubject,
  consumeChatRateLimit,
} from "../domain/chatRateLimit";
import { AuthError, verifyAuthContext } from "../utils/auth";
import { applyNoStoreHeaders } from "../utils/http";

interface ChatRequest {
  message?: unknown;
  useAI?: unknown;
  conversationHistory?: Array<{
    role: string;
    content: unknown;
  }>;
}

interface OpenAIChatResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

interface SecretValue {
  value(): string;
}

const SYSTEM_PROMPT = `당신은 STYNA 포트폴리오 쇼핑몰의 도움말 챗봇입니다.

=== 데모 경계 ===
STYNA는 박도영의 포트폴리오용 쇼핑몰 데모입니다.
실제 결제·배송·상거래 고객지원 서비스를 제공하지 않습니다.
사람 상담 연결, 문의 접수 완료, 답변 기한을 주장하지 마세요.

=== 서비스 정책 ===
${buildChatPolicyPrompt()}

이모지 금지. 정중하게 답변하세요.
질문을 정확히 파악하고 구현된 데모 정책 범위에서만 답변하세요.`;

const DEFAULT_OPENAI_CHAT_MODEL = "gpt-4o-mini";
const MAX_MESSAGE_LENGTH = 1200;
const MAX_HISTORY_ITEMS = 10;
const MAX_HISTORY_CONTENT_LENGTH = 800;
const CHAT_SESSION_PATTERN = /^[A-Za-z0-9._-]{20,128}$/;

/**
 * POST /chat
 *
 * OpenAI provider 호출의 단일 서버 경계입니다.
 */
export const chat = onRequest(
  {
    cors: [
      "http://localhost:3000",
      "http://localhost:3001",
      "https://hebimall.firebaseapp.com",
      "https://hebimall.web.app",
    ],
    region: "us-central1",
    secrets: [secrets.OPENAI_API_KEY, secrets.CHAT_RATE_LIMIT_SALT],
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

    const body = isRecord(req.body) ? req.body as ChatRequest : {};
    const message = body.message;
    const useAI = body.useAI === true;

    if (typeof message !== "string" || !message.trim()) {
      res.status(400).json({ success: false, error: "메시지가 비어있습니다." });
      return;
    }

    if (message.length > MAX_MESSAGE_LENGTH) {
      res.status(413).json({ success: false, error: "메시지가 너무 깁니다." });
      return;
    }

    const authorizationHeader = getSingleHeader(req.headers.authorization);
    let authenticatedUid: string | undefined;
    if (req.headers.authorization !== undefined) {
      if (!authorizationHeader) {
        res.status(401).json({ success: false, error: "Invalid authentication token." });
        return;
      }

      try {
        const authContext = await verifyAuthContext(authorizationHeader);
        authenticatedUid = authContext.uid;
      } catch (error) {
        const statusCode = error instanceof AuthError ? error.statusCode : 401;
        const errorMessage = error instanceof AuthError
          ? error.message
          : "Invalid authentication token.";
        res.status(statusCode).json({ success: false, error: errorMessage });
        return;
      }
    }

    if (!useAI) {
      sendResponse(res, getMenuResponse(message));
      return;
    }

    const apiKey = readSecret(secrets.OPENAI_API_KEY);
    const rateLimitSalt = readSecret(secrets.CHAT_RATE_LIMIT_SALT);
    if (!apiKey || !rateLimitSalt) {
      sendResponse(res, getAIFallbackResponse(message));
      return;
    }

    const network = req.ip?.trim() || "unknown";
    const subjectInput = authenticatedUid
      ? { salt: rateLimitSalt, uid: authenticatedUid, network }
      : createAnonymousSubjectInput(
        rateLimitSalt,
        getSingleHeader(req.headers["x-chat-session-id"]),
        network,
      );

    if (!subjectInput) {
      res.status(400).json({
        success: false,
        error: "유효한 채팅 세션이 필요합니다.",
      });
      return;
    }

    try {
      const subject = createChatRateLimitSubject(subjectInput);
      const decision = await consumeChatRateLimit(getFirestore(), subject);
      if (!decision.allowed) {
        const retryAfterSeconds = Math.max(1, decision.retryAfterSeconds ?? 60);
        res.set("Retry-After", String(retryAfterSeconds));
        res.status(429).json({
          success: false,
          error: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
          retryAfterSeconds,
        });
        return;
      }
    } catch {
      sendResponse(res, getAIFallbackResponse(message));
      return;
    }

    const providerResponse = await requestOpenAI(
      apiKey,
      message,
      sanitizeConversationHistory(body.conversationHistory),
    );
    sendResponse(res, providerResponse ?? getAIFallbackResponse(message));
  },
);

function createAnonymousSubjectInput(
  salt: string,
  sessionId: string | undefined,
  network: string,
) {
  if (!sessionId || !CHAT_SESSION_PATTERN.test(sessionId)) {
    return null;
  }

  return { salt, sessionId, network };
}

function readSecret(secret: SecretValue): string {
  try {
    return secret.value().trim();
  } catch {
    return "";
  }
}

function getSingleHeader(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sendResponse(
  response: { status(code: number): { json(body: unknown): unknown } },
  message: string,
): void {
  response.status(200).json({ success: true, data: { response: message } });
}

async function requestOpenAI(
  apiKey: string,
  message: string,
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>,
): Promise<string | null> {
  try {
    const openAIResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_CHAT_MODEL?.trim() || DEFAULT_OPENAI_CHAT_MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...conversationHistory,
          { role: "user", content: message },
        ],
        max_tokens: 500,
        temperature: 0.7,
      }),
    });

    if (!openAIResponse.ok) {
      return null;
    }

    const data = await openAIResponse.json() as OpenAIChatResponse;
    const content = data.choices?.[0]?.message?.content;
    return typeof content === "string" && content ? content : null;
  } catch {
    return null;
  }
}

function sanitizeConversationHistory(
  conversationHistory: ChatRequest["conversationHistory"] = [],
): Array<{ role: "user" | "assistant"; content: string }> {
  if (!Array.isArray(conversationHistory)) {
    return [];
  }

  return conversationHistory
    .filter((item): item is { role: "user" | "assistant"; content: string } =>
      (item?.role === "user" || item?.role === "assistant") &&
      typeof item.content === "string" &&
      item.content.trim().length > 0,
    )
    .map(item => ({
      role: item.role,
      content: item.content.slice(0, MAX_HISTORY_CONTENT_LENGTH),
    }))
    .slice(-MAX_HISTORY_ITEMS);
}
