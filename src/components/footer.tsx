import Link from "next/link";
import { Logo } from "./logo";

// Lista própria (o menu principal vive num componente de cliente).
const SECTIONS: [string, string][] = [
  ["/race-center", "Race Center"],
  ["/calendar", "Calendário"],
  ["/results", "Resultados"],
  ["/standings", "Classificação"],
  ["/championship-probabilities", "Probabilidades"],
  ["/head-to-head", "Comparar"],
  ["/news", "Notícias"],
];

export function Footer() {
  return (
    <footer className="mt-24 border-t border-line">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 md:grid-cols-5">
        <div className="md:col-span-2">
          <Logo />
          <p className="mt-3 max-w-md text-sm text-muted">
            Formula 1, decoded. Site independente, sem vínculo com a Formula One Group, a FIA ou as equipes. Marcas citadas
            pertencem a seus titulares.
          </p>
        </div>
        <nav aria-label="Seções do site">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted">Explorar</h2>
          <ul className="space-y-2 text-sm">
            {SECTIONS.map(([href, label]) => (
              <li key={href}>
                <Link className="hover:text-accent" href={href}>
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted">Transparência</h2>
          <ul className="space-y-2 text-sm">
            <li><Link className="hover:text-accent" href="/methodology">Metodologia</Link></li>
            <li><Link className="hover:text-accent" href="/sources">Fontes e política editorial</Link></li>
            <li><Link className="hover:text-accent" href="/about">Sobre</Link></li>
            <li><Link className="hover:text-accent" href="/privacy">Privacidade</Link></li>
          </ul>
        </div>
        <div>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted">Assine</h2>
          <ul className="space-y-2 text-sm">
            <li><a className="hover:text-accent" href="/feed.xml">RSS das notícias</a></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-line py-4 text-center text-xs text-faint">
        Dados esportivos: Jolpica-F1 API. Notícias: redação própria com atribuição às fontes originais.
      </div>
    </footer>
  );
}
