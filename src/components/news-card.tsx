import Link from "next/link";
import { categoryLabel } from "@/lib/news/states";
import { Badge } from "./ui";

export type NewsCardData = {
  id?: string;
  slug: string;
  headline: string;
  dek: string;
  category: string;
  readingMinutes: number;
  publishedAt: Date | null;
  sources: { publisher: string }[];
};

const dateFmt = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

function Meta({ a, compact = false }: { a: NewsCardData; compact?: boolean }) {
  const publishers = [...new Set(a.sources.map((s) => s.publisher))];
  return (
    <p className="text-xs text-faint">
      {a.publishedAt && <time dateTime={a.publishedAt.toISOString()}>{dateFmt.format(a.publishedAt)}</time>}
      {!compact && publishers.length > 0 && (
        <span>
          {" "}
          · {publishers.length} {publishers.length === 1 ? "fonte" : "fontes"}: {publishers.join(", ")}
        </span>
      )}
      {compact && <span> · {a.readingMinutes} min</span>}
    </p>
  );
}

/** Manchete principal: ocupa a altura toda da faixa de destaque. */
export function FeaturedNews({ a }: { a: NewsCardData }) {
  return (
    <article className="group relative flex h-full flex-col justify-between overflow-hidden rounded-md border border-line bg-elev p-6 transition-colors hover:border-line-strong sm:p-8">
      <span className="absolute inset-y-0 left-0 w-1 bg-accent" aria-hidden="true" />
      <div
        className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-accent/10 blur-3xl"
        aria-hidden="true"
      />
      <div className="relative">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Badge tone="accent">{categoryLabel(a.category)}</Badge>
          <span className="text-xs text-faint">Destaque · {a.readingMinutes} min de leitura</span>
        </div>
        <h3 className="max-w-3xl font-display text-3xl font-extrabold leading-[1.05] tracking-tight group-hover:text-accent sm:text-4xl lg:text-5xl">
          <Link href={`/news/${a.slug}`} className="after:absolute after:inset-0">
            {a.headline}
          </Link>
        </h3>
        <p className="mt-4 max-w-2xl text-base text-muted sm:text-lg">{a.dek}</p>
      </div>
      <div className="relative mt-8 flex flex-wrap items-end justify-between gap-3">
        <Meta a={a} />
        <span className="text-sm font-semibold text-accent" aria-hidden="true">
          Ler matéria →
        </span>
      </div>
    </article>
  );
}

/** Item compacto da coluna "Mais recentes". */
export function NewsListItem({ a }: { a: NewsCardData }) {
  return (
    <article className="group relative border-b border-line py-4 first:pt-0 last:border-b-0 last:pb-0">
      <p className="mb-1 text-[0.68rem] font-semibold uppercase tracking-widest text-accent">{categoryLabel(a.category)}</p>
      <h3 className="font-display text-lg font-bold leading-snug tracking-tight group-hover:text-accent">
        <Link href={`/news/${a.slug}`} className="after:absolute after:inset-0">
          {a.headline}
        </Link>
      </h3>
      <div className="mt-1.5">
        <Meta a={a} compact />
      </div>
    </article>
  );
}

/** Card padrão da grade: mesma altura para todos da linha. */
export function NewsCard({ a }: { a: NewsCardData }) {
  return (
    <article className="group relative flex h-full flex-col rounded-md border border-line bg-elev p-5 transition-colors hover:border-line-strong">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Badge tone="accent">{categoryLabel(a.category)}</Badge>
        <span className="text-xs text-faint">{a.readingMinutes} min de leitura</span>
      </div>
      <h3 className="font-display text-xl font-bold leading-tight tracking-tight group-hover:text-accent">
        <Link href={`/news/${a.slug}`} className="after:absolute after:inset-0">
          {a.headline}
        </Link>
      </h3>
      <p className="mt-2 line-clamp-3 text-sm text-muted">{a.dek}</p>
      <div className="mt-auto pt-4">
        <Meta a={a} />
      </div>
    </article>
  );
}

/**
 * Layout de portal: manchete + coluna "Mais recentes" (até 3) e, abaixo, grade de 3 colunas.
 * Funciona com qualquer quantidade: com 1 matéria, a manchete ocupa a largura toda.
 */
export function NewsGrid({ articles, sideCount = 3 }: { articles: NewsCardData[]; sideCount?: number }) {
  const [lead, ...rest] = articles;
  if (!lead) return null;
  const side = rest.slice(0, sideCount);
  const grid = rest.slice(sideCount);
  return (
    <div className="space-y-5">
      <div className={`grid gap-5 ${side.length > 0 ? "lg:grid-cols-[minmax(0,1.75fr)_minmax(0,1fr)]" : ""}`}>
        <FeaturedNews a={lead} />
        {side.length > 0 && (
          <aside aria-label="Mais recentes" className="rounded-md border border-line bg-elev p-5">
            <h3 className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-muted">Mais recentes</h3>
            {side.map((a) => (
              <NewsListItem key={a.slug} a={a} />
            ))}
          </aside>
        )}
      </div>
      {grid.length > 0 && (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {grid.map((a) => (
            <NewsCard key={a.slug} a={a} />
          ))}
        </div>
      )}
    </div>
  );
}
