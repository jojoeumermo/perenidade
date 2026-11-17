// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Botao } from "../ui/Botao";
import { apagarFotoDoAlbum, enderecoDaFoto } from "./albumNoAparelho";
import { EnviarFoto } from "./EnviarFoto";
import { useAnuncio, useQuadro } from "./usarQuadro";
import { fraseDoEvento } from "./usarEventos";
import { atos as cliente, PREVIA_DOS_ATOS } from "@/lib/rede/cliente-atos";
import type { TextosDosAtos } from "@/lib/rede/textos-atos";
import type { AlbumDoAto as Album, Ato, FotoDoAlbum, MaisDoAto } from "@/lib/rede/tipos-atos";
import "./eventos.css";

/** Uma foto do álbum: o endereço assinado só é pedido quando a foto entra na tela (e vale uma hora). */
function Foto({ foto, t, aoAbrir }: { foto: FotoDoAlbum; t: TextosDosAtos; aoAbrir?: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [falhou, setFalhou] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = caixa.current;
    if (!el) return;
    let vivo = true;
    const pedir = () => {
      enderecoDaFoto(foto.id)
        .then((u) => vivo && setUrl(u))
        .catch(() => vivo && setFalhou(true));
    };
    if (typeof IntersectionObserver === "undefined") {
      pedir();
      return () => {
        vivo = false;
      };
    }
    const olho = new IntersectionObserver((e) => {
      if (e.some((x) => x.isIntersecting)) {
        olho.disconnect();
        pedir();
      }
    }, { rootMargin: "200px" });
    olho.observe(el);
    return () => {
      vivo = false;
      olho.disconnect();
    };
  }, [foto.id]);
  const alt = foto.legenda || (PREVIA_DOS_ATOS ? t.eventos.album.exemplo : t.eventos.album.fotoDe);
  const proporcao = foto.largura && foto.altura ? `${foto.largura} / ${foto.altura}` : "4 / 3";
  return (
    <div ref={caixa} className="al-ev-foto-moldura" style={{ aspectRatio: proporcao }} data-falhou={falhou || undefined}>
      {url ? (
        aoAbrir ? (
          <button type="button" className="al-ev-foto-botao" onClick={aoAbrir} aria-label={`${t.eventos.album.abrir}: ${alt}`}>
            {/* Endereço assinado do depósito privado (ou, na prévia, o mosaico desenhado no aparelho). */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" />
          </button>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={alt} loading="lazy" decoding="async" referrerPolicy="no-referrer" />
        )
      ) : null}
    </div>
  );
}

/**
 * O álbum coletivo do ato: as fotos de quem esteve lá, com os rostos borrados NO APARELHO de quem mandou (EnviarFoto), em ordem de
 * chegada. Nenhuma foto diz quem mandou. A própria pessoa vê as dela esperando a conferência (e pode apagar); a moderação do ato
 * (quem chamou e as organizações que aceitaram) vê a fila e aprova ou recusa. Visitante vê só as aprovadas de ato público.
 */
