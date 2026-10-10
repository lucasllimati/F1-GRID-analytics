"use client";

import { useMemo, useState } from "react";

export type Column = { key: string; label: string; numeric?: boolean };
export type Row = Record<string, string | number | null> & { _id: string; _flag?: string | null };

/** Tabela com ordenação, busca, paginação e exportação CSV (dados de origem aberta). */
export function ResultsTable({
  columns,
  rows,
  caption,
  filename,
  pageSize = 30,
}: {
  columns: Column[];
  rows: Row[];
  caption: string;
  filename: string;
  pageSize?: number;
}) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);
  const [page, setPage] = useState(0);

  const view = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let out = needle
      ? rows.filter((r) => columns.some((c) => String(r[c.key] ?? "").toLowerCase().includes(needle)))
      : [...rows];
    if (sort) {
      out = out.sort((a, b) => {
        const av = a[sort.key];
        const bv = b[sort.key];
        if (av === null || av === undefined || av === "") return 1; // vazios sempre ao fim
        if (bv === null || bv === undefined || bv === "") return -1;
        if (typeof av === "number" && typeof bv === "number") return (av - bv) * sort.dir;
        return String(av).localeCompare(String(bv), "pt-BR", { numeric: true }) * sort.dir;
      });
    }
    return out;
  }, [rows, q, sort, columns]);

  const pages = Math.max(1, Math.ceil(view.length / pageSize));
  const shown = view.slice(page * pageSize, page * pageSize + pageSize);

  const exportCsv = () => {
    const esc = (v: unknown) => {
      const s = String(v ?? "");
      // Neutraliza fórmulas em planilhas (CSV injection).
      const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
      return /[",\n;]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
    };
    const csv = [columns.map((c) => esc(c.label)).join(","), ...view.map((r) => columns.map((c) => esc(r[c.key])).join(","))].join("\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label className="text-xs text-muted">
          <span className="sr-only">Buscar</span>
          <input
            type="search"
            placeholder="Buscar piloto, equipe, status…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(0);
            }}
            className="w-64 rounded border border-line bg-bg px-2.5 py-1.5 text-sm text-fg"
          />
        </label>
        <button type="button" onClick={exportCsv} className="ml-auto rounded border border-line px-2.5 py-1.5 text-xs text-muted hover:text-fg">
          Exportar CSV
        </button>
      </div>
      <div className="overflow-x-auto rounded-md border border-line">
        <table className="data-table">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              {columns.map((c) => {
                const active = sort?.key === c.key;
                return (
                  <th key={c.key} scope="col" className={c.numeric ? "num" : ""} aria-sort={active ? (sort!.dir === 1 ? "ascending" : "descending") : "none"}>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 uppercase hover:text-fg"
                      onClick={() => setSort(active ? { key: c.key, dir: sort!.dir === 1 ? -1 : 1 } : { key: c.key, dir: 1 })}
                    >
                      {c.label}
                      <span aria-hidden="true">{active ? (sort!.dir === 1 ? "▲" : "▼") : "↕"}</span>
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r._id}>
                {columns.map((c) => (
                  <td key={c.key} className={c.numeric ? "num" : ""}>
                    {r[c.key] ?? <span className="text-faint">—</span>}
                  </td>
                ))}
              </tr>
            ))}
            {shown.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="py-6 text-center text-muted">
                  Nada encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <nav className="mt-3 flex items-center gap-2 text-sm" aria-label="Paginação">
          <button type="button" disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="rounded border border-line px-2 py-1 disabled:opacity-40">
            Anterior
          </button>
          <span className="text-muted">
            Página {page + 1} de {pages}
          </span>
          <button
            type="button"
            disabled={page >= pages - 1}
            onClick={() => setPage((p) => p + 1)}
            className="rounded border border-line px-2 py-1 disabled:opacity-40"
          >
            Próxima
          </button>
        </nav>
      )}
    </div>
  );
}
