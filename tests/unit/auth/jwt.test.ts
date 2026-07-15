import { beforeAll, describe, expect, it } from "vitest";
import { signAccessToken, verifyAccessToken } from "@/modules/auth/jwt";

beforeAll(() => {
  process.env.JWT_ACCESS_SECRET = "test-access-secret-test-access-secret-1234";
});

describe("access token", () => {
  it("round-trips the user id and roles", async () => {
    const token = await signAccessToken({
      userId: "6f1c9a3e-0000-4000-8000-000000000001",
      roles: ["DRIVER", "HOST_BUSINESS"],
    });

    const claims = await verifyAccessToken(token);

    expect(claims).toEqual({
      userId: "6f1c9a3e-0000-4000-8000-000000000001",
      roles: ["DRIVER", "HOST_BUSINESS"],
    });
  });

  it("carries no personal data", async () => {
    const token = await signAccessToken({ userId: "u1", roles: ["DRIVER"] });
    const payload = JSON.parse(
      Buffer.from(token.split(".")[1]!, "base64url").toString("utf8"),
    ) as Record<string, unknown>;

    expect(Object.keys(payload).sort()).toEqual([
      "aud",
      "exp",
      "iat",
      "iss",
      "roles",
      "sub",
    ]);
  });

  it("expires in 15 minutes", async () => {
    const token = await signAccessToken({ userId: "u1", roles: ["DRIVER"] });
    const payload = JSON.parse(
      Buffer.from(token.split(".")[1]!, "base64url").toString("utf8"),
    ) as { iat: number; exp: number };

    expect(payload.exp - payload.iat).toBe(15 * 60);
  });

  it("rejects a tampered payload", async () => {
    const token = await signAccessToken({ userId: "u1", roles: ["DRIVER"] });
    const [header, payload, signature] = token.split(".");

    const forged = Buffer.from(
      JSON.stringify({
        sub: "u1",
        roles: ["ADMIN"],
        iss: "parkownia",
        aud: "parkownia",
        exp: Math.floor(Date.now() / 1000) + 600,
      }),
    ).toString("base64url");

    expect(await verifyAccessToken(`${header}.${forged}.${signature}`)).toBeNull();
    expect(await verifyAccessToken(`${header}.${payload}.` + "x".repeat(43))).toBeNull();
  });

  it("rejects a token signed with another secret", async () => {
    const token = await signAccessToken({ userId: "u1", roles: ["ADMIN"] });

    process.env.JWT_ACCESS_SECRET = "a-completely-different-secret-value-000000";
    const claims = await verifyAccessToken(token);
    process.env.JWT_ACCESS_SECRET = "test-access-secret-test-access-secret-1234";

    expect(claims).toBeNull();
  });

  it("rejects garbage instead of throwing", async () => {
    expect(await verifyAccessToken("not-a-token")).toBeNull();
    expect(await verifyAccessToken("")).toBeNull();
  });
});
