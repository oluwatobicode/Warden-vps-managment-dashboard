import type { Service } from "shared-types";

/*
 * Where boxes go on the canvas. Pure functions (tested in layout.test.ts):
 * the canvas components only draw what these decide.
 */

export const NODE_W = 240;
export const NODE_H = 112;
const GAP_X = 60;
const GAP_Y = 50;
const COLS = 3;

export interface Point {
  x: number;
  y: number;
}

/** Top-left corner of grid cell `i` (row by row, COLS per row). */
export function cell(i: number): Point {
  return { x: (i % COLS) * (NODE_W + GAP_X), y: Math.floor(i / COLS) * (NODE_H + GAP_Y) };
}

const overlaps = (a: Point, b: Point) => Math.abs(a.x - b.x) < NODE_W + GAP_X / 2 && Math.abs(a.y - b.y) < NODE_H + GAP_Y / 2;

/**
 * Every service's position: saved ones stay where the team put them; never
 * placed ones (canvasX/Y null) take the first grid cell no box is sitting on.
 * Same input → same answer, so everyone sees unplaced boxes in the same spot.
 */
export function placeServices(services: Service[]): Map<string, Point> {
  const out = new Map<string, Point>();
  const taken: Point[] = [];
  for (const s of services) {
    if (s.canvasX !== null && s.canvasY !== null) {
      const p = { x: s.canvasX, y: s.canvasY };
      out.set(s.id, p);
      taken.push(p);
    }
  }
  let i = 0;
  for (const s of sortForLayout(services)) {
    if (out.has(s.id)) continue;
    while (taken.some((t) => overlaps(t, cell(i)))) i++;
    const p = cell(i);
    out.set(s.id, p);
    taken.push(p);
  }
  return out;
}

/** "Tidy up": a fresh grid for everyone, applications first, then by name. */
export function tidyLayout(services: Service[]): Array<{ serviceId: string } & Point> {
  return sortForLayout(services).map((s, i) => ({ serviceId: s.id, ...cell(i) }));
}

const TYPE_ORDER: Record<string, number> = { APPLICATION: 0, WORKER: 1, DATABASE: 2, COMPOSE: 3 };

function sortForLayout(services: Service[]): Service[] {
  return [...services].sort((a, b) => (TYPE_ORDER[a.type] ?? 9) - (TYPE_ORDER[b.type] ?? 9) || a.serviceName.localeCompare(b.serviceName));
}
