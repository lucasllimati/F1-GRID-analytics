import type { Metadata } from "next";
import Link from "next/link";
import { NewsCard, NewsGrid } from "@/components/news-card";
import { LocalTime } from "@/components/timezone";
import { Card, Container, EmptyState, PageHeader, SectionHeading } from "@/components/ui";
import { countPublished, listPublished, radarItems } from "@/lib/news/queries";
import { CATEGORIES, CATEGORY_LABEL, type Category } from "@/lib/news/states";

export const revalidate = 120;
export const metadata: Metadata = {
  title: "Notícias",
  description: "Notícias de Fórmula 1 em português, redigidas pela Apex Grid com checagem de fatos e atribuição às fontes.",
  alternates: { canonical: "/news", types: { "application/rss+xml": "/feed.xml" } },
};

const PAGE = 12;

export default async function NewsPage({ searchParams }: { searchParams: Promise<{ page?: string; cat?: string }> }) {
  const sp = await searchParams;
  const cat = CATEGORIES.includes(sp.cat as Category) ? (sp.cat as Category) : undefined;
  const page = Math.max(1, Math.min(500, Number.parseInt(sp.page ?? "1", 10) || 1));
  const [articles, total, radar] = await Promise.all([
    listPublished({ take: PAGE, skip: (page - 1) * PAGE, category: cat }),
    countPublished(cat),
    page === 1 ? radarItems(20) : Promise.resolve([]),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const link = (p: number, c = cat) => {
    const q = new URLSearchParams();
    if (c) q.set("cat", c);
    if (p > 1) q.set("page", String(p));
    const s = q.toString();
    return s ? `/news?${s}` : "/news";
  };
  const chip = (active: boolean) =>
    `rounded-sm border px-2.5 py-1 text-xs ${active ? "border-accent bg-accent-soft" : "border-line text-muted hover:text-fg"}`;

  return (
    <>
      <PageHeader kicker="Redação Apex Grid" title="Notícias">
        Textos próprios, escritos a partir de veículos especializados e fontes oficiais. Cada matéria lista suas fontes e passa por
        checagem de fatos; temas sensíveis sempre passam por um editor humano.{" "}
        <Link href="/sources" className="underline">
          Como trabalhamos
        </Link>
        .
      </PageHeader>
      <Container className="mt-8">
        <nav aria-label="Categorias" className="mb-6 flex flex-wrap gap-1.5">
          <Link href={link(1, undefined)} aria-current={!cat ? "page" : undefined} className={chip(!cat)}>
            Todas
          </Link>
          {CATEGORIES.map((c) => (
            <Link key={c} href={link(1, c)} aria-current={cat === c ? "page" : undefined} className={chip(cat === c)}>
              {CATEGORY_LABEL[c]}
            </Link>
          ))}
        </nav>

        {articles.length === 0 ? (
          <EmptyState title="Nenhuma matéria publicada nesta seção ainda" />
        ) : (
          page === 1 ? (
            // Primeira página: manchete + "Mais recentes" + grade.
            <NewsGrid articles={articles} />
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {articles.map((a) => (
                <NewsCard key={a.id} a={a} />
              ))}
            </div>
          )
        )}

        {pages > 1 && (
          <nav aria-label="Paginação" className="mt-8 flex items-center justify-center gap-3 text-sm">
            {page > 1 && (
              <Link href={link(page - 1)} className="rounded border border-line px-3 py-1.5 hover:border-fg">
                ← Anteriores
              </Link>
            )}
            <span className="text-muted">
              Página {page} de {pages}
            </span>
            {page < pages && (
              <Link href={link(page + 1)} className="rounded border border-line px-3 py-1.5 hover:border-fg">
                Próximas →
              </Link>
            )}
          </nav>
        )}

        {radar.length > 0 && (
          <section className="mt-16" aria-labelledby="radar">
            <SectionHeading id="radar" kicker="Monitoramento contínuo" title="Radar das fontes" />
            <Card className="p-5">
              <p className="mb-3 text-xs text-faint">
                Últimas manchetes dos veículos que monitoramos. O link leva ao texto original no site de cada veículo.
              </p>
              <ul className="divide-y divide-line">
                {radar.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-baseline justify-between gap-x-4 py-2 text-sm">
                    <a href={r.url} target="_blank" rel="noopener noreferrer nofollow" className="hover:text-accent">
                      {r.title}
                      {r.source.language === "en" && <span className="ml-1 text-xs text-faint">(em inglês)</span>}
                    </a>
                    <span className="text-xs text-faint">
                      {r.source.name} · {!r.publishedAtKnown && "coletado "}
                    <LocalTime iso={r.publishedAt.toISOString()} variant="datetime" />
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          </section>
        )}
      </Container>
    </>
  );
}
