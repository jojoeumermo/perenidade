// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useId, useRef, useState } from "react";
import { midia } from "@/lib/rede/midia/cliente";
import { lerVideoEscolhido, regravarVideoDoPost } from "@/lib/rede/midia/regravar";
import { LIMITES_DA_MIDIA, motivoSemVideo, relogioDoVideo } from "@/lib/rede/midia/regras";
import { carregarTextosDaMidia } from "@/lib/rede/midia/textos";
import { preencher } from "@/lib/rede/preencher";
import type { Post } from "@/lib/rede/tipos";
import type { ContextoDoEncaixe, PedidoDePublicacao, ResultadoAntesDePublicar } from "../encaixes";
import { enviarVideo } from "./api";
import { mensagemDaMidia, useTextosDaMidia } from "./base";
import { esquecerVideoPendente, mudarVideo, novoSinal, useVideoPendente, videoPendente } from "./pendente";

/** O que o compositor diz à ferramenta: é resposta? já tem fotos ou áudio? (Um tipo de mídia por post.) */
export interface SituacaoDoCompositor {
  resposta: boolean;
  imagens: number;
  audio: boolean;
}

function IconeVideo() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="6" width="13" height="12" rx="2.5" />
      <path d="m16 10.5 5-3v9l-5-3" />
    </svg>
  );
}

/**
 * O ícone "Vídeo" na fileira de ferramentas do Escrever. Abre o seletor de arquivo do aparelho (só vídeo); o arquivo escolhido
 * não sai do aparelho até a pessoa tocar em "Preparar o vídeo" no cartão. Desativado com fotos ou áudio (um tipo por post) e
 * fora do post de primeiro nível.
 */
export function FerramentaDoVideo({ lang, compositor }: ContextoDoEncaixe & { compositor: SituacaoDoCompositor }) {
  const tm = useTextosDaMidia(lang);
  const v = useVideoPendente();
  const entrada = useRef<HTMLInputElement>(null);
  if (!tm || compositor.resposta) return null;
  const motivo = motivoSemVideo(compositor);
  const titulo = motivo === "umTipo" ? tm.video.umTipo : `${tm.video.titulo} · ${preencher(tm.video.limite, { s: LIMITES_DA_MIDIA.videoMs / 1000 })}`;
  return (
    <>
      <input
        ref={entrada}
        type="file"
        accept="video/mp4,video/webm,video/quicktime,video/*"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const arquivo = e.target.files?.[0];
          e.target.value = "";
          if (arquivo) void escolher(arquivo);
        }}
      />
      <button
        type="button"
        className="al2-ferramenta"
        onClick={() => entrada.current?.click()}
        disabled={Boolean(motivo) || v.fase !== "vazio"}
        aria-pressed={v.fase !== "vazio"}
        aria-label={tm.video.botao}
        title={titulo}
      >
        <IconeVideo />
      </button>
    </>
  );
}

/** Lê o arquivo escolhido (duração e medida) e abre o cartão do vídeo. */
async function escolher(arquivo: File) {
  esquecerVideoPendente();
  if (arquivo.size > LIMITES_DA_MIDIA.originalBytes || !arquivo.type.startsWith("video/")) {
    mudarVideo({ erro: "tipo" });
    return;
  }
  const url = URL.createObjectURL(arquivo);
  mudarVideo({ fase: "escolhido", url, erro: "" });
  try {
    const info = await lerVideoEscolhido(url);
    mudarVideo({ info, inicio: 0 });
  } catch {
    esquecerVideoPendente();
    mudarVideo({ erro: "invalida" });
  }
}

/**
 * O cartão do vídeo, acima da fileira de ferramentas (como o da foto e o do áudio): a prévia, o começo do trecho (quando passa de
 * 60 s), "Com som", a descrição e "Preparar o vídeo". Preparar regrava no aparelho e sobe com o andamento; pronto, o vídeo entra
 * no post logo depois de publicar.
 */
