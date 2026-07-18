"use client";

import { useEffect, useRef, useState } from "react";
import type { MeshLink, MeshNode, Snapshot } from "@/lib/engine";
import { useSimStore } from "@/store/simStore";
import { STATUS_HEX } from "@/lib/utils";

interface Layout {
  width: number;
  height: number;
  dpr: number;
}

const PAD = 40;

function project(node: { x: number; y: number }, w: number, h: number) {
  return { px: PAD + node.x * (w - 2 * PAD), py: PAD + node.y * (h - 2 * PAD) };
}

/** The live network map. Reads the store imperatively so the rAF loop is stable. */
export function TopologyCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const snapshotRef = useRef<Snapshot | null>(useSimStore.getState().snapshot);
  const layoutRef = useRef<Layout>({ width: 0, height: 0, dpr: 1 });
  const hoverRef = useRef<string | null>(null);
  const [hoverLabel, setHoverLabel] = useState<{ x: number; y: number; node: MeshNode } | null>(null);
  const selectNode = useSimStore((s) => s.selectNode);
  const selectedRef = useRef<string | null>(useSimStore.getState().selectedNodeId);

  // Keep refs in sync with the store without re-rendering the canvas element.
  useEffect(() => {
    return useSimStore.subscribe((s) => {
      snapshotRef.current = s.snapshot;
      selectedRef.current = s.selectedNodeId;
    });
  }, []);

  // Size the canvas to its container.
  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const ro = new ResizeObserver(() => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const { clientWidth, clientHeight } = wrap;
      canvas.width = Math.floor(clientWidth * dpr);
      canvas.height = Math.floor(clientHeight * dpr);
      canvas.style.width = `${clientWidth}px`;
      canvas.style.height = `${clientHeight}px`;
      layoutRef.current = { width: clientWidth, height: clientHeight, dpr };
    });
    ro.observe(wrap);
    return () => ro.disconnect();
  }, []);

  // The render loop.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let raf = 0;
    let start = 0;

    const frame = (t: number) => {
      if (!start) start = t;
      const elapsed = (t - start) / 1000;
      draw(ctx, snapshotRef.current, layoutRef.current, elapsed, hoverRef.current, selectedRef.current, !reduceMotion.matches);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Hover + click hit testing.
  const onMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const snap = snapshotRef.current;
    const { width, height } = layoutRef.current;
    if (!snap) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    let nearest: MeshNode | null = null;
    let best = 18;
    for (const node of snap.nodes) {
      const { px, py } = project(node, width, height);
      const d = Math.hypot(px - mx, py - my);
      if (d < best) {
        best = d;
        nearest = node;
      }
    }
    hoverRef.current = nearest?.id ?? null;
    if (nearest) {
      const { px, py } = project(nearest, width, height);
      setHoverLabel({ x: px, y: py, node: nearest });
      e.currentTarget.style.cursor = "pointer";
    } else {
      setHoverLabel(null);
      e.currentTarget.style.cursor = "default";
    }
  };

  const onClick = () => {
    if (hoverRef.current) selectNode(hoverRef.current === selectedRef.current ? null : hoverRef.current);
  };

  return (
    <div ref={wrapRef} className="noc-grid relative h-full w-full">
      <canvas
        ref={canvasRef}
        onMouseMove={onMove}
        onMouseLeave={() => {
          hoverRef.current = null;
          setHoverLabel(null);
        }}
        onClick={onClick}
        className="h-full w-full"
        role="img"
        aria-label="RF mesh network topology"
      />
      {hoverLabel && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 translate-y-2 rounded-md border border-edge-bright bg-abyss/95 px-2 py-1 font-mono text-[0.66rem] text-ink shadow-lg"
          style={{ left: hoverLabel.x, top: hoverLabel.y + 10 }}
        >
          <span className="text-signal">{hoverLabel.node.id}</span>
          {Number.isFinite(hoverLabel.node.hopCount) && hoverLabel.node.kind !== "headend" && (
            <span className="text-ink-faint"> · {hoverLabel.node.hopCount}h · {hoverLabel.node.rssi} dBm</span>
          )}
          {!Number.isFinite(hoverLabel.node.hopCount) && <span className="text-down"> · unreachable</span>}
        </div>
      )}
      <Legend />
    </div>
  );
}

