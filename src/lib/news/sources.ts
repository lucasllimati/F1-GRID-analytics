// Registro das fontes monitoradas. Cada feed foi verificado em 2026-10-12 com o parser do projeto
// (responde 200, itens com data, links do próprio domínio). Ver docs/DATA_SOURCES.md para os
// candidatos testados e descartados (e por quê) e docs/NEWSROOM.md para a política de uso.
//
// `group` identifica o grupo editorial: fontes do mesmo grupo NÃO contam como confirmação
// independente (ex.: Autosport, Motorsport.com e Formel1.de pertencem à Motorsport Network).

export type SourceLanguage = "en" | "pt-BR" | "es" | "it" | "de";

export type SourceDef = {
  id: string;
  name: string;
  homepage: string;
  feedUrl: string;
  language: SourceLanguage;
  kind: "official" | "media";
  region: "oficial" | "internacional" | "europa" | "brasil";
  group: string;
  /** Feeds multiesportivos exigem menção explícita à F1 (categoria, equipe ou piloto). */
  requireF1Keyword: boolean;
  /** Hosts dos quais podemos baixar a página do artigo (para evidência interna). */
  articleHosts: string[];
  /** Links de itens que nunca são notícia nesta fonte (ex.: vídeos). */
  excludeUrl?: RegExp;
};

export const LANGUAGE_LABEL: Record<SourceLanguage, string> = {
  en: "inglês",
  "pt-BR": "português",
  es: "espanhol",
  it: "italiano",
  de: "alemão",
};

export const REGION_LABEL: Record<SourceDef["region"], string> = {
  oficial: "Oficiais",
  internacional: "Imprensa internacional",
  europa: "Imprensa europeia",
  brasil: "Imprensa brasileira",
};

type Def = Omit<SourceDef, "articleHosts"> & { articleHosts?: string[] };

function def(d: Def): SourceDef {
  return { ...d, articleHosts: d.articleHosts ?? [new URL(d.homepage).hostname] };
}

