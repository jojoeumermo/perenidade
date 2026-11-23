// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { preencher } from "@/lib/rede/preencher";
import type { TipoDaVotacao } from "@/lib/rede/voto/limiar";
import type { EstadoDaUrna } from "@/lib/rede/voto/urna";
import { naUrna, urna } from "@/lib/rede/voto/cliente";
import { urnaDePrevia } from "@/lib/rede/voto/previa";
import { Botao } from "../ui/Botao";
import { erroDoVoto, useTextosDoVoto, type TextosDoVoto } from "./textos";
import "./voto.css";

/** O que a tela usa da urna (a de verdade, lib/rede/voto/urna.ts, ou o dublê da prévia). */
interface UrnaDaTela {
  estado(tipo: TipoDaVotacao, alvo: string, fechada?: boolean): Promise<EstadoDaUrna>;
  minhaChave(): Promise<{ identidade: boolean; diretorio: boolean; publicada: boolean; aqui: boolean; confere: boolean }>;
  criarMinhaChave(): Promise<void>;
  guardiasPossiveis(tipo: TipoDaVotacao, alvo: string): Promise<{ usuario: string; nome: string; eu: boolean; assinada: boolean }[]>;
  publicarChave(tipo: TipoDaVotacao, alvo: string, escolhidas: string[], k: number): Promise<string>;
  conferirMinhaParte(tipo: TipoDaVotacao, alvo: string): Promise<"ok" | "nao_abre" | "sem_chave_aqui">;
  entregarParte(tipo: TipoDaVotacao, alvo: string): Promise<{ entregues: number; abridora: number; souAbridora: boolean }>;
  apurar(tipo: TipoDaVotacao, alvo: string): Promise<{ apuradas: number; nulas: number } | { faltam: number }>;
}

const PREVIA = process.env.NEXT_PUBLIC_ALUMIA_PREVIA === "sim";
let dePrevia: UrnaDaTela | null = null;
const daTela = (): UrnaDaTela => (PREVIA ? (dePrevia ??= urnaDePrevia()) : urna);

/**
 * O voto secreto em limiar de UMA votação (consulta à base, votação da comunidade ou da equipe), do jeito que cada pessoa o vê:
 *   - sem chave: quem abriu a votação escolhe as guardiãs (a coordenação) e cria a chave neste aparelho; os outros ficam sabendo
 *     que ainda não se vota;
 *   - com chave: as guardiãs, quantas abrem, a impressão da chave para comparar, e os avisos se o registro não confere;
 *   - fechada: cada guardiã entrega a parte dela; a abridora abre as cédulas no aparelho dela e conta;
 *   - quem é da coordenação: a própria chave de guardiã (criar, saber se está neste aparelho), com os riscos ditos.
 */