function Legend() {
  const items: { label: string; color: string }[] = [
    { label: "online", color: STATUS_HEX.online },
    { label: "degraded", color: STATUS_HEX.degraded },
    { label: "down", color: STATUS_HEX.offline },
    { label: "unreachable", color: STATUS_HEX.unreachable },
  ];
  return (
    <div className="absolute bottom-3 left-3 flex flex-wrap gap-x-3 gap-y-1 rounded-md border border-edge/60 bg-abyss/70 px-2.5 py-1.5 text-[0.62rem] text-ink-dim backdrop-blur">
      {items.map((it) => (
        <span key={it.label} className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: it.color }} />
          {it.label}
        </span>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------- drawing --- */

function draw(
  ctx: CanvasRenderingContext2D,
  snap: Snapshot | null,
  layout: Layout,
  time: number,
  hovered: string | null,
  selected: string | null,
  animate: boolean,
) {
  const { width, height, dpr } = layout;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  if (!snap || width === 0) return;

  const byId = new Map(snap.nodes.map((n) => [n.id, n]));
  drawLinks(ctx, snap.links, byId, width, height, time, animate);
  for (const node of snap.nodes) {
    drawNode(ctx, node, width, height, time, node.id === hovered, node.id === selected, animate);
  }
}

function drawLinks(
  ctx: CanvasRenderingContext2D,
  links: MeshLink[],
  byId: Map<string, MeshNode>,
  w: number,
  h: number,
  time: number,
  animate: boolean,
) {
  for (const link of links) {
    if (!link.up) continue;
    const a = byId.get(link.a);
    const b = byId.get(link.b);
    if (!a || !b) continue;
    const pa = project(a, w, h);
    const pb = project(b, w, h);

    ctx.beginPath();
    ctx.moveTo(pa.px, pa.py);
    ctx.lineTo(pb.px, pb.py);
    if (link.onRoute) {
      ctx.strokeStyle = `rgba(110, 168, 254, ${0.28 + link.quality * 0.5})`;
      ctx.lineWidth = 1.4;
    } else {
      // Idle mesh links stay as a faint substrate so the active routes pop.
      ctx.strokeStyle = `rgba(40, 58, 82, ${0.1 + link.quality * 0.12})`;
      ctx.lineWidth = 0.8;
    }
    ctx.stroke();
  }

  // Data packets flow along active routes toward the head-end. Skipped entirely
  // when the viewer prefers reduced motion.
  if (!animate) return;
  for (const link of links) {
    if (!link.up || !link.onRoute) continue;
    const a = byId.get(link.a);
    const b = byId.get(link.b);
    if (!a || !b) continue;
    // Toward head-end = toward the lower hop count.
    const [from, to] = a.hopCount >= b.hopCount ? [a, b] : [b, a];
    const pf = project(from, w, h);
    const pt = project(to, w, h);
    const phase = (time * 0.6 + hashPhase(link.id)) % 1;
    const px = pf.px + (pt.px - pf.px) * phase;
    const py = pf.py + (pt.py - pf.py) * phase;
    ctx.beginPath();
    ctx.arc(px, py, 1.8, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(52, 229, 198, 0.9)";
    ctx.fill();
  }
}

function drawNode(
  ctx: CanvasRenderingContext2D,
  node: MeshNode,
  w: number,
  h: number,
  time: number,
  hovered: boolean,
  selected: boolean,
  animate: boolean,
) {
  const { px, py } = project(node, w, h);
  const color = STATUS_HEX[node.status];
  const size = node.kind === "headend" ? 11 : node.kind === "collector" ? 7 : 4.2;

  if (selected || hovered) {
    ctx.beginPath();
    ctx.arc(px, py, size + 6, 0, Math.PI * 2);
    ctx.strokeStyle = selected ? "rgba(52, 229, 198, 0.9)" : "rgba(230, 237, 246, 0.35)";
    ctx.lineWidth = selected ? 1.6 : 1;
    ctx.stroke();
  }

  // Head-end and collectors get a soft glow so infrastructure reads first.
  if (node.kind !== "meter") {
    const glow = ctx.createRadialGradient(px, py, 0, px, py, size * 2.6);
    glow.addColorStop(0, hexToRgba(color, node.kind === "headend" ? 0.35 : 0.22));
    glow.addColorStop(1, hexToRgba(color, 0));
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(px, py, size * 2.6, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.beginPath();
  if (node.kind === "headend") {
    // Diamond.
    ctx.moveTo(px, py - size);
    ctx.lineTo(px + size, py);
    ctx.lineTo(px, py + size);
    ctx.lineTo(px - size, py);
    ctx.closePath();
  } else if (node.kind === "collector") {
    ctx.rect(px - size, py - size, size * 2, size * 2);
  } else {
    ctx.arc(px, py, size, 0, Math.PI * 2);
  }
  ctx.fillStyle = color;
  ctx.fill();

  if (node.status === "offline") {
    // A dead node pulses faintly red — held steady under reduced motion.
    const a = animate ? 0.4 + 0.3 * Math.sin(time * 4) : 0.6;
    ctx.strokeStyle = hexToRgba(STATUS_HEX.offline, a);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(px, py, size + 3, 0, Math.PI * 2);
    ctx.stroke();
  }

  if (node.kind !== "meter") {
    ctx.fillStyle = "rgba(230, 237, 246, 0.85)";
    ctx.font = "600 10px var(--font-geist-mono, monospace)";
    ctx.textAlign = "center";
    ctx.fillText(node.id, px, py - size - 6);
  }
}

function hashPhase(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 997;
  return h / 997;
}

function hexToRgba(hex: string, alpha: number): string {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}
