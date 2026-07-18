"use client";

import { useMemo, useState } from "react";
import { Binary, CircleCheck, CircleX, Cpu } from "lucide-react";
import { Panel } from "@/components/ui/Panel";
import { SAMPLE_FRAMES, parseFrame, type FieldGroup, type ParsedFrame } from "@/lib/dlms";
import { useSimStore } from "@/store/simStore";
import { cn } from "@/lib/utils";

const GROUP_COLOR: Record<FieldGroup, string> = {
  hdlc: "text-flux",
  llc: "text-[#c084fc]",
  apdu: "text-signal",
  data: "text-online",
};

const GROUP_BG: Record<FieldGroup, string> = {
  hdlc: "bg-flux/15",
  llc: "bg-[#c084fc]/15",
  apdu: "bg-signal/15",
  data: "bg-online/15",
};

interface ByteMeta {
  group: FieldGroup;
  fieldKey: string;
}

function buildByteMap(parsed: ParsedFrame): Map<number, ByteMeta> {
  const map = new Map<number, ByteMeta>();
  parsed.fields.forEach((f, idx) => {
    for (let o = f.span.offset; o < f.span.offset + f.span.length; o++) {
      map.set(o, { group: f.group, fieldKey: `${idx}` });
    }
  });
  return map;
}

export function DlmsInspector() {
  const pinned = useSimStore((s) => s.pinnedFrameHex);
  const [customHex, setCustomHex] = useState("");
  const [activeSample, setActiveSample] = useState(SAMPLE_FRAMES[0]!.id);
  const [hoverKey, setHoverKey] = useState<string | null>(null);

  const source = customHex.trim() || pinned || SAMPLE_FRAMES.find((s) => s.id === activeSample)!.hex;

  const parsed = useMemo<ParsedFrame | { error: string }>(() => {
    try {
      return parseFrame(source);
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  }, [source]);

  const bytes = useMemo(() => source.replace(/[^0-9a-fA-F]/g, "").match(/.{1,2}/g) ?? [], [source]);
  const byteMap = "error" in parsed ? new Map<number, ByteMeta>() : buildByteMap(parsed);

  return (
    <Panel
      title="Inspetor DLMS / COSEM"
      icon={<Binary size={13} />}
      tag={pinned && !customHex ? "frame fixado" : "exemplo"}
      hint="DLMS/COSEM e o protocolo que os medidores reais usam. Aqui os bytes crus de um frame sao traduzidos para valores legiveis (energia, tensao...). Passe o mouse sobre um byte ou um campo para ver a que parte ele pertence."
      className="min-h-0"
    >
      <div className="flex h-full min-h-0 flex-col">
        {/* preset + input row */}
        <div className="flex flex-wrap items-center gap-1.5 border-b border-edge/60 px-3 py-2">
          {SAMPLE_FRAMES.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                setActiveSample(s.id);
                setCustomHex("");
                useSimStore.getState().pinFrame(null);
              }}
              title={s.blurb}
              className={cn(
                "rounded-md border px-2 py-1 text-[0.66rem] transition-colors",
                !customHex && !pinned && activeSample === s.id
                  ? "border-signal/50 bg-signal/10 text-signal"
                  : "border-edge text-ink-dim hover:border-edge-bright hover:text-ink",
              )}
            >
              {s.title}
            </button>
          ))}
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 lg:grid-cols-2">
          {/* hex view */}
          <div className="min-h-0 overflow-y-auto border-b border-edge/60 p-3 lg:border-b-0 lg:border-r">
            <div className="mb-2 flex items-center gap-3 text-[0.62rem] uppercase tracking-wider text-ink-faint">
              <Legend />
            </div>
            <div className="flex flex-wrap gap-x-1 gap-y-0.5 font-mono text-[0.72rem] leading-relaxed">
              {bytes.map((b, i) => {
                const meta = byteMap.get(i);
                const active = meta && hoverKey === meta.fieldKey;
                return (
                  <span
                    key={i}
                    onMouseEnter={() => setHoverKey(meta?.fieldKey ?? null)}
                    onMouseLeave={() => setHoverKey(null)}
                    className={cn(
                      "rounded px-0.5 transition-colors",
                      meta ? GROUP_COLOR[meta.group] : "text-ink-faint",
                      active && meta && GROUP_BG[meta.group],
                    )}
                  >
                    {b.toUpperCase()}
                  </span>
                );
              })}
            </div>
          </div>

          {/* decoded view */}
          <div className="min-h-0 overflow-y-auto p-3">
            {"error" in parsed ? (
              <div className="flex items-center gap-2 rounded-md border border-down/40 bg-down/10 px-3 py-2 text-sm text-down">
                <CircleX size={15} /> {parsed.error}
              </div>
            ) : (
              <DecodedView parsed={parsed} onHoverField={setHoverKey} hoverKey={hoverKey} />
            )}
          </div>
        </div>

        <div className="border-t border-edge/60 px-3 py-2">
          <input
            value={customHex}
            onChange={(e) => setCustomHex(e.target.value)}
            placeholder="Cole um frame DLMS/COSEM em hexadecimal (ex.: 7E A0 33 …) para decodificar"
            spellCheck={false}
            maxLength={8192}
            className="w-full rounded-md border border-edge bg-void/60 px-2.5 py-1.5 font-mono text-[0.72rem] text-ink placeholder:text-ink-faint focus:border-signal/50"
          />
        </div>
      </div>
    </Panel>
  );
}

