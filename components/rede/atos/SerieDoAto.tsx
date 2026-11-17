// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useId, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "@/components/Link";
import { Botao } from "../ui/Botao";
import { useAnuncio } from "./usarQuadro";
import { diaCurto, diaDaData, fraseDoEvento, horaDe } from "./usarEventos";
import { conferirSerie, datasDaSerie, diaDoAto, MAX_EXCECOES } from "@/lib/rede/atos/eventos";
import { atos as cliente } from "@/lib/rede/cliente-atos";
import { preencherAto, type TextosDosAtos } from "@/lib/rede/textos-atos";
import { FREQUENCIAS_DA_SERIE, type Ato, type DataDaSerie, type FrequenciaDaSerie, type MaisDoAto } from "@/lib/rede/tipos-atos";
import "./eventos.css";

const DIA = 86_400_000;
const somarDias = (data: string, n: number) => new Date(Date.parse(`${data}T12:00:00Z`) + n * DIA).toISOString().slice(0, 10);

/**
 * A série do ato (L2-57): "Repete toda semana até 20/12", com as datas em ladrilhos (cada data aberta é um ato próprio, com link;
 * a pulada vai riscada; a que ainda não abriu diz "abre perto da data"). Quem chamou pula uma data ou encerra a série; e, num ato
 * que ainda não se repete, monta a série (frequência, até quando e as datas para pular, com a prévia das datas).
 */
