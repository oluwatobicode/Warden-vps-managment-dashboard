import { describe, expect, it } from "vitest";
import { formatBytes } from "./formatBytes";

describe("formatBytes", () => {
  it.each([
    [0, "0 B"],
    [999, "999 B"],
    [1500, "1.5 kB"],
    [2_200_000_000, "2.2 GB"],
    [48_800_000_000, "48.8 GB"],
    [485_500_000_000, "486 GB"],
    [3_400_000, "3.4 MB"],
    [null, "—"],
  ])("%s → %s", (n, text) => expect(formatBytes(n)).toBe(text));
});
