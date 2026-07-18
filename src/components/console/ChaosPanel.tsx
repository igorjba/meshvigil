"use client";

import { useState } from "react";
import { Antenna, Bomb, RadioTower, Scissors, ShieldCheck, Split } from "lucide-react";
import { Panel } from "@/components/ui/Panel";
import { useSimActions } from "@/hooks/useSimulation";
import { useSimStore } from "@/store/simStore";
import type { ChaosCommand } from "@/lib/engine";
import { cn } from "@/lib/utils";

interface ChaosButton {
  id: string;
  label: string;
  hint: string;
  icon: React.ReactNode;
  command: ChaosCommand;
  tone: "warn" | "bad";
}

const ACTIONS: ChaosButton[] = [
  { id: "kill-collector", label: "Derrubar coletor", hint: "Tira um coletor do ar (falha de backhaul)", icon: <RadioTower size={14} />, command: { kind: "kill-collector" }, tone: "bad" },
  { id: "cut-link", label: "Cortar enlace", hint: "Rompe um enlace que esta transmitindo dados", icon: <Scissors size={14} />, command: { kind: "kill-link" }, tone: "warn" },
  { id: "degrade-rf", label: "Degradar RF", hint: "Aumenta a interferencia do radio em +12 dB", icon: <Antenna size={14} />, command: { kind: "degrade-rf", magnitude: 12 }, tone: "warn" },
  { id: "partition", label: "Particionar rede", hint: "Divide a malha em duas ilhas isoladas", icon: <Split size={14} />, command: { kind: "partition", magnitude: 0.5 }, tone: "bad" },
];

export function ChaosPanel() {
  const { injectChaos } = useSimActions();
  const selectedNodeId = useSimStore((s) => s.selectedNodeId);
  const [lastFired, setLastFired] = useState<string | null>(null);

  const fire = (id: string, command: ChaosCommand) => {
    injectChaos(command);
    setLastFired(id);
    window.setTimeout(() => setLastFired((v) => (v === id ? null : v)), 900);
  };

  return (
    <Panel
      title="Injecao de caos"
      icon={<Bomb size={13} />}
      tag="provoque a falha"
      hint="Provoque falhas de proposito e observe a rede se reorganizar (ou colapsar) e se recuperar. Use 'Restaurar tudo' para curar."
      className="shrink-0"
    >
      <div className="grid grid-cols-2 gap-2 p-3">
        {ACTIONS.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => fire(a.id, a.command)}
            title={a.hint}
            className={cn(
              "group flex flex-col gap-1 rounded-lg border px-3 py-2.5 text-left transition-colors",
              "border-edge bg-panel-2/40 hover:bg-panel-2",
              a.tone === "bad" ? "hover:border-down/60" : "hover:border-degraded/60",
              lastFired === a.id && "row-flash",
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
          onClick={() => selectedNodeId && fire("kill-node", { kind: "kill-node", targetId: selectedNodeId })}
          title={selectedNodeId ? "Tira o no selecionado do ar" : "Clique em um no no mapa para poder derruba-lo"}
          className={cn(
            "col-span-2 flex items-center justify-center gap-2 rounded-lg border border-edge bg-panel-2/40 px-3 py-2 text-sm font-medium transition-colors",
            selectedNodeId ? "text-down hover:border-down/60 hover:bg-panel-2" : "cursor-not-allowed text-ink-faint",
          )}
        >
          <Scissors size={14} />
          {selectedNodeId ? `Derrubar no selecionado · ${selectedNodeId}` : "Selecione um no no mapa para derruba-lo"}
        </button>

        <button
          type="button"
          onClick={() => fire("restore", { kind: "restore" })}
          title="Remove todas as falhas e deixa a rede se recuperar"
          className={cn(
            "col-span-2 flex items-center justify-center gap-2 rounded-lg border border-online/40 bg-online/10 px-3 py-2 text-sm font-semibold text-online transition-colors hover:bg-online/20",
            lastFired === "restore" && "row-flash",
          )}
        >
          <ShieldCheck size={15} />
          Restaurar tudo — curar a rede
        </button>
      </div>
    </Panel>
  );
}