export function CartaoDoVideo({ lang, s }: ContextoDoEncaixe) {
  const tm = useTextosDaMidia(lang);
  const v = useVideoPendente();
  const id = useId();
  const cartao = useRef<HTMLDivElement>(null);
  const [aviso, setAviso] = useState("");
  useEffect(() => {
    if (v.fase === "escolhido") cartao.current?.focus();
  }, [v.fase]);
  // O Escrever fechou: o que ainda não estava pronto é esquecido (o pronto fica, para ser ligado ao post que acabou de sair, ou
  // para voltar no próximo Escrever).
  useEffect(() => () => {
    if (videoPendente().fase !== "pronto") esquecerVideoPendente();
  }, []);
  if (!tm) return null;
  if (v.fase === "vazio") return v.erro ? <p role="alert" className="m12-erro">{mensagemDaMidia(s, tm, new Error(v.erro))}</p> : null;
  const total = v.info?.duracao ?? 0;
  const maxInicio = Math.max(0, total - LIMITES_DA_MIDIA.videoMs);
  const ocupado = v.fase === "preparando" || v.fase === "enviando";

  async function preparar() {
    if (!tm || !v.info) return;
    const sinal = novoSinal();
    setAviso("");
    mudarVideo({ fase: "preparando", progresso: 0, erro: "" });
    try {
      const pronto = await regravarVideoDoPost({ url: v.url, inicio: v.inicio, som: v.som, sinal, aoProgresso: (p) => mudarVideo({ progresso: p }) });
      mudarVideo({ fase: "enviando", progresso: 0 });
      const reserva = await enviarVideo(pronto, (p) => mudarVideo({ progresso: p }), sinal);
      const local = URL.createObjectURL(pronto.blob);
      const antigo = videoPendente().url;
      if (antigo.startsWith("blob:")) URL.revokeObjectURL(antigo);
      mudarVideo({ fase: "pronto", id: reserva, url: local, duracao: pronto.duracao, progresso: 1 });
    } catch (e) {
      if (sinal.aborted) return;
      mudarVideo({ fase: "escolhido", progresso: 0 });
      setAviso(mensagemDaMidia(s, tm, e));
    }
  }

  return (
    <div ref={cartao} tabIndex={-1} className="al2-anexo m12-cartao" role="group" aria-labelledby={`${id}-t`}>
      <div className="m12-cartao-topo">
        <p id={`${id}-t`} className="m12-cartao-titulo">
          <IconeVideo />
          {tm.video.titulo}
          {v.info && <span className="m12-cinza">· {relogioDoVideo(v.fase === "pronto" ? v.duracao : Math.min(total, LIMITES_DA_MIDIA.videoMs))}</span>}
        </p>
        <button type="button" className="al2-acao" onClick={esquecerVideoPendente} aria-label={tm.video.tirar} title={tm.video.tirar}>
          <span aria-hidden className="m12-x">×</span>
        </button>
      </div>
      <div className="m12-cartao-corpo">
        {v.url && (
          <video className="m12-previa" src={v.url} muted={!v.som} playsInline controls={v.fase === "pronto"} preload="metadata" aria-hidden={v.fase !== "pronto"} />
        )}
        <div className="m12-cartao-campos">
          {v.fase === "escolhido" && (
            <>
              <p className="m12-dica">{preencher(tm.video.limite, { s: LIMITES_DA_MIDIA.videoMs / 1000 })}</p>
              {maxInicio > 0 && (
                <label className="m12-trecho">
                  <span>{preencher(tm.video.trecho, { t: relogioDoVideo(v.inicio) })}</span>
                  <input
                    type="range"
                    min={0}
                    max={maxInicio}
                    step={500}
                    value={v.inicio}
                    aria-label={preencher(tm.video.trechoRotulo, { s: LIMITES_DA_MIDIA.videoMs / 1000 })}
                    aria-valuetext={relogioDoVideo(v.inicio)}
                    onChange={(e) => mudarVideo({ inicio: Number(e.target.value) })}
                  />
                </label>
              )}
              <label className="al2-chip m12-som">
                <input type="checkbox" className="al2-caixinha" checked={v.som} onChange={(e) => mudarVideo({ som: e.target.checked })} />
                {tm.video.som}
              </label>
            </>
          )}
          <label className="m12-rotulo" htmlFor={`${id}-alt`}>{tm.video.descricao}</label>
          <textarea
            id={`${id}-alt`}
            className="al2-campo m12-campo"
            rows={2}
            maxLength={LIMITES_DA_MIDIA.alt}
            value={v.alt}
            onChange={(e) => mudarVideo({ alt: e.target.value })}
            aria-describedby={`${id}-alt-dica`}
          />
          <p id={`${id}-alt-dica`} className="m12-dica">{tm.video.descricaoDica}</p>
          {ocupado && (
            <div className="m12-andamento" role="status">
              <span>{preencher(v.fase === "preparando" ? tm.video.preparando : tm.video.enviando, { p: Math.round(v.progresso * 100) })}</span>
              <span className="m12-barra" aria-hidden>
                <span style={{ width: `${Math.round(v.progresso * 100)}%` }} />
              </span>
            </div>
          )}
          {v.fase === "pronto" && <p className="m12-pronto" role="status">{tm.video.pronto} · {tm.video.limpo}</p>}
          <div className="m12-linha">
            {v.fase === "escolhido" && (
              <button type="button" className="al-botao al-botao-p al-botao-dourado" onClick={() => void preparar()} disabled={!v.info}>
                {tm.video.preparar}
              </button>
            )}
            {ocupado && (
              <button type="button" className="al-botao al-botao-p al-botao-contorno" onClick={esquecerVideoPendente}>
                {tm.video.cancelar}
              </button>
            )}
          </div>
          {aviso && <p role="alert" className="m12-erro">{aviso}</p>}
        </div>
      </div>
    </div>
  );
}

