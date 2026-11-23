// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Ligar um aparelho novo à conta, por QR (onda R2, item 1.5). Documento: docs/rede/CHAT-PRIVADO.md.
//
// 1. O aparelho NOVO (já entrou na conta) sorteia uma caixa-canal (id, passe de depósito e de leitura), um par X-Wing de uma vez e
//    um segredo q de 32 bytes, e mostra o QR:  alumia:ligar:v1:<conta>:<id>:<passe de depósito>:<X-Wing pública>:<q>.
// 2. O aparelho VELHO lê o QR, confere que é a MESMA conta (QR de outra conta: recusado), pede confirmação à pessoa, e deposita no
//    canal: HPKE (RFC 9180, @hpke) com X-Wing para a chave do QR, info "alumia/r2/ligar/v1", aad = SHA-256(q), de um pacote com a
//    identidade da conta, a chave de pedidos, a chave de sincronia e a lista de conversas, mais um MAC (HMAC-SHA-256 com q).
// 3. O novo abre, confere o MAC e a conta, confere que a identidade que chegou é a que o diretório e o registro de transparência
//    mostram para a conta (quem chama faz), gera as PRÓPRIAS chaves de aparelho, e publica o certificado assinado pela identidade.
// O servidor nunca vê o QR: só uma caixa anônima e um envelope cifrado. Quem fotografar o QR não abre o envelope (falta a privada
// X-Wing, que nunca sai do aparelho novo); quem só tiver o canal não forja o pacote (falta q).
//
// O risco que sobra (dito na tela): quem convencer a pessoa a ler, com o aparelho dela, um QR que NÃO está num aparelho dela, ganha
// a identidade da conta. Por isso: confirmação com o aviso, só a mesma conta, e o aviso "aparelho novo ligado" em todos os aparelhos
// e para os contatos.
import type { CipherSuite } from "@hpke/core";
import { autenticar, canonico, completar, copia, deB64Url, deTexto, iguais, juntar, paraB64Url, resumo, sortear, texto, tirarCompleto, type Bytes } from "../chat/r2/bytes";
import { novoParXWing } from "../chat/r2/envelope";
import { ROTULOS } from "../chat/r2/rotulos";

/** Um tamanho só (o que o banco aceita para o canal: TAMANHO_LIGAR do módulo das caixas). A lista de conversas não vai pelo QR: vem
 * pelo arquivo cifrado da conta, que o aparelho novo lê com a chave de sincronia. */
export const TAMANHOS_DO_LIGAR = [64 * 1024] as const;
const PREFIXO = "alumia:ligar:v1:";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
/** O QR vale por 10 minutos (o aparelho novo para de esperar e apaga o canal). */
export const VALIDADE_DO_QR_MS = 10 * 60_000;

let suite: Promise<CipherSuite> | null = null;
function suiteDoLigar(): Promise<CipherSuite> {
  suite ??= (async () => {
    const [{ CipherSuite: Suite, HkdfSha256, Aes256Gcm }, { XWing }] = await Promise.all([import("@hpke/core"), import("@hpke/hybridkem-x-wing")]);
    return new Suite({ kem: new XWing(), kdf: new HkdfSha256(), aead: new Aes256Gcm() });
  })().catch((erro: unknown) => {
    suite = null;
    throw erro;
  });
  return suite;
}

/** O que o aparelho novo guarda (só na memória) enquanto espera. */
export interface EsperaDoLigar {
  conta: string;
  canal: { id: Bytes; pd: Bytes; pl: Bytes };
  privada: Bytes;
  q: Bytes;
  criadoEm: number;
}

/** O pacote que o aparelho velho manda: as chaves da CONTA (nunca as do aparelho velho) e a lista de conversas. */
export interface PacoteDeLigar {
  conta: string;
  /** Semente Ed25519 da identidade da conta (base64url). */
  identidade: string;
  /** Privada X-Wing da chave de pedidos (base64url). */
  pedidos: string;
  /** Chave de sincronia (base64url). */
  sincronia: string;
  /** A geração da lista que o aparelho velho já viu: o novo não aceita do servidor uma lista mais velha que ela. */
  geracao?: number;
  lista: unknown;
}

