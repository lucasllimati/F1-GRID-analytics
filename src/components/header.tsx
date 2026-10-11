import { AdminStatus } from "./admin-status";
import { Logo } from "./logo";
import { NavLinks, type NavItem } from "./nav-links";
import { ThemeToggle } from "./theme-toggle";
import { TimezonePicker } from "./timezone";

export const NAV: NavItem[] = [
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
            <NavLinks items={NAV} variant="desktop" />
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
          <NavLinks items={NAV} variant="mobile" />
        </ul>
      </nav>
    </header>
  );
}