/**
 * Antes de publicar (encaixe antesDePublicar): com o vídeo ainda preparando ou subindo, segura o "Publicar"; com o vídeo pronto e
 * fotos no post, pede para escolher um dos dois.
 */
export async function antesDePublicarComVideo(pedido: PedidoDePublicacao, { lang }: ContextoDoEncaixe): Promise<ResultadoAntesDePublicar> {
  const v = videoPendente();
  if (v.fase === "vazio" || pedido.extras.resposta_a) return { ok: true };
  const tm = await carregarTextosDaMidia(lang);
  if (v.fase !== "pronto") return { ok: false, aviso: tm.video.esperando, bloqueia: true };
  if (Number(pedido.extras.imagens ?? 0) > 0) return { ok: false, aviso: tm.video.umTipo, bloqueia: true };
  return { ok: true };
}

/**
 * Depois de publicar: liga o vídeo pronto ao post que acabou de sair (só post de primeiro nível). Devolve nulo quando deu certo
 * (ou não havia vídeo) e, quando o banco recusou, a frase para a tela ("O post saiu, mas o vídeo não entrou: …").
 */
export async function ligarVideoAoPost(post: Post, { lang, s }: ContextoDoEncaixe): Promise<string | null> {
  const v = videoPendente();
  if (v.fase !== "pronto" || !v.id || post.resposta_a) return null;
  try {
    await midia().ligar(post.id, v.id, v.alt.trim());
    return null;
  } catch (e) {
    const tm = await carregarTextosDaMidia(lang);
    return preencher(tm.video.naoEntrou, { erro: mensagemDaMidia(s, tm, e) });
  } finally {
    // Ligado ou recusado, o compositor fica limpo: a reserva que não entrou vence sozinha em 24 horas (e o arquivo sai).
    esquecerVideoPendente();
  }
}
