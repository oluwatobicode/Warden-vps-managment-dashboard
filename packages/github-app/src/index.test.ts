import { createHmac, createVerify, generateKeyPairSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import { appJwt, matchesWatchPath, normalizePem, verifyWebhook } from "./index";

describe("appJwt", () => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const pem = privateKey.export({ type: "pkcs1", format: "pem" }).toString();

  it("is an RS256 JWT for the app id, valid ~10 minutes, verifiable with the public key", () => {
    const now = 1_800_000_000;
    const [h, p, s] = appJwt({ appId: "12345", privateKey: pem }, now).split(".");
    expect(JSON.parse(Buffer.from(h, "base64url").toString())).toEqual({ alg: "RS256", typ: "JWT" });
    expect(JSON.parse(Buffer.from(p, "base64url").toString())).toEqual({ iat: now - 60, exp: now + 540, iss: "12345" });
    expect(createVerify("RSA-SHA256").update(`${h}.${p}`).verify(publicKey, Buffer.from(s, "base64url"))).toBe(true);
  });

  it("accepts a PEM written on one line with \\n, as in .env", () => {
    expect(() => appJwt({ appId: "1", privateKey: pem.trim().replace(/\n/g, "\\n") })).not.toThrow();
    expect(normalizePem("a\\nb")).toBe("a\nb\n");
  });
});

describe("verifyWebhook", () => {
  const body = JSON.stringify({ ref: "refs/heads/main" });
  const sign = (secret: string, b: string) => `sha256=${createHmac("sha256", secret).update(b).digest("hex")}`;

  it("accepts GitHub's signature of the exact body", () => {
    expect(verifyWebhook("s3cret", body, sign("s3cret", body))).toBe(true);
  });
  it("refuses a wrong secret, a changed body, a missing header, or no secret set", () => {
    expect(verifyWebhook("s3cret", body, sign("other", body))).toBe(false);
    expect(verifyWebhook("s3cret", body + " ", sign("s3cret", body))).toBe(false);
    expect(verifyWebhook("s3cret", body, undefined)).toBe(false);
    expect(verifyWebhook("", body, sign("", body))).toBe(false);
  });
});

describe("matchesWatchPath", () => {
  it("matches folders, ** and *", () => {
    expect(matchesWatchPath("apps/api/src/main.ts", "apps/api/**")).toBe(true);
    expect(matchesWatchPath("apps/api/src/main.ts", "apps/api")).toBe(true);
    expect(matchesWatchPath("apps/api/src/main.ts", "apps/api/")).toBe(true);
    expect(matchesWatchPath("apps/frontend/src/App.tsx", "apps/api/**")).toBe(false);
    expect(matchesWatchPath("packages/db/prisma/schema.prisma", "packages/**")).toBe(true);
    expect(matchesWatchPath("README.md", "*.md")).toBe(true);
    expect(matchesWatchPath("docs/README.md", "*.md")).toBe(false);
    expect(matchesWatchPath("apps/api-v2/x.ts", "apps/api/**")).toBe(false);
  });
});
