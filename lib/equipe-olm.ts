// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As conversas da equipe (painel) na biblioteca do Matrix: Megolm nas mensagens e Olm de aparelho para aparelho, com vários
// aparelhos por pessoa. Documento: docs/CONVERSAS-DA-EQUIPE.md ("A cifra"). Banco: supabase/migracoes/20261116-equipe-chat-olm.sql.
//
// Cada versão da conversa (a troca quando alguém sai) é uma sala da biblioteca. Quem escreve entrega a chave da sessão Megolm,
// por Olm, a cada aparelho aprovado de quem está na conversa (o filtro `aceita` do aparelho confere o certificado da identidade
// de cada pessoa). Aparelho que chegou depois pede a sessão que falta (`equipe_chat_pedir_chave`), e um aparelho de quem está
// na conversa repassa (`exportarSessao` + `mandarSessao`); quem recebe só importa sessões daquela conversa, vindas de aparelho
// confiável de quem está nela. O texto vai dentro já assinado pela identidade de quem escreveu (lib/sigilo.ts, "s1"): a autoria
// é conferida mesmo numa sessão repassada.
//
// Sem "@/" e sem navegador obrigatório: roda no Node nos testes (scripts/testar-equipe-chat.mjs).
import { type AparelhoOlm, carregarBiblioteca, entregarABiblioteca, idMatrix, processarPedidos, type RecadoAberto, salaDaVersao } from "./rede/chat/olm";

export const MENSAGENS_POR_SESSAO = 100;

/** O que a identidade da pessoa assina para certificar as chaves Olm de um aparelho dela. */
export const textoDoCertificadoOlm = (usuario: string, aparelho: string, dispositivo: string, ed25519: string, curve25519: string) =>
  `lucia:equipe-olm:${usuario}:${aparelho}:${dispositivo}:${ed25519}:${curve25519}`;
/** O nome do aparelho na biblioteca: dez letras tiradas do id do aparelho (fixo para o mesmo aparelho). */
export const nomeDoAparelhoOlm = (aparelho: string) => [...aparelho.replace(/-/g, "").slice(0, 10)].map((c) => String.fromCharCode(65 + (parseInt(c, 16) % 26))).join("");
const SETE_DIAS_EM_MICROSSEGUNDOS = BigInt(7 * 86_400) * BigInt(1_000_000);
const FORMATO_E1 = /^e1\.([1-9][0-9]{0,6})\.([A-Za-z0-9+/]{43})\.([A-Za-z0-9+/]+)$/;

export const eE1 = (corpo: string) => FORMATO_E1.test(corpo);
export function versaoDoE1(corpo: string): number | null {
  const m = FORMATO_E1.exec(corpo);
  return m ? Number(m[1]) : null;
}
export function sessaoDoE1(corpo: string): string | null {
  return FORMATO_E1.exec(corpo)?.[2] ?? null;
}
const prefixoDaConversa = (conversa: string) => `!${conversa}.v`;

/** Abre (ou confere) as sessões Olm com todos os aparelhos aceitos destas pessoas. */
async function garantirSessoesOlm(aparelho: AparelhoOlm, pessoas: string[]) {
  const M = await carregarBiblioteca();
  const ids = pessoas.map((p) => new M.UserId(idMatrix(p)));
  await aparelho.maquina.updateTrackedUsers(ids.map((i) => i.clone()));
  // Os aparelhos de cada pessoa podem ter mudado (aparelho novo aprovado): a biblioteca consulta de novo (sem tocar na caixa).
  await entregarABiblioteca(aparelho, [], pessoas, null);
  await processarPedidos(aparelho);
  const faltam = await aparelho.maquina.getMissingSessions(ids.map((i) => i.clone()));
  if (faltam) {
    const resposta = await aparelho.transporte.reivindicar(JSON.parse(faltam.body).one_time_keys ?? {});
    await aparelho.maquina.markRequestAsSent(faltam.id, faltam.type, JSON.stringify({ ...resposta, failures: {} }));
  }
  return ids;
}

/**
 * Cifra o texto (já assinado) na versão `versao` da conversa, para os `membros` (ids das contas, a própria inclusive). Devolve o
 * corpo "e1" que vai ao banco.
 */
export async function cifrarNaConversa(aparelho: AparelhoOlm, conversa: string, versao: number, membros: string[], texto: string): Promise<string> {
  if (!Number.isInteger(versao) || versao < 1 || versao > 9_999_999) throw new Error("versao_invalida");
  const M = await carregarBiblioteca();
  const sala = salaDaVersao(conversa, versao);
  const pessoas = [...new Set([...membros, aparelho.usuario])];
  const ids = await garantirSessoesOlm(aparelho, pessoas);
  const ajustes = new M.EncryptionSettings();
  ajustes.rotationPeriodMessages = BigInt(MENSAGENS_POR_SESSAO);
  ajustes.rotationPeriod = SETE_DIAS_EM_MICROSSEGUNDOS;
  ajustes.historyVisibility = M.HistoryVisibility.Shared;
  for (const recado of await aparelho.maquina.shareRoomKey(new M.RoomId(sala), ids.map((i) => i.clone()), ajustes)) {
    await aparelho.transporte.enviar(recado.event_type ?? "m.room.encrypted", JSON.parse(recado.body).messages ?? {});
    await aparelho.maquina.markRequestAsSent(recado.id, M.RequestType.ToDevice, "{}");
  }
  const conteudo = JSON.parse(await aparelho.maquina.encryptRoomEvent(new M.RoomId(sala), "m.room.message", JSON.stringify({ b: texto })));
  const corpo = `e1.${versao}.${conteudo?.session_id}.${conteudo?.ciphertext}`;
  if (conteudo?.algorithm !== "m.megolm.v1.aes-sha2" || !FORMATO_E1.test(corpo)) throw new Error("cifra_falhou");
  return corpo;
}

