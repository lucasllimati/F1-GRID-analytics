"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { formatDuration, overallFraction, phaseFraction, type Phase, type PhaseStatus, type RunProgress } from "@/lib/news/progress";

type Running = { id: string; trigger: string; startedAt: number; progress: RunProgress | null; stale: boolean };
type Finished = { id: string; status: string; finishedAt: number; durationMs: number };
type Payload = { now: number; running: Running | null; lastFinished: Finished | null };

const TRIGGER: Record<string, string> = { admin: "painel", cron: "agendamento automático", cli: "linha de comando" };
const STATUS: Record<PhaseStatus, { label: string; cls: string }> = {
  pending: { label: "Aguardando", cls: "border-line-strong text-faint" },
  running: { label: "Em andamento", cls: "border-info/60 text-info" },
  done: { label: "Concluído", cls: "border-ok/60 text-ok" },
  skipped: { label: "Não se aplica", cls: "border-line-strong text-muted" },
  error: { label: "Erro", cls: "border-accent/60 text-accent" },
};

function Bar({ fraction, active, error }: { fraction: number; active: boolean; error?: boolean }) {
  const pct = Math.round(fraction * 100);
  return (
    <div
      className="h-2 w-full overflow-hidden rounded bg-elev-2"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
    >
      <div
        className={`h-full rounded transition-[width] duration-500 ${error ? "bg-accent" : active ? "bg-info" : "bg-ok"}`}
        style={{ width: `${Math.max(pct, active ? 3 : 0)}%` }}
      />
    </div>
  );
}

function PhaseRow({ p }: { p: Phase }) {
  const st = STATUS[p.status];
  const showCount = p.total > 0 && (p.status === "running" || p.status === "done") && p.key !== "writing";
  return (
    <li className="grid gap-1.5 sm:grid-cols-[14rem_1fr] sm:items-center sm:gap-4">
      <div className="flex items-center justify-between gap-2 sm:block">
        <p className="text-sm font-medium">{p.label}</p>
        <span className={`inline-block rounded-sm border px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider ${st.cls}`}>{st.label}</span>
      </div>
      <div>
        <Bar fraction={phaseFraction(p)} active={p.status === "running"} error={p.status === "error"} />
        <p className="mt-1 truncate text-xs text-faint" title={p.detail}>
          {showCount ? `${p.done} de ${p.total} · ` : ""}
          {p.detail || (p.status === "pending" ? "na fila" : "")}
        </p>
      </div>
    </li>
  );
}

/**
 * Banner fixo no topo do painel enquanto houver um ciclo em execução (de qualquer origem).
 * Ao terminar, mostra o resultado por alguns segundos e atualiza o restante do painel.
 */
export function RunProgressBanner() {
  const router = useRouter();
  const [data, setData] = useState<Payload | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [justFinished, setJustFinished] = useState<Finished | null>(null);
  const runningId = useRef<string | null>(null);
  const skew = useRef(0); // diferença de relógio servidor × navegador

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const r = await fetch("/api/admin/runs", { cache: "no-store", credentials: "same-origin" });
        if (r.ok) {
          const d = (await r.json()) as Payload;
          if (!alive) return;
          skew.current = d.now - Date.now();
          // Transição "rodando → concluído": avisa e recarrega os dados do painel.
          if (runningId.current && !d.running && d.lastFinished?.id === runningId.current) {
            setJustFinished(d.lastFinished);
            router.refresh();
            setTimeout(() => alive && setJustFinished(null), 15_000);
          }
          runningId.current = d.running?.id ?? null;
          setData(d);
        }
      } catch {
        // rede instável: tenta de novo no próximo ciclo
      }
      if (alive) timer = setTimeout(poll, runningId.current ? 2_000 : 10_000);
    };
    poll();
    const tick = setInterval(() => setNow(Date.now()), 1_000);
    return () => {
      alive = false;
      clearTimeout(timer);
      clearInterval(tick);
    };
  }, [router]);

  const run = data?.running;
  if (!run && !justFinished) return null;

  if (!run && justFinished) {
    const ok = justFinished.status === "ok";
    return (
      <div role="status" className={`sticky top-[104px] z-30 mb-6 rounded-md border p-4 text-sm shadow-lg lg:top-[61px] ${ok ? "border-ok/60 bg-elev" : "border-warn/60 bg-elev"}`}>
        <strong className={ok ? "text-ok" : "text-warn"}>{ok ? "Execução concluída" : `Execução concluída com status "${justFinished.status}"`}</strong>{" "}
        <span className="text-muted">em {formatDuration(justFinished.durationMs)}. Os números abaixo já foram atualizados.</span>
      </div>
    );
  }

  const progress = run!.progress;
  const overall = progress ? overallFraction(progress) : 0;
  const elapsed = now + skew.current - run!.startedAt;

  return (
    <section
      aria-label="Execução em andamento"
      className="sticky top-[104px] z-30 mb-6 rounded-md border border-info/60 bg-elev p-4 shadow-2xl lg:top-[61px]"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm">
          <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-info opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-info" />
          </span>
          <strong>Execução em andamento</strong>
          <span className="text-muted">· {progress?.label ?? "ciclo de notícias"}</span>
          <span className="text-faint">· iniciada pelo {TRIGGER[run!.trigger] ?? run!.trigger}</span>
        </p>
        <p className="text-sm tabular text-muted">
          {formatDuration(elapsed)} · <strong className="text-fg">{Math.round(overall * 100)}%</strong>
        </p>
      </div>
      <Bar fraction={overall} active />
      {run!.stale && (
        <p role="alert" className="mt-2 text-xs text-warn">
          Sem atualização há mais de 2 minutos — o processo pode ter sido interrompido (por exemplo, o servidor foi reiniciado). A trava é
          liberada sozinha em até 20 minutos.
        </p>
      )}
      {progress ? (
        <ol className="mt-4 space-y-3">
          {progress.phases.map((p) => (
            <PhaseRow key={p.key} p={p} />
          ))}
        </ol>
      ) : (
        <p className="mt-3 text-xs text-faint">Preparando…</p>
      )}
      <p className="mt-3 text-[0.7rem] text-faint">Você pode continuar revisando e aprovando matérias enquanto isso. Atualiza a cada 2 s.</p>
    </section>
  );
}
