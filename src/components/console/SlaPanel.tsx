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
    <Panel title="Service Level" icon={<Gauge size={13} />} tag="live" className="shrink-0">
      <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3">
        <StatTile
          label="Availability"
          value={formatPercent(sla.availability)}
          tone={fractionTone(sla.availability, 0.98, 0.85)}
          icon={<Activity size={11} />}
          sub={`${sla.unreachable} meters unreachable`}
        />
        <StatTile
          label="Read success"
          value={formatPercent(sla.readSuccessRate)}
          tone={fractionTone(sla.readSuccessRate, 0.97, 0.85)}
          icon={<RadioTower size={11} />}
          sub={`${formatNumber(sla.readsDelivered)} / ${formatNumber(sla.readsExpected)} reads`}
        />
        <StatTile
          label="MTTR"
          value={`${mttrSeconds(sla, TICK_MS)}s`}
          tone="neutral"
          icon={<Timer size={11} />}
          sub={`${sla.mttrTicks} ticks mean`}
        />
        <StatTile
          label="Partitions"
          value={sla.partitions}
          tone={sla.partitions > 1 ? "bad" : "good"}
          icon={<Waypoints size={11} />}
          sub={sla.partitions > 1 ? "network split" : "fully converged"}
        />
        <StatTile
          label="RF noise floor"
          value={formatDbm(noiseFloor)}
          tone={noiseFloor > -90 ? "warn" : "neutral"}
          icon={<TriangleAlert size={11} />}
          sub={noiseFloor > -90 ? "degraded" : "nominal"}
        />
        <StatTile
          label="Reads delivered"
          value={formatNumber(sla.readsDelivered)}
          tone="neutral"
          icon={<RadioTower size={11} />}
          sub="since seed"
        />
      </div>
    </Panel>
  );
}
