// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A cifra do chat privado da Alumia pela biblioteca do Matrix (`@matrix-org/matrix-sdk-crypto-wasm`, a mesma do Element; por
// dentro, o vodozemac): Olm (Double Ratchet) entre os dois aparelhos para entregar as chaves, e Megolm para as mensagens. Nada de
// cifra feita à mão aqui: este arquivo só leva os pedidos da biblioteca ao banco e traz as respostas. Documento:
// docs/rede/CHAT-PRIVADO.md ("A tecnologia").
//
// O servidor da Alumia faz o papel do "homeserver" só no que a cifra precisa (supabase/migracoes/20261113-chat-olm.sql):
// guardar a chave pública do aparelho, as chaves de uso único, e a caixa de recados cifrados de aparelho para aparelho. Ele não
// é de confiança: este aparelho só entrega chave ao aparelho cuja identidade (a chave ed25519) ele já conhece da pessoa
// (`confiavel`), e só abre mensagem cuja sessão veio desse mesmo aparelho.
//
// Cada versão da conversa é uma "sala" própria para a biblioteca (`salaDaVersao`): versão nova = sessão Megolm nova. Dentro de
// uma versão, a biblioteca troca de sessão sozinha a cada 100 mensagens. O que vai cifrado é o mesmo bloco de tamanho fixo do
// "c3" (lib/rede/chat/c3.ts), então o tamanho no banco continua sem dizer o tamanho do texto.
//
// Sem "@/" e sem navegador obrigatório: roda no Node nos testes (scripts/testar-rede-chat.mjs), com a loja na memória.
import type { OlmMachine as Maquina } from "@matrix-org/matrix-sdk-crypto-wasm";
import { deBase64, paraBase64 } from "../../sigilo";

type Biblioteca = typeof import("@matrix-org/matrix-sdk-crypto-wasm");
let biblioteca: Promise<Biblioteca> | null = null;
/** Carrega a biblioteca (e o WebAssembly dela) uma vez, só quando o chat é usado. */
export function carregarBiblioteca(): Promise<Biblioteca> {
  biblioteca ??= import("@matrix-org/matrix-sdk-crypto-wasm").then(async (m) => {
    await m.initAsync();
    return m;
  });
  return biblioteca;
}

/** O "servidor" Matrix de mentira: nenhum endereço de verdade, só o nome que a biblioteca exige. */
export const SERVIDOR = "alumia.invalid";
export const idMatrix = (usuario: string) => `@${usuario}:${SERVIDOR}`;
export function usuarioDoIdMatrix(id: string): string | null {
  const m = /^@([0-9a-f-]{36}):alumia\.invalid$/.exec(id);
  return m ? m[1] : null;
}
/** A sala de uma versão da conversa. A versão vai com 7 algarismos: o tamanho do cifrado não muda de uma versão para outra. */
export const salaDaVersao = (conversa: string, versao: number) => `!${conversa}.v${String(versao).padStart(7, "0")}:${SERVIDOR}`;

/** O nome do aparelho na biblioteca: dez letras sorteadas a cada ativação. */
export function novoNomeDeAparelho(): string {
  const letras = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const sorte = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(10)));
  return [...sorte].map((n) => letras[n % 26]).join("");
}

/** Quanto vale uma sessão Megolm dentro de uma versão: 100 mensagens (o contador da biblioteca fica em um byte) ou 7 dias. */
export const MENSAGENS_POR_SESSAO = 100;
const SETE_DIAS_EM_MICROSSEGUNDOS = BigInt(7 * 86_400) * BigInt(1_000_000);

/**
 * O tamanho do cifrado Megolm (a última parte do "m1") para cada bloco de 256 a 8192 bytes. É o mesmo em toda mensagem do mesmo
 * bloco: o banco recusa qualquer outro (supabase/migracoes/20261113-chat-olm.sql, a mesma lista; o teste confere as duas).
 */
export const TAMANHOS_DO_M1 = [723, 1192, 2088, 3923, 7550, 11198, 14846] as const;

