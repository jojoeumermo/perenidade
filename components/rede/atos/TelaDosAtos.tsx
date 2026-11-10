// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { flushSync } from "react-dom";
import Link from "@/components/Link";
import { Botao } from "../ui/Botao";
import type { PropsDaTelaDoPacote } from "../registro";
import { BotaoLembrete } from "./Acoes";
import { AtoAberto } from "./AtoAberto";
import { Correntes } from "./Corrente";
import { ItemDoAto } from "./ItemDoAto";
import { Icone } from "./partes";
import { frase, useListaDeAtos, useTextosDosAtos } from "./usar";
import { codigoDoErro } from "@/lib/rede/atos/erros";
import { podeMexer } from "@/lib/rede/atos/movimento";
import { cidadeGuardada, guardarCidade } from "@/lib/rede/atos/aparelho";
import { marcarVistos } from "@/lib/rede/atos/novos";
import { PREVIA_DOS_ATOS } from "@/lib/rede/cliente-atos";
import { enderecos } from "@/lib/rede/tipos";
import { preencherAto } from "@/lib/rede/textos-atos";
import type { FiltroDosAtos } from "@/lib/rede/tipos-atos";
import "./atos.css";

/**
 * A tela dos atos (/alumia/atos, prancha celular-modo-atos): "Perto" (pela cidade que a pessoa ESCREVE, guardada só neste
 * aparelho; nada de GPS, PLANO-ALUMIA §6.7) e "Seguindo". Um ato por vez, aberto, com o próximo espiando embaixo: deslizar para
 * cima (ou tocar nele) passa para o próximo; deslizar para baixo volta. O ato segue o dedo enquanto arrasta (com elástico) e a troca
 * é uma transição de vista (o velho sobe, o novo vem de baixo). Tudo também pelo teclado (J e K). Embaixo, as correntes de
 * solidariedade da cidade escrita.
 */
