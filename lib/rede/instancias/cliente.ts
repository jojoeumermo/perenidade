// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O chat entre instâncias (onda R3, item 2.7; o protocolo está em docs/rede/INSTANCIAS.md), o lado do aparelho. A Ana (instância A)
// fala com a Bia (instância B) DIRETO com a B, sem passar pela A:
//   1. conhece a B: GET https://<B>/api/alumia/instancia → o nome, o servidor do chat da B e o registro público de transparência da B,
//      conferido como corrente a partir da vista que este aparelho já guardava da B (confiança na primeira vez, dita na tela). O
//      servidor do chat da B tem de ser o ÚLTIMO anotado no registro da B;
//   2. lê o diretório da Bia na B (a rota anônima de sempre) e confere a identidade da conta da Bia no registro da B;
//   3. reivindica as pré-chaves da Bia na B pagando com PROVA DE TRABALHO (sem passe: um passe da A diria à B de qual instância a Ana
//      vem, e a B nem tem como conferir passe da A);
//   4. cria, no servidor do chat da B, a caixa onde vai ler as respostas (também paga com prova de trabalho) e deposita o pedido na
//      caixa de pedidos da Bia (prova de trabalho). A conversa segue nas caixas da B, como qualquer conversa.
// O que cada um vê: a A não vê nada (este aparelho não conta à A com quem fala, nem que fala com alguém de fora); a B vê o que vê de
// qualquer remetente (uma caixa recebeu um pacote; alguém leu o diretório de um codinome) e o endereço de rede de quem chama, que a via
// Tor/mixnet tira (lib/rede/caixas/vias.ts). Todas as chamadas vão sem cookie, sem sessão, sem referência de página.
// Sem "@/" de propósito.
import { deB64u, paraB64u, resumo, ROTULOS as ROTULOS_DAS_CAIXAS } from "../caixas/base";
import { lerConta } from "../caixas/diretorio";
import { resolverProva, TAMANHO_DO_DESAFIO } from "../caixas/prova";
import { tamanhoAceito, TAMANHO_PEDIDO } from "../caixas/tamanhos";
import type { Caixa, DiretorioDaConta, Pacote, PreChaveEntregue, ResultadoDoDeposito } from "../caixas/tipos";
import { iguais } from "../chat/r2/bytes";
import type { PedidoDeConversa } from "../chat/r2/pedido";
import { atualizarVista, conferirConta, INICIO, type LinhaDoRegistro, type VistaDoRegistro } from "../chat/transparencia";
import { enderecoValido, servidorDoChatConfere } from "../caixas/servidor-do-chat";
import { BITS_DE_FORA_MAXIMO, BITS_DE_FORA_MINIMO, instanciaValida } from "./endereco";

export { BITS_DE_FORA_MAXIMO, BITS_DE_FORA_MINIMO };

/** Um erro com código (o que as telas mostram). */
const erro = (codigo: string) => Object.assign(new Error(codigo), { code: codigo });

/** O fetch de quem fala com outra instância: sem cookie, sem referência, sem cache. A via (Tor/mixnet) entra pelo `buscar`. */
async function chamar(buscar: typeof fetch, url: string, corpo?: unknown): Promise<{ status: number; corpo: Record<string, unknown> | null }> {
  try {
    const r = await buscar(url, {
      method: corpo === undefined ? "GET" : "POST",
      ...(corpo === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) }),
      credentials: "omit",
      referrerPolicy: "no-referrer",
      cache: "no-store",
      redirect: "error",
    });
    return { status: r.status, corpo: (await r.json().catch(() => null)) as Record<string, unknown> | null };
  } catch {
    return { status: 0, corpo: null };
  }
}

// ── 1. Conhecer a outra instância ────────────────────────────────────────────────────────────────────────────────────────────

export interface InstanciaConhecida {
  nome: string;
  /** O site da instância (https://<nome>). */
  site: string;
  /** O servidor do chat da instância (o último anotado no registro dela). */
  chat: string;
  /** A vista do registro da instância que este aparelho passa a guardar. */
  vista: VistaDoRegistro;
  /** Primeira vez que este aparelho vê esta instância (a tela diz: "confiança na primeira vez"). */
  primeiraVez: boolean;
}

/** Uma linha do registro como a rota da outra instância entrega (os mesmos campos de public.rede_kt_trecho). */
function linhaValida(x: unknown): x is LinhaDoRegistro {
  const l = x as Record<string, unknown> | null;
  return !!l && Number.isInteger(l.seq) && typeof l.quem === "string" && typeof l.identidade === "string" && Number.isInteger(l.versao)
    && typeof l.dia === "string" && typeof l.resumo === "string" && (l.tipo === undefined || typeof l.tipo === "string");
}

