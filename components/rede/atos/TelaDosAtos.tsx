// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useRef, useState, type FormEvent, type TouchEvent } from "react";
import Link from "@/components/Link";
import { Botao } from "../ui/Botao";
import type { PropsDaTelaDoPacote } from "../registro";
import { AtoAberto } from "./AtoAberto";
import { ItemDoAto } from "./ItemDoAto";
import { Icone } from "./partes";
import { useListaDeAtos, useTextosDosAtos } from "./usar";
import { cidadeGuardada, guardarCidade } from "@/lib/rede/atos/aparelho";
import { PREVIA_DOS_ATOS } from "@/lib/rede/cliente-atos";
import { enderecos } from "@/lib/rede/tipos";
import { preencherAto } from "@/lib/rede/textos-atos";
import type { FiltroDosAtos } from "@/lib/rede/tipos-atos";
import "./atos.css";

/**
 * A tela dos atos (/alumia/atos, prancha celular-modo-atos): "Perto" (pela cidade que a pessoa ESCREVE, guardada só neste
 * aparelho; nada de GPS, PLANO-ALUMIA §6.7) e "Seguindo". Um ato por vez, aberto, com o próximo espiando embaixo: deslizar para
 * cima (ou tocar nele) passa para o próximo; deslizar para baixo volta. Tudo também pelo teclado.
 */
export default function TelaDosAtos({ lang, situacao, aoEscrever }: PropsDaTelaDoPacote) {
  const t = useTextosDosAtos(lang);
  const [filtro, setFiltro] = useState<FiltroDosAtos>("perto");
  const [cidade, setCidade] = useState<string | null>(null);
  const [lida, setLida] = useState(false);
  const [rascunho, setRascunho] = useState("");
  const [indice, setIndice] = useState(0);
  const toque = useRef<number | null>(null);
  const topo = useRef<HTMLDivElement>(null);

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

  const ir = (i: number) => {
    if (i < 0 || i >= itens.length) return;
    setIndice(i);
    topo.current?.focus();
  };
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
  const aoComecarToque = (e: TouchEvent) => {
    toque.current = e.touches[0]?.clientY ?? null;
  };
  const aoSoltarToque = (e: TouchEvent) => {
    const inicio = toque.current;
    toque.current = null;
    const fim = e.changedTouches[0]?.clientY;
    if (inicio === null || fim === undefined) return;
    const d = inicio - fim;
    // só um gesto claro (e só quando a tela já está no fim ou no começo da rolagem) troca de ato
    if (d > 70 && window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) ir(indice + 1);
    else if (d < -70 && window.scrollY <= 0) ir(indice - 1);
  };

  if (!t) return <div className="al-atos-tela" aria-busy="true" />;

  return (
    <section className="al-atos-tela" aria-labelledby="al-atos-titulo" onTouchStart={aoComecarToque} onTouchEnd={aoSoltarToque}>
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

      <div ref={topo} tabIndex={-1} className="al-atos-miolo" aria-live="polite" aria-busy={estado.fase === "carregando" && !precisaCidade}>
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
            <p>{t.tela.erro}</p>
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
          <>
            {indice > 0 ? (
              <button type="button" className="al-atos-anterior" onClick={() => ir(indice - 1)}>
                <span aria-hidden className="al-atos-anterior-seta">{Icone.baixo(18)}</span>
                {t.tela.irAnterior}
              </button>
            ) : null}
            <p className="al-so-leitor">{preencherAto(t.tela.contagem, { i: indice + 1, n: itens.length })}</p>
            <AtoAberto key={atual.id} ato={atual} t={t} lang={lang} logado={situacao.logado || PREVIA_DOS_ATOS} />
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
                  {t.tela.deslize}
                </p>
              </div>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}