export function SerieDoAto({ ato, mais, t, lang, trocar }: { ato: Ato; mais: MaisDoAto; t: TextosDosAtos; lang: string; trocar: (m: MaisDoAto) => void }) {
  const ts = t.eventos.serie;
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [aberto, setAberto] = useState(false);
  const [anuncio, anunciar] = useAnuncio();
  // A hora em que a página abriu: decide quais datas ainda podem ser puladas (o servidor confere de novo).
  const [agora] = useState(() => Date.now());
  const id = useId();
  const titulo = useRef<HTMLHeadingElement>(null);
  const serie = mais.serie;

  const agir = async (f: () => Promise<MaisDoAto>, pronta: string) => {
    if (ocupado) return;
    setOcupado(true);
    setErro(null);
    try {
      trocar(await f());
      anunciar(pronta);
      setConfirmando(false);
      setAberto(false);
      requestAnimationFrame(() => titulo.current?.focus());
    } catch (e) {
      setErro(fraseDoEvento(t, e));
    } finally {
      setOcupado(false);
    }
  };

  if (!serie && !mais.pode_repetir) return null;

  if (!serie) {
    return (
      <section className="al-ev al-ev-serie" aria-labelledby={`${id}-t`}>
        <h2 id={`${id}-t`} ref={titulo} tabIndex={-1} className="al-cond al-ev-titulo">
          {ts.repetir}
        </h2>
        <p className="al-ev-ajuda">{ts.repetirExplica}</p>
        {aberto ? (
          <FormularioDaSerie ato={ato} t={t} lang={lang} ocupado={ocupado} erro={erro} aoDesistir={() => { setErro(null); setAberto(false); }} aoSalvar={(p) => void agir(() => cliente.serieCriar(ato.id, p), ts.criada)} />
        ) : (
          <div className="al-ev-acoes">
            <Botao variante="contorno" onClick={() => setAberto(true)}>
              {ts.repetir}
            </Botao>
          </div>
        )}
        <p className="sr-only" role="status" aria-live="polite">
          {anuncio}
        </p>
      </section>
    );
  }

  const freq = ts[serie.frequencia];
  const futuras = (d: DataDaSerie) => Date.parse(d.inicio) > agora && d.situacao !== "pulada" && d.situacao !== "cancelado";
  return (
    <section className="al-ev al-ev-serie" aria-labelledby={`${id}-t`}>
      <h2 id={`${id}-t`} ref={titulo} tabIndex={-1} className="al-cond al-ev-titulo">
        <span>{ts.titulo}</span> <span className="al-ev-titulo-forte">{freq}</span>
      </h2>
      <p className="al-ev-ajuda">
        {serie.encerrada ? ts.encerrada : preencherAto(ts.ate, { data: diaDaData(serie.ate, lang) })}
      </p>
      {serie.datas.length ? (
        <ol className="al-ev-datas" aria-label={ts.datas}>
          {serie.datas.map((d) => {
            const situacao = d.situacao === "pulada" ? ts.pulada : d.situacao === "prevista" ? ts.prevista : t.situacao[d.situacao];
            const corpo = (
              <>
                <span className="al-ev-data-dia">{diaCurto(d.inicio, lang)}</span>
                <span className="al-ev-data-hora">{horaDe(d.inicio, lang)}</span>
                <span className="al-ev-data-carimbo">{d.atual ? ts.esta : situacao}</span>
              </>
            );
            return (
              <li key={d.data} className="al-ev-data" data-situacao={d.situacao} data-atual={d.atual || undefined}>
                {d.id && !d.atual ? (
                  <Link href={`/${lang}/alumia/ato/${d.id}`} className="al-ev-data-corpo" aria-label={`${preencherAto(ts.abrir, { data: diaCurto(d.inicio, lang) })} · ${situacao}`}>
                    {corpo}
                  </Link>
                ) : (
                  <span className="al-ev-data-corpo" aria-current={d.atual ? "page" : undefined}>
                    {corpo}
                  </span>
                )}
                {mais.chamou && !serie.encerrada && !d.atual && futuras(d) ? (
                  <button type="button" className="al-ev-pular" disabled={ocupado} aria-label={preencherAto(ts.pularRotulo, { data: diaCurto(d.inicio, lang) })} onClick={() => void agir(() => cliente.seriePular(ato.id, d.data), ts.pulou)}>
                    {ts.pular}
                  </button>
                ) : null}
              </li>
            );
          })}
        </ol>
      ) : null}
      {mais.chamou && !serie.encerrada ? (
        confirmando ? (
          <div className="al-ev-confirma" role="group" aria-labelledby={`${id}-c`}>
            <p id={`${id}-c`}>{ts.confirmarEncerrar}</p>
            <div className="al-ev-acoes">
              <Botao variante="primario" disabled={ocupado} aria-busy={ocupado || undefined} onClick={() => void agir(() => cliente.serieEncerrar(ato.id), ts.fechou)}>
                {ts.sim}
              </Botao>
              <Botao variante="fantasma" disabled={ocupado} onClick={() => setConfirmando(false)}>
                {ts.nao}
              </Botao>
            </div>
          </div>
        ) : (
          <div className="al-ev-acoes">
            <Botao variante="fantasma" tamanho="p" onClick={() => setConfirmando(true)}>
              {ts.encerrar}
            </Botao>
          </div>
        )
      ) : null}
      {erro ? (
        <p role="alert" className="al-ato-erro">
          {erro}
        </p>
      ) : null}
      <p className="sr-only" role="status" aria-live="polite">
        {anuncio}
      </p>
    </section>
  );
}

