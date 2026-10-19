import { useCallback, useMemo, useState } from "react";
import { Background, Controls, MiniMap, ReactFlow, useReactFlow, type NodeChange, type NodeTypes } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import toast from "react-hot-toast";
import type { Service } from "shared-types";
import { apiMessage } from "../../../utils/apiMessage";
import { useSaveCanvasPositions } from "../hooks/useCanvasPositions";
import { NODE_H, NODE_W, placeServices, type Point } from "../layout";
import { CanvasPanel } from "./CanvasPanel";
import { ServiceNode, type ServiceNodeType } from "./ServiceNode";

const NODE_TYPES: NodeTypes = { service: ServiceNode };
/** Room kept clear for the floating panel (280px wide + margins) when fitting the view. */
const PANEL_ROOM = 320;
const fitPadding = (panelOpen: boolean) => ({ top: "48px", bottom: "48px", left: "48px", right: panelOpen ? `${PANEL_ROOM}px` : "48px" }) as const;

/**
 * The environment's services as boxes. Everyone can drag (shared layout,
 * decided 2026-10-18); a drop saves that one position. Boxes are derived from
 * the services list every render: only the drag in progress and React Flow's
 * measured sizes live in local state, so a refetch never fights the user.
 */
export function ServiceCanvas({
  environmentId,
  services,
  serverName,
  servicePath,
}: {
  environmentId: string;
  services: Service[];
  serverName: (id: string | null) => string | undefined;
  servicePath: (id: string) => string;
}) {
  const flow = useReactFlow();
  const save = useSaveCanvasPositions(environmentId);
  const [dragging, setDragging] = useState<Record<string, Point>>({});
  const [measured, setMeasured] = useState<Record<string, { width: number; height: number }>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);
  const togglePanel = (open: boolean) => {
    setPanelOpen(open);
    // Re-fit so no box ends up hidden behind the panel (or stranded when it closes).
    window.setTimeout(() => void flow.fitView({ padding: fitPadding(open), maxZoom: 1, duration: 300 }), 0);
  };

  const placed = useMemo(() => placeServices(services), [services]);
  const nodes: ServiceNodeType[] = useMemo(
    () =>
      services.map((s) => ({
        id: s.id,
        type: "service",
        position: dragging[s.id] ?? placed.get(s.id)!,
        data: { service: s, serverName: serverName(s.serverId) },
        selected: s.id === selectedId,
        measured: measured[s.id],
      })),
    [services, placed, dragging, measured, selectedId, serverName],
  );

  const onNodesChange = useCallback((changes: NodeChange<ServiceNodeType>[]) => {
    for (const c of changes) {
      if (c.type === "position" && c.position) {
        const p = c.position;
        setDragging((d) => ({ ...d, [c.id]: p }));
      }
      if (c.type === "dimensions" && c.dimensions) {
        const dims = c.dimensions;
        setMeasured((m) => ({ ...m, [c.id]: dims }));
      }
    }
  }, []);

  const onNodeDragStop = useCallback(
    (_: unknown, node: ServiceNodeType) => {
      const { x, y } = node.position;
      const before = placed.get(node.id);
      const clear = () =>
        setDragging((d) => {
          const rest = { ...d };
          delete rest[node.id];
          return rest;
        });
      if (before && Math.round(before.x) === Math.round(x) && Math.round(before.y) === Math.round(y)) return clear();
      save.mutate([{ serviceId: node.id, x, y }], {
        onError: (e) => toast.error(`Couldn't save the layout. ${apiMessage(e)}`),
        onSettled: clear,
      });
    },
    [placed, save],
  );

  const flyTo = (id: string) => {
    const p = placed.get(id);
    setSelectedId(id);
    // Aim a little right of the box so it lands in the visible area, left of the panel.
    if (p) void flow.setCenter(p.x + NODE_W / 2 + (panelOpen ? PANEL_ROOM / 2 : 0), p.y + NODE_H / 2, { zoom: 1, duration: 450 });
  };

  return (
    <div className="relative h-full min-h-[460px] overflow-hidden rounded-2xl border border-cb bg-ink">
      <ReactFlow<ServiceNodeType>
        nodes={nodes}
        edges={[]}
        nodeTypes={NODE_TYPES}
        onNodesChange={onNodesChange}
        onNodeDragStop={onNodeDragStop}
        onNodeClick={(_, n) => setSelectedId(n.id)}
        onPaneClick={() => setSelectedId(null)}
        nodesConnectable={false}
        fitView
        fitViewOptions={{ padding: fitPadding(panelOpen), maxZoom: 1 }}
        minZoom={0.2}
        maxZoom={1.75}
        colorMode="dark"
        proOptions={{ hideAttribution: false }}
      >
        <Background gap={24} size={1.2} color="var(--color-track)" />
        <Controls position="bottom-left" showInteractive={false} />
        {/* Next to the zoom buttons, clear of the boxes and the panel. */}
        <MiniMap position="bottom-left" style={{ marginLeft: 56, width: 150, height: 96 }} pannable zoomable className="!bg-card" nodeColor="var(--color-focus)" maskColor="rgba(0,0,0,.55)" />
      </ReactFlow>
      <CanvasPanel
        services={services}
        serverName={serverName}
        selected={services.find((s) => s.id === selectedId)}
        onPick={flyTo}
        onBack={() => setSelectedId(null)}
        servicePath={servicePath}
        open={panelOpen}
        onOpenChange={togglePanel}
      />
    </div>
  );
}
