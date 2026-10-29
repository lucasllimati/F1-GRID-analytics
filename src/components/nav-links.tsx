"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = { href: string; label: string; match?: string[]; exclude?: RegExp };

/**
 * Itens do menu principal. A página de uma etapa (/calendar/2026/17) é o Race Center:
 * por isso "Calendário" só fica ativo na lista do calendário, não nas etapas.
 */
export const NAV: NavItem[] = [
  { href: "/race-center", label: "Race Center", match: ["/calendar/"] },
  { href: "/calendar", label: "Calendário", exclude: /^\/calendar\/\d{4}\/\d+/ },
  { href: "/schedule", label: "Horários" },
  { href: "/results", label: "Resultados" },
  { href: "/standings", label: "Classificação" },
  { href: "/championship-probabilities", label: "Título" },
  { href: "/head-to-head", label: "Comparar" },
  { href: "/records", label: "Recordes" },
  { href: "/recaps", label: "Resumos" },
  { href: "/news", label: "Notícias" },
];

/** Seção atual: rota exata, subrota ou prefixo extra (`match`), respeitando `exclude`. */
export function isActive(pathname: string, item: NavItem): boolean {
  if (item.exclude?.test(pathname)) return false;
  if (pathname === item.href || pathname.startsWith(`${item.href}/`)) return true;
  return (item.match ?? []).some((p) => (p.endsWith("/") ? pathname.startsWith(p) && pathname.length > p.length : pathname === p || pathname.startsWith(`${p}/`)));
}

export function NavLinks({ variant }: { variant: "desktop" | "mobile" }) {
  const pathname = usePathname() ?? "/";
  return (
    <>
      {NAV.map((n) => {
        const active = isActive(pathname, n);
        const base =
          variant === "desktop"
            ? "relative rounded px-3 py-2 text-sm font-medium hover:bg-elev-2 hover:text-fg"
            : "relative block rounded px-3 py-1.5 text-sm hover:text-fg";
        return (
          <li key={n.href} className={variant === "mobile" ? "shrink-0" : undefined}>
            <Link href={n.href} aria-current={active ? "page" : undefined} className={`${base} ${active ? "text-fg" : "text-muted"}`}>
              {n.label}
              {active && (
                <span
                  className={`absolute inset-x-3 h-0.5 bg-accent ${variant === "desktop" ? "-bottom-[13px]" : "bottom-0"}`}
                  aria-hidden="true"
                />
              )}
            </Link>
          </li>
        );
      })}
    </>
  );
}
