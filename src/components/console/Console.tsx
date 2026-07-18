"use client";

import { useEffect } from "react";
import { Network } from "lucide-react";
import { useSimulation } from "@/hooks/useSimulation";
import { useSimStore } from "@/store/simStore";
import { Panel } from "@/components/ui/Panel";
import { TopBar } from "./TopBar";
import { TopologyCanvas } from "@/components/topology/TopologyCanvas";
import { SlaPanel } from "./SlaPanel";
import { ChaosPanel } from "./ChaosPanel";
import { NodeInspector } from "./NodeInspector";
import { TelemetryStream } from "./TelemetryStream";
import { EventLog } from "./EventLog";
import { DlmsInspector } from "./DlmsInspector";

export function Console() {
  const { play } = useSimulation();

  // Auto-run on first load so the console is alive without a click.
  useEffect(() => {
    const id = window.setTimeout(() => play(), 120);
    return () => window.clearTimeout(id);
  }, [play]);

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <h1 className="sr-only">MeshVigil — AMI mesh simulator and observability console</h1>
      <TopBar />
      <main className="grid min-h-0 flex-1 gap-3 overflow-y-auto p-3 lg:grid-cols-[1.6fr_1fr] lg:grid-rows-[minmax(25rem,1.3fr)_minmax(22rem,1fr)]">
        <section className="min-h-[360px] lg:col-start-1 lg:row-start-1 lg:min-h-0">
          <TopologyPanel />
        </section>

        <aside className="flex min-h-0 flex-col gap-3 overflow-y-auto lg:col-start-2 lg:row-start-1">
          <SlaPanel />
          <ChaosPanel />
        </aside>

        <section className="min-h-[420px] lg:col-start-1 lg:row-start-2 lg:min-h-0">
          <DlmsInspector />
        </section>

        <aside className="grid min-h-0 grid-rows-2 gap-3 overflow-hidden lg:col-start-2 lg:row-start-2">
          <div className="min-h-[220px] lg:min-h-0">
            <TelemetryStream />
          </div>
          <div className="min-h-[180px] lg:min-h-0">
            <EventLog />
          </div>
        </aside>
      </main>
    </div>
  );
}

function TopologyPanel() {
  const nodeCount = useSimStore((s) => s.snapshot?.nodes.length ?? 0);
  const linkCount = useSimStore((s) => s.snapshot?.links.filter((l) => l.up).length ?? 0);
  const selectedNodeId = useSimStore((s) => s.selectedNodeId);
  return (
    <Panel
      title="Network Topology"
      icon={<Network size={13} />}
      tag={`${nodeCount} nodes · ${linkCount} links up`}
      className="h-full"
      bodyClassName="relative"
    >
      <TopologyCanvas />
      {selectedNodeId && (
        <div className="absolute right-3 top-3 z-20 w-64">
          <NodeInspector />
        </div>
      )}
    </Panel>
  );
}
