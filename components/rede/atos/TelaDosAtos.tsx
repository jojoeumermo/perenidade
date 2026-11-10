// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from "react";
import { flushSync } from "react-dom";
import Link from "@/components/Link";
import { Botao } from "../ui/Botao";
import type { PropsDaTelaDoPacote } from "../registro";
import { AtoAberto } from "./AtoAberto";
import { Correntes } from "./Corrente";
import { ItemDoAto } from "./ItemDoAto";
import { Icone } from "./partes";
import { frase, useListaDeAtos, useTextosDosAtos } from "./usar";
import { codigoDoErro } from "@/lib/rede/atos/erros";
import { MOLAS, podeMexer, vibrar } from "@/lib/rede/atos/movimento";
import { cidadeGuardada, guardarCidade, nomeDaCidade } from "@/lib/rede/atos/aparelho";
import { marcarVistos } from "@/lib/rede/atos/novos";
import { PREVIA_DOS_ATOS } from "@/lib/rede/cliente-atos";
import { enderecos } from "@/lib/rede/tipos";
import { preencherAto } from "@/lib/rede/textos-atos";
import type { FiltroDosAtos } from "@/lib/rede/tipos-atos";
import "./atos.css";

/**
 * A tela dos atos (/alumia/atos, prancha celular-modo-atos): "Perto" (pela cidade que a pessoa ESCREVE, guardada só neste
 * aparelho; nada de GPS, PLANO-ALUMIA §6.7) e "Seguindo". Um ato por vez, aberto, com o próximo espiando embaixo: deslizar para
 * cima com o próximo à vista (ou tocar nele) passa para o próximo; deslizar para baixo no topo volta. Enquanto o dedo arrasta, o
 * cartão do próximo sobe junto (com elástico) e acende quando já dá para soltar. A troca é uma animação só do ato (Web Animations:
 * o velho sobe e some, o novo vem de baixo com mola), por baixo das barras fixas. Tudo também pelo teclado (J e K). Embaixo, as
 * correntes de solidariedade da cidade escrita, num cartão recolhível.
 */
