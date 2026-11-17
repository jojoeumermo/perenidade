// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from "react";
import Link from "@/components/Link";
import { Botao } from "../ui/Botao";
import { TextoComMencoes } from "../conversa/TextoComMencoes";
import { useModoAto } from "../modoato/usar";
import { useAnuncio } from "./usarQuadro";
import { fraseDoEvento, horaDe } from "./usarEventos";
import { juntarLinha } from "@/lib/rede/atos/eventos";
import { verificarAntesDePublicar, type MemoriaDosAvisos } from "@/lib/rede/modoato/antes-de-publicar";
import { carregarTextosDoModoAto } from "@/lib/rede/modoato/textos";
import { atos as cliente } from "@/lib/rede/cliente-atos";
import { preencherAto, type TextosDosAtos } from "@/lib/rede/textos-atos";
import { enderecos, type Post } from "@/lib/rede/tipos";
import type { Ato, MaisDoAto } from "@/lib/rede/tipos-atos";
import "./eventos.css";

const LIMITE = 500;
/** De quanto em quanto tempo a linha pergunta o que chegou (só com a aba à vista e a linha aberta). */
const INTERVALO_MS = 30_000;

/** O "já avisei" da verificação de dado pessoal (uma por aba; some ao recarregar). */
const memoria: MemoriaDosAvisos = new Map();

/**
 * A linha ao vivo do ato: os posts escritos aqui durante o ato, em ORDEM DE CHEGADA (o mais antigo em cima), sem ranking. Cada
 * post continua com o público dele (o servidor só manda o que esta pessoa pode ver). Enquanto a linha está aberta e a aba à vista,
 * pergunta de 30 em 30 segundos só o que chegou depois do último; o que chega fica guardado até a pessoa pedir para ver (a lista
 * não pula debaixo do dedo). Escrever passa pela mesma verificação de dado pessoal do compositor (CPF, telefone, placa) e respeita
 * o modo ato; foto não entra aqui (vai pelo álbum, com os rostos borrados).
 */
