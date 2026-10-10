import { db } from "../db";

// Consultas públicas: somente artigos publicados aparecem no site.

export async function listPublished({ take = 20, skip = 0, category }: { take?: number; skip?: number; category?: string } = {}) {
  try {
    return await db.article.findMany({
      where: { status: "published", ...(category ? { category } : {}) },
      orderBy: { publishedAt: "desc" },
      take,
      skip,
      include: { sources: { select: { publisher: true } } },
    });
  } catch (err) {
    console.error("[news] falha ao listar artigos", err);
    return [];
  }
}

export async function countPublished(category?: string) {
  try {
    return await db.article.count({ where: { status: "published", ...(category ? { category } : {}) } });
  } catch {
    return 0;
  }
}

export async function getPublicArticle(slug: string) {
  if (!/^[a-z0-9-]{1,120}$/.test(slug)) return null;
  // Artigos despublicados continuam acessíveis com aviso de correção (transparência).
  return db.article.findFirst({
    where: { slug, status: { in: ["published", "retracted"] } },
    include: {
      sources: { orderBy: { publishedAt: "asc" } },
      versions: { orderBy: { version: "desc" }, take: 1 },
    },
  });
}

/** Radar: manchetes recentes das fontes, com link para o original (sem copiar texto). */
export async function radarItems(take = 12) {
  try {
    return await db.feedItem.findMany({
      where: { excluded: false },
      orderBy: { publishedAt: "desc" },
      take,
      select: { id: true, title: true, url: true, publishedAt: true, source: { select: { name: true, language: true } } },
    });
  } catch {
    return [];
  }
}
