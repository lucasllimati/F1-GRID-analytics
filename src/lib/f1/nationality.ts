// Nacionalidade (como a fonte publica: "British", "Brazilian"…) → bandeira e país em português.
// Desconhecida: sem bandeira (nunca adivinhamos).

const MAP: Record<string, [flag: string, country: string]> = {
  American: ["🇺🇸", "EUA"],
  Argentine: ["🇦🇷", "Argentina"],
  Argentinian: ["🇦🇷", "Argentina"],
  Australian: ["🇦🇺", "Austrália"],
  Austrian: ["🇦🇹", "Áustria"],
  Belgian: ["🇧🇪", "Bélgica"],
  Brazilian: ["🇧🇷", "Brasil"],
  British: ["🇬🇧", "Reino Unido"],
  Canadian: ["🇨🇦", "Canadá"],
  Chilean: ["🇨🇱", "Chile"],
  Chinese: ["🇨🇳", "China"],
  Colombian: ["🇨🇴", "Colômbia"],
  Czech: ["🇨🇿", "Tchéquia"],
  Danish: ["🇩🇰", "Dinamarca"],
  Dutch: ["🇳🇱", "Países Baixos"],
  "East German": ["🇩🇪", "Alemanha Oriental"],
  Finnish: ["🇫🇮", "Finlândia"],
  French: ["🇫🇷", "França"],
  German: ["🇩🇪", "Alemanha"],
  Hungarian: ["🇭🇺", "Hungria"],
  Indian: ["🇮🇳", "Índia"],
  Indonesian: ["🇮🇩", "Indonésia"],
  Irish: ["🇮🇪", "Irlanda"],
  Italian: ["🇮🇹", "Itália"],
  Japanese: ["🇯🇵", "Japão"],
  Liechtensteiner: ["🇱🇮", "Liechtenstein"],
  Malaysian: ["🇲🇾", "Malásia"],
  Mexican: ["🇲🇽", "México"],
  Monegasque: ["🇲🇨", "Mônaco"],
  Moroccan: ["🇲🇦", "Marrocos"],
  "New Zealander": ["🇳🇿", "Nova Zelândia"],
  Polish: ["🇵🇱", "Polônia"],
  Portuguese: ["🇵🇹", "Portugal"],
  Russian: ["🇷🇺", "Rússia"],
  "South African": ["🇿🇦", "África do Sul"],
  Spanish: ["🇪🇸", "Espanha"],
  Swedish: ["🇸🇪", "Suécia"],
  Swiss: ["🇨🇭", "Suíça"],
  Thai: ["🇹🇭", "Tailândia"],
  Uruguayan: ["🇺🇾", "Uruguai"],
  Venezuelan: ["🇻🇪", "Venezuela"],
};

export function nationalityFlag(nationality: string): string {
  return MAP[nationality]?.[0] ?? "";
}

export function nationalityCountry(nationality: string): string {
  return MAP[nationality]?.[1] ?? nationality;
}
