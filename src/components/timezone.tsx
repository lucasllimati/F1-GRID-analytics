"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  BRASILIA_TIME_ZONE,
  COMMON_TIME_ZONES,
  DEFAULT_TIME_ZONE,
  dayShift,
  formatDate,
  formatOffset,
  formatTime,
  isValidTimeZone,
  supportedTimeZones,
  timeZoneCity,
} from "@/lib/time";

// Preferência de fuso do usuário. Persistida em localStorage (sem cookies, sem geolocalização).
// O servidor sempre renderiza em Brasília; o cliente ajusta após montar (sem divergência de hidratação).

export type TzMode = "brasilia" | "browser" | "circuit" | "custom";
type Pref = { mode: TzMode; custom: string; compare: string[] };

const STORAGE_KEY = "apexgrid.tz.v1";
const DEFAULT_PREF: Pref = { mode: "brasilia", custom: DEFAULT_TIME_ZONE, compare: [] };

type Ctx = {
  pref: Pref;
  setPref: (p: Partial<Pref>) => void;
  reset: () => void;
  browserTz: string;
  /** Resolve o fuso efetivo. `circuitTz` é usado no modo "circuito". */
  resolve: (circuitTz?: string | null) => string;
  ready: boolean;
};

const TzContext = createContext<Ctx | null>(null);

