import { z } from "zod";

/** A coordinate on the canvas. Generous bounds: wide enough for any layout, never Infinity/NaN. */
const coord = z.number({ error: "Position must be a number" }).finite().min(-100_000).max(100_000);

/**
 * PUT /canvas-positions : save where boxes sit on one environment's canvas.
 * One drag sends one position; "Tidy up" sends them all. Every role may save
 * (decided 2026-10-18). Every service must be in this environment and the
 * caller's org, or nothing is saved.
 */
export const SaveCanvasPositionsSchema = z.object({
  environmentId: z.uuid(),
  positions: z
    .array(z.object({ serviceId: z.uuid(), x: coord, y: coord }))
    .min(1, "Nothing to save")
    .max(100, "Up to 100 services at once")
    .refine((p) => new Set(p.map((x) => x.serviceId)).size === p.length, "Each service only once"),
});
export type SaveCanvasPositionsInput = z.infer<typeof SaveCanvasPositionsSchema>;
