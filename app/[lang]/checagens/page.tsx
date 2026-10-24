// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import Link from "next/link";
import { SourceList } from "@/components/Cards";
import { Markdown } from "@/components/Markdown";
import { Capa, Corpo, Secao } from "@/components/pagina/Capa";
import { ListaComBusca } from "@/components/critica/ListaComBusca";
import { ComoChecar } from "@/components/ComoChecar";
import { FactCheckSearch } from "@/components/FactCheckSearch";
import { originalLang, Untranslated } from "@/components/Untranslated";
import { loadLang } from "@/i18n";
import { paginaMeta } from "@/lib/seo";
import { fill, localePath } from "@/i18n/config";
import { getCheckTools, getFactChecks, verdicts } from "@/lib/content";

export async function generateMetadata({ params }: PageProps<"/[lang]/checagens">): Promise<Metadata> {
  const { lang, t } = await loadLang(params);
  return paginaMeta(lang, "/checagens", t.factCheck.title, t.factCheck.lead);
}

// Os carimbos da capa, tortos como num mural de redação: cada selo numa inclinação.
const inclinacoes = ["-rotate-6", "rotate-3", "-rotate-2", "rotate-6"];

/**
 * A checagem de fatos no desenho do Caderno do Povo: a capa preta com o cartaz dos carimbos, a busca nas agências, o
 * passo a passo para checar sozinho, o que quer dizer cada selo, as checagens publicadas e a caixa de ferramentas.
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
        <FactCheckSearch s={s} />

        <ComoChecar s={s.steps} />

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
            <ListaComBusca
              rotulo={s.title}
              items={checks.map((check) => ({
                id: check.slug,
                nome: check.claim,
                chaves: `${check.claim} ${check.verdict} ${check.body}`,
                meta: check.verdict,
                node: (
                  <article key={check.slug} className="cartao p-6 pt-14 sm:p-9 sm:pt-14" {...originalLang(check.translated)}>
                    <p className="rotulo">{s.claim}</p>
                    <h3 className="mt-3 font-serif text-[1.9rem] font-semibold leading-[1.1] text-balance sm:text-[2.4rem]">“{check.claim}”</h3>
                    <p className="jornal-carimbo mt-6 text-xl">{check.verdict}</p>
                    <div className="mt-6 border-t-2 border-ink pt-5">
                      <Markdown lang={lang}>{check.body}</Markdown>
                    </div>
                    <SourceList sources={check.sources} title={t.common.sources} />
                  </article>
                ),
              }))}
            />
          )}
        </Secao>

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
