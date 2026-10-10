import { siteUrl } from "@/lib/env";
import { listPublished } from "@/lib/news/queries";

export const revalidate = 300;

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export async function GET() {
  const items = await listPublished({ take: 30 });
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
<title>Apex Grid — Notícias</title>
<link>${esc(siteUrl("/news"))}</link>
<atom:link href="${esc(siteUrl("/feed.xml"))}" rel="self" type="application/rss+xml"/>
<description>Notícias de Fórmula 1 com fontes verificadas.</description>
<language>pt-BR</language>
${items
  .map(
    (a) => `<item>
<title>${esc(a.headline)}</title>
<link>${esc(siteUrl(`/news/${a.slug}`))}</link>
<guid isPermaLink="true">${esc(siteUrl(`/news/${a.slug}`))}</guid>
<description>${esc(a.dek)}</description>
${a.publishedAt ? `<pubDate>${a.publishedAt.toUTCString()}</pubDate>` : ""}
</item>`,
  )
  .join("\n")}
</channel>
</rss>`;
  return new Response(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8" } });
}
