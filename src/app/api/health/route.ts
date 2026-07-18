import { NextResponse } from "next/server";
import { parseFrame } from "@/lib/dlms";
import { SAMPLE_FRAMES } from "@/lib/dlms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BOOT_TIME = Date.now();

/**
 * Liveness + readiness probe. Beyond "the process is up", it exercises the DLMS
 * codec on a known-good frame, so a green check means the core actually works —
 * not just that the server answered.
 */
export function GET() {
  const started = performance.now();

  let codecOk = false;
  let codecDetail = "";
  try {
    const parsed = parseFrame(SAMPLE_FRAMES[0]!.hex);
    codecOk = parsed.ok && parsed.readings.length > 0;
    codecDetail = `${parsed.readings.length} register(s) decoded`;
  } catch (err) {
    codecDetail = err instanceof Error ? err.message : String(err);
  }

  const durationMs = Number((performance.now() - started).toFixed(3));
  const healthy = codecOk;

  return NextResponse.json(
    {
      status: healthy ? "ok" : "degraded",
      service: "meshvigil",
      version: process.env.NEXT_PUBLIC_APP_VERSION ?? "dev",
      commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
      uptimeSeconds: Math.floor((Date.now() - BOOT_TIME) / 1000),
      timestamp: new Date().toISOString(),
      checks: {
        dlmsCodec: { ok: codecOk, detail: codecDetail },
      },
      durationMs,
    },
    {
      status: healthy ? 200 : 503,
      headers: { "cache-control": "no-store" },
    },
  );
}