/**
 * Conhece a instância `nome`: lê o registro dela desde a vista guardada (`vistaGuardada`; nula na primeira vez) e confere a corrente.
 * Erros: "instancia_invalida", "instancia_fora" (a rota não respondeu ou a instância não fala com outras), "kt_quebrado" (a corrente
 * não fecha com o que este aparelho já viu: a instância reescreveu o registro), "instancia_sem_chat_separado" (o chat entre
 * instâncias pede o servidor do chat separado), "servidor_do_chat_fora_do_registro".
 */
export async function conhecerInstancia(nome: string, vistaGuardada: VistaDoRegistro | null, buscar: typeof fetch): Promise<InstanciaConhecida> {
  if (!instanciaValida(nome)) throw erro("instancia_invalida");
  const site = `https://${nome}`;
  const pagina = async (desde: number) => {
    const r = await chamar(buscar, `${site}/api/alumia/instancia?desde=${Math.max(0, Math.floor(desde))}`);
    const c = r.corpo;
    if (r.status !== 200 || !c || c.v !== 1 || c.nome !== nome) throw erro("instancia_fora");
    return c;
  };
  const primeira = await pagina(vistaGuardada?.seq ?? 0);
  const ponta = primeira.ponta as { seq?: unknown; resumo?: unknown } | null;
  if (!ponta || !Number.isInteger(ponta.seq) || typeof ponta.resumo !== "string") throw erro("instancia_fora");
  const vista = await atualizarVista(vistaGuardada ?? INICIO, {
    ponta: async () => ({ seq: ponta.seq as number, resumo: ponta.resumo as string }),
    trecho: async (desde) => {
      const c = desde === (vistaGuardada?.seq ?? 0) ? primeira : await pagina(desde);
      const linhas = Array.isArray(c.linhas) ? c.linhas : [];
      if (!linhas.every(linhaValida)) throw erro("instancia_fora");
      return linhas as LinhaDoRegistro[];
    },
  });
  const chat = typeof primeira.chat === "string" ? primeira.chat : "";
  if (!chat) throw erro("instancia_sem_chat_separado");
  if (!enderecoValido(chat) || !servidorDoChatConfere(vista.servidorChat, chat)) throw erro("servidor_do_chat_fora_do_registro");
  return { nome, site, chat, vista, primeiraVez: !vistaGuardada };
}

// ── 2 e 3. O diretório da outra instância ─────────────────────────────────────────────────────────────────────────────────────

/** O diretório de `codinome` na outra instância, com a identidade da conta conferida no registro DELA (nulo: não existe lá). */
export async function lerDiretorioDeFora(inst: InstanciaConhecida, codinome: string, buscar: typeof fetch): Promise<DiretorioDaConta | null> {
  const r = await chamar(buscar, `${inst.site}/api/alumia/diretorio/ler`, { codinome });
  if (r.status === 404) return null;
  if (r.status !== 200 || !r.corpo) throw erro(r.status === 429 ? "muitos_pedidos" : "rede");
  const conta = lerConta(r.corpo.conta);
  if (!conta) return null;
  if ((await conferirConta(inst.vista, conta.usuario, conta.identidade)) !== "confere") throw erro("chave_fora_do_registro");
  return conta;
}

/** Resolve a prova de trabalho pedida por quem está do outro lado (só entre os limites; mais que isso seria travar o aparelho). */
async function provaDeFora(url: string, buscar: typeof fetch): Promise<{ desafio: string; nonce: string }> {
  const d = await chamar(buscar, url);
  const desafio = deB64u(d.corpo?.desafio, TAMANHO_DO_DESAFIO);
  const pedidos = Number(d.corpo?.bits);
  if (d.status !== 200 || !desafio || !Number.isInteger(pedidos) || pedidos > BITS_DE_FORA_MAXIMO) throw erro("rede");
  const bits = Math.max(pedidos, BITS_DE_FORA_MINIMO);
  return { desafio: paraB64u(desafio), nonce: paraB64u(await resolverProva(desafio, bits)) };
}

/**
 * Uma pré-chave Proteus (ou um pacote MLS) de cada aparelho de `codinome` na outra instância, pagando com prova de trabalho de fora
 * (o desafio é o do pedido de conversa da outra instância, resolvido com BITS_DE_FORA_MINIMO bits ou mais).
 */
