// Nome do GP em português ("United States Grand Prix" → "GP dos Estados Unidos").
// Nome desconhecido: só troca "Grand Prix" por "GP", sem inventar tradução.

const PT: Record<string, string> = {
  "70th Anniversary": "do 70º Aniversário",
  "Abu Dhabi": "de Abu Dhabi",
  Argentine: "da Argentina",
  Australian: "da Austrália",
  Austrian: "da Áustria",
  Azerbaijan: "do Azerbaijão",
  Bahrain: "do Bahrein",
  "Barcelona-Catalunya": "de Barcelona",
  Belgian: "da Bélgica",
  Brazilian: "do Brasil",
  British: "da Grã-Bretanha",
  "Caesars Palace": "de Caesars Palace",
  Canadian: "do Canadá",
  Chinese: "da China",
  Dallas: "de Dallas",
  Detroit: "de Detroit",
  Dutch: "da Holanda",
  Eifel: "de Eifel",
  "Emilia Romagna": "da Emília-Romanha",
  European: "da Europa",
  French: "da França",
  German: "da Alemanha",
  Hungarian: "da Hungria",
  Indian: "da Índia",
  Italian: "da Itália",
  Japanese: "do Japão",
  Korean: "da Coreia",
  "Las Vegas": "de Las Vegas",
  Luxembourg: "de Luxemburgo",
  Madrid: "de Madri",
  Malaysian: "da Malásia",
  Mexican: "do México",
  "Mexico City": "da Cidade do México",
  Miami: "de Miami",
  Monaco: "de Mônaco",
  Moroccan: "do Marrocos",
  Pacific: "do Pacífico",
  Pescara: "de Pescara",
  Portuguese: "de Portugal",
  Qatar: "do Catar",
  Russian: "da Rússia",
  Sakhir: "de Sakhir",
  "San Marino": "de San Marino",
  "São Paulo": "de São Paulo",
  "Saudi Arabian": "da Arábia Saudita",
  Singapore: "de Singapura",
  "South African": "da África do Sul",
  Spanish: "da Espanha",
  Styrian: "da Estíria",
  Swedish: "da Suécia",
  Swiss: "da Suíça",
  Turkish: "da Turquia",
  Tuscan: "da Toscana",
  "United States": "dos Estados Unidos",
  "United States West": "do Oeste dos EUA",
};

/** Etapa transferida de país ("Bahrain Grand Prix in Malaysia"): onde ela foi disputada. */
const IN: Record<string, string> = {
  Malaysia: "na Malásia",
  Portugal: "em Portugal",
  Turkey: "na Turquia",
  Italy: "na Itália",
  Spain: "na Espanha",
  Bahrain: "no Bahrein",
  Qatar: "no Catar",
};

export function gpName(raceName: string): string {
  if (/Indianapolis 500/i.test(raceName)) return "500 Milhas de Indianápolis";
  const m = /^(.*?) Grand Prix(?: in (.+))?$/.exec(raceName.trim());
  if (!m) return raceName;
  const pt = PT[m[1]!];
  const base = pt ? `GP ${pt}` : `GP ${m[1]}`;
  return m[2] ? `${base} ${IN[m[2]] ?? `em ${m[2]}`}` : base;
}
