// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import Link from "next/link";
import { localePath, type Locale } from "@/i18n/config";
import type { Dict } from "@/i18n/types";
import { site } from "@/lib/site";

/** O desenho da câmera do Instagram, em traço, na cor do texto ao redor. */
export function InstagramIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" />
    </svg>
  );
}

export function Footer({ lang, t }: { lang: Locale; t: Dict }) {
  const columns = [
    {
      title: t.footer.learn,
      links: [
        [t.nav.disciplines, "/trilhas"],
        [t.nav.library, "/acervo"],
        [t.nav.start, "/comecar"],
        [t.nav.tools, "/ferramentas"],
        [t.nav.labs, "/laboratorios"],
        [t.nav.glossary, "/glossario"],
        [t.nav.questions, "/perguntas"],
        [t.nav.tutoring, "/reforco"],
        [t.nav.authors, "/autores"],
      ],
    },
    {
      title: t.footer.community,
      links: [
        [t.nav.volunteers, "/voluntarios"],
        [t.nav.contribute, "/contribuir"],
        [t.nav.community, "/comunidade"],
        [t.nav.journal, "/jornal"],
        [t.nav.podcasts, "/podcasts"],
        [t.nav.news, "/noticias"],
        [t.nav.mural, "/mural"],
        [t.nav.health, "/saude"],
        [t.nav.rightsGuide, "/direitos"],
        [t.nav.materials, "/materiais"],
        [t.nav.factCheck, "/checagens"],
        [t.nav.debates, "/debates"],
      ],
    },
    {
      title: t.footer.project,
      links: [
        [t.nav.about, "/sobre"],
        [t.nav.institute, "/instituto"],
        [t.nav.team, "/quem-somos"],
        [t.nav.dedication, "/dedicatoria"],
        [t.nav.memorial, "/memorial"],
        [t.nav.timeline, "/linha-do-tempo"],
        [t.nav.gallery, "/galeria"],
        [t.nav.support, "/apoie"],
        [t.nav.myData, "/meus-dados"],
        [t.nav.privacy, "/privacidade"],
        [t.nav.terms, "/termos"],
        [t.nav.usePolicy, "/uso"],
        [t.nav.conduct, "/conduta"],
        [t.nav.copyright, "/direitos-autorais"],
        [t.nav.contributors, "/contribuidores"],
        [t.nav.reportContent, "/denunciar"],
        [t.nav.reportBug, "/relatar-erro"],
      ],
    },
  ];

  // No celular, dentro do aplicativo, o rodapé some: tudo o que ele lista está em "Mais".
  return (
    <footer className="rodape-do-site no-print no-focus mt-20 border-t-[3px] border-ink bg-parchment app:max-md:hidden pb-[calc(4rem+var(--recuo-baixo))] md:pb-0">
      <div className="mx-auto grid max-w-[78rem] gap-10 px-4 py-12 font-sans text-sm sm:grid-cols-2 sm:px-6 lg:grid-cols-[1.3fr_1fr_1fr_1fr] lg:px-8">
        <div>
          <Link href={localePath(lang, "/")} className="flex items-center gap-3 text-ink hover:text-ink">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/marca-96.png" alt="" width={44} height={44} className="h-11 w-11" loading="lazy" />
            <span className="font-serif text-[1.65rem] font-semibold leading-none">{site.name}</span>
          </Link>
          <p className="mt-3 font-serif text-lg leading-snug text-ink-soft">{t.footer.tagline}</p>
          <p className="mt-4 font-serif text-lg italic text-prelo-texto">{t.footer.slogan}</p>
          <a href={site.instagram} target="_blank" rel="noopener noreferrer me" className="botao botao-papel botao-menor mt-5">
            <InstagramIcon />
            <span>
              {t.footer.instagram} <span className="font-mono text-xs font-normal">@institutoluciaorg</span>
            </span>
          </a>
        </div>
        {columns.map((column) => (
          <nav key={column.title} aria-label={column.title}>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink">{column.title}</p>
            <ul className="mt-3 space-y-2 border-t-2 border-ink pt-3 text-ink-soft">
              {column.links.map(([label, href]) => (
                <li key={href}>
                  <Link href={localePath(lang, href)} className="hover:text-prelo-texto hover:underline">{label}</Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <p className="border-t-2 border-ink px-4 py-4 text-center font-mono text-xs text-ink-soft">
        {t.footer.legal}
        {" · "}
        <Link href={localePath(lang, "/entrar")} rel="nofollow" className="underline hover:text-prelo-texto">
          {t.footer.team}
        </Link>
      </p>
    </footer>
  );
}
