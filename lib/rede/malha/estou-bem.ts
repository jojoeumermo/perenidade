// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O "Estou bem" e as mensagens curtas pela malha sem internet (onda R3, item 2.2; documento público: docs/rede/SEM-INTERNET.md).
//
// Nada de canal novo: o "Estou bem" é um bloco de controle da conversa a dois (lib/rede/chat/r2/conversa.ts, `mandar`), com as MESMAS
// sessões, mandado aos contatos de segurança que já têm sessão de chat. O que muda é só o caminho do depósito: `depositarNaMalha`
// faz, de cada depósito que iria à caixa, um pacote da malha (pacote.ts) e o guarda no aparelho para repassar. `comMalha` embrulha o
// transporte do chat: quem tem internet deposita na caixa E guarda na malha (a mensagem que chegar pelos dois caminhos é "repetida"
// na segunda vez e some: lib/rede/chat/r2/ordem.ts).
//
// Só o bloco de 2048 cabe no pacote (mensagens curtas, o farol e o "Estou bem"). O que não cabe vai só pela caixa.
// Sem "@/" de propósito: roda no Node nos testes (scripts/testar-r3-malha.mjs).
import { deTexto, texto, type Bytes } from "../chat/r2/bytes";
import { cabeNaMalha, montarMensagem, VALIDADE_PADRAO } from "./pacote";

/** O controle "Estou bem" que vai no corpo do bloco de controle: `em` = quando a pessoa tocou (segundos desde 1970). */
export interface EstouBem {
  a: "estou_bem";
  em: number;
}

export const controleEstouBem = (agora = Date.now()): Bytes => texto(JSON.stringify({ a: "estou_bem", em: Math.floor(agora / 1000) } satisfies EstouBem));

/** Lê o controle "Estou bem" (null se o corpo é outra coisa). */
export function lerEstouBem(corpo: Uint8Array): EstouBem | null {
  try {
    const c = JSON.parse(deTexto(corpo));
    if (c?.a === "estou_bem" && Number.isInteger(c.em) && c.em > 0 && Object.keys(c).length === 2) return { a: "estou_bem", em: c.em };
    return null;
  } catch {
    return null;
  }
}

/** Onde o pacote feito vai parar (o NoDaMalha: `guardar`). */
export interface GuardaDaMalha {
  guardar(p: Uint8Array): boolean;
}

/** Um `depositar` (a assinatura do da conversa a dois) que, no lugar da caixa, guarda um pacote da malha. */
export function depositarNaMalha(no: GuardaDaMalha, agora: () => number = () => Date.now()) {
  return async (caixa: { id: Uint8Array }, envelope: Uint8Array, franquia: Uint8Array | null): Promise<{ ok: boolean }> => {
    if (!franquia || !cabeNaMalha(envelope, franquia)) return { ok: false };
    return { ok: no.guardar(montarMensagem(caixa.id, franquia, envelope, VALIDADE_PADRAO, agora())) };
  };
}

/** O pedaço do transporte do chat que deposita (lib/rede/chat/r2/servico.ts, `Transporte`). */
export interface ComDepositar {
  depositar(c: { id: Bytes; pd: Bytes }, envelope: Bytes, franquia: Bytes | null): Promise<{ ok: boolean }>;
}

/**
 * O transporte do chat com a malha: deposita na caixa (se der) e, com a malha ligada, guarda também o pacote para repassar.
 * Entregue = foi a pelo menos um dos dois caminhos. Os outros métodos do transporte passam direto.
 */
export function comMalha<T extends ComDepositar>(base: T, no: GuardaDaMalha, ligada: () => boolean, agora: () => number = () => Date.now()): T {
  const naMalha = depositarNaMalha(no, agora);
  const depositar: ComDepositar["depositar"] = async (c, envelope, franquia) => {
    const pelaCaixa = await base.depositar(c, envelope, franquia).catch(() => ({ ok: false }));
    const pelaMalha = ligada() ? await naMalha(c, envelope, franquia).catch(() => ({ ok: false })) : { ok: false };
    return { ok: pelaCaixa.ok || pelaMalha.ok };
  };
  return new Proxy(base, { get: (alvo, nome, r) => (nome === "depositar" ? depositar : Reflect.get(alvo, nome, r)) });
}
