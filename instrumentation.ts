/**
 * OpenTelemetry registration. The simulation itself runs client-side, so the
 * server surface is thin — but the health check and snapshot endpoints are still
 * worth tracing. `@vercel/otel` wires spans straight into Vercel's OTel pipeline
 * with zero config when deployed, and is a no-op collector locally.
 */

import { registerOTel } from "@vercel/otel";

export function register(): void {
  registerOTel({ serviceName: "meshvigil" });
}
