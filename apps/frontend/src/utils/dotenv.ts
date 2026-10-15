import { variableKey } from "shared-types";

export interface EnvLine {
  /** 1-based line number in the pasted text, for error messages. */
  line: number;
  key: string;
  value: string;
  /** Why it can't be imported, if it can't. */
  error?: string;
  /** A later line has the same key; that one wins. */
  overridden?: boolean;
}

/**
 * Reads .env text the way most tools do:
 *   KEY=value · export KEY=value · KEY="quoted # not a comment" · KEY='single'
 *   blank lines and # comments are skipped; `value # comment` drops the comment.
 * Multi-line quoted values aren't supported (they're rare; add those by hand).
 */
export function parseDotenv(text: string): EnvLine[] {
  const out: EnvLine[] = [];
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = i + 1;
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith("#")) return;

    const body = trimmed.replace(/^export\s+/, "");
    const eq = body.indexOf("=");
    if (eq === -1) {
      out.push({ line, key: body, value: "", error: "No = sign: expected KEY=value" });
      return;
    }
    const key = body.slice(0, eq).trim();
    let value = body.slice(eq + 1).trim();

    const quote = value[0];
    if (quote === '"' || quote === "'") {
      const end = value.indexOf(quote, 1);
      if (end === -1) {
        out.push({ line, key, value: "", error: "Unclosed quote. Multi-line values aren't supported here" });
        return;
      }
      value = value.slice(1, end);
      // Double quotes understand the usual escapes; single quotes are literal.
      if (quote === '"') value = value.replace(/\\n/g, "\n").replace(/\\"/g, '"').replace(/\\\\/g, "\\");
    } else {
      const hash = value.search(/\s#/);
      if (hash !== -1) value = value.slice(0, hash).trimEnd();
    }

    const check = variableKey.safeParse(key);
    out.push({ line, key, value, error: check.success ? undefined : check.error.issues[0]?.message });
  });

  // Same key twice: the last one wins, like a shell would.
  const lastIndex = new Map<string, number>();
  out.forEach((r, i) => !r.error && lastIndex.set(r.key, i));
  return out.map((r, i) => (!r.error && lastIndex.get(r.key) !== i ? { ...r, overridden: true } : r));
}