/** O formato "m1" no banco: `m1.<versão>.<sessão (43)>.<cifrado Megolm (base64)>`. */
const FORMATO_M1 = /^m1\.([1-9][0-9]{0,6})\.([A-Za-z0-9+/]{43})\.([A-Za-z0-9+/]+)$/;
export function eM1(corpo: string): boolean {
  return FORMATO_M1.test(corpo);
}
export function versaoDoM1(corpo: string): number | null {
  const m = FORMATO_M1.exec(corpo);
  return m ? Number(m[1]) : null;
}

/** As chamadas ao banco de que a biblioteca precisa (lib/rede/cliente-chat.ts; nos testes, o banco local). */
export interface TransporteOlm {
  publicar(pedido: Record<string, unknown>): Promise<{ one_time_key_counts: Record<string, number>; versao?: number }>;
  consultar(usuarios: string[]): Promise<{ device_keys: Record<string, Record<string, DeviceKeys>> }>;
  reivindicar(pedido: Record<string, unknown>): Promise<{ one_time_keys: Record<string, Record<string, Record<string, unknown>>> }>;
  enviar(tipo: string, mensagens: Record<string, Record<string, unknown>>): Promise<unknown>;
  receber(): Promise<{ eventos: { id: number; sender: string; type: string; content: unknown }[]; unicas: number; reserva_usada: boolean }>;
  confirmar(ate: number): Promise<unknown>;
}

interface DeviceKeys {
  user_id: string;
  device_id: string;
  keys: Record<string, string>;
  [outro: string]: unknown;
}

/** As chaves públicas do aparelho, como a biblioteca as dá (base64 sem "="). */
export interface IdentidadeOlm {
  dispositivo: string;
  ed25519: string;
  curve25519: string;
}

/** Um aparelho do chat: a máquina da biblioteca, quem é, e como chegar ao banco. */
export interface AparelhoOlm {
  usuario: string;
  maquina: Maquina;
  identidade: IdentidadeOlm;
  transporte: TransporteOlm;
  /**
   * A identidade (ed25519) em que este aparelho confia para cada pessoa, ou null. Só aparelho com esta chave recebe chave de
   * conversa; só mensagem de sessão vinda dela abre.
   */
  confiavel: (usuario: string) => Promise<string | null>;
}

/** Abre (ou cria) o aparelho. Com `loja`, a biblioteca guarda as sessões no IndexedDB, cifradas com `loja.senha`. */
export async function abrirAparelho(opcoes: {
  usuario: string;
  dispositivo: string;
  transporte: TransporteOlm;
  confiavel: AparelhoOlm["confiavel"];
  loja?: { nome: string; senha: string };
}): Promise<AparelhoOlm> {
  const M = await carregarBiblioteca();
  const maquina = await M.OlmMachine.initialize(new M.UserId(idMatrix(opcoes.usuario)), new M.DeviceId(opcoes.dispositivo), opcoes.loja?.nome, opcoes.loja?.senha);
  const chaves = maquina.identityKeys;
  const aparelho: AparelhoOlm = {
    usuario: opcoes.usuario,
    maquina,
    identidade: { dispositivo: opcoes.dispositivo, ed25519: chaves.ed25519.toBase64(), curve25519: chaves.curve25519.toBase64() },
    transporte: opcoes.transporte,
    confiavel: opcoes.confiavel,
  };
  await processarPedidos(aparelho);
  // A primeira sincronização faz a biblioteca publicar também a chave de reserva (e traz os recados que já estavam lá).
  await sincronizar(aparelho);
  return aparelho;
}

/** Fecha a máquina (libera a memória do WebAssembly). Depois disso, o aparelho não serve para mais nada. */
export function fecharAparelho(aparelho: AparelhoOlm | null | undefined) {
  try {
    aparelho?.maquina.close();
  } catch {
    // Já fechado.
  }
}

