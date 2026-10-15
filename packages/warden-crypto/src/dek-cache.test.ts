import { describe, expect, it, vi } from "vitest";
import { DekCache } from "./dek-cache";
import { EnvKeyProvider } from "./env-key-provider";

const MASTER = "11".repeat(32);

async function setup() {
  const provider = new EnvKeyProvider({ masterKeyHex: MASTER });
  const { wrapped, dek } = await provider.generateWrappedDek();
  const unwrap = vi.spyOn(provider, "unwrapDek");
  const load = vi.fn(async (orgId: string) => {
    if (orgId !== "org-1") throw new Error("no such org");
    return wrapped;
  });
  return { cache: new DekCache(provider, load), dek, unwrap, load };
}

describe("DekCache", () => {
  it("unwraps the stored key to the original DEK", async () => {
    const { cache, dek } = await setup();
    expect((await cache.get("org-1")).equals(dek)).toBe(true);
  });

  it("loads and unwraps only once per org", async () => {
    const { cache, unwrap, load } = await setup();
    await cache.get("org-1");
    await cache.get("org-1");
    expect(load).toHaveBeenCalledTimes(1);
    expect(unwrap).toHaveBeenCalledTimes(1);
  });

  it("forget() makes the next get unwrap again", async () => {
    const { cache, unwrap } = await setup();
    await cache.get("org-1");
    cache.forget("org-1");
    await cache.get("org-1");
    expect(unwrap).toHaveBeenCalledTimes(2);
  });

  it("passes the loader's error through and caches nothing", async () => {
    const { cache, load } = await setup();
    await expect(cache.get("org-2")).rejects.toThrow("no such org");
    await expect(cache.get("org-2")).rejects.toThrow("no such org");
    expect(load).toHaveBeenCalledTimes(2);
  });
});
