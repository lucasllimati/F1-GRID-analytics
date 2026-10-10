"use client";

import { useEffect, useState } from "react";
import { countdown } from "@/lib/time";

/**
 * Contagem regressiva calculada no navegador a partir do horário oficial (UTC).
 * Ao atingir zero, NÃO afirma que a sessão está ao vivo — apenas que o horário previsto chegou.
 */
export function Countdown({ targetIso, label }: { targetIso: string; label: string }) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const target = new Date(targetIso);
  const parts = now ? countdown(target, now) : null;

  if (now && !parts) {
    return (
      <p className="text-sm text-muted" role="status">
        O horário previsto de <strong className="text-fg">{label}</strong> foi atingido. Status e resultado dependem da confirmação oficial.
      </p>
    );
  }

  const cells: [string, number | null][] = [
    ["dias", parts?.days ?? null],
    ["h", parts?.hours ?? null],
    ["min", parts?.minutes ?? null],
    ["s", parts?.seconds ?? null],
  ];

  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted">Faltam para {label}</p>
      <div className="flex gap-2" aria-live="off">
        {cells.map(([unit, v]) => (
          <div key={unit} className="min-w-[4.25rem] rounded border border-line bg-bg/60 px-3 py-2 text-center">
            <div className="font-display text-3xl font-bold tabular leading-none sm:text-4xl">
              {v === null ? "––" : String(v).padStart(2, "0")}
            </div>
            <div className="mt-1 text-[0.65rem] uppercase tracking-widest text-faint">{unit}</div>
          </div>
        ))}
      </div>
      <span className="sr-only">
        {parts ? `${parts.days} dias, ${parts.hours} horas e ${parts.minutes} minutos para ${label}` : ""}
      </span>
    </div>
  );
}

/** Escolhe, no navegador, a próxima sessão com horário oficial futuro. */
export function NextSessionCountdown({ sessions }: { sessions: { label: string; startsAt: string | null }[] }) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  if (!now) return <div className="h-[92px]" aria-hidden="true" />;
  const next = sessions.find((s) => s.startsAt && Date.parse(s.startsAt) > now.getTime());
  if (!next || !next.startsAt) {
    return (
      <p className="text-sm text-muted" role="status">
        Todas as sessões previstas deste evento já passaram do horário oficial. Aguardando publicação dos resultados pela fonte.
      </p>
    );
  }
  return <Countdown key={next.startsAt} targetIso={next.startsAt} label={next.label} />;
}
