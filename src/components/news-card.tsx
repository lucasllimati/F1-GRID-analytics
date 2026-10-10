import Link from "next/link";
import { categoryLabel } from "@/lib/news/states";
import { Badge } from "./ui";

export type NewsCardData = {
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

export function NewsCard({ a, featured = false }: { a: NewsCardData; featured?: boolean }) {
  const publishers = [...new Set(a.sources.map((s) => s.publisher))];
  return (
    <article className={`group relative flex flex-col rounded-md border border-line bg-elev p-5 transition-colors hover:border-line-strong ${featured ? "md:p-7" : ""}`}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Badge tone="accent">{categoryLabel(a.category)}</Badge>
        <span className="text-xs text-faint">{a.readingMinutes} min de leitura</span>
      </div>
      <h3 className={`font-display font-bold leading-tight tracking-tight group-hover:text-accent ${featured ? "text-3xl" : "text-xl"}`}>
        <Link href={`/news/${a.slug}`} className="after:absolute after:inset-0">
          {a.headline}
        </Link>
      </h3>
      <p className={`mt-2 text-muted ${featured ? "text-base" : "line-clamp-3 text-sm"}`}>{a.dek}</p>
      <div className="mt-auto pt-4 text-xs text-faint">
        {a.publishedAt && <time dateTime={a.publishedAt.toISOString()}>{dateFmt.format(a.publishedAt)} (Brasília)</time>}
        {publishers.length > 0 && <span> · Fontes: {publishers.join(", ")}</span>}
      </div>
    </article>
  );
}
