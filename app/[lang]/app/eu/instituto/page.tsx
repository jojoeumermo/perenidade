// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import Link from "@/components/Link";
import { Untranslated } from "@/components/Untranslated";
import { loadLang } from "@/i18n";
import { localePath } from "@/i18n/config";
import { VALORES } from "@/lib/instituto-valores";

/**
 * O Instituto dentro do aplicativo (aba Eu): propósito, missão, visão e os nove valores em cartões, cada valor numa
 * sanfona (<details>) para a tela caber no celular. O estatuto inteiro (13 artigos) ainda abre na página do site:
 * pendência registrada. O texto está em português, como na página do site, com o aviso das outras línguas.
 */
export default async function InstitutoDoApp({ params }: PageProps<"/[lang]/app/eu/instituto">) {
  const { lang, t } = await loadLang(params);
  const blocos: [string, string, string][] = [
    ["proposito", "Propósito", "Que o conhecimento acumulado pela humanidade volte a quem o produziu: livre, gratuito e copiado por todos."],
    ["missao", "Missão", "Manter, com trabalho voluntário, uma escola, uma biblioteca e um arquivo digitais, gratuitos e sem anúncios, em seis idiomas, com ferramentas que funcionam no aparelho de quem estuda, sem cadastro e sem vender dados."],
    ["visao", "Visão", "Uma biblioteca de Alexandria ao contrário: que não dependa de poucas cópias, porque tudo nela pode ser copiado, e que sirva em casa, na sala de aula, no movimento e no trabalho."],
  ];
  return (
    <div className="app-hub app-instituto-tela" lang="pt-BR">
      <header className="app-hub-cabeca">
        <h1>{t.nav.institute}</h1>
        <p>Quem somos, por escrito. Sem preço e sem cadeado.</p>
      </header>
      <Untranslated lang={lang} t={t} show={lang !== "pt"} />
      {blocos.map(([id, nome, texto]) => (
        <section key={id} className="app-cartao app-instituto-bloco" aria-labelledby={`app-${id}`} data-bloco={id}>
          <h2 id={`app-${id}`} className="app-instituto-rotulo">{nome}</h2>
          <p className="app-instituto-texto">{texto}</p>
        </section>
      ))}
      <h2 className="app-titulo-secao">Valores</h2>
      <ol className="app-instituto-valores">
        {VALORES.map(([nome, texto], i) => (
          <li key={nome}>
            <details className="app-cartao app-instituto-valor">
              <summary>
                <span className="app-instituto-num">{String(i + 1).padStart(2, "0")}</span> {nome}
              </summary>
              <p className="app-cartao-texto">{texto}</p>
            </details>
          </li>
        ))}
      </ol>
      <Link href={localePath(lang, "/instituto")} className="app-cartao app-instituto-estatuto">
        <span className="app-cartao-titulo app-cartao-titulo-menor">Estatuto e acessibilidade</span>
        <span className="app-cartao-texto">A carta de funcionamento com os 13 artigos abre na página do site.</span>
      </Link>
    </div>
  );
}
