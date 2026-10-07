import Link from "next/link";
import { localePath, type Locale } from "@/i18n/config";
import type { Dict } from "@/i18n/pt";
import { repoUrl, site } from "@/lib/site";

export function Footer({ lang, t }: { lang: Locale; t: Dict }) {
  const columns = [
    {
      title: t.footer.learn,
      links: [
        [t.nav.tracks, "/trilhas"],
        [t.nav.library, "/acervo"],
        [t.nav.authors, "/autores"],
        [t.nav.glossary, "/glossario"],
        [t.nav.timeline, "/linha-do-tempo"],
      ],
    },
    {
      title: t.footer.community,
      links: [
        [t.nav.volunteers, "/voluntarios"],
        [t.nav.contribute, "/contribuir"],
        [t.nav.moderation, "/moderacao"],
        [t.nav.history, "/historico"],
        [t.nav.memorial, "/memorial"],
      ],
    },
    {
      title: t.footer.project,
      links: [
        [t.nav.about, "/sobre"],
        [t.nav.dedication, "/dedicatoria"],
        [t.nav.myData, "/meus-dados"],
        [t.nav.reportContent, "/denunciar"],
        [t.nav.code, repoUrl],
      ],
    },
  ];

  return (
    <footer className="no-print no-focus mt-20 border-t border-rule">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 font-sans text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="font-serif text-2xl font-semibold">{site.name}</p>
          <p className="mt-2 text-ink-soft">{t.footer.tagline}</p>
          <p className="mt-4 font-serif text-lg italic text-oxblood">{t.footer.slogan}</p>
        </div>
        {columns.map((column) => (
          <nav key={column.title} aria-label={column.title}>
            <p className="font-mono text-xs uppercase tracking-widest text-gold">{column.title}</p>
            <ul className="mt-3 space-y-2 text-ink-soft">
              {column.links.map(([label, href]) => (
                <li key={href}>
                  {href.startsWith("/") ? (
                    <Link href={localePath(lang, href)} className="hover:text-oxblood">{label}</Link>
                  ) : (
                    <a href={href} target="_blank" rel="noopener noreferrer" className="hover:text-oxblood">{label} ↗</a>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <p className="border-t border-rule px-4 py-4 text-center font-mono text-xs text-ink-soft">{t.footer.legal}</p>
    </footer>
  );
}