const PUXAR = 70;
type Toque = { y: number; noFim: boolean; noTopo: boolean; d: number };
export default function TelaDosAtos({ lang, situacao, aoEscrever }: PropsDaTelaDoPacote) {
  const t = useTextosDosAtos(lang);
  const [filtro, setFiltro] = useState<FiltroDosAtos>("perto");
  const [cidade, setCidade] = useState<string | null>(null);
  const [lida, setLida] = useState(false);
  const [rascunho, setRascunho] = useState("");
  const [indice, setIndice] = useState(0);
  const toque = useRef<Toque | null>(null);
  const palco = useRef<HTMLDivElement>(null);
  const topo = useRef<HTMLDivElement>(null);
  // Depois de trocar de ato (pelo gesto, pelo item "próximo" ou pelo "anterior"), o foco vai ao título do ato novo.
  const focarTitulo = useRef(false);

  useEffect(() => {
    queueMicrotask(() => {
      const c = cidadeGuardada();
      setCidade(c);
      setRascunho(c ?? "");
      setLida(true);
    });
  }, []);

  const precisaCidade = filtro === "perto" && !cidade;
  const { estado, recarregar } = useListaDeAtos(filtro, { cidade, ligado: lida && !precisaCidade });
  const itens = estado.fase === "pronto" ? estado.dados : [];
  const atual = itens[Math.min(indice, Math.max(0, itens.length - 1))];
  const proximo = itens[indice + 1];

  // O ato que apareceu deixa de ser "novo" (o emblema do menu e o ponto da barra; a lista fica só neste aparelho).
  useEffect(() => {
    if (atual) marcarVistos([atual.id]);
  }, [atual]);

  useEffect(() => {
    if (!focarTitulo.current || !atual) return;
    focarTitulo.current = false;
    const titulo = document.getElementById(`al-ato-aberto-${atual.id}`);
    (titulo ?? topo.current)?.focus();
  }, [atual]);

  const ir = useCallback(
    (i: number) => {
      if (i < 0 || i >= itens.length || i === indice) return;
      focarTitulo.current = true;
      const trocar = () => {
        setIndice(i);
        window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
      };
      const raiz = document.documentElement;
      const vt = (document as Document & { startViewTransition?: (f: () => void) => { finished: Promise<void> } }).startViewTransition;
      if (!vt || !podeMexer()) {
        trocar();
        return;
      }
      raiz.dataset.alIr = i > indice ? "frente" : "tras";
      const transicao = vt.call(document, () => flushSync(trocar));
      transicao.finished.finally(() => {
        delete raiz.dataset.alIr;
      });
    },
    [itens.length, indice],
  );

  // J vai ao próximo ato, K volta (fora de campos de texto)
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const alvo = e.target as HTMLElement | null;
      if (alvo && (alvo.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(alvo.tagName))) return;
      if (e.key === "j" || e.key === "J") ir(indice + 1);
      else if (e.key === "k" || e.key === "K") ir(indice - 1);
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [ir, indice]);
  const trocarFiltro = (f: FiltroDosAtos) => {
    setFiltro(f);
    setIndice(0);
  };
  const salvarCidade = (e: FormEvent) => {
    e.preventDefault();
    const c = rascunho.replace(/\s+/g, " ").trim().slice(0, 80);
    if (c.length < 2) return;
    guardarCidade(c);
    setCidade(c);
    setIndice(0);
  };
  // O gesto: só quando a tela já está no fim (para o próximo) ou no começo (para o anterior) da rolagem. Enquanto o dedo arrasta,
  // o ato acompanha com elástico; passando de PUXAR, o próximo acende ("solte para ir").
  const pintarArraste = (d: number) => {
    const el = palco.current;
    if (!el) return;
    const puxa = Math.sign(d) * Math.min(140, Math.abs(d) * 0.45);
    el.style.setProperty("--al-arraste", `${-puxa}px`);
    el.style.setProperty("--al-arraste-p", String(Math.min(1, Math.abs(d) / 220)));
    el.toggleAttribute("data-puxou", Math.abs(d) > PUXAR);
  };
  const limparArraste = () => {
    const el = palco.current;
    if (!el) return;
    el.removeAttribute("data-arrastando");
    el.removeAttribute("data-puxou");
    el.style.removeProperty("--al-arraste");
    el.style.removeProperty("--al-arraste-p");
  };
  // O gesto vale na página inteira (também no rodapé e nas correntes): os ouvintes ficam na janela, passivos.
  useEffect(() => {
    const aoComecarToque = (e: TouchEvent) => {
      const y = e.touches[0]?.clientY;
      if (y === undefined || e.touches.length > 1) return;
      toque.current = { y, d: 0, noFim: window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4, noTopo: window.scrollY <= 0 };
    };
    const aoMoverToque = (e: TouchEvent) => {
      const tq = toque.current;
      const y = e.touches[0]?.clientY;
      if (!tq || y === undefined) return;
      tq.d = tq.y - y;
      const vale = (tq.d > 0 && tq.noFim && !!proximo) || (tq.d < 0 && tq.noTopo && indice > 0);
      if (!vale || !podeMexer()) return;
      palco.current?.setAttribute("data-arrastando", "");
      pintarArraste(tq.d);
    };
    const aoSoltarToque = () => {
      const tq = toque.current;
      toque.current = null;
      limparArraste();
      if (!tq) return;
      // só um gesto claro troca de ato
      if (tq.d > PUXAR && tq.noFim) ir(indice + 1);
      else if (tq.d < -PUXAR && tq.noTopo) ir(indice - 1);
    };
    window.addEventListener("touchstart", aoComecarToque, { passive: true });
    window.addEventListener("touchmove", aoMoverToque, { passive: true });
    window.addEventListener("touchend", aoSoltarToque);
    window.addEventListener("touchcancel", aoSoltarToque);
    return () => {
      window.removeEventListener("touchstart", aoComecarToque);
      window.removeEventListener("touchmove", aoMoverToque);
      window.removeEventListener("touchend", aoSoltarToque);
      window.removeEventListener("touchcancel", aoSoltarToque);
    };
  }, [ir, indice, proximo]);

  if (!t) return <div className="al-atos-tela" aria-busy="true" />;

  return (
    <section className="al-atos-tela" aria-labelledby="al-atos-titulo">
      <header className="al-atos-cabeca">
        <Link href={enderecos.linha(lang)} className="al-atos-voltar" aria-label={t.tela.voltar}>
          {Icone.voltar(26)}
        </Link>
        <h1 id="al-atos-titulo" className="al-cond al-atos-titulo">
          {t.tela.titulo}
        </h1>
        <div className="al-atos-filtro" role="group" aria-label={t.tela.filtro}>
          {(["perto", "seguindo"] as const).map((f) => (
            <button key={f} type="button" aria-pressed={filtro === f} onClick={() => trocarFiltro(f)} className="al-atos-filtro-botao">
              {t.tela[f]}
            </button>
          ))}
        </div>
      </header>

      {PREVIA_DOS_ATOS ? <p className="al-atos-previa">{t.tela.previa}</p> : null}

      {filtro === "perto" && cidade ? (
        <p className="al-atos-cidade">
          <button type="button" className="al-atos-link" onClick={() => setCidade(null)}>
            {preencherAto(t.tela.trocarCidade, { cidade })}
          </button>
        </p>
      ) : null}

      <div ref={topo} tabIndex={-1} className="al-atos-miolo" aria-busy={estado.fase === "carregando" && !precisaCidade}>
        {precisaCidade ? (
          <form className="al-atos-cidade-form" onSubmit={salvarCidade}>
            <label htmlFor="al-atos-cidade" className="al-atos-rotulo">
              {t.tela.cidade}
            </label>
            <div className="al-atos-cidade-linha">
              <input
                id="al-atos-cidade"
                className="al-atos-campo"
                value={rascunho}
                onChange={(e) => setRascunho(e.target.value)}
                placeholder={t.tela.cidadeExemplo}
                maxLength={80}
                autoComplete="address-level2"
                aria-describedby="al-atos-cidade-ajuda"
              />
              <Botao type="submit" variante="claro" tamanho="m">
                {t.tela.cidadeVer}
              </Botao>
            </div>
            <p id="al-atos-cidade-ajuda" className="al-atos-ajuda">
              {t.tela.cidadeAjuda}
            </p>
          </form>
        ) : estado.fase === "carregando" ? (
          <p className="al-atos-ajuda">{t.tela.carregando}</p>
        ) : estado.fase === "erro" ? (
          <div className="al-atos-vazio" role="alert">
            <p>{codigoDoErro(estado.erro) === "generico" ? t.tela.erro : frase(t, estado.erro)}</p>
            <Botao variante="contorno" onClick={recarregar}>
              {t.tela.tentar}
            </Botao>
          </div>
        ) : !atual ? (
          <div className="al-atos-vazio">
            <p>{filtro === "perto" ? preencherAto(t.tela.vazioPerto, { cidade: cidade ?? "" }) : t.tela.vazioSeguindo}</p>
            {situacao.logado || PREVIA_DOS_ATOS ? (
              <Botao variante="primario" icone={Icone.bandeira(18)} onClick={() => aoEscrever()}>
                {t.tela.chamarUm}
              </Botao>
            ) : null}
          </div>
        ) : (
          <div ref={palco} className="al-atos-palco">
            {itens.length > 1 ? (
              <ol className="al-atos-pontos" aria-hidden>
                {itens.slice(0, 12).map((a, i) => (
                  <li key={a.id} aria-current={i === indice ? "true" : undefined} />
                ))}
              </ol>
            ) : null}
            {indice > 0 ? (
              <button type="button" className="al-atos-anterior" onClick={() => ir(indice - 1)}>
                <span aria-hidden className="al-atos-anterior-seta">{Icone.baixo(18)}</span>
                {t.tela.irAnterior}
              </button>
            ) : null}
            {/* Só a contagem é anunciada na troca ("Ato 2 de 4: Vigília…"); o ato inteiro não é relido. */}
            <p className="al-so-leitor" role="status">
              {`${preencherAto(t.tela.contagem, { i: indice + 1, n: itens.length })}: ${atual.titulo}`}
            </p>
            <div className="al-atos-atual" style={{ viewTransitionName: "al-ato" }}>
              <AtoAberto key={atual.id} ato={atual} t={t} lang={lang} logado={situacao.logado || PREVIA_DOS_ATOS} depois={<BotaoLembrete ato={atual} t={t} lang={lang} tamanho="p" />} />
            </div>
            {proximo ? (
              <div className="al-atos-proximo">
                <ItemDoAto
                  ato={proximo}
                  t={t}
                  lang={lang}
                  tamanho="g"
                  aoTocar={() => ir(indice + 1)}
                  rotulo={`${preencherAto(t.tela.irProximo, { titulo: proximo.titulo })} (${t.situacao[proximo.situacao]})`}
                  fim={<span className="al-ato-item-seta" aria-hidden>{Icone.baixo(22)}</span>}
                />
                <p className="al-atos-deslize" aria-hidden>
                  <span className="al-atos-deslize-seta">{Icone.baixo(18)}</span>
                  {t.tela.deslize}
                </p>
              </div>
            ) : null}
            {itens.length > 1 ? <p className="al-atos-atalhos">{t.tela.atalhos}</p> : null}
          </div>
        )}
        {filtro === "perto" && cidade ? <Correntes t={t} lang={lang} cidade={cidade} logado={situacao.logado || PREVIA_DOS_ATOS} /> : null}
      </div>
    </section>
  );
}
