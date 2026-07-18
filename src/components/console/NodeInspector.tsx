"use client";

import { Route, X } from "lucide-react";
import { Panel } from "@/components/ui/Panel";
import { StatusDot } from "@/components/ui/StatusDot";
import { useSimStore } from "@/store/simStore";
import type { NodeKind, NodeStatus } from "@/lib/engine";
import { cn, statusColor } from "@/lib/utils";

const STATUS_LABEL: Record<NodeStatus, string> = {
  online: "online",
  degraded: "degradado",
  offline: "fora do ar",
  unreachable: "inacessivel",
};

const KIND_LABEL: Record<NodeKind, string> = {
  meter: "medidor",
  collector: "coletor",
  headend: "central (head-end)",
};

export function NodeInspector() {
  const selectedId = useSimStore((s) => s.selectedNodeId);
  const snapshot = useSimStore((s) => s.snapshot);
  const selectNode = useSimStore((s) => s.selectNode);

  const node = selectedId ? snapshot?.nodes.find((n) => n.id === selectedId) : null;

  return (
    <Panel
      title="Inspetor de no"
      icon={<Route size={13} />}
      maximizable={false}
      hint="Detalhes do dispositivo selecionado: tipo, forca de sinal e o caminho que os dados dele percorrem ate a central."
      actions={
        node ? (
          <button type="button" onClick={() => selectNode(null)} className="text-ink-faint hover:text-ink" aria-label="Limpar selecao" title="Limpar selecao">
            <X size={14} />
          </button>
        ) : undefined
      }
    >
      {!node ? (
        <p className="px-3 py-4 text-[0.72rem] text-ink-faint">Clique em um no no mapa para ver a rota dele ate a central.</p>
      ) : (
        <div className="flex flex-col gap-3 p-3 text-[0.72rem]">
          <div className="flex items-center gap-2">
            <StatusDot status={node.status} live={node.status === "online"} size={10} />
            <span className="font-mono text-sm text-ink">{node.id}</span>
            <span className={cn("ml-auto text-[0.66rem] uppercase tracking-wide", statusColor(node.status))}>
              {STATUS_LABEL[node.status]}
            </span>
          </div>

          <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 font-mono">
            <Field label="Tipo" value={KIND_LABEL[node.kind]} />
            <Field
              label="Saltos"
              value={Number.isFinite(node.hopCount) ? `${node.hopCount}` : "∞"}
              hint="Quantos dispositivos os dados atravessam ate chegar na central. Menos e melhor; infinito (∞) = sem rota."
            />
            <Field
              label="RSSI"
              value={node.kind === "headend" ? "—" : `${node.rssi} dBm`}
              hint="Forca do sinal de radio no enlace, em dBm. Mais proximo de zero = melhor."
            />
            <Field label="Proximo salto" value={node.nextHop ?? "—"} hint="O proximo dispositivo para onde este no envia os dados." />
          </dl>

          {node.route.length > 1 && (
            <div>
              <div className="mb-1 text-[0.6rem] uppercase tracking-wider text-ink-faint" title="Caminho completo dos dados deste no ate a central">
                Rota ate a central
              </div>
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

function Field({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex flex-col" title={hint}>
      <dt className={cn("text-[0.6rem] uppercase tracking-wider text-ink-faint", hint && "cursor-help")}>{label}</dt>
      <dd className="text-ink">{value}</dd>
    </div>
  );
}
