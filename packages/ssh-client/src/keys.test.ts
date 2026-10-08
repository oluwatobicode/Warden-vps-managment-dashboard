import { describe, it, expect } from "vitest";
import { generateKeyPair, parsePrivateKey, fingerprint } from "./keys";
import {
  LOCKED_PRIVATE,
  PLAIN_FINGERPRINT,
  PLAIN_PRIVATE,
  PLAIN_PUBLIC,
} from "./__fixtures__/keys";

// The fixtures came from the real ssh-keygen. Comparing against them is what
// proves Warden's keys are the format OpenSSH expects — the bugs this file
// guards against all looked fine until compared with a real key.

/** "ssh-ed25519 AAAA… comment" → "ssh-ed25519 AAAA…" (comments don't matter to SSH) */
const withoutComment = (line: string) => line.split(/\s+/).slice(0, 2).join(" ");

describe("generateKeyPair", () => {
  const pair = generateKeyPair("warden-test");

  it("returns a PUBLIC key as publicKey (never the private one)", () => {
    expect(pair.publicKey.startsWith("ssh-ed25519 ")).toBe(true);
    expect(pair.publicKey).not.toContain("PRIVATE");
    expect(pair.publicKey.endsWith("warden-test")).toBe(true);
  });

  it("returns an OpenSSH private key", () => {
    expect(pair.privateKey).toContain("BEGIN OPENSSH PRIVATE KEY");
  });

  it("produces a pair that belongs together", () => {
    // Re-deriving the public key from the private one must give the same key.
    expect(parsePrivateKey(pair.privateKey).publicKey).toBe(
      withoutComment(pair.publicKey),
    );
  });

  it("makes a different key every time", () => {
    expect(generateKeyPair("a").publicKey).not.toBe(generateKeyPair("a").publicKey);
  });
});

describe("parsePrivateKey", () => {
  it("derives the same public key ssh-keygen wrote", () => {
    const parsed = parsePrivateKey(PLAIN_PRIVATE);
    expect(parsed.publicKey).toBe(withoutComment(PLAIN_PUBLIC));
    expect(parsed.type).toBe("ssh-ed25519");
  });

  it("tolerates surrounding whitespace from a paste", () => {
    expect(() => parsePrivateKey(`\n\n  ${PLAIN_PRIVATE}  \n`)).not.toThrow();
  });

  it("rejects garbage", () => {
    expect(() => parsePrivateKey("definitely not a key")).toThrow(/Invalid private key/);
  });

  it("rejects a passphrase-protected key (Warden can't type a passphrase)", () => {
    expect(() => parsePrivateKey(LOCKED_PRIVATE)).toThrow(/Invalid private key/);
  });

  it("rejects a PUBLIC key pasted by mistake", () => {
    expect(() => parsePrivateKey(PLAIN_PUBLIC)).toThrow(/public key/);
  });
});

describe("fingerprint", () => {
  it("matches `ssh-keygen -lf` exactly", () => {
    expect(fingerprint(PLAIN_PUBLIC)).toBe(PLAIN_FINGERPRINT);
  });

  it("has no base64 padding", () => {
    expect(fingerprint(PLAIN_PUBLIC)).not.toMatch(/=$/);
  });

  it("ignores the comment", () => {
    expect(fingerprint(withoutComment(PLAIN_PUBLIC))).toBe(PLAIN_FINGERPRINT);
  });

  it("matches the key Warden generated", () => {
    const pair = generateKeyPair("x");
    const derived = parsePrivateKey(pair.privateKey).publicKey;
    expect(fingerprint(pair.publicKey)).toBe(fingerprint(derived));
  });

  it("rejects a malformed line", () => {
    expect(() => fingerprint("ssh-ed25519")).toThrow();
  });
});
