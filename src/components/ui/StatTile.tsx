import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type StatTone = "neutral" | "good" | "warn" | "bad";

const TONE: Record<StatTone, string> = {
  neutral: "text-ink",
  good: "text-online",
  warn: "text-degraded",
  bad: "text-down",
};

interface StatTileProps {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: StatTone;
  icon?: ReactNode;
}

export function StatTile({ label, value, sub, tone = "neutral", icon }: StatTileProps) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-edge/70 bg-panel-2/60 px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[0.62rem] font-medium uppercase tracking-[0.12em] text-ink-faint">
        {icon}
        {label}
      </div>
      <div className={cn("font-mono text-xl font-semibold leading-none tabular", TONE[tone])}>{value}</div>
      {sub && <div className="text-[0.66rem] text-ink-faint tabular">{sub}</div>}
    </div>
  );
}
