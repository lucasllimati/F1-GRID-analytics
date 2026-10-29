"use client";

import { useEffect, useState } from "react";
import { formatTime } from "@/lib/time";
import { useEffectiveZoneLabel, useTimezone } from "./timezone";

// Lista de sessões de um fim de semana no fuso escolhido pelo leitor (padrão: Brasília),
// com "Hoje"/"Amanhã", aviso de madrugada e o canal de TV aberta quando houver.

export type SessionItem = { key: string; label: string; startsAt: string | null; date: string; main: boolean; openTv: string | null };

const dayKey = (d: Date, tz: string) => new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);

function dayLabel(d: Date, tz: string, now: Date | null): string {
  if (now) {
    const k = dayKey(d, tz);
    if (k === dayKey(now, tz)) return "Hoje";
    if (k === dayKey(new Date(now.getTime() + 86_400_000), tz)) return "Amanhã";
  }
  const wd = new Intl.DateTimeFormat("pt-BR", { timeZone: tz, weekday: "short" }).format(d);
  const dm = new Intl.DateTimeFormat("pt-BR", { timeZone: tz, day: "2-digit", month: "2-digit" }).format(d);
  return `${wd.charAt(0).toUpperCase()}${wd.slice(1)}, ${dm}`;
}

export function SessionList({ sessions, circuitTz, highlightNext = false }: { sessions: SessionItem[]; circuitTz: string | null; highlightNext?: boolean }) {
  const { resolve } = useTimezone();
  const tz = resolve(circuitTz);
  const zone = useEffectiveZoneLabel(circuitTz);
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  const nextKey = highlightNext && now ? sessions.find((s) => s.startsAt && Date.parse(s.startsAt) > now.getTime())?.key : undefined;

  return (
    <div>
      <ul className="space-y-1">
        {sessions.map((s) => {
          const d = s.startsAt ? new Date(s.startsAt) : null;
          const hour = d ? Number(new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", hourCycle: "h23" }).format(d)) : null;
          const past = d && now ? d.getTime() < now.getTime() : false;
          const isNext = s.key === nextKey;
          return (
            <li key={s.key} className={`flex items-baseline justify-between gap-3 border-l-2 py-0.5 pl-3 ${isNext ? "border-accent" : "border-line"} ${past ? "opacity-60" : ""}`}>
              <span className="tabular">
                {d ? (
                  <>
                    <span className={isNext ? "text-fg" : "text-muted"}>{dayLabel(d, tz, now)}</span> ·{" "}
                    <strong className={isNext ? "text-accent" : "text-fg"}>{formatTime(d, tz)}</strong>
                    {hour !== null && hour < 6 && <span className="block text-[0.7rem] text-faint">madrugada</span>}
                  </>
                ) : (
                  <span className="text-faint">{s.date} · horário a confirmar</span>
                )}
              </span>
              <span className={`text-right ${s.main ? "font-semibold text-fg" : "text-muted"}`}>
                {s.label}
                {s.openTv && <span className="ml-2 rounded border border-line-strong px-1 py-0.5 text-[0.65rem] font-semibold text-fg">{s.openTv}</span>}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-[0.7rem] text-faint">{zone}</p>
    </div>
  );
}
