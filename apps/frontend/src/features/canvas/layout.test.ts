import { describe, expect, it } from "vitest";
import type { Service } from "shared-types";
import { cell, NODE_W, placeServices, tidyLayout } from "./layout";

const svc = (id: string, name: string, type: Service["type"] = "APPLICATION", x: number | null = null, y: number | null = null): Service => ({
  id,
  serviceName: name,
  type,
  status: "NOT_DEPLOYED",
  githubRepoUrl: null,
  branch: null,
  port: null,
  image: null,
  environmentId: "env",
  serverId: null,
  canvasX: x,
  canvasY: y,
  createdAt: "2026-10-19T00:00:00.000Z",
  updatedAt: "2026-10-19T00:00:00.000Z",
});

describe("placeServices", () => {
  it("keeps saved positions exactly", () => {
    const p = placeServices([svc("a", "api", "APPLICATION", 500, 300)]);
    expect(p.get("a")).toEqual({ x: 500, y: 300 });
  });

  it("puts unplaced services on free grid cells, applications first", () => {
    const p = placeServices([svc("w", "worker", "WORKER"), svc("b", "web"), svc("a", "api")]);
    expect(p.get("a")).toEqual(cell(0));
    expect(p.get("b")).toEqual(cell(1));
    expect(p.get("w")).toEqual(cell(2));
  });

  it("never drops a new box on top of a placed one", () => {
    const p = placeServices([svc("a", "api", "APPLICATION", 0, 0), svc("n", "new")]);
    expect(p.get("n")).toEqual(cell(1));
    expect(Math.abs(p.get("n")!.x - p.get("a")!.x)).toBeGreaterThanOrEqual(NODE_W);
  });

  it("gives everyone the same answer for the same services", () => {
    const list = [svc("x", "x"), svc("y", "y"), svc("z", "z", "WORKER", 900, 0)];
    expect(Object.fromEntries(placeServices(list))).toEqual(Object.fromEntries(placeServices([...list].reverse())));
  });
});

describe("tidyLayout", () => {
  it("lays every service on a clean grid, ignoring old positions", () => {
    const t = tidyLayout([svc("w", "worker", "WORKER", 5, 5), svc("a", "api", "APPLICATION", 999, 999)]);
    expect(t).toEqual([
      { serviceId: "a", ...cell(0) },
      { serviceId: "w", ...cell(1) },
    ]);
  });
});
