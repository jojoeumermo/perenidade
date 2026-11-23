// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A franquia das mensagens, o lado do servidor que a rota das caixas usa: a marca do depósito. A conta é UMA só, a de
// lib/rede/franquia/servidor.ts (a mesma que confere a denúncia com prova): t = HMAC(chave do dia, "alumia/r2/marca/v2" ‖ c ‖ id_h ‖
// pd_h ‖ dia), com pd_h o resumo do passe de depósito apresentado. Só no servidor do site; o segredo nunca vai ao banco nem ao
// navegador. A conferência da denúncia mora só lá, com a declaração de quem escreve: não há outra.
//
// Onda R3 (item 3.1, o chat separado): com o servidor do chat fora do site, a marca é feita LÁ (com o segredo da franquia DELE,
// CHAT_FRANQUIA_SEGREDO, que a rede social não tem), e a rota da denúncia, que continua no site (a denúncia é de uma conta), pergunta
// ao servidor do chat se cada marca confere: POST <ALUMIA_CHAT_INTERNO>/interno/franquia/conferir, com o token próprio da interface
// entre os dois (CHAT_INTERFACE_TOKEN, cabeçalho "Authorization: AlumiaInterface <token>"). O servidor do chat responde só "confere"
// ou "não confere" para cada marca: não diz de quem é a caixa (não sabe), não guarda a pergunta.
import { paraB64u } from "./base";
export { DIAS_DA_PROVA as PRAZO_DA_DENUNCIA_DIAS } from "../franquia/protocolo";
export { marcaDoServidor, segredoDaFranquia } from "../franquia/servidor";

/** Uma marca a conferir no servidor do chat. */
export interface MarcaAConferir {
  c: Uint8Array;
  idH: Uint8Array;
  pdH: Uint8Array;
  dia: string;
  marca: Uint8Array;
}

/** O servidor do chat separado, como a rede social o chama (endereço interno e token da interface), ou nulo (o chat está no site). */
export function chatSeparado(
  endereco: string | undefined = process.env.ALUMIA_CHAT_INTERNO,
  token: string | undefined = process.env.CHAT_INTERFACE_TOKEN,
): { endereco: string; token: string } | null {
  const e = (endereco ?? "").trim().replace(/\/+$/, "");
  const t = (token ?? "").trim();
  if (!/^https?:\/\/[A-Za-z0-9.-]+(:[0-9]{2,5})?$/.test(e) || t.length < 32 || !/^[A-Za-z0-9_-]+$/.test(t)) return null;
  return { endereco: e, token: t };
}

/** A chave de uma marca no mapa de respostas (os campos juntos, em base64 de endereço). */
export const nomeDaMarca = (m: MarcaAConferir) => [m.c, m.idH, m.pdH, m.marca].map(paraB64u).join(".") + `.${m.dia}`;

/**
 * Pergunta ao servidor do chat se cada marca confere (até 10 por pergunta). Devolve o conjunto das que conferem, ou nulo se o servidor
 * do chat não respondeu (a rota responde "sem_servico": nunca "confere" por falta de resposta).
 */
export async function conferirMarcasNoChat(
  marcas: MarcaAConferir[],
  chat = chatSeparado(),
  buscar: typeof fetch = (...a) => globalThis.fetch(...a),
): Promise<Set<string> | null> {
  if (!chat || marcas.length < 1 || marcas.length > 10) return null;
  try {
    const r = await buscar(`${chat.endereco}/interno/franquia/conferir`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `AlumiaInterface ${chat.token}` },
      body: JSON.stringify({ marcas: marcas.map((m) => ({ c: paraB64u(m.c), id_h: paraB64u(m.idH), pd_h: paraB64u(m.pdH), dia: m.dia, marca: paraB64u(m.marca) })) }),
      cache: "no-store",
      signal: AbortSignal.timeout(6000),
    });
    if (!r.ok) return null;
    const corpo = (await r.json().catch(() => null)) as { confere?: unknown } | null;
    if (!Array.isArray(corpo?.confere) || corpo.confere.length !== marcas.length) return null;
    const certas = new Set<string>();
    marcas.forEach((m, i) => (corpo.confere as unknown[])[i] === true && certas.add(nomeDaMarca(m)));
    return certas;
  } catch {
    return null;
  }
}
