"use client";

import { useState } from "react";
import { Antenna, Bomb, RadioTower, Scissors, ShieldCheck, Split } from "lucide-react";
import { Panel } from "@/components/ui/Panel";
import { useSimActions } from "@/hooks/useSimulation";
import { useSimStore } from "@/store/simStore";
import type { ChaosCommand } from "@/lib/engine";
import { cn } from "@/lib/utils";

interface ChaosButton {
  label: string;
  hint: string;
  icon: React.ReactNode;
  command: ChaosCommand;
  tone: "warn" | "bad";
}

const ACTIONS: ChaosButton[] = [
  { label: "Kill collector", hint: "Force a backhaul node offline", icon: <RadioTower size={14} />, command: { kind: "kill-collector" }, tone: "bad" },
  { label: "Cut route link", hint: "Sever a link carrying traffic", icon: <Scissors size={14} />, command: { kind: "kill-link" }, tone: "warn" },
  { label: "Degrade RF", hint: "Raise the noise floor +12 dB", icon: <Antenna size={14} />, command: { kind: "degrade-rf", magnitude: 12 }, tone: "warn" },
  { label: "Partition net", hint: "Split the mesh in two islands", icon: <Split size={14} />, command: { kind: "partition", magnitude: 0.5 }, tone: "bad" },
];

export function ChaosPanel() {
  const { injectChaos } = useSimActions();
  const selectedNodeId = useSimStore((s) => s.selectedNodeId);
  const [lastFired, setLastFired] = useState<string | null>(null);

  const fire = (label: string, command: ChaosCommand) => {
    injectChaos(command);
    setLastFired(label);
    window.setTimeout(() => setLastFired((v) => (v === label ? null : v)), 900);
  };

  return (
    <Panel title="Chaos Injection" icon={<Bomb size={13} />} tag="engineer the failure" className="shrink-0">
      <div className="grid grid-cols-2 gap-2 p-3">
        {ACTIONS.map((a) => (
          <button
            key={a.label}
            type="button"
            onClick={() => fire(a.label, a.command)}
            className={cn(
              "group flex flex-col gap-1 rounded-lg border px-3 py-2.5 text-left transition-colors",
              "border-edge bg-panel-2/40 hover:bg-panel-2",
              a.tone === "bad" ? "hover:border-down/60" : "hover:border-degraded/60",
              lastFired === a.label && "row-flash",
            )}
          >
            <span className={cn("flex items-center gap-2 text-sm font-medium", a.tone === "bad" ? "text-down" : "text-degraded")}>
              {a.icon}
              {a.label}
            </span>
            <span className="text-[0.66rem] text-ink-faint">{a.hint}</span>
          </button>
        ))}

        <button
          type="button"
          disabled={!selectedNodeId}
          onClick={() => selectedNodeId && fire("Kill node", { kind: "kill-node", targetId: selectedNodeId })}
          className={cn(
            "col-span-2 flex items-center justify-center gap-2 rounded-lg border border-edge bg-panel-2/40 px-3 py-2 text-sm font-medium transition-colors",
            selectedNodeId ? "text-down hover:border-down/60 hover:bg-panel-2" : "cursor-not-allowed text-ink-faint",
          )}
        >
          <Scissors size={14} />
          {selectedNodeId ? `Kill selected node · ${selectedNodeId}` : "Select a node to kill it"}
        </button>

        <button
          type="button"
          onClick={() => fire("Restore", { kind: "restore" })}
          className={cn(
            "col-span-2 flex items-center justify-center gap-2 rounded-lg border border-online/40 bg-online/10 px-3 py-2 text-sm font-semibold text-online transition-colors hover:bg-online/20",
            lastFired === "Restore" && "row-flash",
          )}
        >
          <ShieldCheck size={15} />
          Restore all — heal the network
        </button>
      </div>
    </Panel>
  );
}