/** O formulário de repetir: frequência em três pílulas, até quando, datas para pular e a prévia das datas (a mesma conta do banco). */
function FormularioDaSerie({ ato, t, lang, ocupado, erro, aoDesistir, aoSalvar }: { ato: Ato; t: TextosDosAtos; lang: string; ocupado: boolean; erro: string | null; aoDesistir: () => void; aoSalvar: (p: { frequencia: FrequenciaDaSerie; ate: string; excecoes: string[] }) => void }) {
  const ts = t.eventos.serie;
  const dia = diaDoAto(ato.inicio);
  const [frequencia, setFrequencia] = useState<FrequenciaDaSerie>("semanal");
  const [ate, setAte] = useState(() => somarDias(dia, 56));
  const [pular, setPular] = useState("");
  const [excecoes, setExcecoes] = useState<string[]>([]);
  const [problema, setProblema] = useState<string | null>(null);
  const id = useId();
  const datas = useMemo(() => datasDaSerie(ato.inicio, { frequencia, ate, excecoes }, 60), [ato.inicio, frequencia, ate, excecoes]);
  const mostrar = datas.slice(0, 8);

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    const c = conferirSerie({ frequencia, ate, excecoes }, ato.inicio);
    if (!c.ok) return setProblema(ts.problemas[c.problema]);
    setProblema(null);
    aoSalvar({ frequencia, ate, excecoes });
  };
  const addExcecao = () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(pular) || excecoes.includes(pular)) return;
    if (excecoes.length >= MAX_EXCECOES) return setProblema(ts.problemas.excecoes);
    setExcecoes([...excecoes, pular].sort());
    setPular("");
  };
  const mensagem = problema ?? erro;

  return (
    <form className="al-ev-form" onSubmit={enviar} noValidate>
      <fieldset className="al-ev-pilulas">
        <legend className="al-ev-rotulo">{ts.frequencia}</legend>
        {FREQUENCIAS_DA_SERIE.map((f) => (
          <label key={f} className="al-ev-pilula" data-ligada={f === frequencia || undefined}>
            <input type="radio" name={`${id}-freq`} value={f} checked={f === frequencia} onChange={() => setFrequencia(f)} />
            {ts[f]}
          </label>
        ))}
      </fieldset>
      <div className="al-ev-form-linha">
        <label className="al-ev-campo">
          <span className="al-ev-rotulo">{ts.campoAte}</span>
          <input type="date" className="al-ato-form-campo" value={ate} min={somarDias(dia, 1)} max={somarDias(dia, 365)} onChange={(e) => setAte(e.target.value)} aria-describedby={`${id}-ate`} />
          <small id={`${id}-ate`} className="al-ev-ajuda">
            {ts.campoAteAjuda}
          </small>
        </label>
        <div className="al-ev-campo">
          <label htmlFor={`${id}-pular`} className="al-ev-rotulo">
            {ts.excecoes}
          </label>
          <div className="al-ev-linha-campo">
            <input id={`${id}-pular`} type="date" className="al-ato-form-campo" value={pular} min={somarDias(dia, 1)} max={ate} onChange={(e) => setPular(e.target.value)} />
            <Botao variante="contorno" onClick={addExcecao} disabled={!pular}>
              {ts.addExcecao}
            </Botao>
          </div>
          {excecoes.length ? (
            <ul className="al-ev-excecoes" role="list">
              {excecoes.map((d) => (
                <li key={d}>
                  <span>{diaDaData(d, lang)}</span>
                  <button type="button" className="al-q-tirar" aria-label={preencherAto(ts.tirarExcecao, { data: diaDaData(d, lang) })} title={preencherAto(ts.tirarExcecao, { data: diaDaData(d, lang) })} onClick={() => setExcecoes(excecoes.filter((x) => x !== d))}>
                    ×
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
      <div className="al-ev-previa">
        <p className="al-ev-rotulo">{ts.previa}</p>
        <ol className="al-ev-datas al-ev-datas-previa">
          {mostrar.map((d) => (
            <li key={d.data} className="al-ev-data" data-situacao={d.pulada ? "pulada" : "prevista"}>
              <span className="al-ev-data-corpo">
                <span className="al-ev-data-dia">{diaCurto(d.inicio, lang)}</span>
                <span className="al-ev-data-hora">{horaDe(d.inicio, lang)}</span>
                {d.pulada ? <span className="al-ev-data-carimbo">{ts.pulada}</span> : null}
              </span>
            </li>
          ))}
        </ol>
        {datas.length > mostrar.length ? <p className="al-ev-ajuda">{preencherAto(ts.mais, { n: datas.length - mostrar.length })}</p> : null}
      </div>
      {mensagem ? (
        <p role="alert" className="al-ato-erro">
          {mensagem}
        </p>
      ) : null}
      <div className="al-ev-acoes">
        <Botao type="submit" variante="dourado" disabled={ocupado} aria-busy={ocupado || undefined}>
          {ts.salvar}
        </Botao>
        <Botao variante="fantasma" onClick={aoDesistir} disabled={ocupado}>
          {ts.desistir}
        </Botao>
      </div>
    </form>
  );
}
