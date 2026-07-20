jest.mock("firebase-functions/v2/https", () => ({
  onRequest: (_options: unknown, handler: unknown) => handler,
}));

jest.mock("../src/utils/auth", () => ({
  verifyAuthContext: jest.fn(),
  verifyAuth: jest.fn(),
  requireAdmin: jest.fn(),
  AuthError: class AuthError extends Error {
    constructor(public statusCode: number, message: string) {
      super(message);
    }
  },
}));

jest.mock("firebase-admin", () => {
  const firestore = jest.fn();
  Object.assign(firestore, {
    FieldValue: {
      serverTimestamp: jest.fn(() => "server-time"),
      increment: jest.fn((value: number) => ({ increment: value })),
      delete: jest.fn(() => "deleted"),
      arrayUnion: jest.fn((value: unknown) => ({ arrayUnion: value })),
    },
    Timestamp: { now: jest.fn(() => "timestamp") },
  });

  return {
    firestore,
    auth: jest.fn(),
  };
});

jest.mock("firebase-admin/firestore", () => ({
  getFirestore: jest.fn(),
  FieldValue: {
    serverTimestamp: jest.fn(() => "server-time"),
    increment: jest.fn((value: number) => ({ increment: value })),
    delete: jest.fn(() => "deleted"),
    arrayUnion: jest.fn((value: unknown) => ({ arrayUnion: value })),
  },
}));

import * as admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import { points } from "../src/handlers/points";
import { coupon } from "../src/handlers/coupon";
import { adminUsers } from "../src/handlers/adminUsers";
import { order } from "../src/handlers/order";
import { qna } from "../src/handlers/qna";
import { event } from "../src/handlers/event";
import { review } from "../src/handlers/review";
import { AuthError, verifyAuthContext, verifyAuth, requireAdmin } from "../src/utils/auth";

type Handler = (req: {
  method: string;
  body?: Record<string, unknown>;
  headers: { authorization?: string };
}, res: MockResponse) => Promise<void>;

interface MockResponse {
  set: jest.Mock;
  status: jest.Mock;
  json: jest.Mock;
  send: jest.Mock;
}

function createResponse(): MockResponse {
  const response: MockResponse = {
    set: jest.fn(),
    status: jest.fn(),
    json: jest.fn(),
    send: jest.fn(),
  };
  response.status.mockReturnValue(response);
  return response;
}

describe("sensitive function cache headers", () => {
  test.each([
    ["points", points as unknown as Handler],
    ["coupon", coupon as unknown as Handler],
    ["adminUsers", adminUsers as unknown as Handler],
    ["qna", qna as unknown as Handler],
  ])("%s sets no-store headers before returning", async (_name, handler) => {
    const response = createResponse();

    await handler({ method: "OPTIONS", headers: {} }, response);

    expect(response.set).toHaveBeenCalledWith("Cache-Control", "no-store, max-age=0");
    expect(response.set).toHaveBeenCalledWith("Pragma", "no-cache");
    expect(response.set).toHaveBeenCalledWith("Expires", "0");
  });
});

