"use client";

import { Activity, Gauge, RadioTower, Timer, TriangleAlert, Waypoints } from "lucide-react";
import { Panel } from "@/components/ui/Panel";
import { StatTile, type StatTone } from "@/components/ui/StatTile";
import { emptySla, mttrSeconds } from "@/lib/engine";
import { useSimStore } from "@/store/simStore";
import { formatDbm, formatNumber, formatPercent } from "@/lib/utils";

const TICK_MS = 1000;

/** Map a 0..1 health fraction to a stat-tile tone. */
function fractionTone(value: number, goodAt: number, warnAt: number): StatTone {
  if (value >= goodAt) return "good";
  if (value >= warnAt) return "warn";
  return "bad";
}

export function SlaPanel() {
  const sla = useSimStore((s) => s.sla) ?? emptySla();
  const noiseFloor = useSimStore((s) => s.snapshot?.noiseFloor ?? -100);

  return (
    <Panel
      title="Nivel de servico"
      icon={<Gauge size={13} />}
      tag="ao vivo"
      hint="Os indicadores de saude da rede (SLA): o quanto ela esta funcionando bem neste momento."
      className="shrink-0"
    >
      <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3">
        <StatTile
          label="Disponibilidade"
          value={formatPercent(sla.availability)}
          tone={fractionTone(sla.availability, 0.98, 0.85)}
          icon={<Activity size={11} />}
          sub={`${sla.unreachable} medidores fora`}
          hint="Percentual de medidores que conseguem falar com a central agora. 100% = todos online."
        />
        <StatTile
          label="Leituras entregues"
          value={formatPercent(sla.readSuccessRate)}
          tone={fractionTone(sla.readSuccessRate, 0.97, 0.85)}
          icon={<RadioTower size={11} />}
          sub={`${formatNumber(sla.readsDelivered)} / ${formatNumber(sla.readsExpected)} leituras`}
          hint="Das leituras que os medidores tentaram enviar, quantas chegaram na central."
        />
        <StatTile
          label="MTTR"
          value={`${mttrSeconds(sla, TICK_MS)}s`}
          tone="neutral"
          icon={<Timer size={11} />}
          sub={`media de ${sla.mttrTicks} ticks`}
          hint="Tempo medio de recuperacao: quanto a rede leva, em media, para reconectar um medidor que caiu."
        />
        <StatTile
          label="Particoes"
          value={sla.partitions}
          tone={sla.partitions > 1 ? "bad" : "good"}
          icon={<Waypoints size={11} />}
          sub={sla.partitions > 1 ? "rede dividida" : "rede unida"}
          hint="Em quantos pedacos isolados a rede esta. 1 = tudo conectado; 2 ou mais = a rede se partiu."
        />
        <StatTile
          label="Ruido de RF"
          value={formatDbm(noiseFloor)}
          tone={noiseFloor > -90 ? "warn" : "neutral"}
          icon={<TriangleAlert size={11} />}
          sub={noiseFloor > -90 ? "degradado" : "normal"}
          hint="Nivel de interferencia no radio (em dBm). Quanto mais alto (menos negativo), pior o sinal e mais enlaces caem."
        />
        <StatTile
          label="Total de leituras"
          value={formatNumber(sla.readsDelivered)}
          tone="neutral"
          icon={<RadioTower size={11} />}
          sub="desde o inicio"
          hint="Quantidade acumulada de leituras entregues desde que esta rede (seed) comecou."
        />
      </div>
    </Panel>
  );
}
