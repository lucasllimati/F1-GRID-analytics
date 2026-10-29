"use client";

import { useEffect, useMemo, useState } from "react";

// Simulador "e se…?": o leitor escolhe a posição de cada candidato nas etapas restantes e vê
// quem termina campeão. Conta exata de pontos com a tabela da temporada; empate decidido por
// vitórias, depois 2º lugares etc. (critério oficial). A simulação pode ser compartilhada pelo link.

/** `finishes`: chegadas reais por posição na temporada (índice 0 = vitórias), para o desempate oficial. */
export type SimContender = { id: string; name: string; code: string; points: number; wins: number; finishes: number[]; color: string };
export type SimEvent = { round: number; name: string; flag: string; sprint: boolean };

type Pick = number | "AB" | null;
type Row = { key: string; round: number; label: string; flag: string; session: "r" | "s" };

const MAX_POS = 22;

function encode(picks: Record<string, Pick>): string {
  return Object.entries(picks)
    .filter(([, v]) => v !== null)
    .map(([k, v]) => `${k}=${v}`)
    .join(",");
}

function decode(s: string): Record<string, Pick> {
  const out: Record<string, Pick> = {};
  for (const part of s.split(",")) {
    const [k, v] = part.split("=");
    if (!k || !v || !/^\d+[rs]\.[\w-]+$/.test(k)) continue;
    out[k] = v === "AB" ? "AB" : /^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= MAX_POS ? Number(v) : null;
  }
  return out;
}

