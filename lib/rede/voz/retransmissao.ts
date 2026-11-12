// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As contas do servidor de retransmissão (TURN) das salas de voz (app/api/alumia/voz/retransmissao/route.ts). Só no servidor.
import { createHmac } from "node:crypto";

export const VALIDADE_S = 3600;
export type Servidor = { urls: string | string[]; username?: string; credential?: string };

/** Só servidores TURN (o "relay" do WebRTC nunca usa STUN, e STUN mostraria o endereço da pessoa ao servidor dele). */
export function soTurn(servidores: Servidor[]): Servidor[] {
  return servidores
    .map((s) => ({ ...s, urls: (Array.isArray(s.urls) ? s.urls : [s.urls]).filter((u) => /^turns?:/.test(u)) }))
    .filter((s) => s.urls.length > 0 && s.username && s.credential);
}

/** coturn com "use-auth-secret": usuário = validade:rótulo, senha = HMAC-SHA1(segredo, usuário) em base64. */
export function doCoturn(urls: string[], segredo: string, agora = Date.now()): Servidor[] {
  const usuario = `${Math.floor(agora / 1000) + VALIDADE_S}:alumia`;
  const credential = createHmac("sha1", segredo).update(usuario).digest("base64");
  return soTurn([{ urls, username: usuario, credential }]);
}