export function LinhaAoVivo({ ato, mais, t, lang, logado }: { ato: Ato; mais: MaisDoAto; t: TextosDosAtos; lang: string; logado: boolean }) {
  const tl = t.eventos.linha;
  const [itens, setItens] = useState<Post[] | null>(null);
  const [chegando, setChegando] = useState<Post[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [texto, setTexto] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [anuncio, anunciar] = useAnuncio();
  const modoAto = useModoAto();
  const id = useId();
  const lista = useRef<HTMLOListElement>(null);
  const campo = useRef<HTMLTextAreaElement>(null);
  const cursorRef = useRef<string | null>(null);
  useEffect(() => {
    cursorRef.current = cursor;
  }, [cursor]);

  useEffect(() => {
    let vivo = true;
    cliente
      .linha(ato.id)
      .then((l) => {
        if (!vivo) return;
        setItens(l.itens);
        setCursor(l.proximo);
      })
      .catch((e) => vivo && setErro(fraseDoEvento(t, e)));
    return () => {
      vivo = false;
    };
  }, [ato.id, t]);

  const buscarNovos = useCallback(async () => {
    try {
      const l = await cliente.linha(ato.id, cursorRef.current);
      if (l.itens.length) {
        setChegando((antes) => juntarLinha(antes, l.itens));
        setCursor(l.proximo);
      }
    } catch {
      // Sem rede agora: tenta na próxima volta.
    }
  }, [ato.id]);

  useEffect(() => {
    if (!mais.linha.aberta || itens === null) return;
    const relogio = window.setInterval(() => {
      if (document.visibilityState === "visible") void buscarNovos();
    }, INTERVALO_MS);
    return () => window.clearInterval(relogio);
  }, [mais.linha.aberta, itens, buscarNovos]);

  const mostrarChegados = () => {
    setItens((antes) => juntarLinha(antes ?? [], chegando));
    setChegando([]);
    requestAnimationFrame(() => lista.current?.lastElementChild?.querySelector<HTMLElement>("[data-foco]")?.focus());
  };

  const publicar = async (e: FormEvent) => {
    e.preventDefault();
    const limpo = texto.trim();
    if (!limpo || ocupado) return;
    setAviso(null);
    const verificar = (await carregarTextosDoModoAto(lang)).verificar;
    const v = verificarAntesDePublicar({ texto: limpo, extras: { imagens: 0 } }, { t: verificar, modoAto: modoAto.ligado, memoria });
    if (!v.ok) {
      setAviso(v.aviso);
      campo.current?.focus();
      return;
    }
    setOcupado(true);
    setErro(null);
    try {
      const p = await cliente.linhaPublicar(ato.id, limpo);
      setTexto("");
      setItens((antes) => juntarLinha([...(antes ?? []), ...chegando], [p]));
      setChegando([]);
      setCursor(`${p.criado_em}|${p.id}`);
      anunciar(tl.publicado);
    } catch (er) {
      setErro(fraseDoEvento(t, er));
    } finally {
      setOcupado(false);
    }
  };

  const tirar = async (p: Post) => {
    setErro(null);
    try {
      await cliente.linhaTirar(p.id);
      setItens((antes) => (antes ?? []).filter((x) => x.id !== p.id));
      anunciar(tl.tirado);
    } catch (er) {
      setErro(fraseDoEvento(t, er));
    }
  };

  // Linha fechada e vazia (ato que ainda não chegou perto, ou que já passou sem ninguém escrever): não ocupa a página.
  if (!mais.linha.aberta && itens !== null && itens.length === 0) return null;

  return (
    <section className="al-ev al-ev-linha" aria-labelledby={`${id}-t`} aria-busy={itens === null || undefined}>
      <header className="al-ev-cabeca">
        <h2 id={`${id}-t`} className="al-cond al-ev-titulo">
          {mais.linha.aberta ? <span className="al-ev-aovivo" aria-hidden /> : null}
          {tl.titulo}
        </h2>
        <span className="al-ev-etiqueta">{tl.ordem}</span>
      </header>
      <p className="al-ev-ajuda">{tl.explica}</p>
      {!mais.linha.aberta ? <p className="al-ev-ajuda">{tl.fechada}</p> : null}

      {itens === null && !erro ? <p className="al-ev-ajuda">{t.tela.carregando}</p> : null}
      {itens && itens.length === 0 ? <p className="al-ev-ajuda">{tl.vazia}</p> : null}
      {itens && itens.length ? (
        <ol ref={lista} className="al-ev-fio">
          {itens.map((p) => (
            <li key={p.id} className="al-ev-fio-item" data-meu={p.meu || undefined}>
              <time className="al-ev-fio-hora" dateTime={p.criado_em}>
                {horaDe(p.criado_em, lang)}
              </time>
              <div className="al-ev-fio-corpo">
                <p className="al-ev-fio-quem">
                  {p.autor.handle && p.autor.perfil ? (
                    <Link href={enderecos.perfil(lang, p.autor.handle)}>{p.autor.codinome}</Link>
                  ) : (
                    <span>{p.autor.codinome}</span>
                  )}
                  {p.meu ? <span className="al-ev-fio-voce"> · {tl.voce}</span> : null}
                </p>
                <p className="al-ev-fio-texto">
                  <TextoComMencoes texto={p.texto} lang={lang} />
                </p>
                <div className="al-ev-fio-acoes">
                  <Link href={enderecos.post(lang, p.id)} className="al-ev-link" data-foco="">
                    {tl.abrir}
                  </Link>
                  {logado && (p.meu || mais.organiza) ? (
                    <button type="button" className="al-ev-link al-ev-link-botao" onClick={() => void tirar(p)}>
                      {tl.tirar}
                    </button>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ol>
      ) : null}

      {chegando.length ? (
        <div className="al-ev-acoes">
          <Botao variante="claro" onClick={mostrarChegados}>
            {tl.novos} <span data-al-numero="">({chegando.length})</span>
          </Botao>
        </div>
      ) : null}

      {mais.linha.pode_escrever ? (
        <form className="al-ev-escrever" onSubmit={(e) => void publicar(e)} noValidate>
          <label htmlFor={`${id}-campo`} className="al-ev-rotulo">
            {tl.campo}
          </label>
          <textarea
            ref={campo}
            id={`${id}-campo`}
            className="al-ato-form-campo al-ev-caixa-texto"
            value={texto}
            onChange={(e) => {
              setTexto(e.target.value.slice(0, LIMITE));
              if (aviso) setAviso(null);
            }}
            rows={3}
            maxLength={LIMITE}
            placeholder={tl.exemplo}
            aria-describedby={`${id}-ajuda${aviso ? ` ${id}-aviso` : ""}`}
          />
          <div className="al-ev-escrever-pe">
            <small id={`${id}-ajuda`} className="al-ev-ajuda">
              {tl.semFoto} · <span data-al-numero="">{preencherAto(tl.restam, { n: LIMITE - texto.length })}</span>
            </small>
            <Botao type="submit" variante="primario" disabled={ocupado || !texto.trim()} aria-busy={ocupado || undefined}>
              {tl.publicar}
            </Botao>
          </div>
          {aviso ? (
            <p id={`${id}-aviso`} role="alert" className="al-ato-erro">
              {aviso}
            </p>
          ) : null}
        </form>
      ) : mais.linha.aberta && !logado ? (
        <p className="al-ev-ajuda">{tl.entrar}</p>
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
