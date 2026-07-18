import type { NodeStatus } from "@/lib/engine";
import { STATUS_HEX } from "@/lib/utils";

export function StatusDot({ status, live = false, size = 8 }: { status: NodeStatus; live?: boolean; size?: number }) {
  return (
    <span
      className={live ? "live-dot inline-block rounded-full" : "inline-block rounded-full"}
      style={{ width: size, height: size, backgroundColor: STATUS_HEX[status] }}
      aria-hidden
    />
  );
}
