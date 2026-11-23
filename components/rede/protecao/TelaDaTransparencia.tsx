// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useCallback, useEffect, useState } from "react";
import { rotulos, type NumerosDoTrimestre, type Relatorio, type Trimestre } from "../rotulos/cliente";
import { Cabeca, Carregando, Numero, Rico } from "../rotulos/pecas";
import { CATEGORIAS_DO_RELATORIO, numeroDoRelatorio, ORGAOS, PEDIDOS, PRAZO_DO_AVISO_DIAS, RESPOSTAS, textoDoNumero, type NumeroDoRelatorio } from "../rotulos/regras";
import { dataNoIdioma, por, type TextosDosRotulos } from "../rotulos/textos";
import { useTextosDosRotulos } from "../rotulos/usarTextos";
import type { PropsDaTelaDoPacote } from "../registro";
import { PorQueSemNumero } from "../uso/PorQueSemNumero";

type T = TextosDosRotulos["transparencia"];

/** "4º trimestre de 2026" a partir do primeiro dia ("2026-10-01"). */
function nomeDoTrimestre(texto: string, inicio: string): string {
  const [ano, mes] = inicio.split("-").map(Number);
  return por(texto, { n: Math.floor((mes - 1) / 3) + 1, ano });
}

/** O aviso de ordem sigilosa: o carimbo dourado enquanto vale; vermelho, dizendo desde quando não foi renovado, quando venceu. */
function AvisoDeOrdemSigilosa({ lang, t, canario }: { lang: string; t: T; canario: Relatorio["canario"] }) {
  const vale = !canario.vencido && canario.renovado_em;
  const frase = vale
    ? por(t.canario.valendo, { data: dataNoIdioma(lang, canario.renovado_em) })
    : canario.renovado_em
      ? por(t.canario.vencido, { data: dataNoIdioma(lang, canario.renovado_em), dias: PRAZO_DO_AVISO_DIAS })
      : t.canario.nunca;
  return (
    <section className="rt-canario" data-vencido={vale ? undefined : "sim"} aria-labelledby="rt-canario-t">
      <div className="rt-canario-selo al-cond" aria-hidden>
        <span><strong>{vale ? "✓" : "!"}</strong>{por(t.canario.selo, { dias: PRAZO_DO_AVISO_DIAS })}</span>
      </div>
      <div>
        <h2 id="rt-canario-t" className="al-cond">{t.canario.titulo}</h2>
        <p className="rt-canario-frase">{frase}</p>
        <p className="rt-canario-nota">
          {vale ? por(t.canario.nota, { dias: PRAZO_DO_AVISO_DIAS, vence: dataNoIdioma(lang, canario.vence_em) }) : t.canario.comoLer}
        </p>
      </div>
    </section>
  );
}

/** Uma linha "rótulo · número" dos cartões. */
function Linha({ lang, t, rotulo, n }: { lang: string; t: T; rotulo: string; n: NumeroDoRelatorio | undefined }) {
  return (
    <div>
      <dt>{rotulo}</dt>
      <Numero lang={lang} n={n} menos={t.menosDe3} reservado={t.reservado} className="" como="dd" />
    </div>
  );
}

/** Denúncias por tipo: o nome, uma barra de ladrilhos proporcional às recebidas (só a partir de 3) e os dois números. */
function PorTipo({ lang, t, numeros }: { lang: string; t: T; numeros: NumerosDoTrimestre }) {
  const maior = Math.max(1, ...CATEGORIAS_DO_RELATORIO.map((c) => numeroDoRelatorio(numeros.denuncias.por_tipo[c]?.recebidas) ?? 0));
  return (
    <section className="rt-bloco" aria-labelledby="rt-tipos-t">
      <h2 id="rt-tipos-t" className="rt-bloco-titulo al-cond">{t.denunciasTitulo}</h2>
      <div className="rt-tipos-cabeca" aria-hidden>
        <span>{t.colunas.tipo}</span>
        <span />
        <span style={{ textAlign: "right" }}>{t.colunas.recebidas}</span>
        <span style={{ textAlign: "right" }}>{t.colunas.decididas}</span>
      </div>
      <ul className="rt-tipos">
        {CATEGORIAS_DO_RELATORIO.map((c) => {
          const linha = numeros.denuncias.por_tipo[c];
          const n = numeroDoRelatorio(linha?.recebidas);
          return (
            <li key={c} className="rt-tipo">
              <span className="rt-tipo-nome">{t.categorias[c]}</span>
              <span className="rt-barra" data-vazia={n === null ? "sim" : undefined} style={n === null ? undefined : { width: `${Math.max(4, (n / maior) * 100)}%` }} aria-hidden />
              <span className="rt-tipo-num" aria-label={`${t.colunas.recebidas}: ${textoDoNumero(linha?.recebidas, t)}`}>
                <Numero lang={lang} n={linha?.recebidas} menos={t.menosDe3} reservado={t.reservado} className="" />
              </span>
              <span className="rt-tipo-num" aria-label={`${t.colunas.decididas}: ${textoDoNumero(linha?.decididas, t)}`}>
                <Numero lang={lang} n={linha?.decididas} menos={t.menosDe3} reservado={t.reservado} className="" />
              </span>
            </li>
          );
        })}
      </ul>
      <p className="rt-nota">
        {por(t.denunciasNota, {
          procedentes: textoDoNumero(numeros.denuncias.procedentes, t),
          descartadas: textoDoNumero(numeros.denuncias.descartadas, t),
        })}
      </p>
    </section>
  );
}

