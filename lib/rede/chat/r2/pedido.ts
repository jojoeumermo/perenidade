// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O pedido de conversa da onda R2 (item 2.5, "pedidos sem lista"). Documento:
// docs/rede/CHAT-PRIVADO.md. O servidor não guarda quem pediu conversa a quem: o pedido é um envelope cifrado na caixa de pedidos da conta de destino
// (a única caixa ligada a uma conta, de propósito: ela diz "esta conta recebe pedidos", não de quem).
//
//   conteúdo  = JSON { v, conversa, conta, codinome, identidade, aparelho, texto?, resposta: {id, pd}, pdH }
//   assinado  = u32(len(conteúdo)) ‖ conteúdo ‖ Ed25519(identidade de quem pede, "alumia/r2/pedido/assinado/v1" ‖ conteúdo)
//   envelope  = enc (1120) ‖ HPKE.SealBase(pk = chave de pedidos de quem recebe, info = "alumia/r2/pedido/v1", assinado completado a 4096)
//
// - HPKE (RFC 9180) com o KEM X-Wing (@hpke/core + @hpke/hybridkem-x-wing), igual ao envelope das mensagens: pós-quântico;
// - o modo base do HPKE não diz quem fechou: por isso a identidade de quem pede ASSINA o conteúdo, e quem recebe confere a
//   assinatura contra a identidade do diretório e do registro de transparência (quem chama faz);
// - `resposta`: a caixa de entrada que o aparelho de quem pede criou para esta conversa (id e um passe de depósito provisório,
//   trocado no aceite pelo passe de quem aceita: a partir daí só ela deposita ali);
// - `pdH`: o resumo do passe de depósito de quem pede (o passe fica com ela): quem aceita cria as caixas de entrada dela com ele;
// - tamanho fixo (TAMANHO_PEDIDO da frente das caixas: 1120 + 4096 + 16).
import type { CipherSuite } from "@hpke/core";
import { completar, copia, deB64Url, deTexto, juntar, lerU32, paraB64Url, texto, tirarCompleto, u32, type Bytes } from "./bytes";
import { assinarPedido, type ParEd25519, pedidoConfere } from "./certificados";
import { ROTULOS_DE_FORA } from "./rotulos";

export const BLOCO_DO_PEDIDO = 4096;
export const TAMANHO_DO_PEDIDO = 1120 + BLOCO_DO_PEDIDO + 16;
/** O texto curto que vai com o pedido (opcional). */
export const MAIOR_TEXTO_DO_PEDIDO = 280;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

let suite: Promise<CipherSuite> | null = null;
function suiteDoPedido(): Promise<CipherSuite> {
  suite ??= (async () => {
    const [{ CipherSuite: Suite, HkdfSha256, Aes256Gcm }, { XWing }] = await Promise.all([import("@hpke/core"), import("@hpke/hybridkem-x-wing")]);
    return new Suite({ kem: new XWing(), kdf: new HkdfSha256(), aead: new Aes256Gcm() });
  })().catch((erro: unknown) => {
    suite = null;
    throw erro;
  });
  return suite;
}

export interface PedidoDeConversa {
  conversa: Bytes;
  conta: string;
  codinome: string;
  identidade: Bytes;
  aparelho: Bytes;
  texto: string;
  resposta: { id: Bytes; pd: Bytes };
  pdH: Bytes;
  /**
   * Onda R3 (2.7): a instância de quem pede, quando é OUTRA (o nome do site, "instancia-a.example"). Vai dentro do conteúdo assinado
   * pela identidade; quem recebe confere a identidade no diretório e no registro DAQUELA instância
   * (lib/rede/instancias/cliente.ts, conferirRemetenteDeFora). Ausente: a mesma instância (o pedido de sempre, sem mudar um byte).
   */
  instancia?: string;
}

/** O nome de uma instância como o pedido aceita (a conferência inteira é a de lib/rede/instancias/endereco.ts). */
const INSTANCIA_DO_PEDIDO = /^(?=.{4,253}$)[a-z0-9-]+(\.[a-z0-9-]+)+$/;

function conteudoDe(p: PedidoDeConversa): Bytes {
  return texto(
    JSON.stringify({
      v: 1,
      conversa: paraB64Url(p.conversa),
      conta: p.conta,
      codinome: p.codinome,
      identidade: paraB64Url(p.identidade),
      aparelho: paraB64Url(p.aparelho),
      texto: p.texto,
      resposta: { id: paraB64Url(p.resposta.id), pd: paraB64Url(p.resposta.pd) },
      pdH: paraB64Url(p.pdH),
      ...(p.instancia ? { instancia: p.instancia } : {}),
    }),
  );
}

