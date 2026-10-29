import { gpName } from "./gp-names";
import { SESSION_LABEL, type RaceEvent, type SessionType } from "./types";

// Calendário no formato iCalendar (RFC 5545) para assinar no Google Agenda, Apple ou Outlook.
// Horários em UTC: cada aplicativo converte para o fuso do usuário. Sessões sem horário oficial
// ficam de fora (não inventamos horário).

const DURATION_MIN: Record<SessionType, number> = {
  fp1: 60,
  fp2: 60,
  fp3: 60,
  sprint_qualifying: 45,
  sprint: 60,
  qualifying: 60,
  race: 120,
};

function stamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** Escapa texto conforme a RFC 5545 (barra, vírgula, ponto e vírgula, quebra de linha). */
export function icsEscape(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

const utf8 = new TextEncoder();

/** Dobra linhas em até 75 octetos UTF-8 (RFC 5545), sem partir caracteres (emoji, acentos). */
export function fold(line: string): string {
  const out: string[] = [];
  let cur = "";
  let bytes = 0;
  for (const ch of line) {
    const n = utf8.encode(ch).length;
    // Linhas de continuação começam com um espaço, que também conta.
    if (bytes + n > 75) {
      out.push(cur);
      cur = " ";
      bytes = 1;
    }
    cur += ch;
    bytes += n;
  }
  out.push(cur);
  return out.join("\r\n");
}

export function buildIcs(events: RaceEvent[], opts: { siteUrl: string; now?: Date }): string {
  const now = stamp(opts.now ?? new Date());
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Apex Grid//Calendario F1//PT-BR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${icsEscape(`F1 ${events[0]?.season ?? ""} · Apex Grid`)}`,
    "X-PUBLISHED-TTL:PT6H",
  ];
  for (const e of events) {
    for (const s of e.sessions) {
      if (!s.startsAt) continue;
      const start = new Date(s.startsAt);
      const end = new Date(start.getTime() + DURATION_MIN[s.type] * 60_000);
      lines.push(
        "BEGIN:VEVENT",
        `UID:${e.season}-${e.round}-${s.type}@apexgrid`,
        `DTSTAMP:${now}`,
        `DTSTART:${stamp(start)}`,
        `DTEND:${stamp(end)}`,
        fold(`SUMMARY:${icsEscape(`${e.flag} ${SESSION_LABEL[s.type]} · ${gpName(e.name)}`)}`),
        fold(`LOCATION:${icsEscape(`${e.circuitName}, ${e.locality}, ${e.countryPt}`)}`),
        fold(`URL:${opts.siteUrl}/calendar/${e.season}/${e.round}`),
        "END:VEVENT",
      );
    }
  }
  lines.push("END:VCALENDAR");
  return `${lines.join("\r\n")}\r\n`;
}
