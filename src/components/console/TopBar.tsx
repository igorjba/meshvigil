"use client";

import Link from "next/link";
import { useState } from "react";
import { Dices, GitBranch, Pause, Play, SkipForward, Waypoints } from "lucide-react";
import { useSimActions } from "@/hooks/useSimulation";
import { useSimStore } from "@/store/simStore";
import { cn } from "@/lib/utils";

const SPEEDS = [
  { label: "1×", tps: 2 },
  { label: "2×", tps: 4 },
  { label: "4×", tps: 8 },
];

export function TopBar() {
  const { play, pause, step, setSpeed, reseed } = useSimActions();
  const running = useSimStore((s) => s.running);
  const connected = useSimStore((s) => s.connected);
  const tick = useSimStore((s) => s.snapshot?.tick ?? 0);
  const ticksPerSecond = useSimStore((s) => s.ticksPerSecond);
  const seed = useSimStore((s) => s.seed);
  const [seedInput, setSeedInput] = useState(String(seed));

  const applySeed = () => {
    const parsed = Number.parseInt(seedInput, 10);
    reseed({ seed: Number.isFinite(parsed) ? parsed : Math.floor(Math.random() * 1e6) });
  };

  const randomSeed = () => {
    const s = Math.floor(Math.random() * 1_000_000);
    setSeedInput(String(s));
    reseed({ seed: s });
  };

  return (
    <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-edge bg-abyss/80 px-4 py-2.5 backdrop-blur">
      <div className="flex items-center gap-2.5">
        <span className="grid h-8 w-8 place-items-center rounded-lg border border-signal/30 bg-signal/10 text-signal">
          <Waypoints size={18} />
        </span>
        <div className="leading-tight">
          <div className="flex items-center gap-2">
            <span className="font-semibold tracking-tight text-ink">MeshVigil</span>
            <span className="hidden rounded border border-edge px-1.5 py-px font-mono text-[0.6rem] text-ink-faint sm:inline">
              AMI · DLMS/COSEM
            </span>
          </div>
          <p className="hidden text-[0.66rem] text-ink-faint md:block">Simulador de rede mesh &amp; console de monitoramento</p>
        </div>
      </div>

      {/* transport */}
      <div className="flex items-center gap-1 rounded-lg border border-edge bg-panel/60 p-1">
        <button
          type="button"
          onClick={() => (running ? pause() : play())}
          title={running ? "Pausar a simulacao" : "Iniciar a simulacao"}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
            running ? "text-degraded hover:bg-panel-2" : "bg-signal/15 text-signal hover:bg-signal/25",
          )}
        >
          {running ? <Pause size={13} /> : <Play size={13} />}
          {running ? "Pausar" : "Iniciar"}
        </button>
        <button
          type="button"
          onClick={step}
          title="Avancar um passo (tick) da simulacao"
          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-ink-dim hover:bg-panel-2 hover:text-ink"
        >
          <SkipForward size={13} /> Passo
        </button>
        <div className="mx-1 h-4 w-px bg-edge" title="Velocidade da simulacao" />
        {SPEEDS.map((s) => (
          <button
            key={s.tps}
            type="button"
            onClick={() => setSpeed(s.tps)}
            className={cn(
              "rounded-md px-2 py-1 font-mono text-xs transition-colors",
              ticksPerSecond === s.tps ? "bg-panel-2 text-ink" : "text-ink-faint hover:text-ink",
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* seed */}
      <div className="flex items-center gap-1.5">
        <span
          className="cursor-help text-[0.66rem] uppercase tracking-wider text-ink-faint"
          title="Semente (seed): numero que gera a rede. A mesma seed sempre produz exatamente a mesma simulacao."
        >
          Seed
        </span>
        <input
          value={seedInput}
          onChange={(e) => setSeedInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && applySeed()}
          className="w-20 rounded-md border border-edge bg-void/60 px-2 py-1 font-mono text-xs text-ink focus:border-signal/50"
          aria-label="Semente da simulacao"
          title="Digite um numero e pressione Enter para gerar uma rede diferente"
        />
        <button
          type="button"
          onClick={randomSeed}
          title="Sortear uma rede aleatoria"
          aria-label="Sortear uma rede aleatoria"
          className="rounded-md border border-edge p-1.5 text-ink-dim hover:border-edge-bright hover:text-ink"
        >
          <Dices size={14} />
        </button>
      </div>

      <div className="ml-auto flex items-center gap-4">
        <div
          className="flex cursor-help items-center gap-2 font-mono text-xs"
          title="Tick: cada passo de tempo da simulacao. O contador mostra quantos passos ja se passaram."
        >
          <span className={cn("h-2 w-2 rounded-full", connected ? "bg-online live-dot" : "bg-unreachable")} />
          <span className="text-ink-faint">tick</span>
          <span className="w-12 text-ink tabular">{tick.toLocaleString("pt-BR")}</span>
        </div>
        <div className="flex items-center gap-1">
          <Link
            href="/sobre"
            className="rounded-md px-2 py-1 text-xs text-ink-dim hover:bg-panel-2 hover:text-ink"
            title="Como o projeto foi construido e as decisoes de arquitetura"
          >
            Arquitetura
          </Link>
          <a
            href="https://github.com"
            target="_blank"
            rel="noreferrer"
            className="rounded-md border border-edge p-1.5 text-ink-dim hover:border-edge-bright hover:text-ink"
            aria-label="Codigo-fonte no GitHub"
            title="Codigo-fonte no GitHub"
          >
            <GitBranch size={14} />
          </a>
        </div>
      </div>
    </header>
  );
}
