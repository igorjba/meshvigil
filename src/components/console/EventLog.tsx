"use client";

import { ScrollText } from "lucide-react";
import { Panel } from "@/components/ui/Panel";
import { useSimStore } from "@/store/simStore";
import type { EventLevel } from "@/lib/engine";
import { cn } from "@/lib/utils";

const LEVEL_STYLE: Record<EventLevel, string> = {
  info: "text-ink-dim",
  success: "text-online",
  warn: "text-degraded",
  error: "text-down",
};

const LEVEL_GLYPH: Record<EventLevel, string> = {
  info: "•",
  success: "✓",
  warn: "▲",
  error: "✕",
};

export function EventLog() {
  const events = useSimStore((s) => s.events);

  return (
    <Panel
      title="Registro de eventos"
      icon={<ScrollText size={13} />}
      tag={`${events.length}`}
      hint="Historico do que aconteceu na rede: falhas injetadas, quedas e recuperacoes, em ordem do mais recente para o mais antigo."
      className="min-h-0"
    >
      <div className="h-full overflow-y-auto px-1 py-1 font-mono text-[0.7rem]">
        {events.length === 0 ? (
          <p className="px-3 py-4 text-ink-faint">Nenhum evento ainda. Injete algum caos.</p>
        ) : (
          <ul>
            {events.map((e, i) => (
              <li
                key={`${e.tick}-${e.code}-${i}`}
                className={cn("flex items-baseline gap-2 rounded px-2.5 py-1 hover:bg-panel-2/50", i === 0 && "row-flash")}
              >
                <span className="w-10 shrink-0 text-right text-ink-faint tabular">t{e.tick}</span>
                <span className={cn("shrink-0", LEVEL_STYLE[e.level])}>{LEVEL_GLYPH[e.level]}</span>
                <span className="text-ink">{e.message}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Panel>
  );
}