const PUXAR = 70;
type Toque = { y: number; frente: boolean; tras: boolean; d: number };
type Foco = "nao" | "esperar" | "sim";
export default function TelaDosAtos({ lang, situacao, aoEscrever }: PropsDaTelaDoPacote) {
  const t = useTextosDosAtos(lang);
  const [filtro, setFiltro] = useState<FiltroDosAtos>("perto");
  const [cidade, setCidade] = useState<string | null>(null);
  const [lida, setLida] = useState(false);
  const [rascunho, setRascunho] = useState("");
  const [erroCidade, setErroCidade] = useState(false);
  const [indice, setIndice] = useState(0);
  const toque = useRef<Toque | null>(null);
  const palco = useRef<HTMLDivElement>(null);
  const atualRef = useRef<HTMLDivElement>(null);
  const proximoRef = useRef<HTMLDivElement>(null);
  const proximoAVista = useRef(false);
  const trocando = useRef(false);
  const topo = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLInputElement>(null);
  const idErroCidade = useId();
  // Depois de trocar de ato (gesto, "próximo", "anterior", J/K), o foco vai ao título do ato novo. Depois de escrever a cidade,
  // espera a lista nova chegar ("esperar" → "sim") e foca o título do primeiro ato (ou o topo da lista, se não houver ato).
  const focarTitulo = useRef<Foco>("nao");
  const focarCampo = useRef(false);

  useEffect(() => {
    queueMicrotask(() => {
      const c = cidadeGuardada();
      setCidade(c ? nomeDaCidade(c) : null);
      setRascunho(c ? nomeDaCidade(c) : "");
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
    const f = focarTitulo.current;
    if (f === "nao" || precisaCidade) return;
    if (f === "esperar") {
      if (estado.fase === "carregando") focarTitulo.current = "sim";
      return;
    }
    if (estado.fase === "carregando") return;
    focarTitulo.current = "nao";
    const titulo = atual ? document.getElementById(`al-ato-aberto-${atual.id}`) : null;
    (titulo ?? topo.current)?.focus();
  }, [atual, estado.fase, precisaCidade]);

  // "trocar cidade": o campo volta já com o foco (e o texto escolhido, para escrever por cima)
  useEffect(() => {
    if (!precisaCidade || !focarCampo.current) return;
    focarCampo.current = false;
    campo.current?.focus();
    campo.current?.select();
  }, [precisaCidade]);

  // O próximo ato está à vista? É o que libera o gesto de passar (não o fim da rolagem: embaixo dele ainda há o rodapé).
  useEffect(() => {
    const el = proximoRef.current;
    proximoAVista.current = false;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const olho = new IntersectionObserver((e) => (proximoAVista.current = e.some((x) => x.isIntersecting)), { threshold: 0.6 });
    olho.observe(el);
    return () => olho.disconnect();
  }, [proximo?.id]);

  const ir = useCallback(
    (i: number) => {
      if (i < 0 || i >= itens.length || i === indice || trocando.current) return;
      focarTitulo.current = "sim";
      const frente = i > indice;
      const trocar = () => {
        setIndice(i);
        window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
      };
      const el = atualRef.current;
      if (!el || !podeMexer() || typeof el.animate !== "function") {
        trocar();
        return;
      }
      // O ato velho sai (rápido), o novo entra com mola. A animação é do próprio ato, dentro da página: as barras fixas do
      // celular e os botões flutuantes continuam por cima, e nada do ato velho fica para trás.
      trocando.current = true;
      const raiz = document.documentElement;
      raiz.dataset.alIr = frente ? "frente" : "tras";
      const sai = el.animate([{ translate: "0 0", opacity: 1, scale: 1 }, { translate: `0 ${frente ? -56 : 56}px`, opacity: 0, scale: 0.97 }], {
        duration: 170,
        easing: "cubic-bezier(.4,0,1,1)",
        fill: "forwards",
      });
      const entrar = () => {
        flushSync(trocar);
        sai.cancel();
        const entra = el.animate([{ translate: `0 ${frente ? 90 : -90}px`, opacity: 0 }, { translate: "0 0", opacity: 1 }], {
          duration: MOLAS.firme.duracao,
          easing: MOLAS.firme.easing,
        });
        const fim = () => {
          trocando.current = false;
          window.setTimeout(() => delete raiz.dataset.alIr, 400);
        };
        entra.finished.then(fim, fim);
      };
      sai.finished.then(entrar, entrar);
    },
    [itens.length, indice],
  );

  // J vai ao próximo ato, K volta (fora de campos de texto)
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const alvo = e.target as HTMLElement | null;
      if (alvo && (alvo.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(alvo.tagName))) return;
      if (alvo?.closest("dialog[open]")) return;
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
    const c = nomeDaCidade(rascunho);
    if (c.length < 2) {
      setErroCidade(true);
      campo.current?.focus();
      return;
    }
    setErroCidade(false);
    guardarCidade(c);
    setRascunho(c);
    focarTitulo.current = "esperar";
    setCidade(c);
    setIndice(0);
  };
  const trocarCidade = () => {
    setRascunho(cidade ?? "");
    setErroCidade(false);
    focarCampo.current = true;
    setCidade(null);
  };
  // O gesto. Para a frente: com o próximo ato à vista (ou no fim da rolagem); o cartão do próximo sobe com o dedo. Para trás: no
  // topo da página; o ato aberto desce com o dedo. Passando de PUXAR, acende ("solte para ir") e vibra de leve uma vez.
  const pintarArraste = (d: number) => {
    const el = palco.current;
    if (!el) return;
    const puxa = Math.sign(d) * Math.min(140, Math.abs(d) * 0.45);
    el.dataset.arrastando = d > 0 ? "frente" : "tras";
    el.style.setProperty("--al-arraste", `${-puxa}px`);
    el.style.setProperty("--al-arraste-p", String(Math.min(1, Math.abs(d) / 220)));
    const passou = Math.abs(d) > PUXAR;
    if (passou && !el.hasAttribute("data-puxou")) vibrar([8]);
    el.toggleAttribute("data-puxou", passou);
  };
  const limparArraste = () => {
    const el = palco.current;
    if (!el) return;
    delete el.dataset.arrastando;
    el.removeAttribute("data-puxou");
    el.style.removeProperty("--al-arraste");
    el.style.removeProperty("--al-arraste-p");
  };
  // O gesto vale na página inteira: os ouvintes ficam na janela, passivos (a rolagem nunca trava).
  useEffect(() => {
    const aoComecarToque = (e: TouchEvent) => {
      const y = e.touches[0]?.clientY;
      if (y === undefined || e.touches.length > 1) return;
      if ((e.target as Element | null)?.closest?.("dialog[open], input, textarea, select, .al-correntes-dobra[open]")) return;
      const noFim = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      toque.current = { y, d: 0, frente: proximoAVista.current || noFim, tras: window.scrollY <= 0 };
    };
    const aoMoverToque = (e: TouchEvent) => {
      const tq = toque.current;
      const y = e.touches[0]?.clientY;
      if (!tq || y === undefined) return;
      tq.d = tq.y - y;
      const vale = (tq.d > 0 && tq.frente && !!proximo) || (tq.d < 0 && tq.tras && indice > 0);
      if (!vale) {
        limparArraste();
        return;
      }
      if (podeMexer()) pintarArraste(tq.d);
    };
    const aoSoltarToque = () => {
      const tq = toque.current;
      toque.current = null;
      limparArraste();
      if (!tq) return;
      // só um gesto claro troca de ato
      if (tq.d > PUXAR && tq.frente && proximo) {
        vibrar([10]);
        ir(indice + 1);
      } else if (tq.d < -PUXAR && tq.tras && indice > 0) {
        vibrar([10]);
        ir(indice - 1);
      }
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

      {/* A linha da cidade e dos pontos. A vaga vazia guarda, no celular, o lugar dos botões flutuantes do site (ajuda e
          acessibilidade): eles se ancoram nela (CSS anchor positioning) e rolam junto, sem tapar a coluna de ações. */}
      <div className="al-atos-meta">
        {filtro === "perto" && cidade ? (
          <button type="button" className="al-atos-cidade" onClick={trocarCidade} aria-label={preencherAto(t.tela.trocarCidade, { cidade })}>
            <span className="al-atos-cidade-pino" aria-hidden>
              {Icone.pino(16)}
            </span>
            <span className="al-atos-cidade-nome">{cidade}</span>
            <span className="al-atos-cidade-trocar" aria-hidden>
              {t.tela.trocar}
            </span>
          </button>
        ) : null}
        <span className="al-atos-vaga" aria-hidden />
        {itens.length > 1 ? (
          <ol className="al-atos-pontos" aria-hidden>
            {itens.slice(0, 12).map((a, i) => (
              <li key={a.id} aria-current={i === indice ? "true" : undefined} />
            ))}
          </ol>
        ) : null}
      </div>

      <div ref={topo} tabIndex={-1} className="al-atos-miolo" aria-busy={estado.fase === "carregando" && !precisaCidade}>
        {precisaCidade ? (
          <form className="al-atos-cidade-form" onSubmit={salvarCidade} noValidate>
            <label htmlFor="al-atos-cidade" className="al-atos-rotulo">
              {t.tela.cidade}
            </label>
            <div className="al-atos-cidade-linha">
              <input
                ref={campo}
                id="al-atos-cidade"
                className="al-atos-campo"
                value={rascunho}
                onChange={(e) => {
                  setRascunho(e.target.value);
                  if (erroCidade) setErroCidade(false);
                }}
                placeholder={t.tela.cidadeExemplo}
                maxLength={80}
                autoComplete="address-level2"
                aria-invalid={erroCidade || undefined}
                aria-describedby={erroCidade ? `${idErroCidade} al-atos-cidade-ajuda` : "al-atos-cidade-ajuda"}
              />
              <Botao type="submit" variante="claro" tamanho="m">
                {t.tela.cidadeVer}
              </Botao>
            </div>
            {erroCidade ? (
              <p id={idErroCidade} className="al-ato-form-problema" role="alert">
                {t.tela.cidadeCurta}
              </p>
            ) : null}
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
            <div ref={atualRef} className="al-atos-atual">
              <AtoAberto key={atual.id} ato={atual} t={t} lang={lang} logado={situacao.logado || PREVIA_DOS_ATOS} />
            </div>
            {proximo ? (
              <div ref={proximoRef} className="al-atos-proximo">
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
                  <span className="al-atos-deslize-texto">{t.tela.deslize}</span>
                  <span className="al-atos-deslize-solte">{t.tela.puxar}</span>
                </p>
              </div>
            ) : null}
            {itens.length > 1 ? <p className="al-atos-atalhos">{t.tela.atalhos}</p> : null}
          </div>
        )}
        {filtro === "perto" && cidade ? (
          <Correntes t={t} lang={lang} cidade={cidade} logado={situacao.logado || PREVIA_DOS_ATOS} dobra={preencherAto(t.tela.correntes, { cidade })} />
        ) : null}
      </div>
    </section>
  );
}
