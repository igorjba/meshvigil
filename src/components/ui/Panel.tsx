"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Hint } from "./Hint";

interface PanelProps {
  title?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  /** Small monospace tag shown at the right of the header (e.g. a live count). */
  tag?: ReactNode;
  /** Plain-language explanation shown on hover next to the title. */
  hint?: string;
  /** Show an expand control that pops the panel to fill the viewport. */
  maximizable?: boolean;
}

const BASE =
  "flex min-h-0 flex-col overflow-hidden rounded-panel border border-edge bg-panel/80 backdrop-blur-sm " +
  "shadow-[0_1px_0_0_rgba(255,255,255,0.02)_inset,0_20px_40px_-24px_rgba(0,0,0,0.8)]";

export function Panel({ title, icon, actions, children, className, bodyClassName, tag, hint, maximizable = true }: PanelProps) {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    if (!maximized) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMaximized(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [maximized]);

  return (
    <>
      {maximized && (
        <div
          className="fixed inset-0 z-40 bg-void/70 backdrop-blur-sm"
          onClick={() => setMaximized(false)}
          aria-hidden
        />
      )}
      <section className={cn(BASE, maximized ? "fixed inset-3 z-50 md:inset-6" : className)}>
        {title && (
          <header className="flex items-center gap-2 border-b border-edge/70 px-3.5 py-2.5">
            {icon && <span className="text-signal">{icon}</span>}
            <h2 className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-ink-dim">{title}</h2>
            {hint && <Hint text={hint} />}
            <div className="ml-auto flex items-center gap-2">
              {tag && <span className="font-mono text-[0.7rem] text-ink-faint tabular">{tag}</span>}
              {actions}
              {maximizable && (
                <button
                  type="button"
                  onClick={() => setMaximized((v) => !v)}
                  aria-label={maximized ? "Restaurar painel" : "Expandir painel"}
                  title={maximized ? "Restaurar (Esc)" : "Expandir"}
                  className="rounded text-ink-faint transition-colors hover:text-ink"
                >
                  {maximized ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                </button>
              )}
            </div>
          </header>
        )}
        <div className={cn("min-h-0 flex-1", bodyClassName)}>{children}</div>
      </section>
    </>
  );
}