/** Um trimestre inteiro: os destaques, as denúncias por tipo, contas, recursos e rótulos, e os pedidos de órgãos públicos. */
function UmTrimestre({ lang, t, tri }: { lang: string; t: T; tri: Trimestre }) {
  const n = tri.numeros;
  const a = tri.autoridade;
  const destaques: [string, NumeroDoRelatorio][] = [
    [t.destaques.recebidas, n.denuncias.recebidas],
    [t.destaques.decididas, n.denuncias.decididas],
    [t.destaques.posts, n.posts_tirados],
    [t.destaques.suspensas, n.contas.suspensas],
    [t.destaques.banidas, n.contas.banidas],
    [t.destaques.revertidos, n.recursos.revertidos],
  ];
  return (
    <>
      <ul className="rt-ladrilhos">
        {destaques.map(([rotulo, valor]) => (
          <li key={rotulo} className="rt-ladrilho">
            <Numero lang={lang} n={valor} menos={t.menosDe3} reservado={t.reservado} />
            <span>{rotulo}</span>
          </li>
        ))}
      </ul>

      <PorTipo lang={lang} t={t} numeros={n} />

      <div className="rt-tres">
        <section className="rt-cartao" aria-labelledby="rt-contas-t">
          <h3 id="rt-contas-t" className="al-cond">{t.contasTitulo}</h3>
          <dl className="rt-lista">
            <Linha lang={lang} t={t} rotulo={t.contas.suspensas} n={n.contas.suspensas} />
            <Linha lang={lang} t={t} rotulo={t.contas.banidas} n={n.contas.banidas} />
            <Linha lang={lang} t={t} rotulo={t.contas.retidas} n={n.contas.retidas} />
            <Linha lang={lang} t={t} rotulo={t.contas.redes} n={n.contas.redes_barradas} />
          </dl>
        </section>
        <section className="rt-cartao" aria-labelledby="rt-recursos-t">
          <h3 id="rt-recursos-t" className="al-cond">{t.recursosTitulo}</h3>
          <dl className="rt-lista">
            <Linha lang={lang} t={t} rotulo={t.recursos.recebidos} n={n.recursos.recebidos} />
            <Linha lang={lang} t={t} rotulo={t.recursos.decididos} n={n.recursos.decididos} />
            <Linha lang={lang} t={t} rotulo={t.recursos.revertidos} n={n.recursos.revertidos} />
          </dl>
        </section>
        <section className="rt-cartao" aria-labelledby="rt-rotulos-t">
          <h3 id="rt-rotulos-t" className="al-cond">{t.rotulosTitulo}</h3>
          <dl className="rt-lista">
            <Linha lang={lang} t={t} rotulo={t.rotulos.marcas} n={n.rotulos.marcas} />
            <Linha lang={lang} t={t} rotulo={t.rotulos.contestadas} n={n.rotulos.contestadas} />
            <Linha lang={lang} t={t} rotulo={t.rotulos.revertidas} n={n.rotulos.revertidas} />
          </dl>
        </section>
      </div>

      <section className="rt-bloco" aria-labelledby="rt-autoridade-t">
        <h2 id="rt-autoridade-t" className="rt-bloco-titulo al-cond">{t.autoridadeTitulo}</h2>
        <p className="rt-bloco-chamada">{t.autoridadeChamada}</p>
        <ul className="rt-ladrilhos rt-autoridade-topo">
          <li className="rt-ladrilho">
            <Numero lang={lang} n={a.recebidos} menos={t.menosDe3} reservado={t.reservado} />
            <span>{t.autoridade.recebidos}</span>
          </li>
          <li className="rt-ladrilho">
            <Numero lang={lang} n={a.contas} menos={t.menosDe3} reservado={t.reservado} />
            <span>{t.autoridade.contas}</span>
          </li>
        </ul>
        <div className="rt-autoridade">
          <section className="rt-cartao" aria-label={t.autoridade.porOrgao}>
            <h3 className="al-cond">{t.autoridade.porOrgao}</h3>
            <dl className="rt-lista">{ORGAOS.map((o) => <Linha key={o} lang={lang} t={t} rotulo={t.orgaos[o]} n={a.por_orgao[o]} />)}</dl>
          </section>
          <section className="rt-cartao" aria-label={t.autoridade.porPedido}>
            <h3 className="al-cond">{t.autoridade.porPedido}</h3>
            <dl className="rt-lista">{PEDIDOS.map((o) => <Linha key={o} lang={lang} t={t} rotulo={t.pedidos[o]} n={a.por_pedido[o]} />)}</dl>
          </section>
          <section className="rt-cartao" aria-label={t.autoridade.porResposta}>
            <h3 className="al-cond">{t.autoridade.porResposta}</h3>
            <dl className="rt-lista">{RESPOSTAS.map((o) => <Linha key={o} lang={lang} t={t} rotulo={t.respostas[o]} n={a.por_resposta[o]} />)}</dl>
          </section>
        </div>
      </section>
    </>
  );
}

