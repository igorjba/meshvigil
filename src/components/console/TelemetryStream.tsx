"use client";

import { Radio } from "lucide-react";
import { Panel } from "@/components/ui/Panel";
import { useSimStore } from "@/store/simStore";
import { cn, formatEnergy } from "@/lib/utils";

function rssiTone(rssi: number): string {
  if (rssi > -75) return "text-online";
  if (rssi > -88) return "text-degraded";
  return "text-down";
}

export function TelemetryStream() {
  const readings = useSimStore((s) => s.readings);
  const pinFrame = useSimStore((s) => s.pinFrame);
  const selectNode = useSimStore((s) => s.selectNode);

  return (
    <Panel title="Telemetry Stream" icon={<Radio size={13} />} tag={`${readings.length} buffered`}>
      <div className="h-full overflow-y-auto">
        <table className="w-full border-collapse font-mono text-[0.7rem]">
          <thead className="sticky top-0 z-10 bg-panel/95 text-[0.6rem] uppercase tracking-wider text-ink-faint backdrop-blur">
            <tr className="[&>th]:px-2.5 [&>th]:py-1.5 [&>th]:text-left [&>th]:font-medium">
              <th>Meter</th>
              <th className="text-right">Power</th>
              <th className="text-right">Voltage</th>
              <th className="text-right">Energy</th>
              <th className="text-right">RSSI</th>
              <th className="text-right">Hops</th>
            </tr>
          </thead>
          <tbody>
            {readings.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-center text-ink-faint">
                  Waiting for the first read cycle…
                </td>
              </tr>
            ) : (
              readings.map((r, i) => {
                const inspect = () => {
                  pinFrame(r.frameHex);
                  selectNode(r.meterId);
                };
                return (
                  <tr
                    key={`${r.meterId}-${r.tick}-${i}`}
                    className={cn(
                      "border-b border-edge/40 transition-colors hover:bg-panel-2/60 [&>td]:px-2.5 [&>td]:py-1 [&>td]:tabular",
                      i === 0 && "row-flash",
                    )}
                  >
                    <td className="text-signal">
                      <button
                        type="button"
                        onClick={inspect}
                        className="rounded-sm text-signal hover:underline"
                        title={`Inspect ${r.meterId}'s DLMS frame`}
                      >
                        {r.meterId}
                      </button>
                    </td>
                    <td className="text-right text-ink">{r.powerW} W</td>
                    <td className="text-right text-ink-dim">{r.voltageV} V</td>
                    <td className="text-right text-ink-dim">{formatEnergy(r.energyWh)}</td>
                    <td className={cn("text-right", rssiTone(r.rssi))}>{r.rssi}</td>
                    <td className="text-right text-ink-dim">{r.hopCount}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
