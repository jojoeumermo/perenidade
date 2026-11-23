// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import { signedStorageUrl } from "@/lib/backend";
import { esquecerVideo, midia, videoDoPost, type VideoDoPost as Video } from "@/lib/rede/midia/cliente";
import { relogioDoVideo } from "@/lib/rede/midia/regras";
import { preencher } from "@/lib/rede/preencher";
import type { Post } from "@/lib/rede/tipos";
import type { ContextoDoEncaixe } from "../encaixes";
import { mensagemDaMidia, useTextosDaMidia } from "./base";
import { confirmar } from "@/components/perguntar";

/** O vídeo do post, se tem (o lote junta os cartões da tela numa chamada). */
function useVideo(postId: string): [Video | null, () => void] {
  const [estado, setEstado] = useState<{ post: string; v: Video | null } | null>(null);
  useEffect(() => {
    let vivo = true;
    videoDoPost(postId).then((v) => vivo && setEstado({ post: postId, v }));
    return () => {
      vivo = false;
    };
  }, [postId]);
  const tirar = () => {
    esquecerVideo(postId);
    setEstado({ post: postId, v: null });
  };
  return [estado?.post === postId ? estado.v : null, tirar];
}

/**
 * O vídeo curto embaixo do texto do cartão (encaixe anexosDoCartao). Nada baixa antes do toque: o ladrilho mostra a duração e a
 * descrição, e só "Assistir" pede o endereço assinado (1 hora) e toca, sem começar sozinho de novo. A autora pode tirar o vídeo
 * do próprio post (o arquivo é apagado pela fila do servidor).
 */
export function VideoDoPost({ lang, s, post }: ContextoDoEncaixe & { post: Post }) {
  const tm = useTextosDaMidia(lang);
  const [video, sumir] = useVideo(post.id);
  const [url, setUrl] = useState("");
  const [estado, setEstado] = useState<"parado" | "carregando" | "falhou">("parado");
  const [tirando, setTirando] = useState(false);
  const [nota, setNota] = useState("");
  if (!tm || !video) return nota ? <p role="status" className="m12-nota">{nota}</p> : null;
  const duracao = relogioDoVideo(video.duracao_ms);
  // A proporção do vídeo segura o lugar antes de ele chegar (nada pula na tela); bem alto, ele fica estreito no centro.
  const proporcao = `${video.largura} / ${video.altura}`;
  const emPe = video.altura > video.largura;

  async function assistir() {
    if (!video) return;
    setEstado("carregando");
    try {
      const { bucket, caminho } = await midia().caminhoDoVideo(video.id);
      setUrl(await signedStorageUrl(bucket, caminho, 3600));
    } catch {
      setEstado("falhou");
    }
  }

  async function tirar() {
    if (!tm || !(await confirmar(tm.video.confirmarTirar))) return;
    setTirando(true);
    try {
      await midia().tirarVideo(post.id);
      sumir();
      setNota(tm.video.tirado);
    } catch (e) {
      setNota(mensagemDaMidia(s, tm, e));
    } finally {
      setTirando(false);
    }
  }

  return (
    <figure className="m12-video" data-em-pe={emPe ? "sim" : undefined} onClick={(e) => e.stopPropagation()}>
      <div className="m12-video-quadro" style={{ aspectRatio: proporcao }}>
        {url ? (
          <video
            className="m12-video-tela"
            src={url}
            controls
            autoPlay
            playsInline
            preload="metadata"
            aria-label={video.alt || preencher(tm.video.rotuloDoVideo, { d: duracao })}
            onError={() => (setUrl(""), setEstado("falhou"))}
          />
        ) : (
          <button
            type="button"
            className="m12-video-capa"
            disabled={estado === "carregando"}
            onClick={() => void assistir()}
            aria-label={`${preencher(tm.video.assistir, { d: duracao })}${video.som ? "" : ` · ${tm.video.semSom}`}${video.alt ? `. ${video.alt}` : ""}`}
          >
            <span className="m12-video-play" aria-hidden>
              <svg viewBox="0 0 24 24" className="h-7 w-7" fill="currentColor">
                <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z" />
              </svg>
            </span>
            <span className="m12-video-selo" aria-hidden>
              {estado === "carregando" ? tm.video.carregando : preencher(tm.video.assistir, { d: duracao })}
              {!video.som && <span className="m12-video-mudo"> · {tm.video.semSom}</span>}
            </span>
          </button>
        )}
      </div>
      {video.alt && <figcaption className="m12-video-alt">{video.alt}</figcaption>}
      {estado === "falhou" && <p role="alert" className="m12-erro">{tm.video.falha}</p>}
      {video.meu && (
        <button type="button" className="al2-acao m12-tirar" onClick={() => void tirar()} disabled={tirando}>
          {tm.video.tirarDoPost}
        </button>
      )}
    </figure>
  );
}
