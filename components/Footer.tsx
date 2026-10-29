// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import Link from "@/components/Link";
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

/**
 * O pé do site, arrumado como a janela do "Mais": quatro colunas curtas, por objetivo, e as regras e os dados da
 * pessoa numa linha miúda embaixo. Nada saiu, só mudou de lugar. Fecha com a onda do calçadão e a faixa preta.
 */
export function Footer({ lang, t }: { lang: Locale; t: Dict }) {
  const columns = [
    {
      title: t.footer.learn,
      links: [
        [t.nav.disciplines, "/trilhas"],
        [t.nav.library, "/acervo"],
        [t.nav.start, "/comecar"],
        [t.nav.questions, "/perguntas"],
        [t.nav.tools, "/ferramentas"],
        [t.nav.labs, "/laboratorios"],
        [t.nav.glossary, "/glossario"],
        [t.nav.tutoring, "/reforco"],
        [t.nav.authors, "/autores"],
      ],
    },
    {
      title: t.footer.inform,
      links: [
        [t.nav.journal, "/jornal"],
        [t.nav.news, "/noticias"],
        [t.nav.podcasts, "/podcasts"],
        [t.nav.factCheck, "/checagens"],
        [t.nav.debates, "/debates"],
        [t.nav.health, "/saude"],
        [t.nav.rightsGuide, "/direitos"],
        [t.nav.mural, "/mural"],
        [t.nav.materials, "/materiais"],
      ],
    },
    {
      title: t.footer.join,
      links: [
        [t.nav.community, "/comunidade"],
        [t.nav.volunteers, "/voluntarios"],
        [t.nav.contribute, "/contribuir"],
        [t.nav.support, "/apoie"],
        [t.nav.contributors, "/contribuidores"],
      ],
    },
    {
      title: t.footer.institute,
      links: [
        [t.nav.dedication, "/dedicatoria"],
        [t.nav.about, "/sobre"],
        [t.nav.institute, "/instituto"],
        [t.nav.team, "/quem-somos"],
        [t.nav.memorial, "/memorial"],
        [t.nav.timeline, "/linha-do-tempo"],
        [t.nav.gallery, "/galeria"],
      ],
    },
  ];
  // As regras do site e os dados da pessoa: na linha miúda, como no pé da janela do "Mais".
  const regras = [
    [t.nav.myData, "/meus-dados"],
    [t.nav.privacy, "/privacidade"],
    [t.nav.terms, "/termos"],
    [t.nav.usePolicy, "/uso"],
    [t.nav.conduct, "/conduta"],
    [t.nav.copyright, "/direitos-autorais"],
    [t.nav.reportContent, "/denunciar"],
    [t.nav.reportBug, "/relatar-erro"],
  ];

  // No celular, dentro do aplicativo, o rodapé some: tudo o que ele lista está em "Mais".
  return (
    <footer className="rodape-do-site no-print no-focus mt-20 border-t-[3px] border-ink bg-parchment app:max-md:hidden">
      <div className="mx-auto grid max-w-[78rem] gap-x-9 gap-y-10 px-4 pt-12 pb-10 font-sans text-sm sm:grid-cols-2 sm:px-6 lg:grid-cols-[1.25fr_1fr_1fr_0.85fr_1fr] lg:px-8">
        <div className="sm:col-span-2 lg:col-span-1">
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
        {columns.map((column, i) => (
          <nav key={column.title} aria-label={column.title}>
            <p className={`border-b-2 pb-1.5 font-mono text-[0.72rem] uppercase tracking-[0.18em] ${i === 1 ? "border-[#c21f16] text-prelo-texto" : "border-ink text-ink"}`}>{column.title}</p>
            <ul className="mt-2.5 text-ink-soft">
              {column.links.map(([label, href]) => (
                <li key={href}>
                  <Link href={localePath(lang, href)} className="block py-[0.3rem] text-[0.92rem] text-ink underline-offset-4 hover:text-prelo-texto hover:underline">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <nav aria-label={t.footer.rules} className="mx-auto max-w-[78rem] px-4 pb-6 sm:px-6 lg:px-8">
        <ul className="flex flex-wrap justify-center gap-x-5 gap-y-1.5 border-t border-rule pt-4 font-sans text-[0.8rem] text-ink-soft">
          {regras.map(([label, href]) => (
            <li key={href}>
              <Link href={localePath(lang, href)} className="text-ink-soft hover:text-prelo-texto hover:underline">
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {/* A onda do calçadão e a faixa preta do pé, como a pedra portuguesa do chão. */}
      <div aria-hidden className="onda-do-calcadao" />
      {/* A assinatura em cima, no centro, e o texto legal embaixo: as duas linhas centradas, sem nada caindo de lado. */}
      <div className="bg-[#1f1a14] pb-[calc(4rem+var(--recuo-baixo))] text-[#e9dcbc] md:pb-0">
        <div className="mx-auto flex max-w-[78rem] flex-col items-center gap-1.5 px-4 py-4 text-center font-mono text-xs sm:px-6 lg:px-8">
          <span className="uppercase tracking-[0.18em] text-[#f0b323]">{t.footer.made}</span>
          <p className="text-balance">
            {t.footer.legal}
            {" · "}
            <Link href={localePath(lang, "/entrar")} rel="nofollow" className="text-[#e9dcbc] underline hover:text-white">
              {t.footer.team}
            </Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
