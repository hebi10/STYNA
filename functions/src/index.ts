// Firebase Admin 초기화 (반드시 첫 번째 import)
import "./utils/firebaseInit";

import { onRequest } from "firebase-functions/v2/https";
import * as path from "path";
import { secrets } from "./config/environment";
import { SENSITIVE_FUNCTION_CORS } from "./utils/http";

// ── 핸들러 ──
export { points } from "./handlers/points";
export { coupon } from "./handlers/coupon";
export { config } from "./handlers/config";
export { chat } from "./handlers/chat";
export { adminUsers } from "./handlers/adminUsers";
export { qna } from "./handlers/qna";
export { order } from "./handlers/order";

// ── 크론 ──
export { expirePoints } from "./cron/expirePoints";
export { cleanupExpiredCoupons } from "./cron/cleanupExpiredCoupons";

/* ============================
   Next.js SSR 서버
============================ */

interface NextApp {
  prepare(): Promise<void>;
  getRequestHandler(): (req: unknown, res: unknown) => void | Promise<void>;
}

let app: NextApp | undefined;
let handler: ((req: unknown, res: unknown) => void | Promise<void>) | undefined;
let prepared = false;

export const nextjsServer = onRequest(
  {
    region: "us-central1",
    memory: "2GiB",
    timeoutSeconds: 60,
    invoker: "public",
    cors: SENSITIVE_FUNCTION_CORS,
    secrets: [secrets.OPENAI_API_KEY],
  },
  async (req, res) => {
    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }

    try {
      if (!prepared) {
        const next = require("next") as (options: {
          dev: boolean;
          dir: string;
          conf: { distDir: string };
        }) => NextApp;

        app = next({
          dev: false,
          dir: path.join(__dirname, ".."),
          conf: {
            distDir: ".next",
          },
        });

        await app.prepare();
        handler = app.getRequestHandler();
        prepared = true;
      }

      if (!handler) {
        throw new Error("Next.js handler was not initialized.");
      }

      await handler(req, res);
    } catch (error) {
      console.error("Next.js server error:", error);
      res.status(500).json({
        error: "Internal Server Error",
        details: String(error),
      });
    }
  }
);
