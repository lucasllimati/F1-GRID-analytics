"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = { href: string; label: string; match?: string[] };

/** Seção atual: rota exata ou subrota (ex.: /calendar/2026/17 ativa "Calendário"). */
export function isActive(pathname: string, item: NavItem): boolean {
  const prefixes = [item.href, ...(item.match ?? [])];
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function NavLinks({ items, variant }: { items: NavItem[]; variant: "desktop" | "mobile" }) {
  const pathname = usePathname() ?? "/";
  return (
    <>
      {items.map((n) => {
        const active = isActive(pathname, n);
        const base =
          variant === "desktop"
            ? "relative rounded px-3 py-2 text-sm font-medium hover:bg-elev-2 hover:text-fg"
            : "relative block rounded px-3 py-1.5 text-sm hover:text-fg";
        return (
          <li key={n.href} className={variant === "mobile" ? "shrink-0" : undefined}>
            <Link
              href={n.href}
              aria-current={active ? "page" : undefined}
              className={`${base} ${active ? "text-fg" : "text-muted"}`}
            >
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
