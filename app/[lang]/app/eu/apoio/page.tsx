// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import Link from "@/components/Link";
import { loadLang } from "@/i18n";
import { localePath } from "@/i18n/config";
import { LINK_DA_CAMPANHA } from "@/lib/apoio";
import { numerosDoSite } from "@/lib/apoio-numeros";

export const revalidate = 3600;

/**
 * Apoio dentro do aplicativo (aba Eu): o que o instituto já fez (contagens reais do conteúdo publicado), o botão para a
 * campanha e a ida para a página completa (metas, contas, mural). Nenhum valor de campanha é escrito aqui: eles vêm do
 * painel e continuam só na página completa.
 */
export default async function ApoioDoApp({ params }: PageProps<"/[lang]/app/eu/apoio">) {
  const { lang, t } = await loadLang(params);
  const s = t.support;
  const n = numerosDoSite();
  const contagens: [number, string][] = [
    [n.obras, s.page.counters.works],
    [n.aulas, s.page.counters.lessons],
    [n.idiomas, s.page.counters.languages],
  ];
  return (
    <div className="app-hub app-apoio-tela">
      <header className="app-hub-cabeca">
        <h1>{s.title}</h1>
        <p>{s.lead}</p>
      </header>
      <section className="app-apoio-feito" aria-label={s.page.doneTitle}>
        <h2 className="app-cartao-titulo app-cartao-titulo-menor">{s.page.doneTitle}</h2>
        <ul className="app-apoio-numeros">
          {contagens.map(([valor, rotulo]) => (
            <li key={rotulo}>
              <strong>{valor.toLocaleString(lang)}</strong>
              <span>{rotulo}</span>
            </li>
          ))}
        </ul>
      </section>
      <a href={LINK_DA_CAMPANHA} target="_blank" rel="noopener noreferrer" className="app-cartao app-apoio-botao">
        <span className="app-cartao-titulo app-cartao-titulo-menor">{s.button}</span>
        <span className="app-cartao-texto">{s.page.opensOutside}</span>
      </a>
      <Link href={localePath(lang, "/apoie")} className="app-cartao app-apoio-mais">
        <span className="app-cartao-titulo app-cartao-titulo-menor">{s.page.seeAccounts}</span>
      </Link>
    </div>
  );
}