/** Aparelho NOVO: prepara o canal e o QR. */
export async function prepararQr(conta: string, agora = Date.now()): Promise<{ qr: string; espera: EsperaDoLigar }> {
  if (!UUID.test(conta)) throw new Error("conta_invalida");
  const par = await novoParXWing();
  const canal = { id: sortear(32), pd: sortear(32), pl: sortear(32) };
  const q = sortear(32);
  const qr = PREFIXO + [conta, paraB64Url(canal.id), paraB64Url(canal.pd), paraB64Url(par.publica), paraB64Url(q)].join(":");
  return { qr, espera: { conta, canal, privada: par.privada, q, criadoEm: agora } };
}

export interface QrLido {
  conta: string;
  canal: { id: Bytes; pd: Bytes };
  publica: Bytes;
  q: Bytes;
}

/** Aparelho VELHO: lê o QR. "outra_conta": o QR é de um aparelho que entrou em outra conta (recusado). */
export function lerQr(qr: string, minhaConta: string): QrLido | "invalido" | "outra_conta" {
  if (!qr.startsWith(PREFIXO)) return "invalido";
  const partes = qr.slice(PREFIXO.length).split(":");
  if (partes.length !== 5 || !UUID.test(partes[0])) return "invalido";
  try {
    const [id, pd, publica, q] = partes.slice(1).map(deB64Url);
    if (id.length !== 32 || pd.length !== 32 || publica.length !== 1216 || q.length !== 32) return "invalido";
    if (partes[0] !== minhaConta) return "outra_conta";
    return { conta: partes[0], canal: { id, pd }, publica, q };
  } catch {
    return "invalido";
  }
}

const macDe = (q: Uint8Array, conteudo: Uint8Array) => autenticar(q, canonico(ROTULOS.ligar, conteudo));

/** Aparelho VELHO: o envelope para depositar no canal. */
export async function selarParaONovo(lido: QrLido, pacote: PacoteDeLigar): Promise<Bytes> {
  if (pacote.conta !== lido.conta) throw new Error("outra_conta");
  const s = await suiteDoLigar();
  const conteudo = texto(JSON.stringify({ conta: pacote.conta, identidade: pacote.identidade, pedidos: pacote.pedidos, sincronia: pacote.sincronia, lista: pacote.lista, geracao: pacote.geracao ?? 0 }));
  const bloco = completar(juntar(macDe(lido.q, conteudo), conteudo), TAMANHOS_DO_LIGAR);
  try {
    const chave = await s.kem.deserializePublicKey(copia(lido.publica));
    const { ct, enc } = await s.seal({ recipientPublicKey: chave, info: texto(ROTULOS.ligar) }, bloco, resumo(lido.q));
    return juntar(new Uint8Array(enc), new Uint8Array(ct));
  } finally {
    bloco.fill(0);
  }
}

/** Aparelho NOVO: abre o que chegou no canal. null em qualquer dúvida (outra chave, MAC errado, outra conta, QR vencido). */
export async function abrirNoNovo(espera: EsperaDoLigar, envelope: Uint8Array, agora = Date.now()): Promise<PacoteDeLigar | null> {
  if (agora - espera.criadoEm > VALIDADE_DO_QR_MS || envelope.length < 1120 + 16) return null;
  try {
    const s = await suiteDoLigar();
    const chave = await s.kem.deserializePrivateKey(copia(espera.privada));
    const aberto = new Uint8Array(await s.open({ recipientKey: chave, enc: copia(envelope.subarray(0, 1120)), info: texto(ROTULOS.ligar) }, copia(envelope.subarray(1120)), resumo(espera.q)));
    const bloco = tirarCompleto(aberto, TAMANHOS_DO_LIGAR);
    aberto.fill(0);
    if (!bloco || bloco.length < 32) return null;
    const conteudo = bloco.subarray(32);
    if (!iguais(bloco.subarray(0, 32), macDe(espera.q, conteudo))) return null;
    const p = JSON.parse(deTexto(conteudo));
    if (p?.conta !== espera.conta || typeof p.identidade !== "string" || typeof p.pedidos !== "string" || typeof p.sincronia !== "string") return null;
    return { conta: p.conta, identidade: p.identidade, pedidos: p.pedidos, sincronia: p.sincronia, lista: p.lista ?? null, geracao: Number.isSafeInteger(p.geracao) && p.geracao > 0 ? p.geracao : 0 };
  } catch {
    return null;
  }
}

/** Apaga da memória o que o aparelho novo guardou para esperar. */
export function esquecerEspera(espera: EsperaDoLigar): void {
  espera.privada.fill(0);
  espera.q.fill(0);
  espera.canal.pl.fill(0);
}