export function UrnaSecreta({ tipo, alvo, lang, fechada = false, aoMudar }: { tipo: TipoDaVotacao; alvo: string; lang: string; fechada?: boolean; aoMudar?: () => void }) {
  const t = useTextosDoVoto(lang);
  const id = useId();
  const [e, setE] = useState<EstadoDaUrna | null>(null);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [escolher, setEscolher] = useState(false);
  const [parte, setParte] = useState<"" | "ok" | "nao_abre" | "sem_chave_aqui">("");

  // Cada ação acaba relendo o estado (a versão sobe); a leitura é pedida ao banco e chega numa promessa.
  const [versao, setVersao] = useState(0);
  const ler = useCallback(() => setVersao((v) => v + 1), []);
  useEffect(() => {
    let vivo = true;
    naUrna(() => daTela().estado(tipo, alvo, fechada)).then(
      (x) => {
        if (!vivo) return;
        setE(x);
        setErro("");
      },
      (x) => vivo && setErro(t ? erroDoVoto(t, x) : ""),
    );
    return () => {
      vivo = false;
    };
  }, [tipo, alvo, fechada, t, versao]);

  async function agir<T>(fazer: () => Promise<T>, depois: (r: T) => void) {
    if (!t) return;
    setOcupado(true);
    setErro("");
    setAviso("");
    try {
      depois(await naUrna(fazer));
      ler();
    } catch (x) {
      setErro(erroDoVoto(t, x));
    } finally {
      setOcupado(false);
    }
  }

  if (!t) return null;
  const tu = t.urna;
  const comChave = e?.chave ? e : null;
  const souGuardia = !!comChave && comChave.meuIndice !== null;
  const souAbridora = souGuardia && comChave?.abridora === comChave?.meuIndice;
  const k = comChave?.chave?.k ?? 0;
  const n = comChave?.chave?.n ?? 0;
  const esperandoAbrir = !!comChave && comChave.situacao === "fechada" && comChave.cedulas && !comChave.apurada;

  return (
    <section className="vt-urna" aria-labelledby={`${id}-t`}>
      <h4 id={`${id}-t`} className="vt-titulo">
        <span aria-hidden className="vt-cadeado">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="11" width="16" height="10" rx="2" />
            <path d="M8 11V7a4 4 0 0 1 8 0v4" />
          </svg>
        </span>
        {t.titulo}
      </h4>

      {!e ? (
        <p className="vt-nota" role="status">
          {erro || t.carregando}
        </p>
      ) : !comChave ? (
        e.situacao === "aberta" ? (
          e.possoCriar ? (
            <>
              <p className="vt-texto">{tu.semChaveCriar}</p>
              {escolher ? (
                <Escolha t={t} tipo={tipo} alvo={alvo} aoFechar={() => setEscolher(false)} aoPronto={(imp) => { setEscolher(false); setAviso(preencher(t.escolha.pronto, { impressao: imp })); ler(); aoMudar?.(); }} />
              ) : (
                <div className="vt-acoes">
                  <Botao onClick={() => setEscolher(true)}>{tu.escolher}</Botao>
                </div>
              )}
            </>
          ) : (
            <p className="vt-texto vt-forte">{tu.semChave}</p>
          )
        ) : null
      ) : (
        <>
          {comChave.conferencia !== "ok" ? (
            <p className="vt-alerta" role="alert">{tu.naoConfere}</p>
          ) : comChave.identidades === "trocada" ? (
            <p className="vt-alerta" role="alert">{tu.trocada}</p>
          ) : null}
          <p className="vt-texto">{preencher(tu.abrem, { k, n })}</p>
          {comChave.guardias.length > 0 ? <p className="vt-nota">{preencher(tu.guardias, { nomes: comChave.guardias.map((g) => g.nome).join(", ") })}</p> : null}
          {comChave.impressao ? (
            <div className="vt-impressao">
              <p className="vt-impressao-rotulo">{preencher(tu.impressao, { impressao: "" }).replace(/[:：]\s*$/, "")}</p>
              <p className="vt-impressao-numero" translate="no">{comChave.impressao}</p>
              <p className="vt-nota">{comChave.identidades === "conferida" ? tu.impressaoAjuda : tu.naoConferida}</p>
            </div>
          ) : null}

          {souGuardia ? <p className="vt-texto vt-forte">{tu.souGuardia}</p> : null}
          {souGuardia && comChave.situacao === "aberta" ? (
            <div className="vt-acoes">
              <Botao variante="contorno" tamanho="p" disabled={ocupado} onClick={() => void agir(() => daTela().conferirMinhaParte(tipo, alvo), setParte)}>
                {tu.conferirParte}
              </Botao>
              {parte ? (
                <span className={parte === "ok" ? "vt-ok" : "vt-alerta-curto"} role="status">
                  {parte === "ok" ? tu.parteOk : parte === "nao_abre" ? tu.parteNao : tu.parteSemChave}
                </span>
              ) : null}
            </div>
          ) : null}

          {esperandoAbrir ? (
            <div className="vt-abrir">
              <p className="vt-texto" role="status">{preencher(tu.esperando, { e: comChave.entregues ?? 0, k })}</p>
              {souGuardia && !comChave.entreguei ? (
                <div className="vt-acoes">
                  <Botao disabled={ocupado} onClick={() => void agir(() => daTela().entregarParte(tipo, alvo), (r) => setAviso(preencher(tu.entregue, { e: r.entregues, k })))}>
                    {ocupado ? tu.entregando : tu.entregar}
                  </Botao>
                </div>
              ) : null}
              {souAbridora ? (
                <>
                  <p className="vt-nota">{preencher(tu.abridora, { k })}</p>
                  <div className="vt-acoes">
                    <Botao variante="dourado" disabled={ocupado || (comChave.entregues ?? 0) < k} onClick={() => void agir(() => daTela().apurar(tipo, alvo), (r) => {
                      if ("faltam" in r) setAviso(preencher(tu.faltam, { n: r.faltam }));
                      else {
                        setAviso(preencher(tu.apurada, { a: r.apuradas, nulas: r.nulas }));
                        aoMudar?.();
                      }
                    })}>
                      {ocupado ? tu.apurando : tu.apurar}
                    </Botao>
                    {(comChave.entregues ?? 0) < k ? <span className="vt-nota">{preencher(tu.faltam, { n: k - (comChave.entregues ?? 0) })}</span> : null}
                  </div>
                </>
              ) : null}
            </div>
          ) : null}
        </>
      )}

      {e?.possoGuardar ? <MinhaChave t={t} /> : null}
      {aviso ? <p className="vt-ok" role="status">{aviso}</p> : null}
      {erro && e ? <p className="vt-alerta-curto" role="alert">{erro}</p> : null}
    </section>
  );
}

