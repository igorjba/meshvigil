import Link from "next/link";
import { MoveLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="grid min-h-dvh place-items-center p-6">
      <div className="text-center">
        <p className="font-mono text-6xl font-bold text-signal">404</p>
        <p className="mt-2 text-ink-dim">This route never joined the mesh.</p>
        <Link
          href="/"
          className="mt-5 inline-flex items-center gap-2 rounded-lg border border-edge px-4 py-2 text-sm text-ink hover:border-edge-bright"
        >
          <MoveLeft size={15} />
          Back to the console
        </Link>
      </div>
    </div>
  );
}