describe("admin user lifecycle", () => {
  const operationOrder: string[] = [];
  let userData: Record<string, unknown>;
  let userExists: boolean;
  let authClaims: Record<string, unknown>;
  let authDisabled: boolean;
  let userRef: {
    get: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
  let authApi: {
    getUser: jest.Mock;
    setCustomUserClaims: jest.Mock;
    updateUser: jest.Mock;
    revokeRefreshTokens: jest.Mock;
    deleteUser: jest.Mock;
  };

  beforeEach(() => {
    operationOrder.length = 0;
    userExists = true;
    authClaims = { newsletter: true, role: "user" };
    authDisabled = false;
    userData = {
      role: "user",
      isAdmin: false,
      status: "active",
    };
    userRef = {
      get: jest.fn(async () => ({
        exists: userExists,
        data: () => ({ ...userData }),
      })),
      update: jest.fn(async (updates: Record<string, unknown>) => {
        if ("role" in updates) {
          operationOrder.push("document-role");
        }
        if ("status" in updates) {
          operationOrder.push(`document-status:${updates.status}`);
        }
        Object.assign(userData, updates);
      }),
      delete: jest.fn(),
    };
    authApi = {
      getUser: jest.fn(async () => ({
        uid: "user-1",
        customClaims: { ...authClaims },
        disabled: authDisabled,
      })),
      setCustomUserClaims: jest.fn(async (_userId: string, claims: Record<string, unknown>) => {
        operationOrder.push("claims");
        authClaims = { ...claims };
      }),
      updateUser: jest.fn(async (_userId: string, updates: { disabled: boolean }) => {
        operationOrder.push(updates.disabled ? "auth-disable" : "auth-enable");
        authDisabled = updates.disabled;
      }),
      revokeRefreshTokens: jest.fn(async () => {
        operationOrder.push("revoke");
      }),
      deleteUser: jest.fn(),
    };
    jest.mocked(admin.firestore).mockReturnValue({
      collection: jest.fn(() => ({
        doc: jest.fn(() => userRef),
      })),
    } as never);
    jest.mocked(admin.auth).mockReturnValue(authApi as never);
    jest.mocked(requireAdmin).mockResolvedValue({
      uid: "admin-1",
      token: {} as never,
      role: "admin",
      isAdmin: true,
    });
    jest.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  async function request(body: Record<string, unknown>) {
    const response = createResponse();
    await (adminUsers as unknown as Handler)({
      method: "POST",
      headers: { authorization: "Bearer admin-token" },
      body,
    }, response);
    return response;
  }

  test.each([
    ["unsupported action", { action: "unknown", userId: "user-1" }],
    ["invalid role", { action: "setRole", userId: "user-1", role: "owner" }],
    ["invalid status", { action: "setStatus", userId: "user-1", status: "deleted" }],
    ["missing userId", { action: "deleteUser" }],
    ["userId with surrounding whitespace", { action: "deleteUser", userId: " user-1 " }],
    ["userId with a path separator", { action: "deleteUser", userId: "users/user-1" }],
    ["userId longer than Firebase Auth permits", { action: "deleteUser", userId: "a".repeat(129) }],
  ])("rejects %s after requiring strict admin access", async (_caseName, body) => {
    const response = await request(body);

    expect(requireAdmin).toHaveBeenCalledWith("Bearer admin-token");
    expect(response.status).toHaveBeenCalledWith(400);
    expect(userRef.update).not.toHaveBeenCalled();
    expect(authApi.updateUser).not.toHaveBeenCalled();
  });

  test.each([
    { action: "setRole", userId: "user-1", role: "admin" },
    { action: "setStatus", userId: "user-1", status: "inactive" },
    { action: "deleteUser", userId: "user-1" },
  ])("does not mutate a missing target document for $action", async (body) => {
    userExists = false;

    const response = await request(body);

    expect(response.status).toHaveBeenCalledWith(404);
    expect(userRef.update).not.toHaveBeenCalled();
    expect(authApi.setCustomUserClaims).not.toHaveBeenCalled();
    expect(authApi.updateUser).not.toHaveBeenCalled();
    expect(authApi.revokeRefreshTokens).not.toHaveBeenCalled();
  });

  test("normalizes missing admin claims for an existing admin document", async () => {
    userData.role = "admin";
    userData.isAdmin = true;
    authClaims = { newsletter: true, role: "user" };

    const response = await request({ action: "setRole", userId: "user-1", role: "admin" });

    expect(operationOrder).toEqual(["claims", "revoke"]);
    expect(userRef.update).not.toHaveBeenCalled();
    expect(authApi.getUser).toHaveBeenCalledWith("user-1");
    expect(authClaims).toEqual({ newsletter: true, role: "admin", admin: true });
    expect(response.status).toHaveBeenCalledWith(200);
  });

  test("repairs a mismatched role marker after confirming matching claims", async () => {
    userData.role = "admin";
    userData.isAdmin = false;
    authClaims = { newsletter: true, role: "admin", admin: true };

    const response = await request({ action: "setRole", userId: "user-1", role: "admin" });

    expect(userRef.update).toHaveBeenCalledWith({
      role: "admin",
      isAdmin: true,
      updatedAt: "server-time",
    });
    expect(operationOrder).toEqual(["document-role"]);
    expect(authApi.getUser).toHaveBeenCalledWith("user-1");
    expect(authApi.setCustomUserClaims).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(200);
  });

  test("recovers disabled Auth for an already active document after revoking tokens", async () => {
    userData.status = "active";
    authDisabled = true;

    const response = await request({ action: "setStatus", userId: "user-1", status: "active" });

    expect(operationOrder).toEqual(["revoke", "auth-enable"]);
    expect(userRef.update).not.toHaveBeenCalled();
    expect(authApi.updateUser).toHaveBeenCalledWith("user-1", { disabled: false });
    expect(authDisabled).toBe(false);
    expect(response.status).toHaveBeenCalledWith(200);
  });

  test("returns unchanged for an active document with enabled Auth", async () => {
    const response = await request({ action: "setStatus", userId: "user-1", status: "active" });

    expect(authApi.getUser).toHaveBeenCalledWith("user-1");
    expect(operationOrder).toEqual([]);
    expect(userRef.update).not.toHaveBeenCalled();
    expect(authApi.updateUser).not.toHaveBeenCalled();
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ unchanged: true }),
    }));
  });

  test.each(["inactive", "banned"])(
    "disables Auth and revokes tokens for an already %s document",
    async (status) => {
      userData.status = status;

      const response = await request({ action: "setStatus", userId: "user-1", status });

      expect(operationOrder).toEqual(["auth-disable", "revoke"]);
      expect(userRef.update).not.toHaveBeenCalled();
      expect(authDisabled).toBe(true);
      expect(response.status).toHaveBeenCalledWith(200);
    }
  );

  test("returns unchanged for an inactive document with disabled Auth", async () => {
    userData.status = "inactive";
    authDisabled = true;

    const response = await request({ action: "setStatus", userId: "user-1", status: "inactive" });

    expect(authApi.getUser).toHaveBeenCalledWith("user-1");
    expect(operationOrder).toEqual([]);
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ unchanged: true }),
    }));
  });

  test("removes stale admin claims for an existing user document", async () => {
    authClaims = { newsletter: true, role: "admin", admin: true };

    const response = await request({ action: "setRole", userId: "user-1", role: "user" });

    expect(operationOrder).toEqual(["claims", "revoke"]);
    expect(userRef.update).not.toHaveBeenCalled();
    expect(authClaims).toEqual({ newsletter: true, role: "user" });
    expect(response.status).toHaveBeenCalledWith(200);
  });

  test("revokes stale admin claims before opening the document for promotion", async () => {
    authClaims.admin = true;

    const response = await request({
      action: "setRole",
      userId: "user-1",
      role: "admin",
    });

    expect(userRef.update).toHaveBeenCalledWith({
      role: "admin",
      isAdmin: true,
      updatedAt: "server-time",
    });
    expect(authApi.setCustomUserClaims).toHaveBeenCalledWith("user-1", {
      newsletter: true,
      role: "admin",
      admin: true,
    });
    expect(operationOrder).toEqual(["claims", "revoke", "document-role"]);
    expect(response.status).toHaveBeenCalledWith(200);
  });

  test("enables a disabled active user only after completing promotion gates", async () => {
    authDisabled = true;

    const response = await request({ action: "setRole", userId: "user-1", role: "admin" });

    expect(operationOrder).toEqual(["claims", "revoke", "auth-enable", "document-role"]);
    expect(userData.role).toBe("admin");
    expect(authClaims).toEqual(expect.objectContaining({ role: "admin", admin: true }));
    expect(authDisabled).toBe(false);
    expect(response.status).toHaveBeenCalledWith(200);
  });

  test("keeps a disabled inactive user disabled after changing the role to admin", async () => {
    userData.status = "inactive";
    authDisabled = true;

    const response = await request({ action: "setRole", userId: "user-1", role: "admin" });

    expect(operationOrder).toEqual(["claims", "revoke", "document-role"]);
    expect(userData.role).toBe("admin");
    expect(authDisabled).toBe(true);
    expect(authApi.updateUser).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(200);
  });

  test("removes the legacy admin claim when demoting an administrator", async () => {
    userData.role = "admin";
    userData.isAdmin = true;
    authApi.getUser.mockResolvedValue({
      uid: "user-1",
      customClaims: { newsletter: true, role: "admin", admin: true },
    });

    await request({ action: "setRole", userId: "user-1", role: "user" });

    expect(authApi.setCustomUserClaims).toHaveBeenCalledWith("user-1", {
      newsletter: true,
      role: "user",
    });
    expect(operationOrder).toEqual(["document-role", "claims", "revoke"]);
  });

  test.each(["inactive", "banned"])(
    "writes %s before disabling Auth and revoking tokens",
    async (status) => {
      const response = await request({ action: "setStatus", userId: "user-1", status });

      expect(userRef.update).toHaveBeenCalledWith({
        status,
        updatedAt: "server-time",
      });
      expect(authApi.updateUser).toHaveBeenCalledWith("user-1", { disabled: true });
      expect(operationOrder).toEqual([`document-status:${status}`, "auth-disable", "revoke"]);
      expect(response.status).toHaveBeenCalledWith(200);
    }
  );

  test("enables Auth and revokes old tokens before opening the active document", async () => {
    userData.status = "inactive";

    const response = await request({
      action: "setStatus",
      userId: "user-1",
      status: "active",
    });

    expect(authApi.updateUser).toHaveBeenCalledWith("user-1", { disabled: false });
    expect(userRef.update).toHaveBeenCalledWith({
      status: "active",
      updatedAt: "server-time",
    });
    expect(operationOrder).toEqual(["auth-enable", "revoke", "document-status:active"]);
    expect(response.status).toHaveBeenCalledWith(200);
  });

  test("soft deletes the document before disabling Auth and revoking tokens", async () => {
    const response = await request({ action: "deleteUser", userId: "user-1" });

    expect(userRef.update).toHaveBeenCalledWith({
      status: "deleted",
      deletedAt: "server-time",
      updatedAt: "server-time",
    });
    expect(authApi.updateUser).toHaveBeenCalledWith("user-1", { disabled: true });
    expect(operationOrder).toEqual(["document-status:deleted", "auth-disable", "revoke"]);
    expect(userRef.delete).not.toHaveBeenCalled();
    expect(authApi.deleteUser).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(200);
  });

  test("keeps the document closed after an ambiguous claims failure and converges on retry", async () => {
    authApi.setCustomUserClaims.mockImplementationOnce(async (_userId, claims) => {
      operationOrder.push("claims");
      authClaims = { ...claims };
      throw new Error("claims unavailable");
    });

    const failedResponse = await request({ action: "setRole", userId: "user-1", role: "admin" });

    expect(userData.role).toBe("user");
    expect(userData.isAdmin).toBe(false);
    expect(authClaims.role).toBe("admin");
    expect(operationOrder).toEqual(["claims"]);
    expect(userRef.update).not.toHaveBeenCalled();
    expect(failedResponse.status).toHaveBeenCalledWith(503);
    expect(failedResponse.json).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      retryable: true,
      outcome: "unknown",
    }));

    operationOrder.length = 0;
    const retriedResponse = await request({ action: "setRole", userId: "user-1", role: "admin" });

    expect(operationOrder).toEqual(["claims", "revoke", "document-role"]);
    expect(userData.role).toBe("admin");
    expect(retriedResponse.status).toHaveBeenCalledWith(200);
  });

  test("keeps the document closed after a revoke failure and converges on retry", async () => {
    authApi.revokeRefreshTokens.mockImplementationOnce(async () => {
      operationOrder.push("revoke");
      throw new Error("revoke unavailable");
    });

    const failedResponse = await request({ action: "setRole", userId: "user-1", role: "admin" });

    expect(userData.role).toBe("user");
    expect(authClaims.role).toBe("admin");
    expect(operationOrder).toEqual(["claims", "revoke"]);
    expect(userRef.update).not.toHaveBeenCalled();
    expect(failedResponse.status).toHaveBeenCalledWith(503);

    operationOrder.length = 0;
    const retriedResponse = await request({ action: "setRole", userId: "user-1", role: "admin" });

    expect(operationOrder).toEqual(["claims", "revoke", "document-role"]);
    expect(userData.role).toBe("admin");
    expect(authClaims.role).toBe("admin");
    expect(authDisabled).toBe(false);
    expect(retriedResponse.status).toHaveBeenCalledWith(200);
  });

  test("treats a committed final promotion write as forward progress and converges on retry", async () => {
    userRef.update.mockImplementationOnce(async (updates: Record<string, unknown>) => {
      operationOrder.push("document-role");
      Object.assign(userData, updates);
      throw new Error("commit response unavailable");
    });

    const failedResponse = await request({ action: "setRole", userId: "user-1", role: "admin" });

    expect(userData.role).toBe("admin");
    expect(userData.isAdmin).toBe(true);
    expect(authClaims.role).toBe("admin");
    expect(operationOrder).toEqual(["claims", "revoke", "document-role"]);
    expect(failedResponse.status).toHaveBeenCalledWith(503);

    operationOrder.length = 0;
    const retriedResponse = await request({ action: "setRole", userId: "user-1", role: "admin" });

    expect(operationOrder).toEqual([]);
    expect(retriedResponse.status).toHaveBeenCalledWith(200);
    expect(retriedResponse.json).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ unchanged: true }),
    }));
  });

  test("leaves the document closed after an ambiguous enable failure and converges on retry", async () => {
    authDisabled = true;
    authApi.updateUser.mockImplementationOnce(async (_userId, updates) => {
      operationOrder.push(updates.disabled ? "auth-disable" : "auth-enable");
      authDisabled = updates.disabled;
      throw new Error("enable response unavailable");
    });

    const failedResponse = await request({ action: "setRole", userId: "user-1", role: "admin" });

    expect(userData.role).toBe("user");
    expect(authClaims.role).toBe("admin");
    expect(authDisabled).toBe(false);
    expect(operationOrder).toEqual(["claims", "revoke", "auth-enable"]);
    expect(userRef.update).not.toHaveBeenCalled();
    expect(failedResponse.status).toHaveBeenCalledWith(503);

    operationOrder.length = 0;
    const retriedResponse = await request({ action: "setRole", userId: "user-1", role: "admin" });

    expect(operationOrder).toEqual(["claims", "revoke", "document-role"]);
    expect(userData.role).toBe("admin");
    expect(authDisabled).toBe(false);
    expect(retriedResponse.status).toHaveBeenCalledWith(200);
  });

  test("treats a pre-commit final promotion failure as closed and converges on retry", async () => {
    userRef.update.mockImplementationOnce(async () => {
      operationOrder.push("document-role");
      throw new Error("final write unavailable");
    });

    const failedResponse = await request({ action: "setRole", userId: "user-1", role: "admin" });

    expect(userData.role).toBe("user");
    expect(authClaims.role).toBe("admin");
    expect(operationOrder).toEqual(["claims", "revoke", "document-role"]);
    expect(failedResponse.status).toHaveBeenCalledWith(503);

    operationOrder.length = 0;
    const retriedResponse = await request({ action: "setRole", userId: "user-1", role: "admin" });

    expect(operationOrder).toEqual(["claims", "revoke", "document-role"]);
    expect(userData.role).toBe("admin");
    expect(retriedResponse.status).toHaveBeenCalledWith(200);
  });

  test("treats a committed final active write as forward progress and converges on retry", async () => {
    userData.status = "inactive";
    authDisabled = true;
    userRef.update.mockImplementationOnce(async (updates: Record<string, unknown>) => {
      operationOrder.push(`document-status:${updates.status}`);
      Object.assign(userData, updates);
      throw new Error("commit response unavailable");
    });

    const failedResponse = await request({
      action: "setStatus",
      userId: "user-1",
      status: "active",
    });

    expect(userData.status).toBe("active");
    expect(authDisabled).toBe(false);
    expect(operationOrder).toEqual(["auth-enable", "revoke", "document-status:active"]);
    expect(failedResponse.status).toHaveBeenCalledWith(503);

    operationOrder.length = 0;
    const retriedResponse = await request({
      action: "setStatus",
      userId: "user-1",
      status: "active",
    });

    expect(operationOrder).toEqual([]);
    expect(retriedResponse.status).toHaveBeenCalledWith(200);
    expect(retriedResponse.json).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ unchanged: true }),
    }));
  });

  test("keeps a failed suspension non-active and marks it retryable", async () => {
    authApi.updateUser.mockImplementationOnce(async () => {
      operationOrder.push("auth-disable");
      throw new Error("auth unavailable");
    });

    const response = await request({
      action: "setStatus",
      userId: "user-1",
      status: "inactive",
    });

    expect(userData.status).toBe("inactive");
    expect(operationOrder).toEqual(["document-status:inactive", "auth-disable"]);
    expect(authApi.revokeRefreshTokens).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(503);
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({ retryable: true }));

    operationOrder.length = 0;
    const retriedResponse = await request({
      action: "setStatus",
      userId: "user-1",
      status: "inactive",
    });

    expect(operationOrder).toEqual(["auth-disable", "revoke"]);
    expect(authDisabled).toBe(true);
    expect(retriedResponse.status).toHaveBeenCalledWith(200);
  });

  test("treats a pre-commit final active failure as closed and converges on retry", async () => {
    userData.status = "inactive";
    authDisabled = true;
    userRef.update.mockImplementationOnce(async (updates: Record<string, unknown>) => {
      operationOrder.push(`document-status:${updates.status}`);
      throw new Error("firestore unavailable");
    });

    const failedResponse = await request({
      action: "setStatus",
      userId: "user-1",
      status: "active",
    });

    expect(userData.status).toBe("inactive");
    expect(authDisabled).toBe(false);
    expect(operationOrder).toEqual(["auth-enable", "revoke", "document-status:active"]);
    expect(authApi.revokeRefreshTokens).toHaveBeenCalledTimes(1);
    expect(failedResponse.status).toHaveBeenCalledWith(503);

    operationOrder.length = 0;
    const retriedResponse = await request({
      action: "setStatus",
      userId: "user-1",
      status: "active",
    });

    expect(operationOrder).toEqual(["auth-enable", "revoke", "document-status:active"]);
    expect(userData.status).toBe("active");
    expect(retriedResponse.status).toHaveBeenCalledWith(200);
  });

  test("keeps the active document closed after a revoke failure and converges on retry", async () => {
    userData.status = "inactive";
    authDisabled = true;
    authApi.revokeRefreshTokens.mockImplementationOnce(async () => {
      operationOrder.push("revoke");
      throw new Error("revoke unavailable");
    });

    const failedResponse = await request({
      action: "setStatus",
      userId: "user-1",
      status: "active",
    });

    expect(userData.status).toBe("inactive");
    expect(authDisabled).toBe(false);
    expect(operationOrder).toEqual(["auth-enable", "revoke"]);
    expect(userRef.update).not.toHaveBeenCalled();
    expect(failedResponse.status).toHaveBeenCalledWith(503);

    operationOrder.length = 0;
    const retriedResponse = await request({
      action: "setStatus",
      userId: "user-1",
      status: "active",
    });

    expect(operationOrder).toEqual(["auth-enable", "revoke", "document-status:active"]);
    expect(userData.status).toBe("active");
    expect(retriedResponse.status).toHaveBeenCalledWith(200);
  });

  test("preserves the first deletion timestamp when a partial delete is retried", async () => {
    jest.mocked(admin.firestore.FieldValue.serverTimestamp)
      .mockReturnValueOnce("delete-time" as never)
      .mockReturnValueOnce("retry-time" as never);
    authApi.updateUser.mockImplementationOnce(async (_userId, updates) => {
      operationOrder.push(updates.disabled ? "auth-disable" : "auth-enable");
      authDisabled = updates.disabled;
      throw new Error("auth unavailable");
    });

    const failedResponse = await request({ action: "deleteUser", userId: "user-1" });
    const retriedResponse = await request({ action: "deleteUser", userId: "user-1" });

    expect(failedResponse.status).toHaveBeenCalledWith(503);
    expect(retriedResponse.status).toHaveBeenCalledWith(200);
    expect(userRef.update.mock.calls[0][0]).toEqual({
      status: "deleted",
      deletedAt: "delete-time",
      updatedAt: "delete-time",
    });
    expect(userRef.update.mock.calls[1][0]).toEqual({
      status: "deleted",
      updatedAt: "retry-time",
    });
    expect(userData.deletedAt).toBe("delete-time");
    expect(authApi.deleteUser).not.toHaveBeenCalled();
  });
});

