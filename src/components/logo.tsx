import Link from "next/link";

/** Logotipo tipográfico próprio: APEX / GRID com a barra diagonal como "ápice" de curva. */
export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="group flex items-center gap-2" aria-label="Apex Grid — página inicial">
      <svg aria-hidden="true" width="28" height="28" viewBox="0 0 32 32" className="shrink-0">
        <rect width="32" height="32" rx="4" fill="var(--accent)" />
        <path d="M7 24 L15 8 L17.5 8 L11 24 Z" fill="#fff" />
        <path d="M16 24 L21.5 13 L24 13 L20 24 Z" fill="#fff" opacity="0.85" />
      </svg>
      {!compact && (
        <span className="font-display text-xl font-extrabold uppercase italic leading-none tracking-tight">
          Apex<span className="text-accent">/</span>Grid
        </span>
      )}
    </Link>
  );
}
