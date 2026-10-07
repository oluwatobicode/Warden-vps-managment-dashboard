import { describe, it, expect } from "vitest";
import { generateKey } from "./aes";
import { EnvKeyProvider } from "./env-key-provider";

const hexKey = () => generateKey().toString("hex");

describe("EnvKeyProvider", () => {
  it("wraps a DEK and unwraps it back to the same 32 bytes", async () => {
    const provider = new EnvKeyProvider({ masterKeyHex: hexKey() });
    const { wrapped, dek } = await provider.generateWrappedDek();

    expect(dek).toHaveLength(32);
    expect(wrapped.startsWith("v1.")).toBe(true); // same format as every other secret
    // toEqual, not toBe: two Buffers with the same bytes are equal, not identical
    expect(await provider.unwrapDek(wrapped)).toEqual(dek);
  });

  it("never stores the DEK in readable form", async () => {
    const provider = new EnvKeyProvider({ masterKeyHex: hexKey() });
    const { wrapped, dek } = await provider.generateWrappedDek();
    expect(wrapped).not.toContain(dek.toString("base64url"));
  });

  it("gives every org a different DEK", async () => {
    const provider = new EnvKeyProvider({ masterKeyHex: hexKey() });
    const a = await provider.generateWrappedDek();
    const b = await provider.generateWrappedDek();
    expect(a.dek).not.toEqual(b.dek);
  });

  it("cannot unwrap with a different master key", async () => {
    const mine = new EnvKeyProvider({ masterKeyHex: hexKey() });
    const theirs = new EnvKeyProvider({ masterKeyHex: hexKey() });
    const { wrapped } = await mine.generateWrappedDek();
    // async → the error arrives as a rejected promise, hence `rejects`
    await expect(theirs.unwrapDek(wrapped)).rejects.toThrow();
  });

  it("refuses a master key that isn't 32 bytes", () => {
    expect(() => new EnvKeyProvider({ masterKeyHex: "abcd" })).toThrow();
  });
});
