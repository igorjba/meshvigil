import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, CircuitBoard, Cpu, Radio, ServerCog, ShieldCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "Arquitetura & Decisões",
  description:
    "Como o MeshVigil roda uma simulação de rede mesh AMI inteiramente no browser, o codec DLMS/COSEM no coração e as arquiteturas descartadas.",
};

export default function SobrePage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-10">
      <Link href="/" className="mb-8 inline-flex items-center gap-2 text-sm text-ink-dim hover:text-ink">
        <ArrowLeft size={15} /> Voltar ao console
      </Link>

      <header className="mb-10">
        <p className="mb-2 font-mono text-xs uppercase tracking-[0.2em] text-signal">MeshVigil · arquitetura</p>
        <h1 className="text-3xl font-semibold tracking-tight text-ink">Um simulador que não cai</h1>
        <p className="mt-3 text-ink-dim">
          O MeshVigil modela uma rede AMI RF-mesh — medidores roteando por coletores até uma central (head-end) — com
          telemetria sintética, injeção de caos e um parser DLMS/COSEM real no coração. O foco de engenharia é menos a
          simulação em si e mais torná-la determinística, testável e de hospedagem gratuita, sem timeout de serverless.
        </p>
      </header>

      <Section icon={<CircuitBoard size={16} />} title="Visão geral">
        <ArchDiagram />
        <p className="mt-4">
          A simulação inteira roda no cliente, dentro de um <Mono>Web Worker</Mono>. O worker é o dono do estado
          autoritativo e o avança por um timer; a thread da UI renderiza uma projeção de cada snapshot. O servidor é
          deliberadamente fino — um health check e um armazenamento opcional de snapshots — então não há processo
          persistente para pagar, escalar ou ver cair.
        </p>
      </Section>

      <Section icon={<Cpu size={16} />} title="O codec DLMS/COSEM">
        <p>
          Cada leitura que a simulação emite é serializada em um frame DLMS/COSEM <Mono>DataNotification</Mono> genuíno —
          framing HDLC com CRC-16/X.25 no cabeçalho e no frame, uma camada LLC, uma APDU xDLMS e dados COSEM em A-XDR
          carregando registradores identificados por OBIS. O inspetor então decodifica exatamente esses bytes de volta para
          objetos legíveis. Não há caminho de dados falso: bytes entram, objetos saem — as duas direções cobertas por testes,
          incluindo um round-trip completo encoder&nbsp;↔&nbsp;parser e um frame deliberadamente corrompido que precisa falhar
          na verificação de FCS.
        </p>
      </Section>

      <Section icon={<ShieldCheck size={16} />} title="Por que determinismo">
        <p>
          A engine é uma função pura de <Mono>(seed, tick, eventos de caos)</Mono>. Nenhum <Mono>Math.random()</Mono> é
          chamado em lugar nenhum; todo sorteio vem de um PRNG seedado misturado com o tick atual. A mesma seed e o mesmo log
          de comandos produzem uma saída byte a byte idêntica — é isso que torna a simulação testável, que permite reproduzir
          um snapshot compartilhado com exatidão e que deixaria um browser e um servidor concordarem sobre o estado sem uma
          conexão ativa.
        </p>
      </Section>

      <Section icon={<ServerCog size={16} />} title="Alternativas consideradas">
        <p className="mb-4">Um desenho server-driven era uma opção. O raciocínio por trás das escolhas feitas:</p>
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
        O texto completo e o status do CI estão no README do repositório.
      </footer>
    </div>
  );
}

function Section({ icon, title, children }: Readonly<{ icon: React.ReactNode; title: string; children: React.ReactNode }>) {
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

function Mono({ children }: Readonly<{ children: React.ReactNode }>) {
  return <code className="rounded bg-panel-2 px-1 py-0.5 font-mono text-[0.85em] text-ink">{children}</code>;
}

function ArchDiagram() {
  return (
    <div className="overflow-x-auto rounded-panel border border-edge bg-panel/60 p-4">
      <div className="flex min-w-[560px] flex-col gap-3 font-mono text-[0.72rem]">
        <div className="rounded-lg border border-flux/30 bg-flux/5 p-3">
          <div className="mb-2 text-flux">BROWSER</div>
          <div className="flex items-stretch gap-3">
            <Box label="Thread da UI" sub="React · Canvas · Zustand" tone="ink" />
            <Arrow label="snapshots" />
            <Box label="Web Worker" sub="engine determinística por tick" tone="signal" />
            <Arrow label="encode / decode" />
            <Box label="Codec DLMS/COSEM" sub="HDLC · APDU · A-XDR · OBIS" tone="online" />
          </div>
        </div>
        <div className="self-center text-ink-faint">▲ HTTPS (assets estáticos · fetch ocasional) ▼</div>
        <div className="rounded-lg border border-edge-bright/40 bg-panel-2/40 p-3">
          <div className="mb-2 text-ink-dim">VERCEL (servidor fino)</div>
          <div className="flex items-stretch gap-3">
            <Box label="Next.js App Router" sub="estático + RSC" tone="ink" />
            <Box label="/api/health" sub="liveness + self-test do codec" tone="ink" />
            <Box label="/api/snapshot" sub="Upstash KV opcional" tone="ink" />
            <Box label="OpenTelemetry" sub="@vercel/otel" tone="ink" />
          </div>
        </div>
      </div>
    </div>
  );
}

function Box({ label, sub, tone }: Readonly<{ label: string; sub: string; tone: "ink" | "signal" | "online" | "flux" }>) {
  const color = { ink: "text-ink", signal: "text-signal", online: "text-online", flux: "text-flux" }[tone];
  return (
    <div className="flex-1 rounded-md border border-edge bg-void/40 p-2.5">
      <div className={color}>{label}</div>
      <div className="mt-0.5 text-[0.66rem] text-ink-faint">{sub}</div>
    </div>
  );
}

function Arrow({ label }: Readonly<{ label: string }>) {
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
            <th>Opção</th>
            <th>Veredito</th>
            <th>Por quê</th>
          </tr>
        </thead>
        <tbody className="text-ink-dim">
          {TRADEOFFS.map((t) => (
            <tr key={t.option} className="border-t border-edge/60 [&>td]:px-3 [&>td]:py-2.5 [&>td]:align-top">
              <td className="font-medium text-ink">{t.option}</td>
              <td>
                <span className={t.verdict === "Rejeitado" ? "text-down" : "text-degraded"}>{t.verdict}</span>
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
    verdict: "Rejeitado",
    why: "O cron do Hobby roda cerca de uma vez por dia e handlers SSE batem no timeout de função — o oposto exato de um sistema que fica de pé. Ainda força uma dependência externa numa demo que deveria simplesmente funcionar.",
  },
  {
    option: "Engine em Rust → WASM",
    verdict: "Adiado",
    why: "Adiciona um toolchain e um risco real de quebrar o deploy por um ganho de performance que não existe nesta escala. Um Web Worker em TypeScript já entrega execução client-side de custo zero e escala infinita.",
  },
  {
    option: "Transporte por WebSocket",
    verdict: "Rejeitado",
    why: "Funções serverless não seguram sockets de longa duração. Com a engine no browser não há a que se conectar — o problema de transporte desaparece.",
  },
  {
    option: "TypeScript 7 / ESLint 10 gume-vivo",
    verdict: "Adiado",
    why: "Fixei as duas ferramentas com maior chance de quebrar o type-checker embutido do build nas suas majors comprovadas. Latest onde é seguro; conservador no caminho crítico de deploy.",
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
