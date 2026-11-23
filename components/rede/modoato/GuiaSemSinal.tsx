// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import Link from "@/components/Link";
import type { TextosDoModoAto } from "@/lib/rede/modoato/textos";
import { Faixa } from "../ui/Faixa";
import { KitNoGuia } from "../uso/KitDeBolso";
import "./modoato.css";

/**
 * O guia "Sem sinal?" (/alumia/modo-ato/sem-sinal): página estática, montada inteira no servidor, sem dado de ninguém e sem
 * pedir nada ao banco. Por isso o service worker do site (public/sw.js) guarda o HTML pronto e o guia abre sem internet depois
 * da primeira visita (o modo ato pede para guardar assim que é aberto). Bluetooth e redes em malha só são mencionados: não
 * fazem parte da Alumia.
 */
export function GuiaSemSinal({ t, lang }: { t: TextosDoModoAto; lang: string }) {
  const g = t.guia;
  const cores = ["v", "d", "1", "4", "2"];
  return (
    <article className="ma-pagina ma-guia" aria-labelledby="ma-guia-titulo">
      <header className="ma-cabeca">
        <Faixa className="ma-faixa" />
        <p className="ma-rotulo al-cond">{t.titulo}</p>
        <h1 id="ma-guia-titulo" className="ma-titulo al-cond">{g.titulo}</h1>
        <p className="ma-chamada">{g.chamada}</p>
      </header>
      <nav className="ma-guia-indice" aria-label={g.titulo}>
        <ol>
          {g.secoes.map((s, i) => (
            <li key={i}>
              <a href={`#ma-guia-${i + 1}`}>
                <span className="ma-item-ladrilho" data-cor={cores[i % cores.length]} aria-hidden />
                {s.titulo}
              </a>
            </li>
          ))}
          <li>
            <a href="#ma-guia-direitos">
              <span className="ma-item-ladrilho" data-cor="v" aria-hidden />
              {g.direitosTitulo}
            </a>
          </li>
        </ol>
      </nav>
      <div className="ma-guia-secoes">
        {g.secoes.map((s, i) => (
          <section key={i} id={`ma-guia-${i + 1}`} className="ma-cartao ma-guia-secao" aria-labelledby={`ma-guia-${i + 1}-t`}>
            <div className="ma-cartao-topo">
              <span className="ma-guia-numero al-cond" data-cor={cores[i % cores.length]} aria-hidden>{i + 1}</span>
            </div>
            <h2 id={`ma-guia-${i + 1}-t`} className="ma-cartao-titulo al-cond">{s.titulo}</h2>
            <ul className="ma-itens">
              {s.itens.map((item, j) => (
                <li key={j}>
                  <span className="ma-item-ladrilho" data-cor={cores[i % cores.length]} aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          </section>
        ))}
        <section id="ma-guia-direitos" className="ma-cartao ma-guia-secao ma-detido" aria-labelledby="ma-guia-direitos-t">
          <div className="ma-cartao-topo">
            <span className="ma-carimbo ma-carimbo-vermelho al-cond">{t.detido.direitosTitulo}</span>
          </div>
          <h2 id="ma-guia-direitos-t" className="ma-cartao-titulo al-cond">{g.direitosTitulo}</h2>
          <ol className="ma-lista-numerada">
            {t.detido.direitos.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ol>
        </section>
        {/* R1 (A4.1): o kit de bolso que a pessoa guardou neste aparelho (lido só daqui, nunca do servidor). */}
        <KitNoGuia lang={lang} />
      </div>
      <p className="ma-guia-voltar">
        <Link href={`/${lang}/alumia/modo-ato`} className="al-botao al-botao-contorno al-botao-m">
          {g.voltar}
        </Link>
      </p>
    </article>
  );
}
