"use client";

/**
 * React entry point to the simulation. Boots the worker once on mount and
 * returns memoised control actions. Components read state via `useSimStore`
 * selectors so a tick only re-renders the panels that use the changed slice.
 */

import { useEffect, useMemo } from "react";
import { getController } from "@/lib/worker/controller";
import type { ChaosCommand } from "@/lib/engine";

export interface SimActions {
  play: () => void;
  pause: () => void;
  step: () => void;
  setSpeed: (ticksPerSecond: number) => void;
  injectChaos: (command: ChaosCommand) => void;
  reseed: (overrides: { seed?: number; meterCount?: number; collectorCount?: number }) => void;
}

/** Control actions bound to the process-wide controller. Safe to call anywhere. */
export function useSimActions(): SimActions {
  return useMemo<SimActions>(() => {
    const c = getController();
    return {
      play: () => c.play(),
      pause: () => c.pause(),
      step: () => c.step(),
      setSpeed: (tps) => c.setSpeed(tps),
      injectChaos: (command) => c.injectChaos(command),
      reseed: (overrides) => c.reseed(overrides),
    };
  }, []);
}

/** Boot the worker (idempotent) and expose control actions. Call once, high up. */
export function useSimulation(): SimActions {
  useEffect(() => {
    const controller = getController();
    controller.start();
    const onUnload = () => controller.dispose();
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, []);

  return useSimActions();
}
