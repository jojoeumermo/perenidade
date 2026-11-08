// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import Image from "next/image";
import Link from "@/components/Link";
import { CapaDaEdicao } from "@/components/Territorios";
import { IDENTIDADES } from "@/lib/territorios-identidades";
import { originalLang } from "@/components/Untranslated";
import { loadLang } from "@/i18n";
import { localePath } from "@/i18n/config";
import { paginaMeta } from "@/lib/seo";
import { site } from "@/lib/site";
import { territorios } from "@/lib/territorios";

export async function generateMetadata({ params }: PageProps<"/[lang]/territorios">): Promise<Metadata> {
  const { lang, t } = await loadLang(params);
  return paginaMeta(lang, "/territorios", t.territorios.title, t.territorios.lead);
}

/** Os coletivos que caminham com o instituto, cada um com a capa de uma edição, e o convite para o próximo chegar. */
export default async function Territorios({ params }: PageProps<"/[lang]/territorios">) {
  const { lang, t } = await loadLang(params);
  const s = t.territorios;
  const to = (path: string) => localePath(lang, path);

  return (
    <div className="mx-auto max-w-[78rem] px-4 pt-8 pb-16 sm:px-6 lg:px-8">
      <header className="border-b-[3px] border-ink pb-5">
        <p className="rotulo">{s.eyebrow}</p>
        <h1 className="mt-2 font-serif text-[3.4rem] font-semibold leading-none sm:text-[4.4rem]">{s.title}</h1>
        <p className="mt-4 max-w-3xl font-serif text-xl leading-relaxed text-ink-soft">{s.lead}</p>
      </header>

      {/* Sem faixa corrida na abertura (pedido da coordenação, 05/11/2026): os temas andam dentro de cada território. */}
      <ul className="mt-10 grid gap-8">
        {territorios.map((territorio) => (
          <li key={territorio.slug} className="grid items-center gap-8 border-2 border-ink bg-folha p-6 shadow-[6px_6px_0_var(--sombra)] md:grid-cols-[minmax(0,1fr)_16rem]" {...originalLang(lang === "pt")}>
            <div className="min-w-0">
              <p className="font-mono text-[0.68rem] uppercase tracking-[0.2em] text-prelo-texto">{s.partner.replace("{n}", String(territorio.numero).padStart(2, "0"))}</p>
              <h2 className="mt-2 font-serif text-[2.8rem] font-semibold leading-none">{territorio.nome}</h2>
              <p className="mt-3 text-lg font-semibold">{territorio.linha}</p>
              <p className="mt-2 max-w-2xl leading-relaxed text-ink-soft">{territorio.sobre}</p>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <Link href={to(`/territorios/${territorio.slug}`)} className="botao botao-prelo">{s.open}</Link>
                <a href={`https://www.instagram.com/${territorio.instagram}/`} className="font-mono text-sm font-semibold text-ink hover:text-prelo-texto" rel="noopener noreferrer" target="_blank">
                  @{territorio.instagram}
                </a>
              </div>
            </div>
            {/* A logo vem antes da capa da edição: desde 08/11/2026 o cartão do Na Atividade também mostra a logo. */}
            {territorio.logo ? (
              /* A logo do coletivo (cedida pela parceria), como na abertura da página dele. */
              <Link href={to(`/territorios/${territorio.slug}`)} tabIndex={-1} aria-hidden className="block w-full max-md:max-w-[15rem]">
                <Image src={territorio.logo.src} alt="" width={480} height={480} sizes="(min-width: 768px) 16rem, 15rem" className="aspect-square h-auto w-full border-[1.5px] border-ink object-cover shadow-[6px_6px_0_var(--sombra)]" />
                <span className="mt-1.5 block font-sans text-[0.7rem] text-ink-soft">{territorio.logo.credito}</span>
              </Link>
            ) : territorio.edicoes[0] ? (
              <div className="w-full max-md:max-w-[15rem]">
                <CapaDaEdicao edicao={territorio.edicoes[0]} perfil={territorio.instagram} assinatura={s.byCollective} />
              </div>
            ) : territorio.capa ? (
              <Link href={to(`/territorios/${territorio.slug}`)} tabIndex={-1} aria-hidden className="block w-full max-md:max-w-[15rem]">
                <Image src={territorio.capa.src} alt="" width={640} height={800} sizes="(min-width: 768px) 16rem, 15rem" className="aspect-[4/5] h-auto w-full border-[1.5px] border-ink object-cover shadow-[6px_6px_0_var(--sombra)]" />
              </Link>
            ) : (
              territorio.visual && (
                <div
                  aria-hidden
                  className="flex aspect-[4/5] w-full flex-col justify-end border-[1.5px] border-ink p-4 shadow-[6px_6px_0_var(--sombra)] max-md:max-w-[15rem]"
                  style={{ backgroundColor: IDENTIDADES[territorio.visual].fundo, color: IDENTIDADES[territorio.visual].tinta }}
                >
                  <span className="font-mono text-[0.6rem] uppercase tracking-[0.2em]" style={{ color: IDENTIDADES[territorio.visual].destaque }}>@{territorio.instagram}</span>
                  <span className="mt-2 font-serif text-[2rem] font-black leading-[0.95]">{territorio.nome}</span>
                </div>
              )
            )}
          </li>
        ))}
      </ul>

      <section className="mt-14 border-2 border-dashed border-ink p-6 sm:p-8">
        <h2 className="max-w-3xl font-serif text-[1.9rem] font-semibold leading-tight text-balance">{s.nextTitle}</h2>
        <p className="mt-3 max-w-2xl text-ink-soft">{s.nextText}</p>
        <p className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2">
          <a href={`mailto:${site.newsletter}?subject=${encodeURIComponent(s.nextCta)}`} className="botao botao-papel">{s.nextCta}</a>
          <span className="font-mono text-sm select-all">{site.newsletter}</span>
          <a href={site.instagram} className="font-mono text-sm font-semibold hover:text-prelo-texto" rel="noopener noreferrer" target="_blank">@{site.instagramUser}</a>
        </p>
      </section>
    </div>
  );
}