export function TimezoneProvider({ children }: { children: ReactNode }) {
  const [pref, setPrefState] = useState<Pref>(DEFAULT_PREF);
  const [browserTz, setBrowserTz] = useState(DEFAULT_TIME_ZONE);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (detected && isValidTimeZone(detected)) setBrowserTz(detected);
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const p = JSON.parse(raw) as Partial<Pref>;
        const mode: TzMode = ["brasilia", "browser", "circuit", "custom"].includes(p.mode as string) ? (p.mode as TzMode) : "brasilia";
        const custom = typeof p.custom === "string" && isValidTimeZone(p.custom) ? p.custom : DEFAULT_TIME_ZONE;
        const compare = Array.isArray(p.compare) ? p.compare.filter((z) => typeof z === "string" && isValidTimeZone(z)).slice(0, 3) : [];
        setPrefState({ mode, custom, compare });
      }
    } catch {
      // armazenamento indisponível: segue com o padrão
    }
    setReady(true);
  }, []);

  const setPref = useCallback((p: Partial<Pref>) => {
    setPrefState((prev) => {
      const next = { ...prev, ...p };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
    setPrefState(DEFAULT_PREF);
  }, []);

  const resolve = useCallback(
    (circuitTz?: string | null) => {
      if (!ready) return BRASILIA_TIME_ZONE;
      switch (pref.mode) {
        case "browser":
          return browserTz;
        case "circuit":
          return circuitTz ?? BRASILIA_TIME_ZONE;
        case "custom":
          return pref.custom;
        default:
          return BRASILIA_TIME_ZONE;
      }
    },
    [pref, browserTz, ready],
  );

  const value = useMemo(() => ({ pref, setPref, reset, browserTz, resolve, ready }), [pref, setPref, reset, browserTz, resolve, ready]);
  return <TzContext.Provider value={value}>{children}</TzContext.Provider>;
}

export function useTimezone(): Ctx {
  const ctx = useContext(TzContext);
  if (!ctx) throw new Error("useTimezone fora do TimezoneProvider");
  return ctx;
}

/** Horário de um instante UTC no fuso preferido do usuário. */
export function LocalTime({
  iso,
  circuitTz,
  variant = "time",
  showZone = false,
}: {
  iso: string;
  circuitTz?: string | null;
  variant?: "time" | "date" | "datetime";
  showZone?: boolean;
}) {
  const { resolve } = useTimezone();
  const tz = resolve(circuitTz);
  const d = new Date(iso);
  const text =
    variant === "time" ? formatTime(d, tz) : variant === "date" ? formatDate(d, tz) : `${formatDate(d, tz)} · ${formatTime(d, tz)}`;
  return (
    <time dateTime={iso} title={`${tz} (${formatOffset(d, tz)})`}>
      {text}
      {showZone && <span className="ml-1 text-faint text-[0.8em]">{formatOffset(d, tz)}</span>}
    </time>
  );
}

export function useEffectiveZoneLabel(circuitTz?: string | null): string {
  const { resolve, pref } = useTimezone();
  const tz = resolve(circuitTz);
  if (pref.mode === "circuit") return "Horário do circuito";
  if (tz === BRASILIA_TIME_ZONE && pref.mode === "brasilia") return "Horário de Brasília";
  return timeZoneCity(tz);
}

/** Tabela de sessões em vários fusos: circuito, Brasília, fuso do usuário e comparações. */
export function SessionTimesTable({
  sessions,
  circuitTz,
}: {
  sessions: { label: string; startsAt: string | null; date: string }[];
  circuitTz: string | null;
}) {
  const { resolve, pref } = useTimezone();
  const userTz = resolve(circuitTz);
  const cols: { key: string; label: string; tz: string }[] = [];
  if (circuitTz) cols.push({ key: "circuit", label: "Circuito", tz: circuitTz });
  cols.push({ key: "brt", label: "Brasília", tz: BRASILIA_TIME_ZONE });
  if (!cols.some((c) => c.tz === userTz)) cols.push({ key: "user", label: `Seu fuso · ${timeZoneCity(userTz)}`, tz: userTz });
  for (const z of pref.compare) if (!cols.some((c) => c.tz === z)) cols.push({ key: `cmp-${z}`, label: timeZoneCity(z), tz: z });

  return (
    <div className="overflow-x-auto">
      <table className="data-table">
        <caption className="sr-only">Horários das sessões em diferentes fusos</caption>
        <thead>
          <tr>
            <th scope="col">Sessão</th>
            {cols.map((c) => (
              <th scope="col" key={c.key}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sessions.map((s) => (
            <tr key={s.label}>
              <th scope="row" className="font-medium text-left normal-case tracking-normal text-sm text-fg">
                {s.label}
              </th>
              {cols.map((c) => {
                if (!s.startsAt) {
                  return (
                    <td key={c.key} className="text-faint">
                      {s.date} · horário não divulgado
                    </td>
                  );
                }
                const d = new Date(s.startsAt);
                const shift = circuitTz ? dayShift(d, circuitTz, c.tz) : 0;
                return (
                  <td key={c.key} className="tabular whitespace-nowrap">
                    <span className="text-muted">{formatDate(d, c.tz)}</span>{" "}
                    <strong className="font-semibold">{formatTime(d, c.tz)}</strong>{" "}
                    <span className="text-faint text-xs">{formatOffset(d, c.tz)}</span>
                    {shift !== 0 && c.key !== "circuit" && (
                      <span className="ml-1 text-xs text-warn" title="Dia diferente do horário do circuito">
                        ({shift > 0 ? "+" : ""}
                        {shift}d)
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TimezonePicker() {
  const { pref, setPref, reset, browserTz, ready } = useTimezone();
  const [open, setOpen] = useState(false);
  const [all, setAll] = useState<string[]>([]);
  useEffect(() => {
    if (open && all.length === 0) setAll(supportedTimeZones());
  }, [open, all.length]);

  const label =
    pref.mode === "brasilia"
      ? "Brasília"
      : pref.mode === "browser"
        ? `Local · ${timeZoneCity(browserTz)}`
        : pref.mode === "circuit"
          ? "Circuito"
          : timeZoneCity(pref.custom);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="flex items-center gap-1.5 rounded border border-line px-2.5 py-1.5 text-xs font-medium text-muted hover:text-fg hover:border-line-strong"
      >
        <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
        <span className="hidden sm:inline">Fuso:</span> {ready ? label : "Brasília"}
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Escolher fuso horário"
          className="absolute right-0 z-50 mt-2 w-80 rounded-md border border-line-strong bg-elev p-4 shadow-2xl"
        >
          <fieldset className="space-y-2">
            <legend className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">Exibir horários em</legend>
            {(
              [
                ["brasilia", "Horário de Brasília (America/Sao_Paulo)"],
                ["browser", `Detectado no navegador (${browserTz})`],
                ["circuit", "Horário local do circuito"],
                ["custom", "Fuso personalizado"],
              ] as [TzMode, string][]
            ).map(([mode, text]) => (
              <label key={mode} className="flex cursor-pointer items-start gap-2 text-sm">
                <input type="radio" name="tzmode" className="mt-1 accent-[var(--accent)]" checked={pref.mode === mode} onChange={() => setPref({ mode })} />
                <span>{text}</span>
              </label>
            ))}
          </fieldset>
          {pref.mode === "custom" && (
            <label className="mt-3 block text-sm">
              <span className="mb-1 block text-xs text-muted">Fuso IANA</span>
              <select
                className="w-full rounded border border-line bg-bg px-2 py-1.5 text-sm"
                value={pref.custom}
                onChange={(e) => setPref({ custom: e.target.value })}
              >
                <optgroup label="Comuns">
                  {COMMON_TIME_ZONES.map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.label} — {z.id}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Todos">
                  {all.map((z) => (
                    <option key={`all-${z}`} value={z}>
                      {z}
                    </option>
                  ))}
                </optgroup>
              </select>
            </label>
          )}
          <label className="mt-3 block text-sm">
            <span className="mb-1 block text-xs text-muted">Comparar também com (opcional)</span>
            <select
              className="w-full rounded border border-line bg-bg px-2 py-1.5 text-sm"
              value=""
              onChange={(e) => {
                const z = e.target.value;
                if (z && !pref.compare.includes(z)) setPref({ compare: [...pref.compare, z].slice(-3) });
              }}
            >
              <option value="">Adicionar fuso…</option>
              {COMMON_TIME_ZONES.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.label} — {z.id}
                </option>
              ))}
            </select>
          </label>
          {pref.compare.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {pref.compare.map((z) => (
                <li key={z}>
                  <button
                    type="button"
                    onClick={() => setPref({ compare: pref.compare.filter((x) => x !== z) })}
                    className="rounded bg-elev-2 px-2 py-0.5 text-xs hover:text-accent"
                    aria-label={`Remover ${z}`}
                  >
                    {timeZoneCity(z)} ×
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 flex justify-between">
            <button type="button" onClick={reset} className="text-xs text-muted underline hover:text-fg">
              Restaurar padrão
            </button>
            <button type="button" onClick={() => setOpen(false)} className="rounded bg-accent px-3 py-1 text-xs font-semibold text-white">
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
