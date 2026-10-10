import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArticleBody } from "@/components/article-body";
import { Badge, Card, Container, SectionHeading } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ARTICLE_STATUS_LABEL, canTransition, type ArticleStatus } from "@/lib/news/states";
import { approveAction, editAction, rejectAction, reopenAction, retractAction } from "../../actions";

export const metadata: Metadata = { title: "Revisão", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const fmt = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
const VERDICT: Record<string, { label: string; tone: "ok" | "warn" | "accent" | "neutral" }> = {
  supported: { label: "Sustentada", tone: "ok" },
  unsupported: { label: "Sem suporte", tone: "warn" },
  contradicted: { label: "Contradita", tone: "accent" },
  unverifiable: { label: "Não verificável", tone: "neutral" },
};

export default async function ReviewPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; erro?: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  if (!/^[a-z0-9]{20,40}$/i.test(id)) notFound();
  const sp = await searchParams;
  const a = await db.article.findUnique({
    where: { id },
    include: {
      sources: true,
      claims: true,
      versions: { orderBy: { version: "desc" } },
      agentRuns: { orderBy: { startedAt: "asc" } },
      story: { include: { items: { include: { source: { select: { name: true } } } } } },
    },
  });
  if (!a) notFound();
  const status = a.status as ArticleStatus;
  const reasons = JSON.parse(a.reviewReasons) as string[];
  const canPublish = canTransition(status, "published") && (!a.sensitive || user.role === "admin");
  const audits = await db.auditLog.findMany({ where: { entity: "article", entityId: id }, orderBy: { createdAt: "desc" }, take: 20 });

  return (
    <Container className="py-10">
      <Link href="/admin" className="text-sm text-muted hover:text-fg">
        ← Painel
      </Link>
      {sp.ok && <p role="status" className="my-4 rounded border border-ok/50 p-3 text-sm">{sp.ok.slice(0, 300)}</p>}
      {sp.erro && <p role="alert" className="my-4 rounded border border-accent/60 bg-accent-soft p-3 text-sm">{sp.erro.slice(0, 300)}</p>}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Badge tone={status === "published" ? "ok" : status === "in_review" ? "warn" : "neutral"}>{ARTICLE_STATUS_LABEL[status] ?? status}</Badge>
        {a.sensitive && <Badge tone="warn">Tema sensível — publicação só por administrador</Badge>}
        <Badge>{a.origin === "ai" ? "Gerado por IA" : "Humano"}</Badge>
        {a.factCheckScore !== null && <Badge>{Math.round(a.factCheckScore * 100)}% das afirmações sustentadas</Badge>}
        {status === "published" && (
          <Link href={`/news/${a.slug}`} className="text-sm text-accent underline">
            Ver publicado
          </Link>
        )}
      </div>

      {reasons.length > 0 && (
        <Card className="mt-4 border-warn/50 p-4">
          <h2 className="mb-1 text-xs font-semibold uppercase tracking-widest text-warn">Por que precisa de revisão</h2>
          <ul className="list-disc pl-5 text-sm text-muted">
            {reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </Card>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <h1 className="font-display text-3xl font-bold leading-tight">{a.headline}</h1>
          <p className="mt-2 text-muted">{a.dek}</p>
          <div className="mt-6">
            <ArticleBody markdown={a.body} />
          </div>

          <SectionHeading title="Ações" />
          <div className="space-y-4">
            {canTransition(status, "published") && (
              <form action={approveAction}>
                <input type="hidden" name="id" value={a.id} />
                <button disabled={!canPublish} className="rounded bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">
                  Aprovar e publicar
                </button>
                {!canPublish && <span className="ml-2 text-xs text-warn">Requer administrador (tema sensível).</span>}
              </form>
            )}
            {canTransition(status, "rejected") && (
              <form action={rejectAction} className="flex flex-wrap gap-2">
                <input type="hidden" name="id" value={a.id} />
                <input name="reason" required minLength={3} maxLength={500} placeholder="Motivo da rejeição" className="min-w-64 flex-1 rounded border border-line bg-bg px-2 py-1.5 text-sm" />
                <button className="rounded border border-line-strong px-3 py-1.5 text-sm">Rejeitar</button>
              </form>
            )}
            {canTransition(status, "retracted") && (
              <form action={retractAction} className="flex flex-wrap gap-2">
                <input type="hidden" name="id" value={a.id} />
                <input name="note" required minLength={10} maxLength={500} placeholder="Nota pública de despublicação" className="min-w-64 flex-1 rounded border border-line bg-bg px-2 py-1.5 text-sm" />
                <button className="rounded border border-accent px-3 py-1.5 text-sm text-accent">Despublicar</button>
              </form>
            )}
            {(status === "rejected" || status === "failed" || status === "retracted") && (
              <form action={reopenAction}>
                <input type="hidden" name="id" value={a.id} />
                <button className="rounded border border-line px-3 py-1.5 text-sm">Devolver para revisão</button>
              </form>
            )}
          </div>

          <details className="mt-8 rounded border border-line p-4">
            <summary className="cursor-pointer font-semibold">Editar (cria nova versão)</summary>
            <form action={editAction} className="mt-4 space-y-3">
              <input type="hidden" name="id" value={a.id} />
              <label className="block text-sm">
                Título
                <input name="headline" defaultValue={a.headline} maxLength={140} required className="mt-1 w-full rounded border border-line bg-bg px-2 py-1.5" />
              </label>
              <label className="block text-sm">
                Linha fina
                <textarea name="dek" defaultValue={a.dek} maxLength={320} rows={2} required className="mt-1 w-full rounded border border-line bg-bg px-2 py-1.5" />
              </label>
              <label className="block text-sm">
                Corpo (Markdown simples: parágrafos, ## subtítulos, listas)
                <textarea name="body" defaultValue={a.body} rows={18} required className="mt-1 w-full rounded border border-line bg-bg px-2 py-1.5 font-mono text-sm" />
              </label>
              <label className="block text-sm">
                Nota interna da versão
                <input name="note" maxLength={300} className="mt-1 w-full rounded border border-line bg-bg px-2 py-1.5" />
              </label>
              {status === "published" && (
                <label className="block text-sm">
                  Nota pública de correção (obrigatória ao corrigir fatos de texto publicado)
                  <input name="correction" maxLength={500} className="mt-1 w-full rounded border border-line bg-bg px-2 py-1.5" />
                </label>
              )}
              <button className="rounded bg-fg px-4 py-2 text-sm font-semibold text-bg">Salvar versão</button>
            </form>
          </details>
        </div>

        <aside className="space-y-6">
          <Card className="p-4">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">Checagem de fatos ({a.claims.length})</h2>
            <ul className="space-y-3 text-sm">
              {a.claims.map((c) => (
                <li key={c.id}>
                  <Badge tone={VERDICT[c.verdict]?.tone ?? "neutral"}>{VERDICT[c.verdict]?.label ?? c.verdict}</Badge>
                  <p className="mt-1">{c.text}</p>
                  {c.evidence && <p className="mt-1 border-l-2 border-line pl-2 text-xs italic text-faint">{c.evidence}</p>}
                </li>
              ))}
              {a.claims.length === 0 && <li className="text-faint">Sem resultado de checagem.</li>}
            </ul>
          </Card>
          <Card className="p-4">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">Fontes usadas</h2>
            <ul className="space-y-1 text-sm">
              {a.sources.map((s) => (
                <li key={s.id}>
                  <a href={s.url} target="_blank" rel="noopener noreferrer nofollow" className="hover:text-accent">
                    {s.publisher}: {s.title}
                  </a>
                </li>
              ))}
            </ul>
            {a.story && a.story.items.length > a.sources.length && (
              <>
                <h3 className="mb-1 mt-3 text-xs text-faint">Outros itens da pauta</h3>
                <ul className="space-y-1 text-xs text-muted">
                  {a.story.items
                    .filter((i) => !a.sources.some((s) => s.feedItemId === i.id))
                    .map((i) => (
                      <li key={i.id}>
                        <a href={i.url} target="_blank" rel="noopener noreferrer nofollow" className="hover:text-accent">
                          [{i.source.name}] {i.title}
                        </a>
                      </li>
                    ))}
                </ul>
              </>
            )}
          </Card>
          <Card className="p-4 text-xs">
            <h2 className="mb-2 font-semibold uppercase tracking-widest text-muted">Execuções de agentes</h2>
            <ul className="space-y-1 text-muted">
              {a.agentRuns.map((r) => (
                <li key={r.id}>
                  {r.agent} · {r.model} · {r.promptVersion} · {r.status} · US$ {r.costUsd.toFixed(4)}
                </li>
              ))}
            </ul>
          </Card>
          <Card className="p-4 text-xs">
            <h2 className="mb-2 font-semibold uppercase tracking-widest text-muted">Versões</h2>
            <ul className="space-y-1 text-muted">
              {a.versions.map((v) => (
                <li key={v.id}>
                  v{v.version} · {fmt.format(v.createdAt)} · {v.author}
                  {v.note ? ` · ${v.note}` : ""}
                </li>
              ))}
            </ul>
          </Card>
          <Card className="p-4 text-xs">
            <h2 className="mb-2 font-semibold uppercase tracking-widest text-muted">Auditoria</h2>
            <ul className="space-y-1 text-muted">
              {audits.map((l) => (
                <li key={l.id}>
                  {fmt.format(l.createdAt)} · {l.actor} · {l.action}
                </li>
              ))}
            </ul>
          </Card>
        </aside>
      </div>
    </Container>
  );
}
