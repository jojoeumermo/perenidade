import Link from "next/link";
import { repoUrl } from "@/lib/site";

const columns = [
  {
    title: "Aprender",
    links: [
      ["Trilhas", "/trilhas"],
      ["Acervo", "/acervo"],
      ["Buscar", "/busca"],
    ],
  },
  {
    title: "Comunidade",
    links: [
      ["Contribuir", "/contribuir"],
      ["Fila de moderação", "/moderacao"],
      ["Histórico do acervo", "/historico"],
    ],
  },
  {
    title: "Projeto",
    links: [
      ["Sobre e licenças", "/sobre"],
      ["Denunciar conteúdo", "/denunciar"],
      ["Código no GitHub", repoUrl],
    ],
  },
] as const;

export function Footer() {
  return (
    <footer className="no-print mt-20 border-t border-rule">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 font-sans text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="font-serif text-2xl font-semibold">Perenidade</p>
          <p className="mt-2 text-ink-soft">Conhecimento livre, para todos, para sempre.</p>
        </div>
        {columns.map((column) => (
          <nav key={column.title} aria-label={column.title}>
            <p className="font-mono text-xs uppercase tracking-widest text-gold">{column.title}</p>
            <ul className="mt-3 space-y-2 text-ink-soft">
              {column.links.map(([label, href]) => (
                <li key={href}>
                  {href.startsWith("/") ? (
                    <Link href={href} className="hover:text-oxblood">{label}</Link>
                  ) : (
                    <a href={href} target="_blank" rel="noopener noreferrer" className="hover:text-oxblood">{label} ↗</a>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <p className="border-t border-rule px-4 py-4 text-center font-mono text-xs text-ink-soft">
        Aulas sob CC BY-SA 4.0 · Só domínio público, licenças abertas e texto da comunidade · Nenhum arquivo de terceiros é hospedado aqui
      </p>
    </footer>
  );
}
