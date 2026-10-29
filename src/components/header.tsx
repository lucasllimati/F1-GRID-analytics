import { AdminStatus } from "./admin-status";
import { Logo } from "./logo";
import { NavLinks } from "./nav-links";
import { ThemeToggle } from "./theme-toggle";
import { TimezonePicker } from "./timezone";

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/90 backdrop-blur supports-[backdrop-filter]:bg-bg/75">
      <div className="h-0.5 w-full bg-accent" aria-hidden="true" />
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
        <Logo />
        <nav aria-label="Principal" className="hidden flex-1 xl:block">
          <ul className="flex items-center gap-0.5">
            <NavLinks variant="desktop" />
          </ul>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <AdminStatus />
          <TimezonePicker />
          <ThemeToggle />
        </div>
      </div>
      <nav aria-label="Principal (móvel)" className="border-t border-line xl:hidden">
        <ul className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-2 py-1.5">
          <NavLinks variant="mobile" />
        </ul>
      </nav>
    </header>
  );
}
