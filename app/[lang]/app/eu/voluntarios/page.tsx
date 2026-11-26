// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import Link from "@/components/Link";
import { TarefasDeVoluntariado } from "@/components/governanca/Governanca";
import { I18nProvider } from "@/components/I18n";
import { Markdown } from "@/components/Markdown";
import { originalLang, Untranslated } from "@/components/Untranslated";
import { VolunteerForm } from "@/components/VolunteerForm";
import voluntariado from "@/content/voluntariado.json";
import { loadLang } from "@/i18n";
import { pickSections } from "@/i18n/core";
import { localePath } from "@/i18n/config";
import { getPage } from "@/lib/content";
import { funcoes, secoes } from "@/lib/voluntarios-secoes";

/**
 * O voluntariado dentro do aplicativo (aba Eu): os três jeitos de ajudar, as funções em cartões de uma coluna (o resto
 * em "saiba mais"), as tarefas rápidas e a candidatura, tudo na mesma tela. Usa o mesmo texto e o mesmo formulário do
 * site (componentes compartilhados): o desenho e a ordem são do aplicativo. O link de confirmação por e-mail
 * (?confirmar=) continua na página do site.
 */
export default async function VoluntariosDoApp({ params }: PageProps<"/[lang]/app/eu/voluntarios">) {
  const { lang, t } = await loadLang(params);
  const page = getPage("voluntarios", lang);
  const s = t.volunteer;
  const { abertura, partes } = secoes(page.body);
  const idioma = originalLang(page.translated);
  const jeitos: [string, string, string, string][] = [
    [s.way1Title, s.way1Text, localePath(lang, "/contribuir"), s.way1Link],
    [s.way2Title, s.way2Text, "#tarefas", s.way2Link],
    [s.way3Title, s.way3Text, "#candidatura", s.way3Link],
  ];
  return (
    <div className="app-hub app-voluntarios-tela">
      <header className="app-hub-cabeca" {...idioma}>
        <h1>{page.title}</h1>
        <p>{page.lead}</p>
      </header>
      <Untranslated lang={lang} t={t} show={!page.translated} />
      {abertura && (
        <div className="app-voluntarios-texto" {...idioma}>
          <Markdown lang={lang}>{abertura}</Markdown>
        </div>
      )}
      <h2 className="app-titulo-secao">{s.waysTitle}</h2>
      <ol className="app-voluntarios-jeitos">
        {jeitos.map(([titulo, texto, href, rotulo]) => (
          <li key={href} className="app-cartao app-voluntarios-cartao">
            <span className="app-cartao-titulo app-cartao-titulo-menor">{titulo}</span>
            <span className="app-cartao-texto">{texto}</span>
            {href.startsWith("#") ? (
              <a href={href} className="app-voluntarios-acao">{rotulo} →</a>
            ) : (
              <Link href={href} className="app-voluntarios-acao">{rotulo} →</Link>
            )}
          </li>
        ))}
      </ol>
      {partes.map((secao, i) => {
        const cartoes = funcoes(secao);
        if (!cartoes) {
          return (
            <div key={i} className="app-voluntarios-texto" {...idioma}>
              <Markdown lang={lang}>{secao}</Markdown>
            </div>
          );
        }
        return (
          <section key={i} {...idioma}>
            <div className="app-voluntarios-texto">
              <Markdown lang={lang}>{cartoes.cabeca}</Markdown>
            </div>
            <ul className="app-voluntarios-jeitos">
              {cartoes.cartoes.map((c) => (
                <li key={c.titulo} className="app-cartao app-voluntarios-cartao">
                  <span className="app-cartao-titulo app-cartao-titulo-menor">{c.titulo}</span>
                  <Markdown lang={lang}>{c.resumo}</Markdown>
                  {c.resto && (
                    <details className="app-voluntarios-mais">
                      <summary>{s.more}</summary>
                      <Markdown lang={lang}>{c.resto}</Markdown>
                    </details>
                  )}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      <TarefasDeVoluntariado />
      <div className="app-voluntarios-form">
        <I18nProvider lang={lang} t={pickSections(t, ["areas"])}>
          <VolunteerForm s={s} tarefas={voluntariado.tarefas.map(({ id, titulo }) => ({ id, titulo }))} />
        </I18nProvider>
      </div>
    </div>
  );
}