export const NEWS_SOURCES: SourceDef[] = [
  // ── Oficiais ────────────────────────────────────────────────────────
  def({ id: "formula1", name: "Formula1.com", homepage: "https://www.formula1.com", feedUrl: "https://www.formula1.com/en/latest/all.xml", language: "en", kind: "official", region: "oficial", group: "fom", requireF1Keyword: false }),
  def({ id: "fia", name: "FIA", homepage: "https://www.fia.com", feedUrl: "https://www.fia.com/rss/press-release", language: "en", kind: "official", region: "oficial", group: "fia", requireF1Keyword: true }),
  // Fornecedora oficial de pneus da F1: dados de compostos e estratégia. Multiesporte.
  def({ id: "pirelli", name: "Pirelli Motorsport (imprensa)", homepage: "https://press.pirelli.com", feedUrl: "https://press.pirelli.com/feed/", language: "en", kind: "official", region: "oficial", group: "pirelli", requireF1Keyword: true }),

  // ── Imprensa internacional (inglês) ─────────────────────────────────
  def({ id: "autosport", name: "Autosport", homepage: "https://www.autosport.com", feedUrl: "https://www.autosport.com/rss/f1/news/", language: "en", kind: "media", region: "internacional", group: "motorsport-network", requireF1Keyword: false }),
  def({ id: "motorsport-com", name: "Motorsport.com", homepage: "https://www.motorsport.com", feedUrl: "https://www.motorsport.com/rss/f1/news/", language: "en", kind: "media", region: "internacional", group: "motorsport-network", requireF1Keyword: false }),
  def({ id: "bbc-sport", name: "BBC Sport", homepage: "https://www.bbc.com/sport/formula1", feedUrl: "https://feeds.bbci.co.uk/sport/formula1/rss.xml", language: "en", kind: "media", region: "internacional", group: "bbc", requireF1Keyword: false, articleHosts: ["www.bbc.com", "www.bbc.co.uk"] }),
  def({ id: "the-race", name: "The Race", homepage: "https://www.the-race.com", feedUrl: "https://www.the-race.com/rss/", language: "en", kind: "media", region: "internacional", group: "the-race", requireF1Keyword: true }),
  def({ id: "sky-sports", name: "Sky Sports F1", homepage: "https://www.skysports.com/f1", feedUrl: "https://www.skysports.com/rss/12433", language: "en", kind: "media", region: "internacional", group: "sky", requireF1Keyword: false, articleHosts: ["www.skysports.com"] }),
  def({ id: "guardian", name: "The Guardian", homepage: "https://www.theguardian.com/sport/formulaone", feedUrl: "https://www.theguardian.com/sport/formulaone/rss", language: "en", kind: "media", region: "internacional", group: "guardian", requireF1Keyword: false, articleHosts: ["www.theguardian.com"] }),
  // O espn.com passou a bloquear leitores de RSS (202 sem conteúdo, 2026-10-30); a ESPN Brasil publica o feed de F1 normalmente.
  def({ id: "espn", name: "ESPN Brasil (F1)", homepage: "https://www.espn.com.br/f1/", feedUrl: "https://www.espn.com.br/espn/rss/f1/news", language: "pt-BR", kind: "media", region: "brasil", group: "espn", requireF1Keyword: false, articleHosts: ["www.espn.com.br"] }),
  def({ id: "racer", name: "RACER", homepage: "https://racer.com", feedUrl: "https://racer.com/f1/feed/", language: "en", kind: "media", region: "internacional", group: "racer", requireF1Keyword: false }),
  def({ id: "crash", name: "Crash.net", homepage: "https://www.crash.net", feedUrl: "https://www.crash.net/rss/f1", language: "en", kind: "media", region: "internacional", group: "crash", requireF1Keyword: false }),
  def({ id: "planetf1", name: "PlanetF1", homepage: "https://www.planetf1.com", feedUrl: "https://www.planetf1.com/rss", language: "en", kind: "media", region: "internacional", group: "planet-sport", requireF1Keyword: true }),
  def({ id: "gpfans", name: "GPFans", homepage: "https://www.gpfans.com/en/", feedUrl: "https://www.gpfans.com/en/rss.xml", language: "en", kind: "media", region: "internacional", group: "gpfans", requireF1Keyword: false, articleHosts: ["www.gpfans.com"] }),
  def({ id: "racingnews365", name: "RacingNews365", homepage: "https://racingnews365.com", feedUrl: "https://racingnews365.com/feed/news.xml", language: "en", kind: "media", region: "internacional", group: "racingnews365", requireF1Keyword: true }),
  def({ id: "f1i", name: "F1i.com", homepage: "https://f1i.com", feedUrl: "https://f1i.com/feed", language: "en", kind: "media", region: "internacional", group: "f1i", requireF1Keyword: false }),
  def({ id: "motorsport-week", name: "Motorsport Week", homepage: "https://www.motorsportweek.com", feedUrl: "https://www.motorsportweek.com/feed/", language: "en", kind: "media", region: "internacional", group: "motorsport-week", requireF1Keyword: true }),
  def({ id: "speedcafe", name: "Speedcafe", homepage: "https://speedcafe.com", feedUrl: "https://www.speedcafe.com/feed/", language: "en", kind: "media", region: "internacional", group: "speedcafe", requireF1Keyword: true }),

  // ── Imprensa europeia ───────────────────────────────────────────────
  def({ id: "motorsport-es", name: "Motorsport.com España", homepage: "https://es.motorsport.com", feedUrl: "https://es.motorsport.com/rss/f1/news/", language: "es", kind: "media", region: "europa", group: "motorsport-network", requireF1Keyword: false }),
  def({ id: "marca", name: "Marca (Espanha)", homepage: "https://www.marca.com/motor/formula1.html", feedUrl: "https://www.marca.com/rss/motor/formula1.xml", language: "es", kind: "media", region: "europa", group: "unidad-editorial", requireF1Keyword: false, articleHosts: ["www.marca.com"] }),
  def({ id: "formulapassion", name: "FormulaPassion (Itália)", homepage: "https://www.formulapassion.it", feedUrl: "https://www.formulapassion.it/f1/feed", language: "it", kind: "media", region: "europa", group: "formulapassion", requireF1Keyword: false }),
  def({ id: "formel1-de", name: "Formel1.de (Alemanha)", homepage: "https://www.formel1.de", feedUrl: "https://www.formel1.de/rss/news/feed.xml", language: "de", kind: "media", region: "europa", group: "motorsport-network", requireF1Keyword: false }),

  // ── Imprensa brasileira ─────────────────────────────────────────────
  def({ id: "motorsport-br", name: "Motorsport.com Brasil", homepage: "https://motorsport.uol.com.br", feedUrl: "https://motorsport.uol.com.br/rss/f1/news/", language: "pt-BR", kind: "media", region: "brasil", group: "motorsport-network", requireF1Keyword: false }),
  def({ id: "ge-globo", name: "ge (Globo)", homepage: "https://ge.globo.com/motor/formula-1/", feedUrl: "https://ge.globo.com/rss/ge/motor/formula-1/", language: "pt-BR", kind: "media", region: "brasil", group: "globo", requireF1Keyword: false, articleHosts: ["ge.globo.com"] }),
  def({ id: "grande-premio", name: "Grande Prêmio", homepage: "https://grandepremio.com/br/", feedUrl: "https://grandepremio.com/br/feed/", language: "pt-BR", kind: "media", region: "brasil", group: "grande-premio", requireF1Keyword: true, articleHosts: ["grandepremio.com"] }),
  def({ id: "autoracing", name: "Autoracing", homepage: "https://www.autoracing.com.br", feedUrl: "https://www.autoracing.com.br/feed/", language: "pt-BR", kind: "media", region: "brasil", group: "autoracing", requireF1Keyword: true }),
  def({ id: "f1mania", name: "F1Mania", homepage: "https://www.f1mania.net", feedUrl: "https://www.f1mania.net/feed/", language: "pt-BR", kind: "media", region: "brasil", group: "f1mania", requireF1Keyword: false }),
  def({ id: "projeto-motor", name: "Projeto Motor", homepage: "https://projetomotor.com.br", feedUrl: "https://projetomotor.com.br/feed/", language: "pt-BR", kind: "media", region: "brasil", group: "projeto-motor", requireF1Keyword: true }),
];

export function sourceById(id: string): SourceDef | undefined {
  return NEWS_SOURCES.find((s) => s.id === id);
}

/** Lista fechada de hosts que o sistema pode acessar (proteção contra SSRF). */
export function allowedHosts(): Set<string> {
  const hosts = new Set<string>();
  for (const s of NEWS_SOURCES) {
    hosts.add(new URL(s.feedUrl).hostname);
    for (const h of s.articleHosts) hosts.add(h);
  }
  return hosts;
}