/** A escolha das guardiãs e de K, e a criação da chave da votação neste aparelho. */
function Escolha({ t, tipo, alvo, aoFechar, aoPronto }: { t: TextosDoVoto; tipo: TipoDaVotacao; alvo: string; aoFechar: () => void; aoPronto: (impressao: string) => void }) {
  const te = t.escolha;
  const id = useId();
  const [lista, setLista] = useState<{ usuario: string; nome: string; eu: boolean; assinada: boolean }[] | null>(null);
  const [marcadas, setMarcadas] = useState<string[]>([]);
  const [k, setK] = useState(2);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let vivo = true;
    naUrna(() => daTela().guardiasPossiveis(tipo, alvo)).then(
      (l) => {
        if (!vivo) return;
        setLista(l);
        const boas = l.filter((g) => g.assinada).slice(0, 7).map((g) => g.usuario);
        setMarcadas(boas);
        setK(boas.length >= 5 ? 3 : 2);
      },
      (x) => vivo && setErro(erroDoVoto(t, x)),
    );
    return () => {
      vivo = false;
    };
  }, [tipo, alvo, t]);

  const boas = (lista ?? []).filter((g) => g.assinada);
  const n = marcadas.length;
  const kValido = Math.min(Math.max(2, k), Math.max(2, n));

  async function publicar() {
    setOcupado(true);
    setErro("");
    try {
      aoPronto(await naUrna(() => daTela().publicarChave(tipo, alvo, marcadas, kValido)));
    } catch (x) {
      setErro(erroDoVoto(t, x));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="vt-escolha" role="group" aria-labelledby={`${id}-e`}>
      <p id={`${id}-e`} className="vt-subtitulo">{te.titulo}</p>
      <p className="vt-nota">{te.explica}</p>
      {!lista ? (
        <p className="vt-nota" role="status">{erro || t.carregando}</p>
      ) : boas.length < 3 ? (
        <p className="vt-texto vt-forte">{preencher(te.poucas, { n: boas.length })}</p>
      ) : (
        <>
          <fieldset className="vt-guardias" disabled={ocupado}>
            <legend className="vt-oculto">{te.titulo}</legend>
            {lista.map((g) => (
              <label key={g.usuario} className={`vt-guardia ${g.assinada ? "" : "vt-guardia-ruim"}`}>
                <input
                  type="checkbox"
                  disabled={!g.assinada || (!marcadas.includes(g.usuario) && n >= 7)}
                  checked={marcadas.includes(g.usuario)}
                  onChange={(ev) => setMarcadas((m) => (ev.target.checked ? [...m, g.usuario] : m.filter((u) => u !== g.usuario)))}
                />
                <span>
                  {g.nome}
                  {g.eu ? ` (${te.voce})` : ""}
                  {g.assinada ? null : <span className="vt-nota"> · {te.semAssinatura}</span>}
                </span>
              </label>
            ))}
          </fieldset>
          <label className="vt-k">
            <span>{te.k}</span>
            <select value={kValido} onChange={(ev) => setK(Number(ev.target.value))} disabled={ocupado || n < 3}>
              {Array.from({ length: Math.max(0, n - 1) }, (_, i) => i + 2).map((x) => (
                <option key={x} value={x}>
                  {x} / {n}
                </option>
              ))}
            </select>
          </label>
        </>
      )}
      <div className="vt-acoes">
        <Botao disabled={ocupado || n < 3 || n > 7} onClick={() => void publicar()}>
          {ocupado ? te.publicando : te.publicar}
        </Botao>
        <Botao variante="contorno" disabled={ocupado} onClick={aoFechar}>
          {te.cancelar}
        </Botao>
      </div>
      {erro && lista ? <p className="vt-alerta-curto" role="alert">{erro}</p> : null}
    </div>
  );
}

/** A chave de guardiã desta conta: criar, saber se está neste aparelho e publicada, com os riscos ditos. */
function MinhaChave({ t }: { t: TextosDoVoto }) {
  const tg = t.guardia;
  const [m, setM] = useState<Awaited<ReturnType<UrnaDaTela["minhaChave"]>> | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const ler = useCallback(() => naUrna(() => daTela().minhaChave()).then(setM, (x) => setErro(erroDoVoto(t, x))), [t]);
  useEffect(() => {
    void ler();
  }, [ler]);

  async function criar() {
    setOcupado(true);
    setErro("");
    try {
      await naUrna(() => daTela().criarMinhaChave());
      await ler();
    } catch (x) {
      setErro(erroDoVoto(t, x));
    } finally {
      setOcupado(false);
    }
  }

  const estado = !m ? "" : !m.identidade ? tg.semIdentidade : !m.diretorio ? tg.semDiretorio : !m.publicada ? tg.nenhuma : m.confere ? tg.ok : tg.outroAparelho;
  const posso = !!m && m.identidade && m.diretorio;
  return (
    <details className="vt-minha" open={!!m && posso && !m.publicada}>
      <summary>{tg.titulo}</summary>
      <p className="vt-nota">{tg.explica}</p>
      {m ? <p className={`vt-texto ${m.confere ? "vt-ok-texto" : "vt-forte"}`}>{estado}</p> : null}
      {posso ? (
        <>
          <p className="vt-nota">{tg.riscos}</p>
          <div className="vt-acoes">
            <Botao variante={m?.publicada ? "contorno" : "primario"} tamanho="p" disabled={ocupado} onClick={() => void criar()}>
              {ocupado ? tg.criando : m?.publicada ? tg.trocar : tg.criar}
            </Botao>
          </div>
        </>
      ) : null}
      {erro ? <p className="vt-alerta-curto" role="alert">{erro}</p> : null}
    </details>
  );
}