/** Só as chaves de aparelho em que este aparelho confia: as da pessoa com a identidade conhecida, e a minha, a deste aparelho. */
async function filtrarConsulta(aparelho: AparelhoOlm, resposta: Awaited<ReturnType<TransporteOlm["consultar"]>>) {
  const saida: Record<string, Record<string, DeviceKeys>> = {};
  for (const [id, aparelhos] of Object.entries(resposta.device_keys ?? {})) {
    const usuario = usuarioDoIdMatrix(id);
    if (!usuario) continue;
    const confiada = usuario === aparelho.usuario ? aparelho.identidade.ed25519 : await aparelho.confiavel(usuario);
    saida[id] = {};
    for (const [dispositivo, chaves] of Object.entries(aparelhos ?? {})) {
      if (!confiada || chaves?.user_id !== id || chaves?.device_id !== dispositivo || chaves?.keys?.[`ed25519:${dispositivo}`] !== confiada) continue;
      saida[id][dispositivo] = chaves;
    }
  }
  return { device_keys: saida, failures: {} };
}

/** Faz o que a biblioteca pede (publicar chaves, consultar e reivindicar chaves dos outros, mandar recados) até ela não pedir mais nada. */
export async function processarPedidos(aparelho: AparelhoOlm): Promise<void> {
  const M = await carregarBiblioteca();
  for (let volta = 0; volta < 5; volta++) {
    const pedidos = await aparelho.maquina.outgoingRequests();
    if (pedidos.length === 0) return;
    for (const pedido of pedidos) {
      const corpo = JSON.parse(pedido.body);
      let resposta: unknown = {};
      switch (pedido.type) {
        case M.RequestType.KeysUpload:
          resposta = await aparelho.transporte.publicar(corpo);
          break;
        case M.RequestType.KeysQuery:
          resposta = await filtrarConsulta(aparelho, await aparelho.transporte.consultar(Object.keys(corpo.device_keys ?? {}).map(usuarioDoIdMatrix).filter((u): u is string => !!u)));
          break;
        case M.RequestType.KeysClaim:
          resposta = { ...(await aparelho.transporte.reivindicar(corpo.one_time_keys ?? {})), failures: {} };
          break;
        case M.RequestType.ToDevice:
          await aparelho.transporte.enviar((pedido as unknown as { event_type: string }).event_type, corpo.messages ?? {});
          break;
        default:
          // Assinaturas cruzadas, backup de chaves, mensagens de sala: este chat não usa. Responde vazio para a biblioteca seguir.
          break;
      }
      await aparelho.maquina.markRequestAsSent(pedido.id as string, pedido.type, JSON.stringify(resposta));
    }
  }
}

/**
 * Busca os recados cifrados que chegaram para este aparelho (as chaves das sessões da outra pessoa) e entrega à biblioteca.
 * `mudaram`: pessoas cuja chave de aparelho pode ter mudado (a biblioteca consulta de novo).
 */
export async function sincronizar(aparelho: AparelhoOlm, mudaram: string[] = []): Promise<RecadoAberto[]> {
  const caixa = await aparelho.transporte.receber();
  const eventos = (caixa.eventos ?? []).filter((e) => e.type === "m.room.encrypted").map((e) => ({ sender: e.sender, type: e.type, content: e.content }));
  const abertos = await entregarABiblioteca(aparelho, eventos, mudaram, caixa.unicas ?? 0, !caixa.reserva_usada);
  const ultimo = (caixa.eventos ?? []).reduce((maior, e) => Math.max(maior, e.id), 0);
  if (ultimo > 0) await aparelho.transporte.confirmar(ultimo);
  await processarPedidos(aparelho);
  return abertos;
}

/** Um recado de aparelho para aparelho que a biblioteca abriu: quem mandou, a chave curve25519 do aparelho que cifrou, e o evento. */
export interface RecadoAberto {
  de: string;
  curve25519: string;
  tipo: string;
  conteudo: Record<string, unknown>;
}

/**
 * Entrega recados cifrados (Olm) à biblioteca e devolve os que ela abriu, fora os de chave de sala (esses ela guarda sozinha).
 * `unicas`: quantas chaves de uso único ainda estão no banco (`null`: não sabe; a biblioteca não repõe).
 */
