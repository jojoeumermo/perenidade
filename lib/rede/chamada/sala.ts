// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A sala da chamada a dois (Prompt 4, itens 139 e 140): a sala de voz que já existe (lib/rede/voz/sala.ts: conexão direta, sempre por
// retransmissão, combinação cifrada), com a chave e o nome do canal tirados do toque (lib/rede/chamada/toque.ts), no máximo 2 pessoas
// e, na chamada de vídeo, a câmera. Nada aqui é protocolo novo: a combinação é a da sala de voz, só a origem da chave muda (o toque,
// dentro do cifrado do chat, no lugar do MLS do grupo). Transporte e conexões injetados (navegador ou memória dos testes). Sem "@/".
import { type CanalDaSala, type ChaveDaSala, criarSalaDeVoz, type Participante } from "../voz/sala";
import { chaveDaCombinacao, type CorpoDoToque, PESSOAS_NA_CHAMADA } from "./toque";

/** A chave da sala, de uma época só (a 0): a chamada não muda de chave enquanto dura. */
export async function chaveDaChamada(toque: CorpoDoToque): Promise<ChaveDaSala> {
  const chave = await chaveDaCombinacao(toque);
  return { atual: async () => ({ epoca: 0, chave }), daEpoca: async (e) => (e === 0 ? chave : null) };
}

export async function abrirChamada(opcoes: {
  eu: string;
  toque: CorpoDoToque;
  canal: CanalDaSala;
  iceServers: RTCIceServer[];
  microfone: MediaStream | null;
  camera?: MediaStream | null;
  novaConexao?: (config: RTCConfiguration) => RTCPeerConnection;
  aoMudar?: (p: Participante[]) => void;
}) {
  const sala = criarSalaDeVoz({
    eu: opcoes.eu,
    sala: `chamada:${opcoes.toque.id}`,
    chave: await chaveDaChamada(opcoes.toque),
    canal: opcoes.canal,
    iceServers: opcoes.iceServers,
    maximo: PESSOAS_NA_CHAMADA,
    comVideo: opcoes.toque.video,
    novaConexao: opcoes.novaConexao,
    aoMudar: opcoes.aoMudar,
  });
  await sala.entrar(opcoes.microfone, opcoes.toque.video ? (opcoes.camera ?? null) : null);
  return sala;
}
