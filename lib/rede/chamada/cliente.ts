// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// O lado do navegador da chamada da conversa a dois (Prompt 4, itens 139 e 140, atrás de "alumia-p4-chamadas"): manda o toque pelo
// chat do aparelho (dentro do cifrado), pede as credenciais curtas da retransmissão com um passe anônimo (sem sessão, como a sala de
// voz), abre o canal de combinação SEM a sessão da conta, com o nome tirado da chave, e liga a sala (lib/rede/chamada/sala.ts). O
// microfone e a câmera só ligam no toque em "Ligar" ou "Atender", e desligam ao desligar, ao fechar a página e no "Sair rápido".
import type { Participante } from "../voz/sala";
import { guardaDosToques } from "./guarda";
import { type AcoesDaChamada, criarPainelDaChamada, type Outro, type PainelDaChamada } from "./painel";
import { abrirChamada } from "./sala";
import { canalDaChamada, type CorpoDoToque, fimDoToque, type FimDaChamada, novoToque } from "./toque";

async function meuChat() {
  const { quemSouEu, chatDaConta, naFila } = await import("../chat/r2/navegador");
  const { usuario } = await quemSouEu();
  const chat = usuario ? await chatDaConta(usuario) : null;
  if (!chat || !usuario) throw new Error("sem_chat");
  return { usuario, chat, naFila };
}

/** Um nome desta pessoa NESTA chamada (a conta e um sorteio): dois aparelhos dela que atendam não se confundem na sala. */
function euNaChamada(usuario: string): string {
  const b = crypto.getRandomValues(new Uint8Array(4));
  return `${usuario}:${[...b].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
}

/** Quem é esta pessoa da sala (a conta, sem o sorteio do aparelho). */
export const contaDe = (participante: string) => participante.split(":")[0];

const paraOutros = (aoMudar: (p: Outro[]) => void) => (p: Participante[]) => aoMudar(p.map((x) => ({ usuario: contaDe(x.usuario), fluxo: x.audio })));

async function entrar(usuario: string, toque: CorpoDoToque, comCamera: boolean, aoMudar: (p: Outro[]) => void) {
  const { servidoresDeRetransmissao, abrirCanalDeVoz } = await import("../voz/navegador");
  let microfone: MediaStream | null = null;
  let camera: MediaStream | null = null;
  try {
    microfone = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
    if (toque.video && comCamera) camera = await navigator.mediaDevices.getUserMedia({ audio: false, video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 24 } } });
  } catch (e) {
    for (const f of [...(microfone?.getTracks() ?? []), ...(camera?.getTracks() ?? [])]) f.stop();
    throw e;
  }
  try {
    const [iceServers, canal] = await Promise.all([servidoresDeRetransmissao(), canalDaChamada(toque).then((nome) => abrirCanalDeVoz(nome, { semConta: true }))]);
    const sala = await abrirChamada({ eu: euNaChamada(usuario), toque, canal, iceServers, microfone, camera, aoMudar: paraOutros(aoMudar) });
    return { sala, camera };
  } catch (e) {
    for (const f of [...(microfone?.getTracks() ?? []), ...(camera?.getTracks() ?? [])]) f.stop();
    throw e;
  }
}

/** As ações de verdade (o chat do aparelho, a sala de voz, o microfone e a câmera). */
export const acoesDoNavegador: AcoesDaChamada = {
  /** Liga: primeiro a sala (microfone e retransmissão; se der errado, o toque nem sai), depois o toque, dentro do cifrado. */
  async ligar(conversa, video, aoMudar) {
    const { usuario, chat, naFila } = await meuChat();
    const toque = novoToque(video);
    const { sala, camera } = await entrar(usuario, toque, video, aoMudar);
    try {
      const r = await naFila(() => chat.mandarChamada(conversa, toque));
      if (!r.entregues) throw new Error("chamada_nao_saiu");
    } catch (e) {
      await sala.sair().catch(() => undefined);
      throw e;
    }
    return { toque, sala, camera };
  },
  async atender(toque, comCamera, aoMudar) {
    const { usuario } = await meuChat();
    return entrar(usuario, toque, comCamera, aoMudar);
  },
  /** O fim (recusou, desistiu, desligou, atendida), sem chave nenhuma. */
  async avisarFim(conversa: string, toque: CorpoDoToque, fim: FimDaChamada) {
    const { chat, naFila } = await meuChat();
    await naFila(() => chat.mandarChamada(conversa, fimDoToque(toque, fim)));
  },
};

let painel: PainelDaChamada | null = null;
/** O painel da chamada desta aba (um só, de toda tela). */
export function painelDaChamada(): PainelDaChamada {
  painel ??= criarPainelDaChamada(guardaDosToques, acoesDoNavegador);
  return painel;
}