export async function reivindicarDeFora(inst: InstanciaConhecida, codinome: string, tipo: "proteus" | "mls", buscar: typeof fetch): Promise<PreChaveEntregue[]> {
  const prova = await provaDeFora(`${inst.site}/api/alumia/pedido/desafio`, buscar);
  const r = await chamar(buscar, `${inst.site}/api/alumia/diretorio/reivindicar`, { codinome, tipo, ...prova });
  if (r.status !== 200 || !Array.isArray(r.corpo?.pre)) throw erro(typeof r.corpo?.erro === "string" ? r.corpo.erro : "rede");
  const saida: PreChaveEntregue[] = [];
  for (const x of r.corpo.pre as Record<string, unknown>[]) {
    const aparelho = deB64u(x?.aparelho, 32), pre = deB64u(x?.pre);
    if (!aparelho || !pre) continue;
    saida.push({ aparelho, pre, assinatura: x.assinatura == null ? null : deB64u(x.assinatura, 64), ...(Number.isInteger(x.id) ? { id: x.id as number } : {}), ...(x.ref ? { ref: deB64u(x.ref) ?? undefined } : {}) });
  }
  return saida;
}

/**
 * Quem pede conversa de OUTRA instância (o pedido de lib/rede/chat/r2/pedido.ts com `instancia`). O pedido já vem assinado pela
 * identidade que ele diz (abrirPedido confere a assinatura); aqui o aparelho de quem recebe confere que essa identidade é mesmo a da
 * conta `codinome` naquela instância: conhece a instância (o registro dela, desde a vista guardada), lê o diretório do codinome lá e
 * exige a MESMA conta e a MESMA identidade, conferida no registro DELA. Devolve o diretório (para os aparelhos, com
 * aparelhosConfiaveis) e a instância (com a vista nova, para guardar). Erros: "remetente_fora" (não confere) e os de
 * conhecerInstancia/lerDiretorioDeFora. Um pedido de fora sem `instancia`, ou da própria instância, não passa por aqui.
 */
export async function conferirRemetenteDeFora(
  pedido: Pick<PedidoDeConversa, "conta" | "codinome" | "identidade" | "instancia">, vistaGuardada: VistaDoRegistro | null, buscar: typeof fetch,
): Promise<{ instancia: InstanciaConhecida; diretorio: DiretorioDaConta }> {
  if (!pedido.instancia) throw erro("remetente_fora");
  const instancia = await conhecerInstancia(pedido.instancia, vistaGuardada, buscar);
  const diretorio = await lerDiretorioDeFora(instancia, pedido.codinome, buscar);
  if (!diretorio || diretorio.usuario !== pedido.conta || !iguais(diretorio.identidade, pedido.identidade)) throw erro("remetente_fora");
  return { instancia, diretorio };
}

// ── 4. As caixas no servidor do chat da outra instância ──────────────────────────────────────────────────────────────────────

const idDaCaixa = (id: Uint8Array) => resumo(ROTULOS_DAS_CAIXAS.caixa, id);
const resumoDoPd = (pd: Uint8Array) => resumo(ROTULOS_DAS_CAIXAS.passeDeposito, pd);
const resumoDoPl = (pl: Uint8Array) => resumo(ROTULOS_DAS_CAIXAS.passeLeitura, pl);
export { idDaCaixa as idDaCaixaNoServidor };

type Item = { ok?: unknown; erro?: unknown };
const unico = (c: Record<string, unknown> | null): Item | null => {
  const l = c?.resultados;
  return Array.isArray(l) && l.length === 1 && l[0] && typeof l[0] === "object" ? (l[0] as Item) : null;
};

/** As caixas num servidor do chat que não é o desta instância (sem passe: o que paga é a prova de trabalho). */
export class CaixasDeFora {
  private readonly chat: string;
  private readonly buscar: typeof fetch;

  constructor(chat: string, buscar: typeof fetch) {
    if (!enderecoValido(chat) || !chat) throw erro("instancia_invalida");
    this.chat = chat;
    this.buscar = buscar;
  }

  private lote(item: Record<string, unknown>) {
    return chamar(this.buscar, `${this.chat}/caixa/lote`, { itens: [item] });
  }

  /** Cria uma caixa lá (a prova de trabalho paga). */
  async criar(c: Caixa): Promise<void> {
    const prova = await provaDeFora(`${this.chat}/desafio`, this.buscar);
    const r = await this.lote({ acao: "criar", id: paraB64u(c.id), pd_h: paraB64u(resumoDoPd(c.pd)), pl_h: paraB64u(resumoDoPl(c.pl)), multi: c.multi, ...prova });
    if (r.status === 200 && unico(r.corpo)?.ok === true) return;
    throw erro(typeof unico(r.corpo)?.erro === "string" ? (unico(r.corpo)?.erro as string) : typeof r.corpo?.erro === "string" ? r.corpo.erro : "rede");
  }