/** Fecha o pedido para a chave de pedidos (X-Wing, já conferida pela assinatura da identidade de quem recebe). */
export async function fecharPedido(chaveDePedidos: Uint8Array, identidade: ParEd25519, p: PedidoDeConversa): Promise<Bytes> {
  if (p.conversa.length !== 16 || p.aparelho.length !== 32 || p.resposta.id.length !== 32 || p.resposta.pd.length !== 32 || p.pdH.length !== 32) throw new Error("pedido_invalido");
  if (!UUID.test(p.conta) || [...p.texto].length > MAIOR_TEXTO_DO_PEDIDO) throw new Error("pedido_invalido");
  if (p.instancia !== undefined && !INSTANCIA_DO_PEDIDO.test(p.instancia)) throw new Error("pedido_invalido");
  const conteudo = conteudoDe(p);
  const bloco = completar(juntar(u32(conteudo.length), conteudo, assinarPedido(identidade, conteudo)), [BLOCO_DO_PEDIDO]);
  try {
    const s = await suiteDoPedido();
    const chave = await s.kem.deserializePublicKey(copia(chaveDePedidos));
    const { ct, enc } = await s.seal({ recipientPublicKey: chave, info: texto(ROTULOS_DE_FORA.pedido) }, bloco);
    return juntar(new Uint8Array(enc), new Uint8Array(ct));
  } finally {
    bloco.fill(0);
  }
}

/**
 * Abre um pedido com a privada da chave de pedidos e confere a assinatura com a identidade que o pedido diz. null em qualquer
 * dúvida. ATENÇÃO: a identidade que vem dentro tem de ser conferida, por quem chama, contra o diretório e o registro de
 * transparência da conta dita (senão qualquer um assina com uma identidade inventada).
 */
export async function abrirPedido(privada: Uint8Array, envelope: Uint8Array): Promise<PedidoDeConversa | null> {
  if (envelope.length !== TAMANHO_DO_PEDIDO) return null;
  try {
    const s = await suiteDoPedido();
    const chave = await s.kem.deserializePrivateKey(copia(privada));
    const aberto = new Uint8Array(await s.open({ recipientKey: chave, enc: copia(envelope.subarray(0, 1120)), info: texto(ROTULOS_DE_FORA.pedido) }, copia(envelope.subarray(1120))));
    const bloco = tirarCompleto(aberto, [BLOCO_DO_PEDIDO]);
    aberto.fill(0);
    if (!bloco || bloco.length < 4 + 64) return null;
    const n = lerU32(bloco, 0);
    if (4 + n + 64 !== bloco.length) return null;
    const conteudo = bloco.subarray(4, 4 + n);
    const assinatura = bloco.subarray(4 + n);
    const j = JSON.parse(deTexto(conteudo));
    if (j?.v !== 1 || typeof j.conta !== "string" || !UUID.test(j.conta) || typeof j.codinome !== "string" || typeof j.texto !== "string") return null;
    const p: PedidoDeConversa = {
      conversa: deB64Url(j.conversa),
      conta: j.conta,
      codinome: j.codinome,
      identidade: deB64Url(j.identidade),
      aparelho: deB64Url(j.aparelho),
      texto: j.texto,
      resposta: { id: deB64Url(j.resposta?.id ?? ""), pd: deB64Url(j.resposta?.pd ?? "") },
      pdH: deB64Url(j.pdH),
      ...(j.instancia === undefined ? {} : { instancia: j.instancia }),
    };
    if (p.instancia !== undefined && (typeof p.instancia !== "string" || !INSTANCIA_DO_PEDIDO.test(p.instancia))) return null;
    if (p.conversa.length !== 16 || p.identidade.length !== 32 || p.aparelho.length !== 32 || p.resposta.id.length !== 32 || p.resposta.pd.length !== 32 || p.pdH.length !== 32) return null;
    if ([...p.texto].length > MAIOR_TEXTO_DO_PEDIDO) return null;
    if (!pedidoConfere(p.identidade, conteudo, assinatura)) return null;
    return p;
  } catch {
    return null;
  }
}
