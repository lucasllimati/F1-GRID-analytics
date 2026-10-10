// Registro das fontes monitoradas. Todas foram verificadas manualmente em 2026-10-10
// (feed responde 200 e contém <item>). Ver docs/NEWSROOM.md para a política de uso.
//
// `group` identifica o grupo editorial: fontes do mesmo grupo NÃO contam como
// confirmação independente (ex.: Autosport e Motorsport.com pertencem à Motorsport Network).

export type SourceDef = {
  id: string;
  name: string;
  homepage: string;
  feedUrl: string;
  language: "en" | "pt-BR";
  kind: "official" | "media";
  group: string;
  /** Feeds multiesportivos exigem menção explícita à F1 no título/resumo. */
  requireF1Keyword: boolean;
  /** Hosts dos quais podemos baixar a página do artigo (para evidência interna). */
  articleHosts: string[];
};

export const NEWS_SOURCES: SourceDef[] = [
  {
    id: "formula1",
    name: "Formula1.com",
    homepage: "https://www.formula1.com",
    feedUrl: "https://www.formula1.com/en/latest/all.xml",
    language: "en",
    kind: "official",
    group: "fom",
    requireF1Keyword: false,
    articleHosts: ["www.formula1.com"],
  },
  {
    id: "fia",
    name: "FIA",
    homepage: "https://www.fia.com",
    feedUrl: "https://www.fia.com/rss/press-release",
    language: "en",
    kind: "official",
    group: "fia",
    requireF1Keyword: true,
    articleHosts: ["www.fia.com"],
  },
  {
    id: "autosport",
    name: "Autosport",
    homepage: "https://www.autosport.com",
    feedUrl: "https://www.autosport.com/rss/f1/news/",
    language: "en",
    kind: "media",
    group: "motorsport-network",
    requireF1Keyword: false,
    articleHosts: ["www.autosport.com"],
  },
  {
    id: "motorsport-com",
    name: "Motorsport.com",
    homepage: "https://www.motorsport.com",
    feedUrl: "https://www.motorsport.com/rss/f1/news/",
    language: "en",
    kind: "media",
    group: "motorsport-network",
    requireF1Keyword: false,
    articleHosts: ["www.motorsport.com"],
  },
  {
    id: "motorsport-br",
    name: "Motorsport.com Brasil",
    homepage: "https://motorsport.uol.com.br",
    feedUrl: "https://motorsport.uol.com.br/rss/f1/news/",
    language: "pt-BR",
    kind: "media",
    group: "motorsport-network",
    requireF1Keyword: false,
    articleHosts: ["motorsport.uol.com.br"],
  },
  {
    id: "bbc-sport",
    name: "BBC Sport",
    homepage: "https://www.bbc.com/sport/formula1",
    feedUrl: "https://feeds.bbci.co.uk/sport/formula1/rss.xml",
    language: "en",
    kind: "media",
    group: "bbc",
    requireF1Keyword: false,
    articleHosts: ["www.bbc.com", "www.bbc.co.uk"],
  },
  {
    id: "the-race",
    name: "The Race",
    homepage: "https://www.the-race.com",
    feedUrl: "https://www.the-race.com/rss/",
    language: "en",
    kind: "media",
    group: "the-race",
    requireF1Keyword: true,
    articleHosts: ["www.the-race.com"],
  },
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
