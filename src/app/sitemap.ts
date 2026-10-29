import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { siteUrl } from "@/lib/env";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const statics = ["", "/calendar", "/results", "/standings", "/championship-probabilities", "/head-to-head", "/schedule", "/records", "/recaps", "/news", "/sources", "/methodology", "/about", "/privacy"];
  let articles: { slug: string; updatedAt: Date }[] = [];
  try {
    articles = await db.article.findMany({ where: { status: "published" }, select: { slug: true, updatedAt: true }, orderBy: { publishedAt: "desc" }, take: 5000 });
  } catch {
    // sitemap continua válido sem os artigos
  }
  return [
    ...statics.map((p) => ({ url: siteUrl(p || "/"), changeFrequency: "daily" as const })),
    ...articles.map((a) => ({ url: siteUrl(`/news/${a.slug}`), lastModified: a.updatedAt })),
  ];
}
