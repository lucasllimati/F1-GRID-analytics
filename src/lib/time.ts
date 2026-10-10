// Utilidades de fuso horário baseadas exclusivamente em zonas IANA via Intl.
// Nunca somamos/subtraímos um número fixo de horas: o Intl usa a base tzdata
// do runtime, que inclui o histórico e as regras futuras de horário de verão.

export const DEFAULT_TIME_ZONE = "America/Sao_Paulo";
export const BRASILIA_TIME_ZONE = "America/Sao_Paulo";
export const DEFAULT_LOCALE = "pt-BR";

export function isValidTimeZone(tz: string): boolean {
  if (!tz || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Lista de zonas suportadas pelo runtime (fallback para uma lista curta). */
export function supportedTimeZones(): string[] {
  const intl = Intl as typeof Intl & { supportedValuesOf?: (k: string) => string[] };
  try {
    const zones = intl.supportedValuesOf?.("timeZone");
    if (zones && zones.length > 0) return zones;
  } catch {
    // runtime antigo
  }
  return COMMON_TIME_ZONES.map((z) => z.id);
}

export const COMMON_TIME_ZONES: { id: string; label: string }[] = [
  { id: "America/Sao_Paulo", label: "Brasília" },
  { id: "America/Manaus", label: "Manaus" },
  { id: "America/Noronha", label: "Fernando de Noronha" },
  { id: "America/Rio_Branco", label: "Rio Branco" },
  { id: "Europe/Lisbon", label: "Lisboa" },
  { id: "Europe/London", label: "Londres" },
  { id: "Europe/Madrid", label: "Madri" },
  { id: "Europe/Rome", label: "Roma" },
  { id: "America/New_York", label: "Nova York" },
  { id: "America/Chicago", label: "Chicago" },
  { id: "America/Los_Angeles", label: "Los Angeles" },
  { id: "America/Mexico_City", label: "Cidade do México" },
  { id: "America/Argentina/Buenos_Aires", label: "Buenos Aires" },
  { id: "Asia/Tokyo", label: "Tóquio" },
  { id: "Asia/Dubai", label: "Dubai" },
  { id: "Australia/Melbourne", label: "Melbourne" },
  { id: "UTC", label: "UTC" },
];

function parts(date: Date, tz: string) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const out: Record<string, number> = {};
  for (const p of fmt.formatToParts(date)) {
    if (p.type !== "literal") out[p.type] = Number(p.value);
  }
  return out as { year: number; month: number; day: number; hour: number; minute: number; second: number };
}

/** Deslocamento da zona em minutos para um instante específico (ex.: -180 para UTC−3). */
export function offsetMinutes(date: Date, tz: string): number {
  const p = parts(date, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  const truncated = Math.floor(date.getTime() / 1000) * 1000;
  return Math.round((asUtc - truncated) / 60000);
}

/** "UTC−3", "UTC+10:30", "UTC" */
export function formatOffset(date: Date, tz: string): string {
  const m = offsetMinutes(date, tz);
  if (m === 0) return "UTC";
  const sign = m > 0 ? "+" : "−";
  const abs = Math.abs(m);
  const h = Math.floor(abs / 60);
  const min = abs % 60;
  return `UTC${sign}${h}${min ? `:${String(min).padStart(2, "0")}` : ""}`;
}

/**
 * Converte um horário de parede local (data + hora num fuso IANA) em instante UTC.
 * Usado quando a fonte oficial publica apenas o horário local do circuito.
 *
 * Em transições de horário de verão:
 *  - horários inexistentes (lacuna da primavera) lançam erro — não inventamos horário;
 *  - horários ambíguos (repetidos no outono) resolvem para a primeira ocorrência.
 */
export function zonedLocalToUtc(date: string, time: string, tz: string): Date {
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const tm = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(time);
  if (!dm || !tm) throw new Error(`Data/hora inválida: ${date} ${time}`);
  if (!isValidTimeZone(tz)) throw new Error(`Fuso inválido: ${tz}`);
  const [y, mo, d] = [Number(dm[1]), Number(dm[2]), Number(dm[3])];
  const [h, mi, s] = [Number(tm[1]), Number(tm[2]), Number(tm[3] ?? 0)];
  const wall = Date.UTC(y, mo - 1, d, h, mi, s);

  // Candidatos: o horário de parede menos cada deslocamento observado nas vizinhanças.
  const probes = [wall - 36 * 3600_000, wall, wall + 36 * 3600_000];
  const offsets = new Set(probes.map((t) => offsetMinutes(new Date(t), tz)));
  const matches = [...offsets]
    .map((off) => wall - off * 60_000)
    .filter((t) => {
      const p = parts(new Date(t), tz);
      return p.year === y && p.month === mo && p.day === d && p.hour === h && p.minute === mi && p.second === s;
    })
    .sort((a, b) => a - b);
  if (matches.length === 0) {
    throw new Error(`Horário inexistente em ${tz} (transição de horário de verão): ${date} ${time}`);
  }
  return new Date(matches[0]!);
}

export function formatTime(date: Date, tz: string, locale = DEFAULT_LOCALE): string {
  return new Intl.DateTimeFormat(locale, { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date);
}

export function formatDate(date: Date, tz: string, locale = DEFAULT_LOCALE): string {
  return new Intl.DateTimeFormat(locale, { timeZone: tz, weekday: "short", day: "2-digit", month: "short" }).format(date);
}

export function formatLongDate(date: Date, tz: string, locale = DEFAULT_LOCALE): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: tz,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function formatDateTime(date: Date, tz: string, locale = DEFAULT_LOCALE): string {
  return `${formatDate(date, tz, locale)} · ${formatTime(date, tz, locale)}`;
}

/** Diferença de dia de calendário entre duas zonas para o mesmo instante (−1, 0, +1). */
export function dayShift(date: Date, fromTz: string, toTz: string): number {
  const a = parts(date, fromTz);
  const b = parts(date, toTz);
  const da = Date.UTC(a.year, a.month - 1, a.day);
  const db = Date.UTC(b.year, b.month - 1, b.day);
  return Math.round((db - da) / 86_400_000);
}

export type CountdownParts = { days: number; hours: number; minutes: number; seconds: number; totalMs: number };

/** Contagem regressiva; nunca negativa (retorna null quando o instante já passou). */
export function countdown(target: Date, now: Date): CountdownParts | null {
  const totalMs = target.getTime() - now.getTime();
  if (totalMs <= 0) return null;
  const s = Math.floor(totalMs / 1000);
  return {
    days: Math.floor(s / 86400),
    hours: Math.floor((s % 86400) / 3600),
    minutes: Math.floor((s % 3600) / 60),
    seconds: s % 60,
    totalMs,
  };
}

export function timeZoneCity(tz: string): string {
  const known = COMMON_TIME_ZONES.find((z) => z.id === tz);
  if (known) return known.label;
  const last = tz.split("/").pop() ?? tz;
  return last.replace(/_/g, " ");
}
