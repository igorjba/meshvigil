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
    <Panel
      title="Fluxo de telemetria"
      icon={<Radio size={13} />}
      tag={`${readings.length} na fila`}
      hint="As leituras que os medidores enviam a cada ciclo: consumo, tensao, energia acumulada e qualidade do sinal. Clique no codigo do medidor para ver o frame DLMS bruto."
    >
      <div className="h-full overflow-y-auto">
        <table className="w-full border-collapse font-mono text-[0.7rem]">
          <thead className="sticky top-0 z-10 bg-panel/95 text-[0.6rem] uppercase tracking-wider text-ink-faint backdrop-blur">
            <tr className="[&>th]:px-2.5 [&>th]:py-1.5 [&>th]:text-left [&>th]:font-medium">
              <th title="Codigo do medidor. Clique para inspecionar o frame DLMS.">Medidor</th>
              <th className="text-right" title="Potencia instantanea consumida, em watts (W)">Potencia</th>
              <th className="text-right" title="Tensao da rede eletrica, em volts (V)">Tensao</th>
              <th className="text-right" title="Energia total acumulada, em quilowatt-hora (kWh)">Energia</th>
              <th className="text-right" title="Forca do sinal de radio recebido, em dBm. Mais proximo de zero = melhor.">RSSI</th>
              <th className="text-right" title="Numero de saltos (hops) ate a central: quantos dispositivos a leitura atravessa.">Saltos</th>
            </tr>
          </thead>
          <tbody>
            {readings.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-center text-ink-faint">
                  Aguardando o primeiro ciclo de leitura…
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
                        title={`Inspecionar o frame DLMS do medidor ${r.meterId}`}
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
