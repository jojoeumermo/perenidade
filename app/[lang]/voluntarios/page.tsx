// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import Link from "@/components/Link";
import { Cartaz } from "@/components/Cartaz";
import { TarefasDeVoluntariado } from "@/components/governanca/Governanca";
import { Markdown } from "@/components/Markdown";
import { originalLang, Untranslated } from "@/components/Untranslated";
import { VolunteerForm } from "@/components/VolunteerForm";
import voluntariado from "@/content/voluntariado.json";
import { loadLang } from "@/i18n";
import { localePath } from "@/i18n/config";
import { paginaMeta } from "@/lib/seo";
import { getPage } from "@/lib/content";

export async function generateMetadata({ params }: PageProps<"/[lang]/voluntarios">): Promise<Metadata> {
  const { lang } = await loadLang(params);
  const page = getPage("voluntarios", lang);
  return paginaMeta(lang, "/voluntarios", page.title, page.lead);
}

/** O texto da página em partes: a abertura e cada seção "## ". */
function secoes(corpo: string): { abertura: string; partes: string[] } {
  const pedacos = corpo.split(/\n(?=## )/);
  const abertura = pedacos[0].startsWith("## ") ? "" : pedacos.shift()!;
  return { abertura, partes: pedacos };
}

/**
 * Uma seção com "### " vira cartões: o título, uma ou duas frases à vista e o resto em "saiba mais". Resumos do mesmo
 * tamanho deixam os cartões iguais (com o parágrafo inteiro, um cartão tinha quatro linhas e o vizinho, doze).
 */
function funcoes(secao: string): { cabeca: string; cartoes: { titulo: string; resumo: string; resto: string }[] } | null {
  const [cabeca, ...blocos] = secao.split(/\n(?=### )/);
  if (blocos.length === 0) return null;
  return {
    cabeca,
    cartoes: blocos.map((bloco) => {
      const [linha, ...corpo] = bloco.split("\n");
      const texto = corpo.join("\n").trim();
      const fim = texto.indexOf("\n\n") === -1 ? texto.length : texto.indexOf("\n\n");
      // Fim de frase: ponto, interrogação ou exclamação seguidos de espaço, fora de lista e de link.
      let corte = -1;
      for (const m of texto.slice(0, fim).matchAll(/[.?!](?=\s)/g)) {
        corte = m.index + 1;
        if (corte >= 60) break;
      }
      if (corte === -1 || corte >= fim - 1) corte = fim;
      const resumo = texto.slice(0, corte).trim();
      return { titulo: linha.replace(/^###\s+/, "").trim(), resumo, resto: texto.slice(corte).trim() };
    }),
  };
}

// O voluntariado numa página só: três jeitos de ajudar no alto, as funções em cartões, as tarefas rápidas e a
// candidatura. "Quero fazer esta" desce até o formulário já com a tarefa escrita, sem abrir programa de e-mail.
export default async function Voluntarios({ params }: PageProps<"/[lang]/voluntarios">) {
  const { lang, t } = await loadLang(params);
  const page = getPage("voluntarios", lang);
  const s = t.volunteer;
  const { abertura, partes } = secoes(page.body);
  const idioma = originalLang(page.translated);
  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <div className="mx-auto max-w-3xl" {...idioma}>
        <Cartaz eyebrow={page.eyebrow} title={page.title} slogan={t.footer.slogan} tone="vermelho">
          {page.lead}
        </Cartaz>
      </div>
      <Untranslated lang={lang} t={t} show={!page.translated} />
      {abertura && (
        <div className="mx-auto mt-8 max-w-3xl" {...idioma}>
          <Markdown lang={lang}>{abertura}</Markdown>
        </div>
      )}

      <section aria-labelledby="tres-jeitos" className="mt-10">
        <h2 id="tres-jeitos" className="tarja tarja-v">
          <span className="tarja-nome">★ {s.waysTitle}</span>
        </h2>
        <ol className="mt-6 grid gap-5 md:grid-cols-3">
          {[
            [s.way1Title, s.way1Text, localePath(lang, "/contribuir"), s.way1Link],
            [s.way2Title, s.way2Text, "#tarefas", s.way2Link],
            [s.way3Title, s.way3Text, "#candidatura", s.way3Link],
          ].map(([titulo, texto, href, rotulo], i) => (
            <li key={href} className={`${i === 1 ? "cartao-v" : "cartao"} flex flex-col p-5`}>
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-prelo-texto">0{i + 1}</p>
              <h3 className="mt-2 font-serif text-[1.45rem] font-semibold leading-tight">{titulo}</h3>
              <p className="mt-2 font-sans text-sm leading-relaxed text-ink-soft">{texto}</p>
              <p className="mt-auto pt-4">
                {href.startsWith("#") ? (
                  <a href={href} className="botao botao-tinta botao-menor">{rotulo} →</a>
                ) : (
                  <Link href={href} className="botao botao-tinta botao-menor">{rotulo} →</Link>
                )}
              </p>
            </li>
          ))}
        </ol>
      </section>

      {partes.map((secao, i) => {
        const cartoes = funcoes(secao);
        if (!cartoes) {
          return (
            <div key={i} className="mx-auto mt-12 max-w-3xl" {...idioma}>
              <Markdown lang={lang}>{secao}</Markdown>
            </div>
          );
        }
        return (
          <section key={i} className="mt-12" {...idioma}>
            <div className="mx-auto max-w-3xl">
              <Markdown lang={lang}>{cartoes.cabeca}</Markdown>
            </div>
            {/* Todas as fileiras com a altura da maior (auto-rows-fr), e o cartão que sobra sozinho no fim fica no meio. */}
            <ul className="mt-6 grid auto-rows-fr gap-5 md:grid-cols-2 lg:grid-cols-3 md:max-lg:[&>li:last-child:nth-child(odd)]:col-span-2 lg:[&>li:last-child:nth-child(3n+1)]:col-start-2">
              {cartoes.cartoes.map((c) => (
                <li key={c.titulo} className="cartao flex flex-col p-5 sm:p-6">
                  <h3 className="font-serif text-[1.45rem] font-semibold leading-tight">{c.titulo}</h3>
                  <div className="mt-2">
                    <Markdown lang={lang}>{c.resumo}</Markdown>
                  </div>
                  {c.resto && (
                    <details className="checagem-completa mt-auto border-t-2 border-ink pt-4 [&:not([open])]:mt-4">
                      <summary className="checagem-abrir">{s.more}</summary>
                      <div className="mt-3">
                        <Markdown lang={lang}>{c.resto}</Markdown>
                      </div>
                    </details>
                  )}
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      <TarefasDeVoluntariado />
      <div className="mx-auto max-w-3xl">
        <VolunteerForm s={s} tarefas={voluntariado.tarefas.map(({ id, titulo }) => ({ id, titulo }))} />
      </div>
      <p className="no-print mx-auto mt-10 max-w-3xl border-t border-rule pt-6 font-sans text-sm text-ink-soft">
        <Link href={`${localePath(lang, "/contribuir")}?corrigir=${encodeURIComponent("/voluntarios")}`} className="underline hover:text-oxblood">
          {t.common.suggestFix}
        </Link>
      </p>
    </div>
  );
}
