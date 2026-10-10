import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArticleBody } from "@/components/article-body";
import { Badge, Container } from "@/components/ui";
import { getPublicArticle } from "@/lib/news/queries";
import { categoryLabel } from "@/lib/news/states";

export const revalidate = 300;

const fmt = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "long", timeStyle: "short" });

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const a = await getPublicArticle(slug);
  if (!a) return {};
  return {
    title: a.headline,
    description: a.dek,
    alternates: { canonical: `/news/${a.slug}` },
    openGraph: { type: "article", title: a.headline, description: a.dek, publishedTime: a.publishedAt?.toISOString() },
    robots: a.status === "retracted" ? { index: false } : undefined,
  };
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const a = await getPublicArticle(slug);
  if (!a) notFound();
  const latest = a.versions[0];
  const updated = latest && latest.version > 1 ? latest.createdAt : null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: a.headline,
    description: a.dek,
    datePublished: a.publishedAt?.toISOString(),
    dateModified: (updated ?? a.publishedAt)?.toISOString(),
    inLanguage: "pt-BR",
    publisher: { "@type": "Organization", name: "Apex Grid" },
    isBasedOn: a.sources.map((s) => s.url),
  };

  return (
    <article>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <header className="telemetry-bg border-b border-line">
        <Container className="max-w-3xl py-10 sm:py-14">
          <nav aria-label="Trilha" className="mb-4 text-xs text-muted">
            <Link href="/news" className="hover:text-fg">
              Notícias
            </Link>{" "}
            / {categoryLabel(a.category)}
          </nav>
          {a.status === "retracted" && (
            <div role="alert" className="mb-5 rounded border border-accent bg-accent-soft p-3 text-sm">
              <strong>Esta matéria foi despublicada.</strong>{" "}
              {a.correctionNote ?? "Ela continha informações que não puderam ser confirmadas."}
            </div>
          )}
          <Badge tone="accent">{categoryLabel(a.category)}</Badge>
          <h1 className="mt-3 font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">{a.headline}</h1>
          <p className="mt-4 text-lg text-muted">{a.dek}</p>
          <p className="mt-5 text-xs text-faint">
            {a.publishedAt && <time dateTime={a.publishedAt.toISOString()}>Publicado em {fmt.format(a.publishedAt)} (Brasília)</time>}
            {updated && <> · Atualizado em {fmt.format(updated)}</>} · {a.readingMinutes} min de leitura
          </p>
        </Container>
      </header>
      <Container className="max-w-3xl py-10">
        <ArticleBody markdown={a.body} />

        {a.correctionNote && a.status === "published" && (
          <aside className="mt-8 rounded border border-warn/50 p-4 text-sm">
            <strong className="text-warn">Correção:</strong> {a.correctionNote}
          </aside>
        )}

        <aside aria-labelledby="fontes" className="mt-12 rounded-md border border-line bg-elev p-5">
          <h2 id="fontes" className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted">
            Fontes desta matéria
          </h2>
          <ul className="space-y-2 text-sm">
            {a.sources.map((s) => (
              <li key={s.id}>
                <a href={s.url} target="_blank" rel="noopener noreferrer nofollow" className="font-medium hover:text-accent">
                  {s.publisher}: “{s.title}”
                </a>
                <span className="block text-xs text-faint">
                  {s.publishedAtKnown ? `Publicado em ${fmt.format(s.publishedAt)}` : `Consultado em ${fmt.format(s.publishedAt)} (data de publicação não informada pelo veículo)`}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-4 border-t border-line pt-3 text-xs text-faint">
            {a.origin === "ai"
              ? a.approvedById
                ? "Texto produzido com auxílio de IA a partir das fontes acima e revisado por um editor humano antes da publicação."
                : "Texto produzido com auxílio de IA a partir das fontes acima, publicado após checagem automática de fatos, de cópia e de temas sensíveis."
              : "Texto da redação Apex Grid."}{" "}
            Encontrou um erro?{" "}
            <Link href="/sources#correcoes" className="underline">
              Veja nossa política de correções
            </Link>
            .
          </p>
        </aside>
      </Container>
    </article>
  );
}
