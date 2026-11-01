import { describe, expect, it } from "vitest";
import { cellText, editText, quoteFor, rowKey, ttlText } from "./cells";

describe("cells", () => {
  it("shows and edits values", () => {
    expect(cellText(null)).toBe("NULL");
    expect(cellText({ a: 1 })).toBe('{"a":1}');
    expect(cellText(12)).toBe("12");
    expect(editText(null)).toBe("");
    expect(editText({ a: 1 })).toBe('{\n  "a": 1\n}');
  });
  it("picks the primary key values of a row", () => {
    const cols = [{ name: "id", pk: true }, { name: "name", pk: false }, { name: "org", pk: true }];
    expect(rowKey(cols, [7, "Ada", "o1"])).toEqual({ id: 7, org: "o1" });
  });
  it("says how long until a key expires", () => {
    expect(ttlText(-1)).toBe("never");
    expect(ttlText(45_000)).toBe("45 s");
    expect(ttlText(125 * 60_000)).toBe("2 h 5 min");
    expect(ttlText(3 * 24 * 3600_000)).toBe("3 days");
  });
});

describe("quoteFor", () => {
  it("quotes only when it has to", () => {
    expect(quoteFor("POSTGRES", { schema: "public", name: "users" })).toBe("users");
    expect(quoteFor("POSTGRES", { schema: "auth", name: "Users" })).toBe('auth."Users"');
    expect(quoteFor("MYSQL", { schema: "app", name: "order" })).toBe("`order`");
  });
});
