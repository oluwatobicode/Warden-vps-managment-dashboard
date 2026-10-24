import { useEffect, useRef } from "react";
import { basicSetup } from "codemirror";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { yaml } from "@codemirror/lang-yaml";
import { lintGutter, setDiagnostics, type Diagnostic } from "@codemirror/lint";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";
import type { ProxyProblem } from "shared-types";

/** The editor in the dashboard's colours (dark surfaces, mono text). */
const theme = EditorView.theme(
  {
    "&": { backgroundColor: "#0b0c0e", color: "#c9ccd3", fontSize: "12.5px", borderRadius: "12px", border: "1px solid var(--color-cb, #2a2c31)" },
    "&.cm-focused": { outline: "none", borderColor: "var(--color-focus, #5b5f68)" },
    ".cm-content": { fontFamily: "var(--font-mono, ui-monospace, monospace)", padding: "10px 0", caretColor: "#e7e9ee" },
    ".cm-gutters": { backgroundColor: "#0b0c0e", color: "#4b4f57", border: "none", borderTopLeftRadius: "12px", borderBottomLeftRadius: "12px" },
    ".cm-activeLine, .cm-activeLineGutter": { backgroundColor: "#14161a" },
    ".cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection": { backgroundColor: "#2b3a55 !important" },
    ".cm-cursor": { borderLeftColor: "#e7e9ee" },
  },
  { dark: true },
);

/** YAML colours that read on the dark editor (the default style is for light backgrounds). */
const colours = HighlightStyle.define([
  { tag: [t.propertyName, t.definition(t.propertyName)], color: "#8fb7ff" },
  { tag: [t.string, t.special(t.string)], color: "#b8d98a" },
  { tag: [t.number, t.bool, t.null, t.atom], color: "#e9b872" },
  { tag: t.comment, color: "#6b7079", fontStyle: "italic" },
  { tag: [t.punctuation, t.separator, t.bracket], color: "#9aa0aa" },
  { tag: [t.keyword, t.typeName, t.labelName], color: "#d7a6f5" },
  { tag: t.content, color: "#c9ccd3" },
]);

/**
 * The free YAML of warden.yml. Lazily loaded (CodeMirror is ~100 kB) and
 * uncontrolled inside: `value` only resets it when it changes from outside
 * (loading a version, Reset), so typing never fights a re-render.
 */
export default function RawEditor({ value, onChange, problems, readOnly }: { value: string; onChange: (v: string) => void; problems: ProxyProblem[]; readOnly: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const change = useRef(onChange);
  useEffect(() => {
    change.current = onChange;
  }, [onChange]);

  useEffect(() => {
    const v = new EditorView({
      parent: host.current!,
      state: EditorState.create({
        doc: value,
        extensions: [
          basicSetup,
          yaml(),
          syntaxHighlighting(colours),
          lintGutter(),
          theme,
          EditorState.readOnly.of(readOnly),
          EditorView.contentAttributes.of({ "aria-label": "warden.yml (your part)" }),
          EditorView.updateListener.of((u) => u.docChanged && change.current(u.state.doc.toString())),
        ],
      }),
    });
    view.current = v;
    return () => v.destroy();
    // Created once; `value` changes are applied below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readOnly]);

  // A value from outside (a loaded version, Reset): replace the text.
  useEffect(() => {
    const v = view.current;
    if (v && v.state.doc.toString() !== value) v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: value } });
  }, [value]);

  // The check's problems, on their lines.
  useEffect(() => {
    const v = view.current;
    if (!v) return;
    const doc = v.state.doc;
    const diagnostics: Diagnostic[] = problems
      .filter((p) => p.where === "raw" && p.line != null && p.line >= 1 && p.line <= doc.lines)
      .map((p) => {
        const line = doc.line(p.line!);
        return { from: line.from, to: Math.max(line.to, line.from), severity: "error", message: p.message };
      });
    v.dispatch(setDiagnostics(v.state, diagnostics));
  }, [problems]);

  return <div ref={host} className="min-h-[260px] [&_.cm-editor]:min-h-[260px]" />;
}