export async function entregarABiblioteca(aparelho: AparelhoOlm, eventos: { sender: string; type: string; content: unknown }[], mudaram: string[] = [], unicas: number | null = null, reservaLivre = true): Promise<RecadoAberto[]> {
  const M = await carregarBiblioteca();
  const listas = new M.DeviceLists(mudaram.map((u) => new M.UserId(idMatrix(u))), []);
  const contagem = unicas === null ? new Map<string, number>() : new Map([["signed_curve25519", unicas]]);
  const processados = await aparelho.maquina.receiveSyncChanges(JSON.stringify(eventos), listas, contagem, new Set<string>(reservaLivre ? ["signed_curve25519"] : []));
  const abertos: RecadoAberto[] = [];
  for (const p of processados) {
    if (p.type !== M.ProcessedToDeviceEventType.Decrypted) continue;
    const decifrado = p as unknown as { rawEvent: string; encryptionInfo: { senderCurve25519Key: string; sender: { toString(): string } } };
    try {
      const evento = JSON.parse(decifrado.rawEvent);
      const de = usuarioDoIdMatrix(String(evento?.sender ?? decifrado.encryptionInfo.sender.toString()));
      if (!de || typeof evento?.type !== "string" || evento.type === "m.room_key" || typeof evento.content !== "object") continue;
      abertos.push({ de, curve25519: decifrado.encryptionInfo.senderCurve25519Key, tipo: evento.type, conteudo: evento.content });
    } catch {
      // recado que não é JSON: ignora
    }
  }
  return abertos;
}

/**
 * Cifra um evento só para o aparelho confiável da outra pessoa, por Olm (Double Ratchet: chave nova a cada mensagem, e o
 * ratchet de Diffie-Hellman a cada resposta, que dá a segurança depois do comprometimento). Devolve o conteúdo cifrado
 * ("m.room.encrypted", algoritmo Olm) e o nome do aparelho de destino.
 */
export async function cifrarParaAparelho(aparelho: AparelhoOlm, outro: string, tipo: string, conteudo: Record<string, unknown>): Promise<{ dispositivo: string; cifrado: Record<string, unknown> }> {
  const confiada = await aparelho.confiavel(outro);
  if (!confiada) throw new Error("dm_sem_chave");
  const M = await carregarBiblioteca();
  const pessoa = new M.UserId(idMatrix(outro));
  await aparelho.maquina.updateTrackedUsers([pessoa.clone()]);
  await processarPedidos(aparelho);
  const faltam = await aparelho.maquina.getMissingSessions([pessoa.clone()]);
  if (faltam) {
    const resposta = await aparelho.transporte.reivindicar(JSON.parse(faltam.body).one_time_keys ?? {});
    await aparelho.maquina.markRequestAsSent(faltam.id, faltam.type, JSON.stringify({ ...resposta, failures: {} }));
  }
  const aparelhos = await aparelho.maquina.getUserDevices(pessoa.clone());
  const destino = aparelhos.devices().find((d) => d.getKey(M.DeviceKeyAlgorithmName.Ed25519)?.toBase64() === confiada);
  if (!destino) throw new Error("dm_sem_chave");
  const cifrado = JSON.parse(await destino.encryptToDeviceEvent(tipo, conteudo));
  if (cifrado?.algorithm !== "m.olm.v1.curve25519-aes-sha2") throw new Error("cifra_falhou");
  return { dispositivo: destino.deviceId.toString(), cifrado };
}

