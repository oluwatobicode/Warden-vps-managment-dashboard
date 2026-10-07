import { Buffer } from "node:buffer";
import { describe, it, expect } from "vitest";
import { encrypt, decrypt, generateKey, keyFromHex } from "./aes";

// Each test proves ONE property the rest of Warden relies on. If any of these
// ever goes red, stored secrets are either unreadable or unsafe.

/** Flip one character inside part `index` of a "v1.iv.ct.tag" string. */
function tamper(stored: string, index: number): string {
  const parts = stored.split(".");
  const p = parts[index];
  const swap = p[0] === "A" ? "B" : "A"; // any different base64url char
  parts[index] = swap + p.slice(1);
  return parts.join(".");
}

describe("aes-256-gcm", () => {
  const k = generateKey(); // fresh random 32-byte key every run

  // 1. Whatever goes in comes back out — including the edge cases.
  it("round-trips plaintext", () => {
    for (const plain of ["hello", "", "x".repeat(10_000), "naïve 🔐 ünïcödé"]) {
      expect(decrypt(encrypt(plain, k, "v1"), { v1: k })).toBe(plain);
    }
  });

  // 2. The IV rule: same input, same key, different output every time.
  //    If this fails, a nonce is being reused and GCM is broken.
  it("never produces the same ciphertext twice", () => {
    const a = encrypt("hello", k, "v1");
    const b = encrypt("hello", k, "v1");
    expect(a).not.toBe(b);
    expect(a.split(".")[1]).not.toBe(b.split(".")[1]); // the IVs differ
  });

  it("produces the documented v.iv.ct.tag shape", () => {
    const parts = encrypt("hello", k, "v1").split(".");
    expect(parts).toHaveLength(4);
    expect(parts[0]).toBe("v1");
    expect(Buffer.from(parts[1], "base64url")).toHaveLength(12); // IV
    expect(Buffer.from(parts[3], "base64url")).toHaveLength(16); // tag
  });

  // 3. Authentication: any change to the stored value must fail loudly.
  describe("tamper detection", () => {
    const stored = encrypt("my-ssh-private-key", k, "v1");

    it("rejects a modified ciphertext", () => {
      expect(() => decrypt(tamper(stored, 2), { v1: k })).toThrow();
    });

    it("rejects a modified tag", () => {
      expect(() => decrypt(tamper(stored, 3), { v1: k })).toThrow();
    });

    it("rejects a modified IV", () => {
      expect(() => decrypt(tamper(stored, 1), { v1: k })).toThrow();
    });

    it("rejects a truncated tag (forgery shortcut)", () => {
      const parts = stored.split(".");
      parts[3] = Buffer.from(parts[3], "base64url")
        .subarray(0, 1)
        .toString("base64url");
      expect(() => decrypt(parts.join("."), { v1: k })).toThrow(
        "malformed ciphertext",
      );
    });

    it("rejects a value encrypted with a different key", () => {
      const other = generateKey();
      expect(() => decrypt(stored, { v1: other })).toThrow();
    });

    it("rejects structurally broken input", () => {
      for (const bad of ["", "v1", "v1.a.b", "v1.a.b.c.d"]) {
        expect(() => decrypt(bad, { v1: k })).toThrow("malformed ciphertext");
      }
    });
  });

  // 4. Rotation: the version label picks the key, so old and new coexist.
  describe("key ring", () => {
    const v1 = generateKey();
    const v2 = generateKey();

    it("decrypts an old row while a newer key is current", () => {
      const old = encrypt("secret", v1, "v1");
      expect(decrypt(old, { v1, v2 })).toBe("secret");
    });

    it("decrypts a new row written with v2", () => {
      const fresh = encrypt("secret", v2, "v2");
      expect(decrypt(fresh, { v1, v2 })).toBe("secret");
    });

    it("fails clearly when the needed key was removed too early", () => {
      const old = encrypt("secret", v1, "v1");
      expect(() => decrypt(old, { v2 })).toThrow("Unknown key version v1");
    });
  });

  describe("key helpers", () => {
    it("refuses keys that aren't 32 bytes", () => {
      expect(() => encrypt("x", Buffer.alloc(16), "v1")).toThrow(
        "key must be 32 bytes",
      );
      expect(() => keyFromHex("abcd")).toThrow();
    });

    it("reads a 64-char hex key", () => {
      const hex = generateKey().toString("hex");
      expect(keyFromHex(hex)).toHaveLength(32);
    });
  });
});
