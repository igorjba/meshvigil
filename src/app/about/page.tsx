import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, CircuitBoard, Cpu, Radio, ServerCog, ShieldCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "Architecture & Decisions",
  description:
    "How MeshVigil runs a deterministic AMI mesh simulation entirely in the browser, the DLMS/COSEM codec at its core, and the architectures deliberately rejected.",
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-10">
      <Link href="/" className="mb-8 inline-flex items-center gap-2 text-sm text-ink-dim hover:text-ink">
        <ArrowLeft size={15} /> Back to the console
      </Link>

      <header className="mb-10">
        <p className="mb-2 font-mono text-xs uppercase tracking-[0.2em] text-signal">MeshVigil · architecture</p>
        <h1 className="text-3xl font-semibold tracking-tight text-ink">A simulator that can&rsquo;t fall over</h1>
        <p className="mt-3 text-ink-dim">
          MeshVigil models an RF-mesh AMI network — meters routing through collectors to a head-end — with synthetic
          telemetry, chaos injection, and a real DLMS/COSEM frame parser at its core. The engineering focus is less the
          simulation itself and more making it deterministic, testable, and free to host without a serverless timeout.
        </p>
      </header>

      <Section icon={<CircuitBoard size={16} />} title="Overview">
        <ArchDiagram />
        <p className="mt-4">
          The entire simulation runs client-side in a <Mono>Web Worker</Mono>. The worker owns the authoritative state and
          advances it on a timer; the UI thread renders a projection of each snapshot. The server is deliberately thin — a
          health probe and an optional snapshot store — so there is no persistent process to pay for, scale, or watch crash.
        </p>
      </Section>

      <Section icon={<Cpu size={16} />} title="The DLMS/COSEM codec">
        <p>
          Every reading the simulation emits is serialised into a genuine DLMS/COSEM <Mono>DataNotification</Mono> frame —
          HDLC framing with CRC-16/X.25 header and frame check sequences, an LLC layer, an xDLMS APDU, and A-XDR-encoded
          COSEM data carrying OBIS-identified registers. The inspector then decodes those exact bytes back into readable
          objects. There is no mock data path: bytes in, objects out, both directions covered by unit tests including a full
          encoder&nbsp;↔&nbsp;parser round-trip and a deliberately corrupted frame that must fail its FCS check.
        </p>
      </Section>

      <Section icon={<ShieldCheck size={16} />} title="Why determinism">
        <p>
          The engine is a pure function of <Mono>(seed, tick, chaos&nbsp;events)</Mono>. No <Mono>Math.random()</Mono> is
          called anywhere; every stochastic draw comes from a seeded PRNG mixed with the current tick. Same seed and the same
          command log produce byte-identical output — which is what makes the simulation testable, what lets a shared snapshot
          be reproduced exactly, and what would let a browser and a server agree on state without a live connection.
        </p>
      </Section>

      <Section icon={<ServerCog size={16} />} title="Alternatives considered">
        <p className="mb-4">
          A server-driven design was an option. The reasoning behind the choices made:
        </p>
        <TradeoffTable />
      </Section>

      <Section icon={<Radio size={16} />} title="Stack">
        <ul className="grid grid-cols-2 gap-x-6 gap-y-1.5 font-mono text-sm text-ink-dim sm:grid-cols-3">
          {STACK.map((s) => (
            <li key={s} className="flex items-center gap-2">
              <span className="h-1 w-1 rounded-full bg-signal" />
              {s}
            </li>
          ))}
        </ul>
      </Section>

      <footer className="mt-12 border-t border-edge pt-6 text-sm text-ink-faint">
        The full write-up and CI status live in the repository README.
      </footer>
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-ink">
        <span className="text-signal">{icon}</span>
        {title}
      </h2>
      <div className="space-y-3 text-[0.95rem] leading-relaxed text-ink-dim">{children}</div>
    </section>
  );
}

function Mono({ children }: { children: React.ReactNode }) {
  return <code className="rounded bg-panel-2 px-1 py-0.5 font-mono text-[0.85em] text-ink">{children}</code>;
}

