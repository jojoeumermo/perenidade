// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import Link from "@/components/Link";
import { SourceList } from "@/components/Cards";
import { Markdown } from "@/components/Markdown";
import { Capa, Corpo, Secao } from "@/components/pagina/Capa";
import { ChecagensAgrupadas } from "@/components/critica/ChecagensAgrupadas";
import { ComoChecar } from "@/components/ComoChecar";
import { FactCheckSearch } from "@/components/FactCheckSearch";
import { originalLang, Untranslated } from "@/components/Untranslated";
import { loadLang } from "@/i18n";
import { paginaMeta } from "@/lib/seo";
import { fill, localePath } from "@/i18n/config";
import { factCheckThemes, getCheckTools, getFactChecks, verdicts } from "@/lib/content";

export async function generateMetadata({ params }: PageProps<"/[lang]/checagens">): Promise<Metadata> {
  const { lang, t } = await loadLang(params);
  return paginaMeta(lang, "/checagens", t.factCheck.title, t.factCheck.lead);
}

// Os carimbos da capa, tortos como num mural de redação: cada selo numa inclinação.
const inclinacoes = ["-rotate-6", "rotate-3", "-rotate-2", "rotate-6"];

/**
 * A checagem de fatos no desenho do Caderno do Povo: a capa preta com o cartaz dos carimbos, o sumário da página, a busca
 * nas agências, o que quer dizer cada selo, as checagens publicadas agrupadas por tema (cada uma fechada, com a resposta
 * curta à vista), o passo a passo para checar sozinho e a caixa de ferramentas.
 */
