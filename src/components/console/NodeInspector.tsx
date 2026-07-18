"use client";

import { Route, X } from "lucide-react";
import { Panel } from "@/components/ui/Panel";
import { StatusDot } from "@/components/ui/StatusDot";
import { useSimStore } from "@/store/simStore";
import { cn, statusColor } from "@/lib/utils";

export function NodeInspector() {
  const selectedId = useSimStore((s) => s.selectedNodeId);
  const snapshot = useSimStore((s) => s.snapshot);
  const selectNode = useSimStore((s) => s.selectNode);

  const node = selectedId ? snapshot?.nodes.find((n) => n.id === selectedId) : null;

  return (
    <Panel
      title="Node Inspector"
      icon={<Route size={13} />}
      maximizable={false}
      actions={
        node ? (
          <button type="button" onClick={() => selectNode(null)} className="text-ink-faint hover:text-ink" aria-label="Clear selection">
            <X size={14} />
          </button>
        ) : undefined
      }
    >
      {!node ? (
        <p className="px-3 py-4 text-[0.72rem] text-ink-faint">Click a node on the map to inspect its route to the head-end.</p>
      ) : (
        <div className="flex flex-col gap-3 p-3 text-[0.72rem]">
          <div className="flex items-center gap-2">
            <StatusDot status={node.status} live={node.status === "online"} size={10} />
            <span className="font-mono text-sm text-ink">{node.id}</span>
            <span className={cn("ml-auto text-[0.66rem] uppercase tracking-wide", statusColor(node.status))}>{node.status}</span>
          </div>

          <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 font-mono">
            <Field label="Kind" value={node.kind} />
            <Field label="Hop count" value={Number.isFinite(node.hopCount) ? `${node.hopCount}` : "∞"} />
            <Field label="RSSI" value={node.kind === "headend" ? "—" : `${node.rssi} dBm`} />
            <Field label="Next hop" value={node.nextHop ?? "—"} />
          </dl>

          {node.route.length > 1 && (
            <div>
              <div className="mb-1 text-[0.6rem] uppercase tracking-wider text-ink-faint">Route to head-end</div>
              <div className="flex flex-wrap items-center gap-1 font-mono text-[0.68rem]">
                {node.route.map((hop, i) => (
                  <span key={hop} className="flex items-center gap-1">
                    <span className={i === 0 ? "text-signal" : "text-ink-dim"}>{hop}</span>
                    {i < node.route.length - 1 && <span className="text-ink-faint">→</span>}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-[0.6rem] uppercase tracking-wider text-ink-faint">{label}</dt>
      <dd className="text-ink">{value}</dd>
    </div>
  );
}
