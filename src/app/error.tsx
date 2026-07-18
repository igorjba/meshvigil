"use client";

import { useEffect } from "react";
import { RotateCcw, TriangleAlert } from "lucide-react";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[meshvigil] render error", error);
  }, [error]);

  return (
    <div className="grid min-h-dvh place-items-center p-6">
      <div className="max-w-md rounded-panel border border-down/40 bg-panel/80 p-6 text-center">
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full border border-down/40 bg-down/10 text-down">
          <TriangleAlert size={22} />
        </div>
        <h1 className="mb-1 text-lg font-semibold text-ink">O console encontrou um erro inesperado</h1>
        <p className="mb-4 text-sm text-ink-dim">
          Um error boundary capturou a falha, então o resto do console segue intacto. Recarregue para continuar.
        </p>
        {error.digest && <p className="mb-4 font-mono text-[0.7rem] text-ink-faint">digest: {error.digest}</p>}
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center gap-2 rounded-lg border border-signal/40 bg-signal/10 px-4 py-2 text-sm font-medium text-signal hover:bg-signal/20"
        >
          <RotateCcw size={15} />
          Recarregar o console
        </button>
      </div>
    </div>
  );
}