function ArchDiagram() {
  return (
    <div className="overflow-x-auto rounded-panel border border-edge bg-panel/60 p-4">
      <div className="flex min-w-[560px] flex-col gap-3 font-mono text-[0.72rem]">
        <div className="rounded-lg border border-flux/30 bg-flux/5 p-3">
          <div className="mb-2 text-flux">BROWSER</div>
          <div className="flex items-stretch gap-3">
            <Box label="UI thread" sub="React · Canvas · Zustand" tone="ink" />
            <Arrow label="snapshots" />
            <Box label="Web Worker" sub="deterministic tick engine" tone="signal" />
            <Arrow label="encode / decode" />
            <Box label="DLMS/COSEM codec" sub="HDLC · APDU · A-XDR · OBIS" tone="online" />
          </div>
        </div>
        <div className="self-center text-ink-faint">▲ HTTPS (static assets · occasional fetch) ▼</div>
        <div className="rounded-lg border border-edge-bright/40 bg-panel-2/40 p-3">
          <div className="mb-2 text-ink-dim">VERCEL (thin server)</div>
          <div className="flex items-stretch gap-3">
            <Box label="Next.js App Router" sub="static + RSC" tone="ink" />
            <Box label="/api/health" sub="liveness + codec self-test" tone="ink" />
            <Box label="/api/snapshot" sub="optional Upstash KV" tone="ink" />
            <Box label="OpenTelemetry" sub="@vercel/otel" tone="ink" />
          </div>
        </div>
      </div>
    </div>
  );
}

function Box({ label, sub, tone }: { label: string; sub: string; tone: "ink" | "signal" | "online" | "flux" }) {
  const color = { ink: "text-ink", signal: "text-signal", online: "text-online", flux: "text-flux" }[tone];
  return (
    <div className="flex-1 rounded-md border border-edge bg-void/40 p-2.5">
      <div className={color}>{label}</div>
      <div className="mt-0.5 text-[0.66rem] text-ink-faint">{sub}</div>
    </div>
  );
}

function Arrow({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-1 text-ink-faint">
      <span className="text-[0.6rem]">{label}</span>
      <span>↔</span>
    </div>
  );
}

function TradeoffTable() {
  return (
    <div className="overflow-hidden rounded-panel border border-edge">
      <table className="w-full border-collapse text-sm">
        <thead className="bg-panel-2/60 text-left text-[0.7rem] uppercase tracking-wider text-ink-faint">
          <tr className="[&>th]:px-3 [&>th]:py-2">
            <th>Option</th>
            <th>Verdict</th>
            <th>Why</th>
          </tr>
        </thead>
        <tbody className="text-ink-dim">
          {TRADEOFFS.map((t) => (
            <tr key={t.option} className="border-t border-edge/60 [&>td]:px-3 [&>td]:py-2.5 [&>td]:align-top">
              <td className="font-medium text-ink">{t.option}</td>
              <td>
                <span className={t.verdict === "Rejected" ? "text-down" : "text-degraded"}>{t.verdict}</span>
              </td>
              <td>{t.why}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const TRADEOFFS = [
  {
    option: "Redis + Vercel Cron + SSE",
    verdict: "Rejected",
    why: "Hobby cron runs about once a day and SSE handlers hit function timeouts — the exact opposite of a system that stays up. It also forces an external dependency onto a demo that should just work.",
  },
  {
    option: "Rust → WASM engine",
    verdict: "Deferred",
    why: "Adds a toolchain and a real deploy-breakage risk for a performance win that does not exist at this scale. A TypeScript worker already delivers zero-cost, infinitely-scalable client execution.",
  },
  {
    option: "WebSocket transport",
    verdict: "Rejected",
    why: "Serverless functions don't hold long-lived sockets. With the engine in the browser there is nothing to connect to — the transport problem disappears entirely.",
  },
  {
    option: "Bleeding-edge TS 7 / ESLint 10",
    verdict: "Deferred",
    why: "Pinned the two tools most likely to break next build's bundled type-checker to their proven majors. Latest everywhere it is safe; conservative on the deploy-critical path.",
  },
];

const STACK = [
  "Next.js 16",
  "React 19",
  "TypeScript 5.9",
  "Tailwind v4",
  "Zustand 5",
  "Web Workers",
  "Canvas 2D",
  "Vitest 4",
  "Playwright",
  "@vercel/otel",
  "Upstash Redis",
  "GitHub Actions",
];
