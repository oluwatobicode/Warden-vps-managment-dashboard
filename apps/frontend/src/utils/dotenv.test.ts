import { describe, expect, it } from "vitest";
import { parseDotenv } from "./dotenv";

const ok = (text: string) => parseDotenv(text).filter((l) => !l.error && !l.overridden).map((l) => [l.key, l.value]);

describe("parseDotenv", () => {
  it("reads plain KEY=value lines and skips blanks and comments", () => {
    expect(ok("# comment\n\nA=1\nB=two words\n")).toEqual([["A", "1"], ["B", "two words"]]);
  });

  it("drops `export` and keeps = inside the value", () => {
    expect(ok("export DATABASE_URL=postgres://u:p@h:5432/db?ssl=true")).toEqual([["DATABASE_URL", "postgres://u:p@h:5432/db?ssl=true"]]);
  });

  it("strips quotes; # inside quotes is not a comment", () => {
    expect(ok(`A="has # hash"\nB='single # too'\nC=bare # comment`)).toEqual([["A", "has # hash"], ["B", "single # too"], ["C", "bare"]]);
  });

  it("handles escapes in double quotes only", () => {
    expect(ok(`A="line1\\nline2"\nB='raw\\n'`)).toEqual([["A", "line1\nline2"], ["B", "raw\\n"]]);
  });

  it("allows empty values", () => {
    expect(ok("EMPTY=\nQUOTED_EMPTY=\"\"")).toEqual([["EMPTY", ""], ["QUOTED_EMPTY", ""]]);
  });

  it("reports lines it can't use, with the line number", () => {
    const lines = parseDotenv("GOOD=1\nnot a pair\nlower_case=x\nOPEN=\"never closed");
    expect(lines.map((l) => [l.line, l.error !== undefined])).toEqual([[1, false], [2, true], [3, true], [4, true]]);
    expect(lines[2].error).toBe("Use UPPER_SNAKE_CASE, e.g. DATABASE_URL"); // the API's own rule
  });

  it("uses the LAST of repeated keys, like a shell", () => {
    const lines = parseDotenv("A=first\nA=second");
    expect(lines[0].overridden).toBe(true);
    expect(ok("A=first\nA=second")).toEqual([["A", "second"]]);
  });

  it("copes with Windows line endings", () => {
    expect(ok("A=1\r\nB=2\r\n")).toEqual([["A", "1"], ["B", "2"]]);
  });
});
