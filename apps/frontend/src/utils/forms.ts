// Small converters for register(..., { setValueAs }). Inputs give strings;
// the shared schemas want numbers, undefined ("not sent") or null ("clear it").

/** "" → undefined (field not sent), "22" → 22. */
export const optionalNumber = (v: unknown) => (v === "" || v == null ? undefined : Number(v));

/** "" → undefined: an empty optional text box means "not set". */
export const optionalText = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

/** "" → null: on an UPDATE, emptying a field means "remove it". */
export const clearableText = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);
export const clearableNumber = (v: unknown) => (v === "" || v == null ? null : Number(v));
