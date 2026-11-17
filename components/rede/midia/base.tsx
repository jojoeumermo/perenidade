// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import { audioDeExemplo } from "@/lib/rede/midia/cliente";
import { carregarTextosDaMidia, textoDeErroDaMidia, type TextosDaMidia } from "@/lib/rede/midia/textos";
import type { TextosDaRede } from "@/lib/rede/textos";
import { previaDaAlumiaLigada } from "@/lib/rede/conversa/exemplos";
import { detalhesDe } from "../publicar/detalhes";
import { codigoDoErro, textoDoErro } from "../erros";
import "./midia.css";

const cache = new Map<string, TextosDaMidia>();

/** Os textos da voz e do vídeo no idioma da página; vêm sob demanda (null enquanto chegam). Com "ativo" falso, não baixa nada. */
export function useTextosDaMidia(lang: string, ativo = true): TextosDaMidia | null {
  const [chegou, setChegou] = useState<{ lang: string; texto: TextosDaMidia } | null>(null);
  useEffect(() => {
    if (!ativo || cache.has(lang)) return;
    let vivo = true;
    carregarTextosDaMidia(lang)
      .then((texto) => {
        cache.set(lang, texto);
        if (vivo) setChegou({ lang, texto });
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [lang, ativo]);
  return cache.get(lang) ?? (chegou?.lang === lang ? chegou.texto : null);
}

/** A função ainda não existe no banco (migração da onda 12 não rodou): a tela diz "ainda não está no ar". */
export function faltaNoBancoDaMidia(e: unknown): boolean {
  const c = codigoDoErro(e);
  return c.includes("desatualizado") || c === "PGRST202" || c === "42883";
}

/** O erro vira texto: primeiro os códigos desta frente, depois os da Rede. */
export function mensagemDaMidia(s: Pick<TextosDaRede, "erros">, tm: TextosDaMidia, erro: unknown): string {
  if (faltaNoBancoDaMidia(erro)) return tm.erros.indisponivel;
  // Do banco vem "code"; das contas do aparelho (regravar, ditar), um Error com o código na mensagem.
  const temCodigo = typeof erro === "object" && erro !== null && "code" in erro;
  const c = temCodigo ? codigoDoErro(erro) : erro instanceof Error ? erro.message : "falha";
  return textoDeErroDaMidia(tm, c) ?? (temCodigo ? textoDoErro(s, erro) : tm.erros.generico);
}

export const previa = previaDaAlumiaLigada;

/** O áudio do post (id e duração em segundos), dos detalhes que o cartão já pede em lote; na prévia, o de exemplo. */
export function useAudioDoPost(postId: string, ativo = true): { id: string; duracao: number } | null {
  const [audio, setAudio] = useState<{ post: string; a: { id: string; duracao: number } | null } | null>(null);
  useEffect(() => {
    if (!ativo || previa()) return;
    let vivo = true;
    detalhesDe(postId).then(
      (d) => vivo && setAudio({ post: postId, a: d?.audio ? { id: d.audio.id, duracao: d.audio.duracao } : null }),
      () => undefined,
    );
    return () => {
      vivo = false;
    };
  }, [postId, ativo]);
  if (!ativo) return null;
  if (previa()) return audioDeExemplo(postId);
  return audio?.post === postId ? audio.a : null;
}

/** "0:38" a partir de segundos. */
export const duracaoEmSegundos = (s: number) => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.round(Math.max(0, s)) % 60).padStart(2, "0")}`;