/**
 * O relatório de transparência (/alumia/transparencia): o aviso de ordem sigilosa, os trimestres publicados (só números agregados,
 * a partir de 3) e como ler. Abre sem conta, também com a entrada fechada (o banco deixa a função fora da porta; a página entra em
 * LIVRES do portão da entrada).
 */
export default function TelaDaTransparencia({ lang, s }: PropsDaTelaDoPacote) {
  const textos = useTextosDosRotulos(lang);
  const [relatorio, setRelatorio] = useState<Relatorio | null>(null);
  const [erro, setErro] = useState(false);
  const [aberto, setAberto] = useState(0);

  const carregar = useCallback(() => {
    rotulos.relatorio().then((r) => {
      setRelatorio(r);
      setErro(false);
    }, () => setErro(true));
  }, []);
  useEffect(() => carregar(), [carregar]);

  if (!textos) return <Carregando rotulo={s.estados.carregando} />;
  const t = textos.transparencia;
  const tri = relatorio?.trimestres[aberto] ?? null;

  return (
    <article className="rt-pagina">
      <Cabeca lang={lang} carimbo={t.carimbo} titulo={t.titulo} chamada={t.chamada} />
      <p className="rt-bloco-chamada">
        <PorQueSemNumero lang={lang} motivo="piso" soma comRotulo />
      </p>

      {erro && (
        <div className="rt-erro" role="alert">
          <p style={{ margin: 0 }}>{t.erro}</p>
          <div className="rt-acoes">
            <button type="button" className="al-botao al-botao-contorno al-botao-p" onClick={carregar}>{t.tentar}</button>
          </div>
        </div>
      )}
      {!relatorio && !erro && <Carregando rotulo={s.estados.carregando} />}

      {relatorio && (
        <>
          <AvisoDeOrdemSigilosa lang={lang} t={t} canario={relatorio.canario} />

          {relatorio.trimestres.length === 0 ? (
            <section className="rt-vazio">
              <h2 className="al-cond">{t.vazioTitulo}</h2>
              <p>{por(t.vazio, { inicio: dataNoIdioma(lang, relatorio.proximo.inicio), fim: dataNoIdioma(lang, relatorio.proximo.fim), data: dataNoIdioma(lang, relatorio.proximo.sai_em) })}</p>
            </section>
          ) : (
            <>
              <div className="rt-abas" role="group" aria-label={t.escolher}>
                {relatorio.trimestres.map((x, i) => (
                  <button key={x.inicio} type="button" aria-pressed={i === aberto} aria-controls="rt-tri" className="rt-aba" onClick={() => setAberto(i)}>
                    {nomeDoTrimestre(t.trimestreCurto, x.inicio)}
                  </button>
                ))}
              </div>
              {tri && (
                <div id="rt-tri" aria-live="polite">
                  <p className="rt-periodo">
                    <strong>{nomeDoTrimestre(t.trimestre, tri.inicio)}</strong>
                    {" · "}{por(t.periodo, { inicio: dataNoIdioma(lang, tri.inicio), fim: dataNoIdioma(lang, tri.fim) })}
                    {" · "}{por(t.fechadoEm, { data: dataNoIdioma(lang, tri.fechado_em) })}
                  </p>
                  <UmTrimestre lang={lang} t={t} tri={tri} />
                </div>
              )}
              <p className="rt-nota" style={{ marginBottom: "2.2rem" }}>
                {por(t.proximo, { inicio: dataNoIdioma(lang, relatorio.proximo.inicio), fim: dataNoIdioma(lang, relatorio.proximo.fim), data: dataNoIdioma(lang, relatorio.proximo.sai_em) })}
              </p>
            </>
          )}

          <section className="rt-bloco" aria-labelledby="rt-como-ler-t">
            <h2 id="rt-como-ler-t" className="rt-bloco-titulo al-cond">{t.comoLerTitulo}</h2>
            <ul className="rt-itens">
              {t.comoLer.map((item, i) => (
                <li key={i}><Rico lang={lang} texto={item} /></li>
              ))}
            </ul>
          </section>
        </>
      )}
    </article>
  );
}
