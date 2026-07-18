import { clsx, type ClassValue } from "clsx";
import type { NodeStatus } from "@/lib/engine";

export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}

/** Tailwind text-colour utility for a node/link status. */
export function statusColor(status: NodeStatus): string {
  switch (status) {
    case "online":
      return "text-online";
    case "degraded":
      return "text-degraded";
    case "offline":
      return "text-down";
    case "unreachable":
      return "text-unreachable";
  }
}

export const STATUS_HEX: Record<NodeStatus, string> = {
  online: "#3ddc84",
  degraded: "#f7b32b",
  offline: "#ff5964",
  unreachable: "#5b6b80",
};

export function formatNumber(value: number, digits = 0): string {
  return value.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function formatPercent(fraction: number, digits = 1): string {
  return `${(fraction * 100).toFixed(digits)}%`;
}

export function formatDbm(dbm: number): string {
  return `${Math.round(dbm)} dBm`;
}

/** kWh from Wh with sensible precision. */
export function formatEnergy(wh: number): string {
  return `${(wh / 1000).toLocaleString("en-US", { maximumFractionDigits: 2 })} kWh`;
}

export function timeAgo(tick: number, currentTick: number, tickMs: number): string {
  const ms = (currentTick - tick) * tickMs;
  if (ms < 1000) return "now";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  return `${Math.floor(s / 60)}m ago`;
}
