// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import dynamic from "next/dynamic";
import { midiaLigada, videoNoPostLigado } from "@/lib/rede/midia/ligado";
import type { Post } from "@/lib/rede/tipos";
import type { ContextoDoEncaixe, Encaixe } from "../encaixes";
import { pararDeFalar } from "./BotaoOuvir";
import { esquecerVideoPendente } from "./pendente";

/**
 * Encaixe da frente 12B (voz e vídeo). Tudo atrás de "rede-v2" + "alumia-2"; o vídeo também atrás de "alumia-video-post" (e, no
 * banco, da decisão do painel). Desligado, o encaixe fica vazio.
 *
 *   acoesDoCartao     "Ouvir" no menu "mais" do cartão, com a voz do próprio aparelho (só aparece com voz local no idioma);
 *   anexosDoCartao    a transcrição aprovada do áudio do post (e o "Escrever a transcrição" para quem gravou) e o vídeo curto;
 *   antesDePublicar   segura o "Publicar" enquanto o vídeo prepara ou sobe, e com foto e vídeo juntos;
 *   aoSairRapido      o Sair rápido cala a voz e esquece o vídeo que estava sendo posto.
 *
 * Quem junta acrescenta `midia` à lista de components/rede/encaixes.tsx (import de "./midia/encaixe"). O compositor não tem encaixe
 * para a ferramenta de vídeo; as peças estão prontas abaixo (compositorDaMidia), com o pedido para quem junta. Na conversa, as
 * respostas e a caixa de resposta chamam as peças desta pasta direto (NaResposta, OuvirResposta e AudioNaCaixa). Nenhuma peça
 * mostra número ou lista de pessoas.
 */
const LIGADA = midiaLigada();
const VIDEO = LIGADA && videoNoPostLigado();

const OuvirNoCartao = dynamic(() => import("./BotaoOuvir").then((m) => m.OuvirNoCartao), { ssr: false });
const TranscricaoNoCartao = dynamic(() => import("./TranscricaoDoAudio").then((m) => m.TranscricaoNoCartao), { ssr: false });
const VideoDoPost = dynamic(() => import("./VideoDoPost").then((m) => m.VideoDoPost), { ssr: false });

export const encaixe: Encaixe = !LIGADA ? {} : {
  acoesDoCartao: [OuvirNoCartao],
  anexosDoCartao: [TranscricaoNoCartao, ...(VIDEO ? [VideoDoPost] : [])],
  antesDePublicar: VIDEO ? [async (pedido, ctx) => (await import("./VideoNoCompositor")).antesDePublicarComVideo(pedido, ctx)] : [],
  aoSairRapido: [
    () => {
      pararDeFalar();
      esquecerVideoPendente();
    },
  ],
};

/**
 * As peças do vídeo no Escrever (components/rede/publicar/alumia2), para quem junta (a Encaixe de hoje não tem onde pendurá-las):
 *   · `Ferramenta` vai na fileira de ícones de AnexosDoEscrever (ao lado do microfone), só no post de primeiro nível, com
 *     compositor = { resposta, imagens: pub.imagens.length, audio: Boolean(pub.audio) || gravador };
 *   · `Cartao` vai junto dos outros cartões de anexo, logo acima da fileira;
 *   · `depoisDePublicar(post, ctx)` é chamado com o post que voltou do banco ANTES de fechar o Escrever (antes do aoPublicar); se
 *     devolver uma frase, a tela mostra (o post saiu, o vídeo não entrou).
 * Nulo quando o vídeo está desligado.
 */
export const compositorDaMidia = !VIDEO ? null : {
  Ferramenta: dynamic(() => import("./VideoNoCompositor").then((m) => m.FerramentaDoVideo), { ssr: false }),
  Cartao: dynamic(() => import("./VideoNoCompositor").then((m) => m.CartaoDoVideo), { ssr: false }),
  depoisDePublicar: async (post: Post, ctx: ContextoDoEncaixe) => (await import("./VideoNoCompositor")).ligarVideoAoPost(post, ctx),
};
