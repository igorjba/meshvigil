import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Optional snapshot persistence. The simulation is fully client-side and
 * deterministic, so this is a convenience: POST a snapshot to get a shareable
 * id (keyed by seed+tick), GET it back by id. When Upstash isn't configured the
 * route degrades to a clear 200 "disabled" response, so the demo never depends
 * on it.
 */

const TTL_SECONDS = 60 * 60 * 24 * 7; // a week
const MAX_BODY_BYTES = 256 * 1024;
// Snapshot ids are always "<seed>-<tick>" of integers — reject anything else so
// the key space can't be probed with arbitrary `snapshot:*` patterns.
const ID_PATTERN = /^-?\d{1,15}-\d{1,15}$/;

function redisOrNull(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

function disabled() {
  return NextResponse.json(
    { configured: false, message: "Snapshot persistence is not configured (set UPSTASH_REDIS_REST_URL/TOKEN)." },
    { status: 200, headers: { "cache-control": "no-store" } },
  );
}

export async function GET(request: Request) {
  const redis = redisOrNull();
  if (!redis) return disabled();

  const id = new URL(request.url).searchParams.get("id");
  if (!id || !ID_PATTERN.test(id)) return NextResponse.json({ error: "invalid id" }, { status: 400 });

  const snapshot = await redis.get(`snapshot:${id}`);
  if (!snapshot) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ configured: true, id, snapshot }, { headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request) {
  const redis = redisOrNull();
  if (!redis) return disabled();

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "payload too large" }, { status: 413 });
  }

  let body: { seed?: number; tick?: number; snapshot?: unknown };
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  if (body.snapshot == null || !Number.isInteger(body.seed) || !Number.isInteger(body.tick)) {
    return NextResponse.json({ error: "expected { seed:int, tick:int, snapshot }" }, { status: 400 });
  }

  // This write is unauthenticated by design (public share links). Enabling
  // persistence in production should be fronted with a rate limiter (e.g.
  // @upstash/ratelimit) to prevent KV-quota exhaustion. TTL bounds the exposure.
  const id = `${body.seed}-${body.tick}`;
  await redis.set(`snapshot:${id}`, body.snapshot, { ex: TTL_SECONDS });
  return NextResponse.json({ configured: true, id }, { headers: { "cache-control": "no-store" } });
}
