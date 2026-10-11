import Link from "next/link";
import { AdminStatus } from "./admin-status";
import { Logo } from "./logo";
import { ThemeToggle } from "./theme-toggle";
import { TimezonePicker } from "./timezone";

export const NAV = [
  { href: "/race-center", label: "Race Center" },
  { href: "/calendar", label: "Calendário" },
  { href: "/results", label: "Resultados" },
  { href: "/standings", label: "Classificação" },
  { href: "/championship-probabilities", label: "Probabilidades" },
  { href: "/head-to-head", label: "Comparar" },
  { href: "/news", label: "Notícias" },
];

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/90 backdrop-blur supports-[backdrop-filter]:bg-bg/75">
      <div className="h-0.5 w-full bg-accent" aria-hidden="true" />
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
        <Logo />
        <nav aria-label="Principal" className="hidden flex-1 lg:block">
          <ul className="flex items-center gap-1">
            {NAV.map((n) => (
              <li key={n.href}>
                <Link href={n.href} className="rounded px-3 py-2 text-sm font-medium text-muted hover:bg-elev-2 hover:text-fg">
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <AdminStatus />
          <TimezonePicker />
          <ThemeToggle />
        </div>
      </div>
      <nav aria-label="Principal (móvel)" className="border-t border-line lg:hidden">
        <ul className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-2 py-1.5">
          {NAV.map((n) => (
            <li key={n.href} className="shrink-0">
              <Link href={n.href} className="block rounded px-3 py-1.5 text-sm text-muted hover:text-fg">
                {n.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
