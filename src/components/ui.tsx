import type { ReactNode } from "react";
import type { EventStatus } from "@/lib/f1/types";

export function statusTone(s: EventStatus): "neutral" | "info" | "warn" {
  return s === "completed" ? "neutral" : s === "upcoming" ? "info" : "warn";
}

export function Container({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto max-w-7xl px-4 ${className}`}>{children}</div>;
}

export function SectionHeading({ kicker, title, action, id }: { kicker?: string; title: string; action?: ReactNode; id?: string }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4 border-b border-line pb-3">
      <div>
        {kicker && <p className="mb-1 text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-accent">{kicker}</p>}
        <h2 id={id} className="font-display text-2xl font-bold uppercase tracking-tight sm:text-3xl">
          {title}
        </h2>
      </div>
      {action}
    </div>
  );
}

export function PageHeader({ kicker, title, children }: { kicker?: string; title: string; children?: ReactNode }) {
  return (
    <div className="telemetry-bg border-b border-line">
      <Container className="py-10 sm:py-14">
        {kicker && <p className="mb-2 text-xs font-semibold uppercase tracking-[0.25em] text-accent">{kicker}</p>}
        <h1 className="font-display text-4xl font-extrabold uppercase italic tracking-tight sm:text-5xl">{title}</h1>
        {children && <div className="mt-3 max-w-3xl text-muted">{children}</div>}
      </Container>
    </div>
  );
}

const TONES = {
  neutral: "border-line-strong text-muted",
  accent: "border-accent/60 text-accent bg-accent-soft",
  ok: "border-ok/50 text-ok",
  warn: "border-warn/60 text-warn",
  info: "border-info/50 text-info",
} as const;

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: keyof typeof TONES }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[0.68rem] font-semibold uppercase tracking-wider ${TONES[tone]}`}>
      {children}
    </span>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-md border border-line bg-elev ${className}`}>{children}</div>;
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-md border border-dashed border-line-strong p-8 text-center">
      <p className="font-semibold">{title}</p>
      {children && <div className="mt-2 text-sm text-muted">{children}</div>}
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div role="alert" className="rounded-md border border-warn/50 bg-warn/5 p-4 text-sm">
      <strong className="text-warn">Dados indisponíveis.</strong> <span className="text-muted">{message}</span>
    </div>
  );
}

export function SourceNote({ children }: { children: ReactNode }) {
  return <p className="mt-3 text-xs text-faint">{children}</p>;
}