const GROUP_LABEL: Record<FieldGroup, string> = { hdlc: "HDLC", llc: "LLC", apdu: "APDU", data: "dados" };
const GROUP_HINT: Record<FieldGroup, string> = {
  hdlc: "Camada de enlace: delimita o frame, enderecos e verificacoes de integridade",
  llc: "Cabecalho de controle logico do enlace",
  apdu: "Mensagem da aplicacao (ex.: notificacao de dados do medidor)",
  data: "Os valores medidos em si (energia, tensao, etc.)",
};

function Legend() {
  const groups: FieldGroup[] = ["hdlc", "llc", "apdu", "data"];
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1" title="As cores agrupam os bytes por camada do protocolo">
      {groups.map((g) => (
        <span key={g} className={cn("flex cursor-help items-center gap-1", GROUP_COLOR[g])} title={GROUP_HINT[g]}>
          <span className="inline-block h-2 w-2 rounded-sm bg-current opacity-70" />
          {GROUP_LABEL[g]}
        </span>
      ))}
    </div>
  );
}

function DecodedView({
  parsed,
  onHoverField,
  hoverKey,
}: {
  parsed: ParsedFrame;
  onHoverField: (k: string | null) => void;
  hoverKey: string | null;
}) {
  return (
    <div className="flex flex-col gap-3 text-[0.72rem]">
      {/* CRC + APDU summary */}
      <div className="flex flex-wrap items-center gap-2">
        <CrcBadge ok={parsed.hdlc.fcs.ok} label="FCS" />
        {parsed.hdlc.hcs && <CrcBadge ok={parsed.hdlc.hcs.ok} label="HCS" />}
        {parsed.apdu && (
          <span className="flex items-center gap-1 rounded-md border border-signal/40 bg-signal/10 px-2 py-0.5 font-mono text-signal">
            <Cpu size={12} /> {parsed.apdu.name}
          </span>
        )}
        <span className="font-mono text-ink-faint">
          {parsed.hdlc.source.hex} → {parsed.hdlc.destination.hex} · {parsed.hdlc.control.name.split(" ")[0]}
        </span>
      </div>

      {/* field map */}
      <div className="overflow-hidden rounded-md border border-edge/60">
        <table className="w-full border-collapse font-mono text-[0.68rem]">
          <tbody>
            {parsed.fields.map((f, idx) => (
              <tr
                key={idx}
                onMouseEnter={() => onHoverField(`${idx}`)}
                onMouseLeave={() => onHoverField(null)}
                className={cn(
                  "border-b border-edge/40 last:border-0",
                  hoverKey === `${idx}` ? GROUP_BG[f.group] : "hover:bg-panel-2/40",
                )}
              >
                <td className={cn("px-2 py-0.5", GROUP_COLOR[f.group])}>{f.name}</td>
                <td className="px-2 py-0.5 text-right text-ink-dim">{f.value ?? f.hex}</td>
                <td className="px-2 py-0.5 text-ink-faint">{f.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* readings */}
      {parsed.readings.length > 0 && (
        <div>
          <div
            className="mb-1 cursor-help text-[0.6rem] uppercase tracking-wider text-ink-faint"
            title="Os valores finais extraidos do frame. O codigo OBIS identifica o que cada numero significa."
          >
            Registradores decodificados
          </div>
          <div className="flex flex-col gap-1">
            {parsed.readings.map((r, i) => (
              <div
                key={i}
                className="flex items-center gap-2 rounded-md border border-edge/50 bg-panel-2/40 px-2.5 py-1.5"
                title={`OBIS ${r.obis} — codigo padrao que identifica esta grandeza`}
              >
                <span className="font-mono text-online">{r.obis}</span>
                <span className="flex-1 truncate text-ink-dim">{r.label}</span>
                <span className="font-mono font-semibold text-ink tabular">
                  {typeof r.value === "number" ? r.value.toLocaleString("pt-BR") : r.value}
                  {r.unit ? ` ${r.unit}` : ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {parsed.errors.length > 0 && (
        <ul className="flex flex-col gap-1">
          {parsed.errors.map((e, i) => (
            <li key={i} className="flex items-center gap-1.5 text-down">
              <CircleX size={12} /> {e}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const CRC_HINT: Record<string, string> = {
  FCS: "Frame Check Sequence: verificacao de integridade do frame inteiro (como um digito verificador). Se falha, o frame chegou corrompido.",
  HCS: "Header Check Sequence: verificacao de integridade so do cabecalho do frame.",
};

function CrcBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      title={CRC_HINT[label]}
      className={cn(
        "flex cursor-help items-center gap-1 rounded-md border px-2 py-0.5 font-mono",
        ok ? "border-online/40 bg-online/10 text-online" : "border-down/40 bg-down/10 text-down",
      )}
    >
      {ok ? <CircleCheck size={12} /> : <CircleX size={12} />}
      {label} {ok ? "ok" : "falhou"}
    </span>
  );
}