/**
 * Abre um corpo "e1". `{ texto }`: abriu (o texto ainda assinado, para conferir a autoria). `{ falta }`: este aparelho não tem a
 * sessão (pedir a quem tem). null: não é "e1", ou foi mexido, ou é de outra conversa ou versão.
 */
export async function abrirNaConversa(aparelho: AparelhoOlm, corpo: string, conversa: string, autor: string): Promise<{ texto: string } | { falta: string } | null> {
  const partes = FORMATO_E1.exec(corpo);
  if (!partes) return null;
  const M = await carregarBiblioteca();
  const sala = salaDaVersao(conversa, Number(partes[1]));
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
    const dados = JSON.parse(aberto.event);
    if (dados?.type !== "m.room.message" || dados?.room_id !== sala || typeof dados?.content?.b !== "string") return null;
    return { texto: dados.content.b };
  } catch (erro) {
    // Sessão que este aparelho não tem, ou que só tem a partir de uma mensagem mais nova (chegou depois, ou a chave ainda não
    // veio): pede a quem tem. Outro erro (mexido, aparelho que não confere): não abre.
    const codigo = (erro as { code?: unknown })?.code;
    return codigo === M.DecryptionErrorCode.MissingRoomKey || codigo === M.DecryptionErrorCode.UnknownMessageIndex ? { falta: partes[2] } : null;
  }
}

/** As chaves de uma sessão desta conversa que este aparelho tem (exportadas pela biblioteca), ou null. */
export async function exportarSessao(aparelho: AparelhoOlm, conversa: string, sessao: string): Promise<string | null> {
  const exportadas = await aparelho.maquina.exportRoomKeys((s) => s.sessionId === sessao && s.roomId.toString().startsWith(prefixoDaConversa(conversa)));
  const lista = JSON.parse(exportadas) as unknown[];
  return lista.length ? exportadas : null;
}

/** Manda, por Olm, as chaves de uma sessão a UM aparelho aceito de alguém (o que pediu). Devolve false se o aparelho não é aceito. */
export async function mandarSessao(aparelho: AparelhoOlm, usuario: string, dispositivo: string, conversa: string, chaves: string): Promise<boolean> {
  const M = await carregarBiblioteca();
  await garantirSessoesOlm(aparelho, [usuario]);
  const destino = (await aparelho.maquina.getUserDevices(new M.UserId(idMatrix(usuario)))).get(new M.DeviceId(dispositivo));
  if (!destino) return false;
  const cifrado = JSON.parse(await destino.encryptToDeviceEvent("lucia.chaves", { conversa, chaves }));
  if (cifrado?.algorithm !== "m.olm.v1.curve25519-aes-sha2") return false;
  await aparelho.transporte.enviar("m.room.encrypted", { [idMatrix(usuario)]: { [dispositivo]: cifrado } });
  return true;
}

/**
 * Importa sessões repassadas ("lucia.chaves"). `remetenteOk(conversa, quem)`: quem repassou está naquela conversa (e o aparelho
 * dele foi aceito, o que o Olm já garantiu ao abrir o recado). Só entram sessões da própria conversa. Devolve quantas entraram.
 */
export async function importarSessoes(aparelho: AparelhoOlm, recados: RecadoAberto[], remetenteOk: (conversa: string, quem: string) => boolean | Promise<boolean>): Promise<number> {
  let n = 0;
  for (const r of recados) {
    if (r.tipo !== "lucia.chaves" || typeof r.conteudo.conversa !== "string" || typeof r.conteudo.chaves !== "string") continue;
    const conversa = r.conteudo.conversa;
    if (!(await remetenteOk(conversa, r.de))) continue;
    let lista: { room_id?: unknown }[];
    try {
      lista = JSON.parse(r.conteudo.chaves);
    } catch {
      continue;
    }
    if (!Array.isArray(lista) || !lista.length || lista.length > 20 || !lista.every((k) => typeof k?.room_id === "string" && k.room_id.startsWith(prefixoDaConversa(conversa)))) continue;
    try {
      const resultado = await aparelho.maquina.importExportedRoomKeys(JSON.stringify(lista), () => undefined);
      n += Number(resultado.importedCount ?? 0);
    } catch {
      // chaves que não entram: segue
    }
  }
  return n;
}
