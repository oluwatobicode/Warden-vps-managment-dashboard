import { describe, expect, it } from "vitest";
import { diskAlert, OFFLINE_AFTER_FAILURES, statusAfterFailure, statusAfterSuccess } from "./status";

describe("statusAfterSuccess", () => {
  it("is CONNECTED with running containers, IDLE without", () => {
    expect(statusAfterSuccess(3)).toBe("CONNECTED");
    expect(statusAfterSuccess(0)).toBe("IDLE");
    expect(statusAfterSuccess(null)).toBe("IDLE"); // Docker couldn't say
  });
});

describe("statusAfterFailure", () => {
  it("keeps the status until enough polls fail in a row", () => {
    expect(statusAfterFailure("CONNECTED", 1)).toBe("CONNECTED");
    expect(statusAfterFailure("CONNECTED", OFFLINE_AFTER_FAILURES - 1)).toBe("CONNECTED");
    expect(statusAfterFailure("CONNECTED", OFFLINE_AFTER_FAILURES)).toBe("OFFLINE");
    expect(statusAfterFailure("IDLE", 10)).toBe("OFFLINE");
  });
});

describe("diskAlert", () => {
  it("alerts once on crossing the limit", () => {
    expect(diskAlert(91, 90, false)).toBe("alert");
    expect(diskAlert(95, 90, true)).toBe("none");
  });

  it("re-arms only well below the limit", () => {
    expect(diskAlert(87, 90, true)).toBe("none");
    expect(diskAlert(84.9, 90, true)).toBe("rearm");
    expect(diskAlert(50, 90, false)).toBe("none");
  });
});
