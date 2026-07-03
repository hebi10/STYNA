import type { Response } from "express";

export const SENSITIVE_FUNCTION_CORS = [
  "http://localhost:3000",
  "http://localhost:3001",
  "https://hebimall.firebaseapp.com",
  "https://hebimall.web.app",
];

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  Pragma: "no-cache",
  Expires: "0",
};

export function applyNoStoreHeaders(response: Response): void {
  Object.entries(NO_STORE_HEADERS).forEach(([key, value]) => {
    response.set(key, value);
  });
}