describe("points signup bonus", () => {
  beforeEach(() => {
    jest.mocked(verifyAuthContext).mockResolvedValue({
      uid: "user-1",
      token: {} as never,
      isAdmin: false,
    });
    jest.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  test("grants signup bonus once through a transaction", async () => {
    const response = createResponse();
    const historyDocRef = {};
    const userRef = {
      collection: jest.fn(() => ({
        doc: jest.fn(() => historyDocRef),
      })),
    };
    const transaction = {
      get: jest.fn().mockResolvedValue({
        exists: true,
        data: () => ({ pointBalance: 0 }),
      }),
      update: jest.fn(),
      set: jest.fn(),
    };
    const db = {
      collection: jest.fn(() => ({
        doc: jest.fn(() => userRef),
      })),
      runTransaction: jest.fn((callback: (tx: typeof transaction) => unknown) => callback(transaction)),
    };
    jest.mocked(admin.firestore).mockReturnValue(db as never);

    await (points as unknown as Handler)({
      method: "POST",
      headers: { authorization: "Bearer user-token" },
      body: { action: "signupBonus" },
    }, response);

    expect(db.runTransaction).toHaveBeenCalledTimes(1);
    expect(transaction.update).toHaveBeenCalledWith(userRef, expect.objectContaining({
      pointBalance: 5000,
      signupBonusGrantedAt: "server-time",
    }));
    expect(transaction.set).toHaveBeenCalledWith(historyDocRef, expect.objectContaining({
      type: "earn",
      amount: 5000,
      description: "신규 회원가입 적립",
      balanceAfter: 5000,
    }));
  });
});

describe("coupon issuance", () => {
  beforeEach(() => {
    jest.mocked(verifyAuth).mockResolvedValue("user-1");
    jest.mocked(requireAdmin).mockResolvedValue({
      uid: "admin-1",
      token: {} as never,
      isAdmin: true,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test.each([
    ["issue", { couponId: "coupon-1" }],
    ["register", { couponCode: "WELCOME" }],
  ])("%s runs duplicate check and usedCount update in a transaction", async (action, payload) => {
    const response = createResponse();
    const couponRef = { id: "coupon-1" };
    const userCouponRef = { id: "user-coupon-1" };
    const couponsCollection: { doc: jest.Mock; where: jest.Mock } = {
      doc: jest.fn(() => couponRef),
      where: jest.fn(),
    };
    couponsCollection.where.mockReturnValue(couponsCollection);
    const userCouponsCollection: { doc: jest.Mock; where: jest.Mock } = {
      doc: jest.fn(() => userCouponRef),
      where: jest.fn(),
    };
    userCouponsCollection.where.mockReturnValue(userCouponsCollection);
    const db = {
      collection: jest.fn((name: string) => (name === "coupons" ? couponsCollection : userCouponsCollection)),
      runTransaction: jest.fn(async (callback: (tx: {
        get: jest.Mock;
        set: jest.Mock;
        update: jest.Mock;
      }) => unknown) => callback({
        get: jest
          .fn()
          .mockResolvedValueOnce(action === "register"
            ? {
                empty: false,
                docs: [{ id: "coupon-1", ref: couponRef, data: () => ({
                  name: "Welcome",
                  couponCode: "WELCOME",
                  isActive: true,
                  isDirectAssign: false,
                  expiryDate: "2099-01-01",
                  usedCount: 0,
                  usageLimit: 10,
                }) }],
              }
            : {
                exists: true,
                ref: couponRef,
                data: () => ({
                  name: "Welcome",
                  isActive: true,
                  isDirectAssign: true,
                  expiryDate: "2099-01-01",
                  usedCount: 0,
                  usageLimit: 10,
                }),
              })
          .mockResolvedValueOnce({ empty: true }),
        set: jest.fn(),
        update: jest.fn(),
      })),
    };
    jest.mocked(getFirestore).mockReturnValue(db as never);

    await (coupon as unknown as Handler)({
      method: "POST",
      headers: { authorization: "Bearer user-token" },
      body: { action, ...payload },
    }, response);

    expect(db.runTransaction).toHaveBeenCalledTimes(1);
    expect(response.status).toHaveBeenCalledWith(200);
  });

  test("rejects direct coupon issue by an authenticated non-admin user", async () => {
    const response = createResponse();
    jest.mocked(requireAdmin).mockRejectedValue(new AuthError(403, "Admin privileges are required."));

    await (coupon as unknown as Handler)({
      method: "POST",
      headers: { authorization: "Bearer user-token" },
      body: { action: "issue", couponId: "coupon-1" },
    }, response);

    expect(requireAdmin).toHaveBeenCalledWith("Bearer user-token");
    expect(response.status).toHaveBeenCalledWith(403);
  });
});

describe("order inventory integrity", () => {
  beforeEach(() => {
    jest.mocked(verifyAuthContext).mockResolvedValue({
      uid: "user-1",
      token: {} as never,
      isAdmin: false,
    });
    jest.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  async function submitOrderWithProduct(
    productData: Record<string, unknown>,
    items = [{ productId: "product-1", size: "M", color: "black", quantity: 1 }]
  ) {
    const response = createResponse();
    const userRef = { id: "user-1", collection: jest.fn(() => ({ doc: jest.fn(() => ({ id: "history-1" })) })) };
    const productRef = { id: "product-1" };
    const users = { doc: jest.fn(() => userRef) };
    const products = { doc: jest.fn(() => productRef) };
    const orders = { doc: jest.fn(() => ({ id: "order-1" })) };
    const transaction = {
      get: jest.fn(async (ref: unknown) => {
        if (ref === userRef) {
          return { exists: true, data: () => ({ pointBalance: 0 }) };
        }
        if (ref === productRef) {
          return { exists: true, data: () => productData };
        }
        return { exists: false, data: () => ({}) };
      }),
      set: jest.fn(),
      update: jest.fn(),
    };
    const db = {
      collection: jest.fn((name: string) => ({ users, products, orders }[name] || { doc: jest.fn() })),
      runTransaction: jest.fn((callback: (tx: typeof transaction) => unknown) => callback(transaction)),
    };
    jest.mocked(admin.firestore).mockReturnValue(db as never);

    await (order as unknown as Handler)({
      method: "POST",
      headers: { authorization: "Bearer user-token" },
      body: {
        items,
        deliveryAddress: {
          id: "address-1",
          name: "집",
          recipient: "사용자",
          phone: "010-0000-0000",
          address: "서울시",
          detailAddress: "101호",
          zipCode: "12345",
          isDefault: true,
        },
        paymentMethod: "card",
        deliveryOption: "standard",
      },
    }, response);

    return { response, transaction };
  }

  test("deducts combined quantities for different options of one product once", async () => {
    const response = createResponse();
    const userRef = { id: "user-1", collection: jest.fn(() => ({ doc: jest.fn(() => ({ id: "history-1" })) })) };
    const productRef = { id: "product-1" };
    const orderRef = { id: "order-1" };
    const users = { doc: jest.fn(() => userRef) };
    const products = { doc: jest.fn(() => productRef) };
    const orders = { doc: jest.fn(() => orderRef) };
    const carts = { doc: jest.fn() };
    const transaction = {
      get: jest.fn(async (ref: unknown) => {
        if (ref === userRef) {
          return { exists: true, data: () => ({ pointBalance: 0 }) };
        }
        if (ref === productRef) {
          return {
            exists: true,
            data: () => ({
              name: "테스트 상품",
              stock: 10,
              price: 10000,
              status: "active",
              sizes: ["M", "L"],
              colors: ["black"],
            }),
          };
        }
        return { exists: false, data: () => ({}) };
      }),
      set: jest.fn(),
      update: jest.fn(),
    };
    const db = {
      collection: jest.fn((name: string) => ({ users, products, orders, carts }[name] || { doc: jest.fn() })),
      runTransaction: jest.fn((callback: (tx: typeof transaction) => unknown) => callback(transaction)),
    };
    jest.mocked(admin.firestore).mockReturnValue(db as never);

    await (order as unknown as Handler)({
      method: "POST",
      headers: { authorization: "Bearer user-token" },
      body: {
        items: [
          { productId: "product-1", size: "M", color: "black", quantity: 2 },
          { productId: "product-1", size: "L", color: "black", quantity: 3 },
        ],
        deliveryAddress: {
          id: "address-1",
          name: "집",
          recipient: "사용자",
          phone: "010-0000-0000",
          address: "서울시",
          detailAddress: "101호",
          zipCode: "12345",
          isDefault: true,
        },
        paymentMethod: "card",
        deliveryOption: "standard",
      },
    }, response);

    const productStockUpdates = transaction.update.mock.calls.filter(([ref]) => ref === productRef);
    expect(productStockUpdates).toHaveLength(1);
    expect(productStockUpdates[0][1]).toEqual(expect.objectContaining({ stock: 5 }));
    expect(response.status).toHaveBeenCalledWith(200);
  });

  test("restores combined quantities for different options of one product once", async () => {
    const response = createResponse();
    const orderRef = { id: "order-1" };
    const productRef = { id: "product-1" };
    const orders = { doc: jest.fn(() => orderRef) };
    const products = { doc: jest.fn(() => productRef) };
    const transaction = {
      get: jest.fn(async (ref: unknown) => {
        if (ref === orderRef) {
          return {
            exists: true,
            data: () => ({
              userId: "user-1",
              status: "pending",
              pointUsed: 0,
              products: [
                { productId: "product-1", size: "M", color: "black", quantity: 2 },
                { productId: "product-1", size: "L", color: "black", quantity: 3 },
              ],
            }),
          };
        }
        if (ref === productRef) {
          return { exists: true, data: () => ({ stock: 5 }) };
        }
        return { exists: false, data: () => ({}) };
      }),
      set: jest.fn(),
      update: jest.fn(),
    };
    const db = {
      collection: jest.fn((name: string) => ({ orders, products }[name] || { doc: jest.fn() })),
      runTransaction: jest.fn((callback: (tx: typeof transaction) => unknown) => callback(transaction)),
    };
    jest.mocked(admin.firestore).mockReturnValue(db as never);

    await (order as unknown as Handler)({
      method: "POST",
      headers: { authorization: "Bearer user-token" },
      body: { action: "cancel", orderId: "order-1" },
    }, response);

    const productRestores = transaction.update.mock.calls.filter(([ref]) => ref === productRef);
    expect(productRestores).toHaveLength(1);
    expect(productRestores[0][1]).toEqual(expect.objectContaining({
      stock: { increment: 5 },
    }));
    expect(response.status).toHaveBeenCalledWith(200);
  });

  test("rejects a combined quantity that exceeds the product stock before writing an order", async () => {
    const { response, transaction } = await submitOrderWithProduct(
      { name: "테스트 상품", stock: 4, price: 10000, status: "active", sizes: ["M", "L"], colors: ["black"] },
      [
        { productId: "product-1", size: "M", color: "black", quantity: 2 },
        { productId: "product-1", size: "L", color: "black", quantity: 3 },
      ]
    );

    expect(response.status).toHaveBeenCalledWith(400);
    expect(transaction.update).not.toHaveBeenCalled();
    expect(transaction.set).not.toHaveBeenCalled();
  });

  test.each([
    ["inactive status", { name: "테스트 상품", stock: 10, price: 10000, status: "inactive", sizes: ["M"], colors: ["black"] }],
    ["undeclared size", { name: "테스트 상품", stock: 10, price: 10000, status: "active", sizes: ["S"], colors: ["black"] }],
    ["undeclared color", { name: "테스트 상품", stock: 10, price: 10000, status: "active", sizes: ["M"], colors: ["white"] }],
  ])("rejects an order with %s before writing an order", async (_caseName, productData) => {
    const { response, transaction } = await submitOrderWithProduct(productData);

    expect(response.status).toHaveBeenCalledWith(400);
    expect(transaction.update).not.toHaveBeenCalled();
    expect(transaction.set).not.toHaveBeenCalled();
  });

  test("accepts a legacy product with no status or option declarations", async () => {
    const { response, transaction } = await submitOrderWithProduct({
      name: "기존 상품",
      stock: 10,
      price: 10000,
    });

    expect(response.status).toHaveBeenCalledWith(200);
    expect(transaction.set).toHaveBeenCalledTimes(1);
  });
});

describe("QnA secret access", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test("does not accept a secret QnA password without owner or admin authentication", async () => {
    const response = createResponse();
    const qnaRef = {
      get: jest.fn().mockResolvedValue({
        exists: true,
        data: () => ({
          userId: "owner-1",
          isSecret: true,
          password: "1234",
        }),
      }),
      update: jest.fn(),
    };
    const db = {
      collection: jest.fn(() => ({ doc: jest.fn(() => qnaRef) })),
    };
    jest.mocked(admin.firestore).mockReturnValue(db as never);

    await (qna as unknown as Handler)({
      method: "POST",
      headers: {},
      body: { qnaId: "qna-1", password: "1234" },
    }, response);

    expect(response.status).toHaveBeenCalledWith(401);
    expect(qnaRef.update).not.toHaveBeenCalled();
  });

  test("returns a public list through an email-free server projection", async () => {
    const response = createResponse();
    const publicDoc = {
      id: "qna-1",
      data: () => ({
        userId: "owner-1",
        userEmail: "owner@example.com",
        userName: "owner name",
        category: "product",
        title: "문의",
        content: "문의 내용",
        images: [],
        isSecret: false,
        status: "waiting",
        views: 0,
        isNotified: true,
        internalNote: "must not be returned",
        createdAt: { toDate: () => new Date("2026-07-20T00:00:00.000Z") },
        updatedAt: { toDate: () => new Date("2026-07-20T00:00:00.000Z") },
      }),
    };
    const qnaQuery = {
      where: jest.fn(),
      orderBy: jest.fn(),
      offset: jest.fn(),
      limit: jest.fn(),
      count: jest.fn(),
      get: jest.fn().mockResolvedValue({ docs: [publicDoc] }),
    };
    qnaQuery.where.mockReturnValue(qnaQuery);
    qnaQuery.orderBy.mockReturnValue(qnaQuery);
    qnaQuery.offset.mockReturnValue(qnaQuery);
    qnaQuery.limit.mockReturnValue(qnaQuery);
    qnaQuery.count.mockReturnValue({
      get: jest.fn().mockResolvedValue({ data: () => ({ count: 1 }) }),
    });
    jest.mocked(admin.firestore).mockReturnValue({
      collection: jest.fn(() => qnaQuery),
    } as never);

    await (qna as unknown as Handler)({
      method: "POST",
      headers: {},
      body: {
        action: "publicList",
        filters: { category: "product" },
        page: 1,
        limit: 10,
      },
    }, response);

    expect(qnaQuery.where).toHaveBeenNthCalledWith(1, "isSecret", "==", false);
    expect(qnaQuery.where).toHaveBeenNthCalledWith(2, "category", "==", "product");
    expect(qnaQuery.orderBy).toHaveBeenCalledWith("createdAt", "desc");
    expect(qnaQuery.offset).toHaveBeenCalledWith(0);
    expect(qnaQuery.limit).toHaveBeenCalledWith(10);
    expect(response.set).toHaveBeenCalledWith("Cache-Control", "no-store, max-age=0");
    expect(response.status).toHaveBeenCalledWith(200);
    const payload = response.json.mock.calls[0][0];
    expect(payload.qnas[0]).not.toHaveProperty("userEmail");
    expect(payload.qnas[0]).not.toHaveProperty("userId");
    expect(payload.qnas[0]).not.toHaveProperty("isNotified");
    expect(payload.qnas[0]).not.toHaveProperty("internalNote");
    expect(payload.qnas[0].userName).not.toBe("owner name");
    expect(payload.pagination).toEqual({ page: 1, limit: 10, totalCount: 1, totalPages: 1 });
  });

  test("rejects unbounded or unsupported public list filters before querying", async () => {
    const response = createResponse();
    const collection = jest.fn();
    jest.mocked(admin.firestore).mockReturnValue({ collection } as never);

    await (qna as unknown as Handler)({
      method: "POST",
      headers: {},
      body: {
        action: "publicList",
        filters: { userId: "owner-1" },
        page: 1,
        limit: 1000,
      },
    }, response);

    expect(response.status).toHaveBeenCalledWith(400);
    expect(collection).not.toHaveBeenCalled();
  });

  test("returns an owner-visible secret QnA without exposing owner identity", async () => {
    const response = createResponse();
    const qnaRef = {
      get: jest.fn().mockResolvedValue({
        exists: true,
        data: () => ({
          userId: "owner-1",
          userEmail: "owner@example.com",
          userName: "owner name",
          category: "general",
          title: "비밀 문의",
          content: "내용",
          images: [],
          isSecret: true,
          status: "waiting",
          views: 0,
          isNotified: true,
        }),
      }),
      update: jest.fn(),
    };
    jest.mocked(admin.firestore).mockReturnValue({
      collection: jest.fn(() => ({ doc: jest.fn(() => qnaRef) })),
    } as never);
    jest.mocked(verifyAuthContext).mockResolvedValue({
      uid: "owner-1",
      token: {} as never,
      isAdmin: false,
    });

    await (qna as unknown as Handler)({
      method: "POST",
      headers: { authorization: "Bearer owner-token" },
      body: { qnaId: "qna-1" },
    }, response);

    const payload = response.json.mock.calls[0][0];
    expect(payload.qna).not.toHaveProperty("userId");
    expect(payload.qna).not.toHaveProperty("userEmail");
    expect(payload.qna).not.toHaveProperty("isNotified");
  });

  test.each([undefined, null])(
    "fails closed for an unauthenticated legacy QnA with isSecret=%s",
    async (isSecret) => {
      const response = createResponse();
      const qnaRef = {
        get: jest.fn().mockResolvedValue({
          exists: true,
          data: () => ({
            userId: "owner-1",
            userEmail: "owner@example.com",
            userName: "owner name",
            category: "general",
            title: "legacy",
            content: "legacy content",
            isSecret,
            status: "waiting",
            views: 0,
          }),
        }),
        update: jest.fn(),
      };
      jest.mocked(admin.firestore).mockReturnValue({
        collection: jest.fn(() => ({ doc: jest.fn(() => qnaRef) })),
      } as never);

      await (qna as unknown as Handler)({
        method: "POST",
        headers: {},
        body: { action: "getDetail", qnaId: "legacy-qna" },
      }, response);

      expect(response.status).toHaveBeenCalledWith(401);
      expect(qnaRef.update).not.toHaveBeenCalled();
    }
  );
});

describe("event participation", () => {
  beforeEach(() => {
    jest.mocked(verifyAuth).mockResolvedValue("user-1");
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("creates one participant, increments once, and issues the configured reward coupon", async () => {
    const response = createResponse();
    const eventRef = { id: "event-1" };
    const participantRef = { id: "event-1_user-1" };
    const couponRef = { id: "coupon-1" };
    const userCouponRef = { id: "user-coupon-1" };
    const events = { doc: jest.fn(() => eventRef) };
    const participants = { doc: jest.fn(() => participantRef) };
    const coupons = { doc: jest.fn(() => couponRef) };
    const userCoupons = {
      doc: jest.fn(() => userCouponRef),
      where: jest.fn(),
    };
    userCoupons.where.mockReturnValue(userCoupons);
    let hasParticipant = false;
    const transaction = {
      get: jest.fn(async (target: unknown) => {
        if (target === eventRef) {
          return {
            exists: true,
            data: () => ({
              isActive: true,
              startDate: new Date(Date.now() - 60_000),
              endDate: new Date(Date.now() + 60_000),
              participantCount: 0,
              eventType: "coupon",
              couponType: "auto",
              rewardCouponId: "coupon-1",
            }),
          };
        }
        if (target === participantRef) {
          return {
            exists: hasParticipant,
            data: () => ({ rewardCouponId: "coupon-1" }),
          };
        }
        if (target === couponRef) {
          return {
            exists: true,
            data: () => ({
              name: "이벤트 쿠폰",
              isActive: true,
              isDirectAssign: true,
              expiryDate: "2099-01-01",
              usedCount: 0,
              usageLimit: 10,
            }),
          };
        }
        return { empty: true, docs: [] };
      }),
      set: jest.fn((target: unknown) => {
        if (target === participantRef) {
          hasParticipant = true;
        }
      }),
      update: jest.fn(),
    };
    const db = {
      collection: jest.fn((name: string) => ({
        events,
        eventParticipants: participants,
        coupons,
        user_coupons: userCoupons,
      }[name] || { doc: jest.fn() })),
      runTransaction: jest.fn((callback: (tx: typeof transaction) => unknown) => callback(transaction)),
    };
    jest.mocked(getFirestore).mockReturnValue(db as never);

    await (event as unknown as Handler)({
      method: "POST",
      headers: { authorization: "Bearer user-token" },
      body: { eventId: "event-1" },
    }, response);

    expect(transaction.set).toHaveBeenCalledWith(participantRef, expect.objectContaining({
      eventId: "event-1",
      userId: "user-1",
    }));
    expect(transaction.update).toHaveBeenCalledWith(eventRef, expect.objectContaining({
      participantCount: { increment: 1 },
    }));
    expect(transaction.set).toHaveBeenCalledWith(userCouponRef, expect.objectContaining({
      uid: "user-1",
      couponId: "coupon-1",
    }));
    expect(response.status).toHaveBeenCalledWith(200);

    const repeatedResponse = createResponse();
    await (event as unknown as Handler)({
      method: "POST",
      headers: { authorization: "Bearer user-token" },
      body: { eventId: "event-1" },
    }, repeatedResponse);

    expect(transaction.set).toHaveBeenCalledTimes(2);
    expect(transaction.update).toHaveBeenCalledTimes(2);
    expect(repeatedResponse.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      data: expect.objectContaining({ alreadyParticipated: true }),
    }));
  });
});

describe("verified purchase reviews", () => {
  beforeEach(() => {
    jest.mocked(verifyAuthContext).mockResolvedValue({
      uid: "user-1",
      token: {} as never,
      isAdmin: false,
    });
    jest.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  test("creates one review for a delivered order item and rejects a repeat", async () => {
    const orderRef = { id: "order-1" };
    const reviewRef = { id: "review-1" };
    const orders = { doc: jest.fn(() => orderRef) };
    const reviews = { doc: jest.fn(() => reviewRef) };
    let alreadyReviewed = false;
    const transaction = {
      get: jest.fn(async (target: unknown) => {
        if (target === orderRef) {
          return {
            exists: true,
            data: () => ({
              userId: "user-1",
              status: "delivered",
              products: [{ productId: "product-1", size: "M", color: "black", quantity: 1 }],
            }),
          };
        }
        if (target === reviewRef) {
          return { exists: alreadyReviewed, data: () => ({}) };
        }
        return { exists: false, data: () => ({}) };
      }),
      set: jest.fn((target: unknown) => {
        if (target === reviewRef) {
          alreadyReviewed = true;
        }
      }),
      update: jest.fn(),
    };
    const db = {
      collection: jest.fn((name: string) => ({ orders, reviews }[name] || { doc: jest.fn() })),
      runTransaction: jest.fn((callback: (tx: typeof transaction) => unknown) => callback(transaction)),
    };
    jest.mocked(admin.firestore).mockReturnValue(db as never);

    const payload = {
      orderId: "order-1",
      productId: "product-1",
      size: "M",
      color: "black",
      rating: 5,
      title: "좋아요",
      content: "배송받고 작성한 리뷰입니다.",
      isRecommended: true,
    };
    const response = createResponse();

    await (review as unknown as Handler)({
      method: "POST",
      headers: { authorization: "Bearer user-token" },
      body: payload,
    }, response);

    expect(transaction.set).toHaveBeenCalledWith(reviewRef, expect.objectContaining({
      orderId: "order-1",
      productId: "product-1",
      userId: "user-1",
      size: "M",
      color: "black",
      verifiedPurchase: true,
    }));
    expect(response.status).toHaveBeenCalledWith(201);

    const repeatedResponse = createResponse();
    await (review as unknown as Handler)({
      method: "POST",
      headers: { authorization: "Bearer user-token" },
      body: payload,
    }, repeatedResponse);

    expect(repeatedResponse.status).toHaveBeenCalledWith(409);
  });

  test.each([
    ["an undelivered order", "shipped", "M", "black"],
    ["an option not included in the order", "delivered", "L", "black"],
  ])("rejects a review for %s", async (_caseName, status, size, color) => {
    const response = createResponse();
    const orderRef = { id: "order-1" };
    const reviews = { doc: jest.fn(() => ({ id: "review-1" })) };
    const transaction = {
      get: jest.fn(async () => ({
        exists: true,
        data: () => ({
          userId: "user-1",
          status,
          products: [{ productId: "product-1", size: "M", color: "black", quantity: 1 }],
        }),
      })),
      set: jest.fn(),
      update: jest.fn(),
    };
    const db = {
      collection: jest.fn((name: string) => ({
        orders: { doc: jest.fn(() => orderRef) },
        reviews,
      }[name] || { doc: jest.fn() })),
      runTransaction: jest.fn((callback: (tx: typeof transaction) => unknown) => callback(transaction)),
    };
    jest.mocked(admin.firestore).mockReturnValue(db as never);

    await (review as unknown as Handler)({
      method: "POST",
      headers: { authorization: "Bearer user-token" },
      body: {
        orderId: "order-1",
        productId: "product-1",
        size,
        color,
        rating: 5,
        title: "좋아요",
        content: "내용",
        isRecommended: true,
      },
    }, response);

    expect(response.status).toHaveBeenCalledWith(400);
    expect(transaction.set).not.toHaveBeenCalled();
  });
});