  /** Deposita o pedido de conversa na caixa de pedidos de quem está lá (a do diretório). */
  async pedir(dir: Pick<DiretorioDaConta, "pedidosCaixa" | "pedidosPd">, envelope: Uint8Array): Promise<void> {
    if (envelope.length !== TAMANHO_PEDIDO) throw erro("tamanho");
    const prova = await provaDeFora(`${this.chat}/desafio`, this.buscar);
    const r = await this.lote({ acao: "pedido", id: paraB64u(dir.pedidosCaixa), pd: paraB64u(dir.pedidosPd), envelope: paraB64u(envelope), ...prova });
    if (r.status === 200 && unico(r.corpo)?.ok === true) return;
    throw erro(typeof unico(r.corpo)?.erro === "string" ? (unico(r.corpo)?.erro as string) : typeof r.corpo?.erro === "string" ? r.corpo.erro : "rede");
  }

  /**
   * Deposita um pacote (já cifrado, num dos tamanhos fixos) com o compromisso da franquia (`franquia`, 32 bytes): o envelope da
   * conversa a dois prende `c` nos dados associados (lib/rede/chat/r2/envelope.ts), então sem `c` do outro lado a mensagem não abre.
   * O mesmo JSON de lib/rede/caixas/cliente.ts (depositar). Passe de depósito errado responde ok como o certo, de propósito.
   */
  async depositar(c: Pick<Caixa, "id" | "pd">, envelope: Uint8Array, franquia?: Uint8Array, unicoNaCaixa?: boolean): Promise<ResultadoDoDeposito> {
    if (!tamanhoAceito(envelope.length)) return { ok: false, erro: "tamanho" };
    if (franquia && franquia.length !== 32) throw erro("invalido");
    const r = await this.lote({
      acao: "depositar", id: paraB64u(c.id), pd: paraB64u(c.pd), envelope: paraB64u(envelope),
      ...(franquia ? { franquia: paraB64u(franquia) } : {}), ...(unicoNaCaixa ? { unico: true } : {}),
    });
    const item = unico(r.corpo) as (Item & { marca?: unknown; dia?: unknown }) | null;
    if (r.status === 200 && item?.ok === true) {
      const marca = deB64u(item.marca, 32);
      return { ok: true, ...(marca && typeof item.dia === "string" ? { marca, dia: item.dia } : {}) };
    }
    const e = item?.erro;
    return { ok: false, erro: e === "ocupada" || e === "tamanho" || e === "cheia" ? e : "rede" };
  }

  async buscarPacotes(c: Pick<Caixa, "id" | "pl">, cursor: number): Promise<Pacote[]> {
    const r = await chamar(this.buscar, `${this.chat}/caixa/buscar`, { id: paraB64u(c.id), pl: paraB64u(c.pl), cursor: Math.max(0, Math.floor(cursor)) });
    if (r.status !== 200 || !Array.isArray(r.corpo?.pacotes)) throw erro("rede");
    const saida: Pacote[] = [];
    for (const b of r.corpo.pacotes as Record<string, unknown>[]) {
      const envelope = deB64u(b?.envelope);
      const ordem = Number(b?.ordem);
      if (!envelope || !Number.isInteger(ordem) || ordem <= cursor || typeof b?.dia !== "string") continue;
      saida.push({
        ordem,
        envelope,
        franquia: b.franquia == null ? null : deB64u(b.franquia, 32),
        marca: b.marca == null ? null : deB64u(b.marca, 32),
        unico: b.unico === true,
        dia: b.dia,
      });
    }
    return saida.sort((a, b) => a.ordem - b.ordem);
  }

  async confirmar(c: Pick<Caixa, "id" | "pl">, ate: number): Promise<void> {
    const r = await chamar(this.buscar, `${this.chat}/caixa/confirmar`, { id: paraB64u(c.id), pl: paraB64u(c.pl), ate: Math.max(0, Math.floor(ate)) });
    if (r.status !== 200) throw erro("rede");
  }

  async apagar(c: Pick<Caixa, "id" | "pl">): Promise<void> {
    const r = await chamar(this.buscar, `${this.chat}/caixa/apagar`, { id: paraB64u(c.id), pl: paraB64u(c.pl) });
    if (r.status !== 200) throw erro("rede");
  }
}
