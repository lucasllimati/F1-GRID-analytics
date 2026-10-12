// Disparo do workflow de notícias no GitHub Actions a partir do painel (produção).
// Necessário porque um ciclo com IA pode passar do limite de duração de função da hospedagem.
// Requer GITHUB_REPOSITORY ("dono/repo") e GITHUB_DISPATCH_TOKEN (token fine-grained com
// permissão "Actions: Read and write" SOMENTE neste repositório).

export const NEWS_WORKFLOW_FILE = "news-cycle.yml";

export type DispatchConfig = { repository: string; token: string; ref?: string };

export function dispatchConfigured(c: { GITHUB_REPOSITORY: string; GITHUB_DISPATCH_TOKEN: string }): boolean {
  return /^[\w.-]+\/[\w.-]+$/.test(c.GITHUB_REPOSITORY) && c.GITHUB_DISPATCH_TOKEN.length > 20;
}

export async function dispatchNewsCycle(cfg: DispatchConfig, ingestOnly: boolean, fetchImpl: typeof fetch = fetch): Promise<{ ok: true } | { ok: false; error: string }> {
  const url = `https://api.github.com/repos/${cfg.repository}/actions/workflows/${NEWS_WORKFLOW_FILE}/dispatches`;
  try {
    const res = await fetchImpl(url, {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${cfg.token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
        "User-Agent": "apex-grid",
      },
      body: JSON.stringify({ ref: cfg.ref ?? "main", inputs: { ingest_only: ingestOnly } }),
      signal: AbortSignal.timeout(15_000),
    });
    if (res.status === 204) return { ok: true };
    // Mensagem genérica: nunca devolvemos o corpo (pode conter detalhes do token).
    if (res.status === 401 || res.status === 403) return { ok: false, error: "GitHub recusou o token (verifique a permissão Actions: write)." };
    if (res.status === 404) return { ok: false, error: "Workflow ou repositório não encontrado (confira GITHUB_REPOSITORY)." };
    return { ok: false, error: `GitHub respondeu ${res.status}.` };
  } catch {
    return { ok: false, error: "Sem conexão com o GitHub." };
  }
}