export function TitleSimulator({ contenders, events, race, sprint }: { contenders: SimContender[]; events: SimEvent[]; race: number[]; sprint: number[] }) {
  const rows: Row[] = useMemo(
    () =>
      events.flatMap((e) => [
        ...(e.sprint ? [{ key: `${e.round}s`, round: e.round, label: `${e.name} · Sprint`, flag: e.flag, session: "s" as const }] : []),
        { key: `${e.round}r`, round: e.round, label: e.name, flag: e.flag, session: "r" as const },
      ]),
    [events],
  );
  const [picks, setPicks] = useState<Record<string, Pick>>({});
  const [copied, setCopied] = useState(false);

  // Simulação compartilhada: lida do endereço (#sim=…) ao abrir.
  useEffect(() => {
    const m = /[#&]sim=([^&]+)/.exec(window.location.hash);
    if (m) setPicks(decode(decodeURIComponent(m[1]!)));
  }, []);

  const cellKey = (row: Row, id: string) => `${row.key}.${id}`;
  const set = (k: string, v: Pick) => setPicks((p) => ({ ...p, [k]: v }));

  const winAll = (id: string) =>
    setPicks((p) => {
      const next = { ...p };
      for (const row of rows) {
        for (const c of contenders) if (next[cellKey(row, c.id)] === 1) next[cellKey(row, c.id)] = null;
        next[cellKey(row, id)] = 1;
      }
      return next;
    });

  /** Preenche o que falta na ordem atual do campeonato, sem repetir posição na mesma sessão. */
  const fillRest = () =>
    setPicks((p) => {
      const next = { ...p };
      for (const row of rows) {
        const used = new Set(contenders.map((c) => next[cellKey(row, c.id)]).filter((v): v is number => typeof v === "number"));
        let pos = 1;
        for (const c of contenders) {
          const k = cellKey(row, c.id);
          if (next[k] !== null && next[k] !== undefined) continue;
          while (used.has(pos)) pos++;
          next[k] = pos;
          used.add(pos);
        }
      }
      return next;
    });

  const result = useMemo(() => {
    const totals = contenders.map((c) => ({ ...c, final: c.points, simWins: c.wins, finishes: [...c.finishes] }));
    let any = false;
    const duplicates: string[] = [];
    for (const row of rows) {
      const seen = new Map<number, string>();
      for (const t of totals) {
        const v = picks[cellKey(row, t.id)];
        if (v === null || v === undefined) continue;
        any = true;
        if (v === "AB") continue;
        const table = row.session === "r" ? race : sprint;
        t.final += table[v - 1] ?? 0;
        if (row.session === "r") {
          t.finishes[v - 1] = (t.finishes[v - 1] ?? 0) + 1;
          if (v === 1) t.simWins++;
        }
        if (seen.has(v)) duplicates.push(`${row.label}: ${seen.get(v)} e ${t.name} em ${v}º`);
        seen.set(v, t.name);
      }
    }
    totals.sort((a, b) => {
      if (b.final !== a.final) return b.final - a.final;
      if (b.simWins !== a.simWins) return b.simWins - a.simWins;
      for (let i = 1; i < MAX_POS; i++) if ((b.finishes[i] ?? 0) !== (a.finishes[i] ?? 0)) return (b.finishes[i] ?? 0) - (a.finishes[i] ?? 0);
      return 0;
    });
    return { totals, any, duplicates };
  }, [picks, rows, contenders, race, sprint]);

  const share = async () => {
    const url = `${window.location.origin}${window.location.pathname}#sim=${encodeURIComponent(encode(picks))}`;
    window.history.replaceState(null, "", url);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* sem permissão de área de transferência: o link já está na barra de endereço */
    }
  };

  const champ = result.totals[0];
  const tie = result.totals[1] && result.totals[1].final === champ?.final;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <label className="text-sm">
          <span className="sr-only">Quem vence todas?</span>
          <select
            className="rounded border border-line-strong bg-elev px-2 py-1.5 text-sm font-semibold"
            value=""
            onChange={(e) => e.target.value && winAll(e.target.value)}
          >
            <option value="">Quem vence todas?</option>
            {contenders.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={fillRest} className="rounded border border-line-strong px-3 py-1.5 text-sm font-semibold hover:border-fg">
          Completar o resto
        </button>
        <button type="button" onClick={() => setPicks({})} className="rounded px-3 py-1.5 text-sm text-muted hover:text-fg">
          Limpar
        </button>
        <button type="button" onClick={share} className="ml-auto rounded border border-line-strong px-3 py-1.5 text-sm font-semibold hover:border-fg">
          {copied ? "Link copiado ✓" : "Compartilhar simulação"}
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="overflow-x-auto rounded-md border border-line">
          <table className="data-table">
            <caption className="sr-only">Escolha a posição de cada candidato em cada etapa restante</caption>
            <thead>
              <tr>
                <th scope="col">Etapa</th>
                {contenders.map((c) => (
                  <th key={c.id} scope="col" className="text-center" style={{ borderTop: `3px solid ${c.color}` }}>
                    {c.code}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key}>
                  <th scope="row" className="text-left font-medium normal-case tracking-normal text-fg">
                    <span aria-hidden="true">{row.flag} </span>
                    {row.label}
                  </th>
                  {contenders.map((c) => {
                    const k = cellKey(row, c.id);
                    const v = picks[k] ?? null;
                    return (
                      <td key={c.id} className="text-center">
                        <select
                          aria-label={`${c.name} em ${row.label}`}
                          value={v === null ? "" : String(v)}
                          onChange={(e) => set(k, e.target.value === "" ? null : e.target.value === "AB" ? "AB" : Number(e.target.value))}
                          className="w-16 rounded border border-line-strong bg-elev px-1 py-1 text-center text-sm tabular"
                        >
                          <option value="">–</option>
                          {Array.from({ length: MAX_POS }, (_, i) => (
                            <option key={i + 1} value={i + 1}>
                              {i + 1}º
                            </option>
                          ))}
                          <option value="AB">AB</option>
                        </select>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="px-3 py-2 text-xs text-faint">AB = abandono: não pontua. Sem posição escolhida, não pontua.</p>
        </div>

        <div aria-live="polite">
          <div className="rounded-md border border-line bg-elev-2 p-4">
            {!result.any ? (
              <p className="text-sm text-muted">Escolha posições na tabela e veja aqui quem termina campeão.</p>
            ) : (
              <>
                <p className="text-xs font-semibold uppercase tracking-widest text-faint">Nesta simulação</p>
                <p className="mt-1 font-display text-2xl font-bold">
                  {champ?.name} {tie ? "empata e leva no desempate" : "é campeão"}
                </p>
                {tie && <p className="text-xs text-muted">Empate em pontos: decide o número de vitórias, depois de 2º lugares…</p>}
              </>
            )}
            {result.duplicates.length > 0 && (
              <p role="alert" className="mt-2 text-xs text-warn">
                Posição repetida: {result.duplicates.slice(0, 2).join("; ")}
                {result.duplicates.length > 2 ? "…" : ""}
              </p>
            )}
          </div>
          <h3 className="mb-2 mt-5 text-xs font-semibold uppercase tracking-widest text-faint">{result.any ? "Classificação final" : "Classificação de hoje"}</h3>
          <ol className="space-y-2">
            {(result.any ? result.totals : contenders.map((c) => ({ ...c, final: c.points }))).map((t, i) => (
              <li key={t.id} className="flex items-center gap-3">
                <span className="w-5 text-right font-display font-bold tabular">{i + 1}</span>
                <span className="h-7 w-[3px] rounded-full" style={{ background: t.color }} aria-hidden="true" />
                <span className="flex-1 font-semibold">{t.name}</span>
                <span className="font-display text-lg font-bold tabular">
                  {t.final}
                  <span className="ml-1 text-xs font-normal text-faint">pts</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