export default async function Checagens({ params }: PageProps<"/[lang]/checagens">) {
  const { lang, t } = await loadLang(params);
  const s = t.factCheck;
  const checks = getFactChecks(lang);
  const toolbox = s.toolbox;
  const groups = toolbox.groups as Record<string, string[]>;
  const toolText = toolbox.tools as Record<string, string>;
  const seals = s.verdicts.items as Record<string, string>;
  return (
    <>
      <Capa
        tom="preto"
        estrela
        rotulo={s.eyebrow}
        titulo={s.title}
        acoes={
          <>
            <a href="#como-checar" className="botao botao-prelo">
              {s.startCheck} →
            </a>
            <Link href={localePath(lang, "/falacias")} className="font-sans font-bold text-[#f4ecd8] underline decoration-[#c21f16] decoration-2 underline-offset-4 hover:text-white">
              {s.fallaciesLink}
            </Link>
          </>
        }
        lado={
          <div className="cartao relative mx-auto max-w-sm -rotate-1 p-7 text-ink max-md:hidden">
            <p className="rotulo">{fill(s.published, { n: checks.length })}</p>
            <p className="lambe mt-3 text-[2.1rem]">{t.slogans.checagens}</p>
            <ul className="mt-6 flex flex-wrap gap-x-4 gap-y-5" lang="pt-BR">
              {verdicts.map((verdict, i) => (
                <li key={verdict} className={`jornal-carimbo text-base ${inclinacoes[i % inclinacoes.length]}`}>
                  {verdict}
                </li>
              ))}
            </ul>
          </div>
        }
      >
        {s.lead}
      </Capa>

      <Corpo largura="media" className="flex flex-col gap-16 max-md:gap-12">
        <nav aria-label={s.onThisPage} className="no-print -mb-6 flex flex-wrap items-baseline gap-x-5 gap-y-2 border-y-2 border-ink py-3 font-sans text-sm max-md:-mb-4">
          <span className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-ink-soft">{s.onThisPage}</span>
          {[
            ["#ja-foi-checado", s.searchTitle],
            ["#selos", s.verdicts.title],
            ["#checagens", `${s.checksTitle} (${checks.length})`],
            ["#como-checar", s.steps.title],
            ["#ferramentas-de-checagem", toolbox.title],
          ].map(([href, nome]) => (
            <a key={href} href={href} className="font-semibold underline decoration-rule underline-offset-4 hover:decoration-[#c21f16]">
              {nome}
            </a>
          ))}
        </nav>

        <FactCheckSearch s={s} />

        <Secao titulo={s.verdicts.title} tarja="vermelha" id="selos">
          <dl className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {verdicts.map((verdict, i) => (
              <div key={verdict} className={`${i % 2 ? "cartao-v" : "cartao"} flex flex-col p-5`}>
                <dt className="jornal-carimbo self-start text-lg" lang="pt-BR">
                  {verdict}
                </dt>
                <dd className="mt-4 text-lg leading-snug">{seals[verdict]}</dd>
              </div>
            ))}
          </dl>
        </Secao>

        <Secao titulo={s.checksTitle} id="checagens">
          <Untranslated lang={lang} t={t} show={checks.some((check) => !check.translated)} />
          {checks.length === 0 ? (
            <p className="text-xl text-ink-soft">{s.empty}</p>
          ) : (
            <ChecagensAgrupadas
              s={s}
              temas={factCheckThemes}
              vereditos={verdicts}
              itens={checks.map((check) => ({
                id: check.slug,
                tema: check.theme,
                veredito: check.verdict,
                chaves: `${check.claim} ${check.title ?? ""} ${check.verdict} ${check.body}`,
                node: (
                  <article key={check.slug} className="cartao p-6 pt-14 sm:p-8 sm:pt-14" {...originalLang(check.translated)}>
                    <p className="rotulo">{s.claim}</p>
                    <h4 className="mt-3 font-serif text-[1.6rem] font-semibold leading-[1.12] text-balance sm:text-[2rem]">“{check.claim}”</h4>
                    <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3">
                      <p className="jornal-carimbo text-lg">{check.verdict}</p>
                      {check.title && (
                        <p className="min-w-0 flex-1 font-serif text-xl leading-snug">
                          <span className="rotulo mr-2 align-[2px]">{s.shortAnswer}</span>
                          {check.title}
                          {/[.!?]$/.test(check.title) ? "" : "."}
                        </p>
                      )}
                    </div>
                    <details className="checagem-completa mt-6 border-t-2 border-ink pt-4">
                      <summary className="checagem-abrir">{fill(s.readFull, { n: Math.max(1, Math.round(check.body.split(/\s+/).length / 200)) })}</summary>
                      <div className="mt-5">
                        <Markdown lang={lang}>{check.body}</Markdown>
                        <SourceList sources={check.sources} title={t.common.sources} />
                      </div>
                    </details>
                  </article>
                ),
              }))}
            />
          )}
        </Secao>

        <ComoChecar s={s.steps} />

        <Secao titulo={toolbox.title} tarja="vermelha" id="ferramentas-de-checagem" descricao={toolbox.lead}>
          <div className="grid gap-7 sm:grid-cols-2">
            {getCheckTools().map(({ group, tools }, i) => (
              <section key={group} aria-labelledby={`grupo-${group}`} className={`${i % 3 === 1 ? "cartao-v" : "cartao"} p-6`}>
                <h3 id={`grupo-${group}`} className="font-serif text-2xl font-semibold leading-tight">
                  {groups[group]?.[0] ?? group}
                </h3>
                <p className="mt-1.5 text-ink-soft">{groups[group]?.[1]}</p>
                <ul className="mt-4 flex flex-col border-t-2 border-ink font-sans">
                  {tools.map((tool) => (
                    <li key={tool.id} className="border-b-[1.5px] border-dashed border-rule py-3 last:border-b-0">
                      <a href={tool.url} target="_blank" rel="noopener noreferrer" className="font-bold text-ink underline decoration-[#c21f16] decoration-2 underline-offset-4 hover:text-prelo-texto">
                        {tool.name} ↗
                      </a>
                      {toolText[tool.id] && <p className="mt-1 text-sm leading-snug text-ink-soft">{toolText[tool.id]}</p>}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </Secao>

        <aside className="cartao-preto flex flex-wrap items-center justify-between gap-6 p-7 sm:p-9">
          <div className="max-w-xl">
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-[#e0837a]">{t.fallacies.eyebrow}</p>
            <p className="mt-2 font-serif text-3xl leading-tight">{t.fallacies.title}</p>
            <p className="mt-2 text-lg leading-snug text-[#e9dcbc]">{t.debates.beforeText}</p>
          </div>
          <Link href={localePath(lang, "/falacias")} className="botao botao-prelo">
            {t.debates.beforeLink} →
          </Link>
        </aside>
      </Corpo>
    </>
  );
}
