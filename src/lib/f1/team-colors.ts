// Cor de identificação de cada equipe (uma faixa fina ao lado do nome, como nas transmissões).
// É só um reforço visual: o nome da equipe sempre aparece junto, nunca dependemos da cor.
// Equipe desconhecida (temporadas antigas): cinza neutro.

const COLORS: Record<string, string> = {
  mercedes: "#27f4d2",
  ferrari: "#e8002d",
  red_bull: "#3671c6",
  mclaren: "#ff8000",
  rb: "#6692ff",
  alphatauri: "#5e8faa",
  toro_rosso: "#469bff",
  alpine: "#ff87bc",
  renault: "#fff500",
  haas: "#b6babd",
  audi: "#52e252",
  sauber: "#52e252",
  alfa: "#c92d4b",
  williams: "#64c4ff",
  aston_martin: "#229971",
  racing_point: "#f596c8",
  force_india: "#f596c8",
  cadillac: "#c8a24a",
  lotus_f1: "#ffb800",
};

export function teamColor(constructorId: string): string {
  return COLORS[constructorId] ?? "var(--line-strong)";
}