export function AlbumDoAto({ ato, mais, t, logado, aoMudar }: { ato: Ato; mais: MaisDoAto; t: TextosDosAtos; logado: boolean; aoMudar: () => void }) {
  const ta = t.eventos.album;
  const carregar = useCallback(() => cliente.album(ato.id), [ato.id]);
  const { estado, trocar } = useQuadro<Album>(carregar, ato.id, true);
  const [enviando, setEnviando] = useState(false);
  const [aberta, setAberta] = useState<number | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [anuncio, anunciar] = useAnuncio();
  const id = useId();
  const botaoMandar = useRef<HTMLButtonElement>(null);
  const album = estado.fase === "pronto" ? estado.dados : null;
  const aprovadas = album ? album.fotos.filter((f) => f.estado === "aprovada") : [];

  const agir = async (f: FotoDoAlbum, acao: () => Promise<Album>, frase: string) => {
    if (ocupado) return;
    setOcupado(f.id);
    setErro(null);
    try {
      trocar(await acao());
      anunciar(frase);
      aoMudar();
    } catch (e) {
      setErro(fraseDoEvento(t, e));
    } finally {
      setOcupado(null);
    }
  };

  // Sem foto nenhuma e sem poder mandar (visitante, quem não foi, ato cancelado): o álbum não ocupa a página.
  if (album && !album.fotos.length && !album.pendentes.length && !album.pode_enviar && !(logado && mais.album.pode_enviar)) return null;

  return (
    <section className="al-ev al-ev-album" aria-labelledby={`${id}-t`} aria-busy={estado.fase === "carregando" || undefined}>
      <header className="al-ev-cabeca">
        <h2 id={`${id}-t`} className="al-cond al-ev-titulo">
          {ta.titulo}
        </h2>
        {album?.pode_enviar ? (
          <Botao ref={botaoMandar} variante="primario" onClick={() => setEnviando(true)}>
            {ta.mandar}
          </Botao>
        ) : null}
      </header>
      <p className="al-ev-ajuda">{ta.explica}</p>
      {album && !album.pode_enviar && logado ? <p className="al-ev-ajuda">{ta.soQuemFoi}</p> : null}
      {estado.fase === "carregando" ? <p className="al-ev-ajuda">{t.tela.carregando}</p> : null}
      {estado.fase === "erro" ? (
        <p className="al-ev-ajuda" role="alert">
          {fraseDoEvento(t, estado.erro)}
        </p>
      ) : null}

      {album && album.organiza && album.pendentes.length ? (
        <div className="al-ev-fila">
          <h3 className="al-q-subtitulo">
            {ta.conferir} <span data-al-numero="">({album.pendentes.length})</span>
          </h3>
          <p className="al-ev-ajuda">{ta.conferirExplica}</p>
          <ul className="al-ev-grade al-ev-grade-fila" role="list">
            {album.pendentes.map((f) => (
              <li key={f.id} className="al-ev-foto" data-pendente="">
                <Foto foto={f} t={t} />
                {f.legenda ? <p className="al-ev-legenda">{f.legenda}</p> : null}
                <div className="al-ev-acoes">
                  <Botao variante="primario" tamanho="p" disabled={ocupado === f.id} onClick={() => void agir(f, () => cliente.albumDecidir(f.id, true), ta.aprovada)}>
                    {ta.aprovar}
                  </Botao>
                  <Botao variante="contorno" tamanho="p" disabled={ocupado === f.id} onClick={() => void agir(f, () => cliente.albumDecidir(f.id, false), ta.recusada)}>
                    {ta.recusar}
                  </Botao>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {album && album.fotos.length ? (
        <ul className="al-ev-grade" role="list">
          {album.fotos.map((f) => {
            const i = aprovadas.indexOf(f);
            return (
              <li key={f.id} className="al-ev-foto" data-pendente={f.estado === "pendente" || undefined}>
                <Foto foto={f} t={t} aoAbrir={f.estado === "aprovada" ? () => setAberta(i) : undefined} />
                {f.estado === "pendente" ? <span className="al-ev-carimbo-foto">{ta.esperando}</span> : null}
                {f.legenda ? <p className="al-ev-legenda">{f.legenda}</p> : null}
                {f.minha ? (
                  <button type="button" className="al-ev-link al-ev-link-botao" disabled={ocupado === f.id} onClick={() => void agir(f, () => apagarFotoDoAlbum(f.id), ta.apagada)}>
                    {ta.apagar}
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : album && !album.pendentes.length ? (
        <p className="al-ev-ajuda">{ta.vazio}</p>
      ) : null}

      {erro ? (
        <p role="alert" className="al-ato-erro">
          {erro}
        </p>
      ) : null}
      <p className="sr-only" role="status" aria-live="polite">
        {anuncio}
      </p>

      {enviando ? (
        <EnviarFoto
          ato={ato.id}
          t={t}
          modera={mais.organiza}
          aoFechar={() => {
            setEnviando(false);
            requestAnimationFrame(() => botaoMandar.current?.focus());
          }}
          aoEnviar={(_f, frase) => {
            setEnviando(false);
            anunciar(frase);
            void cliente.album(ato.id).then(trocar).catch(() => undefined);
            aoMudar();
            requestAnimationFrame(() => botaoMandar.current?.focus());
          }}
        />
      ) : null}
      {aberta !== null && aprovadas[aberta] ? (
        <Visor fotos={aprovadas} i={aberta} t={t} aoMudar={setAberta} aoFechar={() => setAberta(null)} />
      ) : null}
    </section>
  );
}

/** A foto maior, com anterior e seguinte (setas do teclado) e Esc para fechar. */
function Visor({ fotos, i, t, aoMudar, aoFechar }: { fotos: FotoDoAlbum[]; i: number; t: TextosDosAtos; aoMudar: (i: number) => void; aoFechar: () => void }) {
  const ta = t.eventos.album;
  const fechar = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    fechar.current?.focus();
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") aoFechar();
      if (e.key === "ArrowRight") aoMudar(Math.min(fotos.length - 1, i + 1));
      if (e.key === "ArrowLeft") aoMudar(Math.max(0, i - 1));
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [aoFechar, aoMudar, fotos.length, i]);
  const f = fotos[i];
  return (
    <div className="al-ev-fundo" role="presentation" onClick={(e) => e.target === e.currentTarget && aoFechar()}>
      <div className="al-ev-janela al-ev-visor" role="dialog" aria-modal="true" aria-label={f.legenda || ta.fotoDe}>
        <Foto key={f.id} foto={f} t={t} />
        {f.legenda ? <p className="al-ev-legenda">{f.legenda}</p> : null}
        <div className="al-ev-acoes al-ev-acoes-fim">
          <Botao variante="contorno" tamanho="p" disabled={i === 0} onClick={() => aoMudar(i - 1)}>
            {ta.anterior}
          </Botao>
          <Botao variante="contorno" tamanho="p" disabled={i >= fotos.length - 1} onClick={() => aoMudar(i + 1)}>
            {ta.seguinte}
          </Botao>
          <Botao ref={fechar} variante="claro" tamanho="p" onClick={aoFechar}>
            {ta.fechar}
          </Botao>
        </div>
      </div>
    </div>
  );
}
