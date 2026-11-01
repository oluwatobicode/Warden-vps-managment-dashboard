import { describe, expect, it } from "vitest";
import type { LogLine } from "shared-types";
import { asText, lineTime, matches, mergeLines, splitMatch } from "./lines";

const line = (id: string, ts: string, over: Partial<LogLine> = {}): LogLine => ({ id, serviceId: "s1", deploymentId: "d1", stream: "STDOUT", ts, message: `m${id}`, ...over });

describe("mergeLines", () => {
  it("puts saved pages and live lines in time order, each once", () => {
    const pages = [
      [line("12", "2026-10-28T10:00:03.000Z"), line("11", "2026-10-28T10:00:02.000Z")],
      [line("10", "2026-10-28T10:00:01.000Z")],
    ];
    const live = [line("12", "2026-10-28T10:00:03.000Z"), line("13", "2026-10-28T10:00:04.000Z")];
    expect(mergeLines(pages, live).map((l) => l.id)).toEqual(["10", "11", "12", "13"]);
  });
  it("orders lines with the same time by id, as numbers", () => {
    const ts = "2026-10-28T10:00:00.000Z";
    expect(mergeLines([[line("100", ts), line("99", ts), line("101", ts)]], []).map((l) => l.id)).toEqual(["99", "100", "101"]);
  });
});

describe("matches", () => {
  it("applies the stream and version filters to live lines", () => {
    const err = line("1", "2026-10-28T10:00:00.000Z", { stream: "STDERR" });
    expect(matches(err, { stream: "STDERR", deploymentId: "", source: "" })).toBe(true);
    expect(matches(err, { stream: "STDOUT", deploymentId: "", source: "" })).toBe(false);
    expect(matches(err, { stream: "", deploymentId: "d2", source: "" })).toBe(false);
    const traefik = line("2", "2026-10-28T10:00:00.000Z", { serviceId: "TRAEFIK" });
    expect(matches(traefik, { stream: "", deploymentId: "", source: "TRAEFIK" })).toBe(true);
    expect(matches(traefik, { stream: "", deploymentId: "", source: "DOCKER" })).toBe(false);
  });
});

describe("lineTime", () => {
  it("shows milliseconds, and the day when it isn't today", () => {
    const now = new Date("2026-10-28T12:00:00");
    expect(lineTime(new Date("2026-10-28T09:05:01.007").toISOString(), now)).toBe("09:05:01.007");
    expect(lineTime(new Date("2026-10-27T09:05:01.007").toISOString(), now)).toBe("27 Oct 09:05:01.007");
  });
});

describe("splitMatch", () => {
  it("finds every match, ignoring case", () => {
    expect(splitMatch("Error: db error", "ERROR")).toEqual([
      { text: "Error", hit: true },
      { text: ": db ", hit: false },
      { text: "error", hit: true },
    ]);
    expect(splitMatch("ok", "")).toEqual([{ text: "ok", hit: false }]);
  });
});

describe("asText", () => {
  it("marks stderr and names the service when asked", () => {
    expect(asText([line("1", "2026-10-28T10:00:00.000Z", { stream: "STDERR", message: "boom" })], () => "api")).toBe("2026-10-28T10:00:00.000Z ERR [api] boom");
  });
});