/** Garante que a sessão Megolm desta versão foi entregue (por Olm) ao aparelho confiável da outra pessoa e ao meu. */
async function entregarChaveDaSala(aparelho: AparelhoOlm, sala: string, outro: string) {
  const M = await carregarBiblioteca();
  const pessoas = [new M.UserId(idMatrix(outro)), new M.UserId(idMatrix(aparelho.usuario))];
  await aparelho.maquina.updateTrackedUsers(pessoas.map((p) => p.clone()));
  await processarPedidos(aparelho);
  const faltam = await aparelho.maquina.getMissingSessions(pessoas.map((p) => p.clone()));
  if (faltam) {
    const resposta = await aparelho.transporte.reivindicar(JSON.parse(faltam.body).one_time_keys ?? {});
    await aparelho.maquina.markRequestAsSent(faltam.id, faltam.type, JSON.stringify({ ...resposta, failures: {} }));
  }
  const ajustes = new M.EncryptionSettings();
  ajustes.rotationPeriodMessages = BigInt(MENSAGENS_POR_SESSAO);
  ajustes.rotationPeriod = SETE_DIAS_EM_MICROSSEGUNDOS;
  ajustes.historyVisibility = M.HistoryVisibility.Joined;
  const recados = await aparelho.maquina.shareRoomKey(new M.RoomId(sala), pessoas, ajustes);
  for (const recado of recados) {
    await aparelho.transporte.enviar(recado.event_type ?? "m.room.encrypted", JSON.parse(recado.body).messages ?? {});
    await aparelho.maquina.markRequestAsSent(recado.id, M.RequestType.ToDevice, "{}");
  }
}

/** Cifra um bloco (bytes de tamanho fixo) na versão da conversa. Devolve o corpo "m1" que vai ao banco. */
export async function cifrarBloco(aparelho: AparelhoOlm, conversa: string, versao: number, outro: string, bloco: Uint8Array): Promise<string> {
  if (!Number.isInteger(versao) || versao < 1 || versao > 9_999_999) throw new Error("versao_invalida");
  if (!(await aparelho.confiavel(outro))) throw new Error("dm_sem_chave");
  const M = await carregarBiblioteca();
  const sala = salaDaVersao(conversa, versao);
  await entregarChaveDaSala(aparelho, sala, outro);
  const conteudo = JSON.parse(await aparelho.maquina.encryptRoomEvent(new M.RoomId(sala), "m.room.message", JSON.stringify({ b: paraBase64(bloco) })));
  if (conteudo?.algorithm !== "m.megolm.v1.aes-sha2" || typeof conteudo.session_id !== "string" || typeof conteudo.ciphertext !== "string") throw new Error("cifra_falhou");
  const corpo = `m1.${versao}.${conteudo.session_id}.${conteudo.ciphertext}`;
  if (!FORMATO_M1.test(corpo)) throw new Error("cifra_falhou");
  return corpo;
}

/**
 * Abre um corpo "m1". null em qualquer dúvida: formato errado, sessão que não chegou a este aparelho, sessão que não veio do
 * aparelho em que este confia para quem escreveu (`identidadeDoAutor`, a ed25519), sessão encaminhada por terceiro, sala ou
 * autor trocados, conteúdo que não é um bloco.
 */
export async function abrirBloco(aparelho: AparelhoOlm, corpo: string, conversa: string, autor: string, identidadeDoAutor: string | null): Promise<Uint8Array | null> {
  const partes = FORMATO_M1.exec(corpo);
  if (!partes || !identidadeDoAutor) return null;
  const M = await carregarBiblioteca();
  const versao = Number(partes[1]);
  const sala = salaDaVersao(conversa, versao);
  const evento = {
    type: "m.room.encrypted",
    event_id: `$${partes[2].slice(0, 16)}${partes[3].slice(-16)}`.replace(/[+/]/g, "_"),
    sender: idMatrix(autor),
    origin_server_ts: 0,
    room_id: sala,
    content: { algorithm: "m.megolm.v1.aes-sha2", session_id: partes[2], ciphertext: partes[3] },
  };
  try {
    const aberto = await aparelho.maquina.decryptRoomEvent(JSON.stringify(evento), new M.RoomId(sala), new M.DecryptionSettings(M.TrustRequirement.Untrusted));
    // A sessão tem de ter vindo direto do aparelho confiável de quem escreveu, por Olm: nada encaminhado por outro.
    if (aberto.senderClaimedEd25519Key !== identidadeDoAutor) return null;
    if (aberto.forwardingCurve25519KeyChain.length > 0) return null;
    if (aberto.sender.toString() !== idMatrix(autor)) return null;
    const dados = JSON.parse(aberto.event);
    if (dados?.type !== "m.room.message" || dados?.room_id !== sala || typeof dados?.content?.b !== "string") return null;
    return deBase64(dados.content.b);
  } catch {
    return null;
  }
}
