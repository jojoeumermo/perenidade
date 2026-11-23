// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A entrada nas salas de vídeo do painel pelo LiveKit (Prompt 4, item 141, atrás de "sala-livekit"): o token curto que o servidor do
// site dá ao navegador para UMA sala. Só roda no servidor: a chave e o segredo do projeto (LIVEKIT_API_KEY e LIVEKIT_API_SECRET,
// variáveis do servidor, nunca no repositório nem no navegador) assinam o token aqui.
//
// O token é um JWT HS256 no formato que o servidor do LiveKit lê (iss = a chave do projeto, sub = a identidade na sala, o grant
// "video" com a sala e as permissões). Assinado com o HMAC do próprio Node, sem pacote a mais. O que ele leva, de propósito:
//   - a sala e as permissões (quem conduz modera; ninguém grava, transmite para fora nem cria sala);
//   - uma identidade SORTEADA a cada entrada (16 bytes de randomBytes): nem a conta, nem o e-mail, nem o nome. O nome que aparece na
//     sala é posto pelo próprio navegador depois de entrar (o painel já usa esse nome; o grant canUpdateOwnMetadata deixa);
//   - validade de 2 horas.
// Sem "@/" de propósito (roda no Node nos testes).
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/** Quanto vale o token (segundos). */
export const VALIDADE_S = 2 * 3600;

/** O papel de quem entra: quem conduz (modera), quem assiste (entra calada e sem câmera), a chamada de canal e o estudo em grupo. */
export type PapelNaSala = "conduz" | "assiste" | "canal" | "estudo";

export interface ConfigDoLivekit {
  /** O endereço público do projeto (wss://...), o mesmo que vai ao navegador (NEXT_PUBLIC_LIVEKIT_URL). */
  url: string;
  chave: string;
  segredo: string;
}

/** O endereço do projeto: wss:// (ou ws:// só em localhost, para o teste local). */
export function enderecoDoLivekit(valor: string | undefined): string | null {
  const u = (valor ?? "").trim().replace(/\/+$/, "");
  if (/^wss:\/\/[a-z0-9.-]+(:\d{2,5})?(\/[A-Za-z0-9._~/-]*)?$/i.test(u)) return u;
  if (/^ws:\/\/(localhost|127\.0\.0\.1)(:\d{2,5})?$/.test(u)) return u;
  return null;
}

/** A configuração, das variáveis do servidor. Faltou qualquer uma: null (a sala diz que o LiveKit não está configurado). */
export function configDoLivekit(env: Record<string, string | undefined>): ConfigDoLivekit | null {
  const url = enderecoDoLivekit(env.NEXT_PUBLIC_LIVEKIT_URL);
  const chave = (env.LIVEKIT_API_KEY ?? "").trim();
  const segredo = (env.LIVEKIT_API_SECRET ?? "").trim();
  if (!url || !/^[A-Za-z0-9_-]{3,64}$/.test(chave) || segredo.length < 6) return null;
  return { url, chave, segredo };
}

/** O nome de sala aceito (o mesmo formato das salas que já estão no banco e das que o navegador sorteia). */
export const SALA = /^[A-Za-z0-9_-]{6,80}$/;
/** A sala do estudo em grupo (nasce no navegador, components/EstudoEmGrupo.tsx). */
export const SALA_DO_ESTUDO = /^instituto-lucia-estudo-[a-z0-9]{12,40}$/;

/** As permissões de cada papel (o grant "video" do LiveKit). */
export function permissoes(sala: string, papel: PapelNaSala) {
  return {
    room: sala,
    roomJoin: true,
    canSubscribe: true,
    canPublish: true,
    canPublishData: true,
    // O navegador põe o próprio nome depois de entrar (o token não leva nome).
    canUpdateOwnMetadata: true,
    // Só quem conduz modera (calar, tirar da sala). Ninguém cria, lista, grava, transmite para fora nem entra escondido.
    roomAdmin: papel === "conduz",
    roomCreate: false,
    roomList: false,
    roomRecord: false,
    ingressAdmin: false,
    hidden: false,
    recorder: false,
  };
}

const b64url = (b: Buffer | string) => Buffer.from(b).toString("base64url");

/** O token da sala para quem entra, com identidade sorteada. */
export function tokenDaSala(config: Pick<ConfigDoLivekit, "chave" | "segredo">, sala: string, papel: PapelNaSala, agora = Date.now(), sortear = () => randomBytes(16)) {
  if (!SALA.test(sala)) throw new Error("sala_invalida");
  const identidade = sortear().toString("hex");
  const s = Math.floor(agora / 1000);
  const cabeca = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const corpo = b64url(JSON.stringify({ iss: config.chave, sub: identidade, nbf: s - 10, exp: s + VALIDADE_S, video: permissoes(sala, papel) }));
  const assinatura = createHmac("sha256", config.segredo).update(`${cabeca}.${corpo}`).digest("base64url");
  return { token: `${cabeca}.${corpo}.${assinatura}`, identidade, expira: (s + VALIDADE_S) * 1000 };
}

/** Lê e confere um token (para os testes e para conferir o que sai). null: assinatura errada ou fora do formato. */
export function lerToken(token: string, segredo: string): Record<string, unknown> | null {
  const partes = token.split(".");
  if (partes.length !== 3) return null;
  const esperada = createHmac("sha256", segredo).update(`${partes[0]}.${partes[1]}`).digest();
  const veio = Buffer.from(partes[2], "base64url");
  if (veio.length !== esperada.length || !timingSafeEqual(veio, esperada)) return null;
  try {
    return JSON.parse(Buffer.from(partes[1], "base64url").toString("utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}
