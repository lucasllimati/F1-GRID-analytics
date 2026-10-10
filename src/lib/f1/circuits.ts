// Metadados estáticos de circuitos que a fonte de dados (Jolpica/Ergast) não fornece:
// o fuso IANA do local e o nome do país em português.
// O fuso é um dado geográfico estável; a conversão de cada horário usa a data
// específica do evento (ver src/lib/time.ts), então mudanças de horário de verão são respeitadas.

export type CircuitMeta = { timeZone: string; countryPt: string; flag: string };

export const CIRCUIT_META: Record<string, CircuitMeta> = {
  albert_park: { timeZone: "Australia/Melbourne", countryPt: "Austrália", flag: "🇦🇺" },
  shanghai: { timeZone: "Asia/Shanghai", countryPt: "China", flag: "🇨🇳" },
  suzuka: { timeZone: "Asia/Tokyo", countryPt: "Japão", flag: "🇯🇵" },
  bahrain: { timeZone: "Asia/Bahrain", countryPt: "Bahrein", flag: "🇧🇭" },
  jeddah: { timeZone: "Asia/Riyadh", countryPt: "Arábia Saudita", flag: "🇸🇦" },
  miami: { timeZone: "America/New_York", countryPt: "EUA", flag: "🇺🇸" },
  imola: { timeZone: "Europe/Rome", countryPt: "Itália", flag: "🇮🇹" },
  monaco: { timeZone: "Europe/Monaco", countryPt: "Mônaco", flag: "🇲🇨" },
  villeneuve: { timeZone: "America/Toronto", countryPt: "Canadá", flag: "🇨🇦" },
  catalunya: { timeZone: "Europe/Madrid", countryPt: "Espanha", flag: "🇪🇸" },
  madring: { timeZone: "Europe/Madrid", countryPt: "Espanha", flag: "🇪🇸" },
  red_bull_ring: { timeZone: "Europe/Vienna", countryPt: "Áustria", flag: "🇦🇹" },
  silverstone: { timeZone: "Europe/London", countryPt: "Reino Unido", flag: "🇬🇧" },
  spa: { timeZone: "Europe/Brussels", countryPt: "Bélgica", flag: "🇧🇪" },
  hungaroring: { timeZone: "Europe/Budapest", countryPt: "Hungria", flag: "🇭🇺" },
  zandvoort: { timeZone: "Europe/Amsterdam", countryPt: "Países Baixos", flag: "🇳🇱" },
  monza: { timeZone: "Europe/Rome", countryPt: "Itália", flag: "🇮🇹" },
  mugello: { timeZone: "Europe/Rome", countryPt: "Itália", flag: "🇮🇹" },
  baku: { timeZone: "Asia/Baku", countryPt: "Azerbaijão", flag: "🇦🇿" },
  sepang: { timeZone: "Asia/Kuala_Lumpur", countryPt: "Malásia", flag: "🇲🇾" },
  marina_bay: { timeZone: "Asia/Singapore", countryPt: "Singapura", flag: "🇸🇬" },
  americas: { timeZone: "America/Chicago", countryPt: "EUA", flag: "🇺🇸" },
  rodriguez: { timeZone: "America/Mexico_City", countryPt: "México", flag: "🇲🇽" },
  interlagos: { timeZone: "America/Sao_Paulo", countryPt: "Brasil", flag: "🇧🇷" },
  vegas: { timeZone: "America/Los_Angeles", countryPt: "EUA", flag: "🇺🇸" },
  las_vegas: { timeZone: "America/Los_Angeles", countryPt: "EUA", flag: "🇺🇸" },
  losail: { timeZone: "Asia/Qatar", countryPt: "Catar", flag: "🇶🇦" },
  yas_marina: { timeZone: "Asia/Dubai", countryPt: "Emirados Árabes Unidos", flag: "🇦🇪" },
  portimao: { timeZone: "Europe/Lisbon", countryPt: "Portugal", flag: "🇵🇹" },
  istanbul: { timeZone: "Europe/Istanbul", countryPt: "Turquia", flag: "🇹🇷" },
  sochi: { timeZone: "Europe/Moscow", countryPt: "Rússia", flag: "🇷🇺" },
  nurburgring: { timeZone: "Europe/Berlin", countryPt: "Alemanha", flag: "🇩🇪" },
  hockenheimring: { timeZone: "Europe/Berlin", countryPt: "Alemanha", flag: "🇩🇪" },
  ricard: { timeZone: "Europe/Paris", countryPt: "França", flag: "🇫🇷" },
};

export function circuitMeta(circuitId: string): CircuitMeta | null {
  return CIRCUIT_META[circuitId] ?? null;
}
