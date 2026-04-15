import { describe, test, expect, vi, beforeEach } from "vitest";
import { SignJWT } from "jose";

vi.mock("server-only", () => ({}));

const { mockGet } = vi.hoisted(() => ({ mockGet: vi.fn() }));

vi.mock("next/headers", () => ({
  cookies: () => Promise.resolve({ get: mockGet }),
}));

import { getSession } from "@/lib/auth";

const SECRET = new TextEncoder().encode("development-secret-key");

async function makeToken(payload: object, expiresIn = "7d") {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(expiresIn)
    .setIssuedAt()
    .sign(SECRET);
}

describe("getSession", () => {
  beforeEach(() => {
    mockGet.mockReset();
  });

  test("returns null when no cookie is set", async () => {
    mockGet.mockReturnValue(undefined);
    expect(await getSession()).toBeNull();
  });

  test("returns session payload for a valid token", async () => {
    const token = await makeToken({
      userId: "user_1",
      email: "user@example.com",
      expiresAt: new Date(Date.now() + 86400000),
    });
    mockGet.mockReturnValue({ value: token });

    const session = await getSession();
    expect(session?.userId).toBe("user_1");
    expect(session?.email).toBe("user@example.com");
  });

  test("returns null for a malformed token", async () => {
    mockGet.mockReturnValue({ value: "not.a.jwt" });
    expect(await getSession()).toBeNull();
  });

  test("returns null for an expired token", async () => {
    const token = await makeToken(
      { userId: "user_1", email: "user@example.com" },
      "-1s"
    );
    mockGet.mockReturnValue({ value: token });
    expect(await getSession()).toBeNull();
  });

  test("returns null for a token signed with a different secret", async () => {
    const wrongSecret = new TextEncoder().encode("wrong-secret");
    const token = await new SignJWT({ userId: "user_1", email: "user@example.com" })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("7d")
      .setIssuedAt()
      .sign(wrongSecret);
    mockGet.mockReturnValue({ value: token });
    expect(await getSession()).toBeNull();
  });
});
