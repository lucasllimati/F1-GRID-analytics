import { XMLParser } from "fast-xml-parser";
import { stripHtml, truncate } from "./text";

export type ParsedFeedItem = {
  guid: string;
  url: string;
  title: string;
  summary: string;
  publishedAt: Date | null;
};

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  processEntities: false, // decodificamos manualmente; evita expansão de entidades (XXE/bomb)
  htmlEntities: false,
  trimValues: true,
});

function text(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string" || typeof v === "number") return String(v);
  if (typeof v === "object" && "#text" in (v as Record<string, unknown>)) return String((v as Record<string, unknown>)["#text"]);
  return "";
}

function asArray<T>(v: T | T[] | undefined): T[] {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

function parseDate(s: string): Date | null {
  if (!s) return null;
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : new Date(t);
}

function cleanUrl(raw: string): string | null {
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    // Remove parâmetros de rastreamento.
    for (const k of [...u.searchParams.keys()]) if (/^(utm_|at_|ocid|cmpid)/i.test(k)) u.searchParams.delete(k);
    u.hash = "";
    return u.toString();
  } catch {
    return null;
  }
}

/** Analisa RSS 2.0 ou Atom. Itens sem URL ou título válidos são descartados. */
export function parseFeed(xml: string): ParsedFeedItem[] {
  if (/<!ENTITY/i.test(xml)) throw new Error("Feed com declarações de entidade rejeitado");
  const doc = parser.parse(xml) as Record<string, any>;
  const out: ParsedFeedItem[] = [];

  const rssItems = asArray(doc?.rss?.channel?.item);
  for (const it of rssItems) {
    const url = cleanUrl(text(it.link));
    const title = stripHtml(text(it.title));
    if (!url || !title) continue;
    out.push({
      guid: text(it.guid) || url,
      url,
      title: truncate(title, 300),
      summary: truncate(stripHtml(text(it.description)), 1200),
      publishedAt: parseDate(text(it.pubDate) || text(it["dc:date"])),
    });
  }

  const atomEntries = asArray(doc?.feed?.entry);
  for (const e of atomEntries) {
    const links = asArray(e.link) as Record<string, string>[];
    const href = links.find((l) => !l["@_rel"] || l["@_rel"] === "alternate")?.["@_href"] ?? "";
    const url = cleanUrl(href);
    const title = stripHtml(text(e.title));
    if (!url || !title) continue;
    out.push({
      guid: text(e.id) || url,
      url,
      title: truncate(title, 300),
      summary: truncate(stripHtml(text(e.summary) || text(e.content)), 1200),
      publishedAt: parseDate(text(e.published) || text(e.updated)),
    });
  }
  return out;
}
