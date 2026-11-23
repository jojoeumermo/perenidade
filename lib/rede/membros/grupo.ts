// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Um grupo com membros escondidos: núcleo, grupo do chat ou conversa da equipe. Documento: docs/rede/POSTS-RESTRITOS.md.
//
// O grupo é um grupo MLS do motor (@wireapp/core-crypto, OpenMLS, suíte híbrida 61442). O servidor não guarda membro nenhum: ele
// só entrega pacotes na caixa anônima da época, cujo id e passes saem do exportador do MLS (lib/rede/membros/segredos.ts). Tudo
// que vai à caixa vai embrulhado (lib/rede/membros/embrulho.ts); a GroupInfo do MLS nunca sai do aparelho.
//
// Regras que o aparelho cumpre (o servidor não sabe quem é quem, então não fiscaliza):
// - um commit por época: o commit vai como depósito "único" na caixa da época; se outro chegou antes ("ocupada"), a biblioteca
//   descarta o nosso, lemos o da outra pessoa e tentamos de novo na época seguinte;
// - todo commit leva a autorização assinada pela identidade de quem fez (lib/rede/membros/papeis.ts); sem ela, ou de quem não tem o
//   papel, o commit nem chega à biblioteca; se a mudança de membros não for a autorizada, o grupo fica marcado como suspeito;
// - a lista de papéis só muda por versão assinada por alguém da mediação da versão anterior;
// - quem saiu não tira os segredos da época seguinte (a biblioteca não exporta mais), então não acha nem lê a caixa nova.
import type { ClientId, CommitBundle, CoreCrypto, CredentialRef } from "@wireapp/core-crypto";
import { deB64, juntar, lerU32, paraB64, sorteados, texto, u32 } from "./bytes";
import { desembrulhar, embrulhar, TIPO } from "./embrulho";
import {
  abrirChaveDeEntrada,
  abrirPedido,
  type EntradaDoNucleo,
  type EntradaPublica,
  novoParXWing,
  type ParXWing,
  type PedidoDeEntrada,
  publicarEntrada,
  selarChaveDeEntrada,
} from "./entrada";
import {
  type AcaoDoCommit,
  aceitarPapeis,
  apresentacaoValida,
  apresentar,
  type Apresentacao,
  assinarBoasVindas,
  type Autorizacao,
  autorizar,
  type BoasVindas,
  conferirBoasVindas,
  julgarCommit,
  type ListaDePapeis,
  mudancaConfere,
  novosPapeis,
  primeirosPapeis,
} from "./papeis";
import { abrirPost, cifrarPost } from "./post";
import { lerCorpoDeAnexo } from "../chat/anexo-cifrado";
import { lerCorpoDePosicao } from "../perto/posicao";
import { derivarSegredos, resumoDaCaixa, type SegredosDaEpoca } from "./segredos";
import type { Caixa, Identidade, Transporte, TipoDeGrupo } from "./tipos";

type Motor = typeof import("@wireapp/core-crypto");

/**
 * O transporte do MLS de um aparelho (um por `CoreCrypto`, dado no `mlsInit`). A biblioteca chama `sendCommitBundle` no meio do
 * commit; quem decide o que fazer é o grupo que pediu o commit (`aoMandar`). Recusar é lançar `MlsTransportError.MessageRejected`
 * (lançar qualquer outro erro derruba o WebAssembly): aí a biblioteca descarta o commit e a época não muda.
 */
export class TransporteDoMotor {
  aoMandar: ((pacote: CommitBundle) => Promise<void>) | null = null;
  private readonly M: Motor;
  constructor(M: Motor) {
    this.M = M;
  }
  async sendCommitBundle(pacote: CommitBundle): Promise<void> {
    const f = this.aoMandar;
    if (!f) throw new this.M.MlsTransportError.MessageRejected({ reason: "sem_grupo" });
    try {
      await f(pacote);
    } catch (erro) {
      if (this.M.MlsTransportError.instanceOf(erro)) throw erro;
      throw new this.M.MlsTransportError.MessageRejected({ reason: erro instanceof Error ? erro.message : "falha" });
    }
  }
  async prepareForTransport(): Promise<Uint8Array> {
    // O histórico compartilhado do Wire não é usado: quem entra lê só daí em diante.
    throw new this.M.MlsTransportError.MessageRejected({ reason: "historico_desligado" });
  }
}

/** O aparelho: o motor, a credencial do MLS deste aparelho e a identidade da conta. */
export interface Aparelho {
  M: Motor;
  cc: CoreCrypto;
  ref: CredentialRef;
  cliente: ClientId;
  transporteDoMotor: TransporteDoMotor;
  identidade: Identidade;
  transporte: Transporte;
}

export interface Mensagem {
  /** "anexo": o corpo do anexo cifrado do chat (Prompt 4, itens 137 e 138: lib/rede/chat/anexo-cifrado.ts), já conferido. */
  /** "posicao": a posição compartilhada (Prompt 4, itens 2 e 7: lib/rede/perto/posicao.ts, JSON), já conferida. */
  tipo: "texto" | "post" | "voz" | "anexo" | "posicao";
  autor: string | null; // identidade (b64url) de quem escreveu, pela apresentação; null se a folha ainda não se apresentou
  corpo: Uint8Array;
  epoca: bigint;
}

type Aplicacao =
  | { t: "apresentacao"; a: Apresentacao }
  | { t: "papeis"; l: ListaDePapeis }
  | { t: "chave-entrada"; para: string; e: string }
  | { t: "texto"; c: string }
  | { t: "post"; c: string }
  | { t: "voz"; c: string }
  | { t: "anexo"; c: string }
  | { t: "posicao"; c: string }
  | { t: "sair" };

export type Suspeita = "commit_mudou_outra_coisa" | "papeis_recusados" | "apresentacao_falsa";

/** O estado de um grupo neste aparelho, para guardar cifrado e voltar depois (`Grupo.retrato` e `Grupo.restaurar`). */
export interface RetratoDoGrupo {
  v: 1;
  id: string;
  tipo: TipoDeGrupo;
  /** A época do retrato: se o motor estiver em outra, o cursor e a caixa anterior não servem mais. */
  epoca: string;
  folha: { publica: string; privada: string };
  entrada: EntradaDoNucleo | null;
  cadeia: ListaDePapeis[];
  membros: Apresentacao[];
  cursor: number;
  anterior: { epoca: string; caixa: { id: string; pd: string; pl: string }; embrulho: string; post: string; voz: string; cursor: number } | null;
  suspeitas: Suspeita[];
  pedidosDeSaida: string[];
}

export class Grupo {
  /** Avisos que a tela mostra como "grupo suspeito" (a regra de hoje, `grupo_suspeito`). */
  readonly suspeitas: Suspeita[] = [];
  /** Commits que chegaram sem autorização válida e foram ignorados (não passaram pela biblioteca). */
  readonly ignorados: string[] = [];
  readonly mensagens: Mensagem[] = [];
  /** Pedidos de saída recebidos (a mediação tira a folha no próximo commit). */
  readonly pedidosDeSaida = new Set<string>();
  removido = false;
  private cadeia: ListaDePapeis[] = [];
  private membros = new Map<string, Apresentacao>(); // cliente (b64url) → apresentação
  private segredos!: SegredosDaEpoca;
  private cursor = 0;
  private anterior: { segredos: SegredosDaEpoca; cursor: number } | null = null;
  private caixaGarantida = false;

  private readonly ap: Aparelho;
  readonly id: Uint8Array;
  readonly tipo: TipoDeGrupo;
  private readonly folha: ParXWing;
  entrada: EntradaDoNucleo | null;

  private constructor(ap: Aparelho, id: Uint8Array, tipo: TipoDeGrupo, folha: ParXWing, entrada: EntradaDoNucleo | null) {
    this.ap = ap;
    this.id = id;
    this.tipo = tipo;
    this.folha = folha;
    this.entrada = entrada;
  }

  private get conversa() {
    return new this.ap.M.ConversationId(this.id);
  }
  private get meuCliente(): string {
    return paraB64(this.ap.cliente.copyBytes());
  }
  private get eu(): string {
    return paraB64(this.ap.identidade.publica);
  }
  get papeis(): ListaDePapeis {
    return this.cadeia[this.cadeia.length - 1];
  }
  get epoca(): bigint {
    return this.segredos.epoca;
  }
  /** Os segredos da época atual (caixa, embrulho, posts, voz). */
  segredosDaEpoca(): SegredosDaEpoca {
    return this.segredos;
  }
  souMediacao(): boolean {
    return this.papeis.mediacao.includes(this.eu);
  }
  /** Quantas pessoas (identidades apresentadas) há no grupo, para a tela: abaixo de 3, nenhum número. */
  contagemParaTela(): number | null {
    const n = new Set([...this.membros.values()].map((a) => a.identidade)).size;
    return n >= 3 ? n : null;
  }
  /** As apresentações conferidas das folhas que estão no grupo (quem é quem, só dentro do cifrado: o servidor não tem esta lista). */
  apresentados(): Apresentacao[] {
    return [...this.membros.values()].map((a) => ({ ...a }));
  }

  // ── Guardar no aparelho (a conversa em grupo do chat: lib/rede/chat/grupo/servico.ts) ──────────────────────────────────────
  // Só o estado da tela do grupo, para a aba recarregada continuar de onde parou: nada aqui muda o protocolo, a cifra ou o que vai
  // ao servidor. Quem guarda tem de guardar CIFRADO (no navegador, a guarda selada dos grupos: lib/rede/grupos/loja-do-navegador.ts).
  // Os segredos da época atual não vão no retrato: saem de novo do exportador do MLS ao restaurar. Os da época anterior (para ler
  // o que ficou na caixa velha) vão, porque o MLS não exporta mais a época que passou.

  /** O estado deste grupo neste aparelho, para guardar (as mensagens já lidas ficam com quem chamou). */
  retrato(): RetratoDoGrupo {
    const s = this.anterior?.segredos;
    return {
      v: 1,
      id: paraB64(this.id),
      tipo: this.tipo,
      epoca: this.segredos.epoca.toString(),
      folha: { publica: paraB64(this.folha.publica), privada: paraB64(this.folha.privada) },
      entrada: this.entrada,
      cadeia: this.cadeia,
      membros: [...this.membros.values()],
      cursor: this.cursor,
      anterior: s && this.anterior ? { epoca: s.epoca.toString(), caixa: { id: paraB64(s.caixa.id), pd: paraB64(s.caixa.pd), pl: paraB64(s.caixa.pl) }, embrulho: paraB64(s.embrulho), post: paraB64(s.post), voz: paraB64(s.voz), cursor: this.anterior.cursor } : null,
      suspeitas: [...this.suspeitas],
      pedidosDeSaida: [...this.pedidosDeSaida],
    };
  }

  /**
   * Volta o grupo de um retrato, com o estado do MLS que ficou na loja do motor deste aparelho. null se o motor não tem mais o grupo
   * (a loja foi apagada, ou o aparelho foi tirado). Se a época do motor andou depois do retrato, o cursor recomeça na caixa nova.
   */
  static async restaurar(ap: Aparelho, r: RetratoDoGrupo): Promise<Grupo | null> {
    if (r?.v !== 1) return null;
    const id = deB64(r.id);
    const conversa = new ap.M.ConversationId(id);
    if (!(await ap.cc.transaction((c) => c.conversationExists(conversa)))) return null;
    const g = new Grupo(ap, id, r.tipo, { publica: deB64(r.folha.publica), privada: deB64(r.folha.privada) }, r.entrada);
    g.cadeia = r.cadeia;
    for (const a of r.membros) g.membros.set(a.cliente, a);
    for (const s of r.suspeitas) g.suspeitas.push(s);
    for (const p of r.pedidosDeSaida) g.pedidosDeSaida.add(p);
    await g.novaEpoca();
    if (g.segredos.epoca.toString() === r.epoca) {
      g.cursor = r.cursor;
      const a = r.anterior;
      g.anterior = a
        ? {
            segredos: { epoca: BigInt(a.epoca), caixa: { id: deB64(a.caixa.id), pd: deB64(a.caixa.pd), pl: deB64(a.caixa.pl), multi: true }, embrulho: deB64(a.embrulho), post: deB64(a.post), voz: deB64(a.voz) },
            cursor: a.cursor,
          }
        : null;
    }
    return g;
  }

  // ── Criar e entrar ──────────────────────────────────────────────────────────────────────────────────────────────────────

  /** Cria o grupo: quem cria é a mediação. Para um núcleo, `comEntrada` cria a caixa e a chave de entrada. */
  static async criar(ap: Aparelho, tipo: TipoDeGrupo, comEntrada: boolean): Promise<Grupo> {
    const id = sorteados(32);
    const g = new Grupo(ap, id, tipo, await novoParXWing(), null);
    await ap.cc.transaction((c) => c.createConversation(g.conversa, ap.ref));
    g.cadeia = [await primeirosPapeis(ap.identidade, id)];
    await g.novaEpoca();
    if (comEntrada) {
      const par = await novoParXWing();
      const caixa = { id: sorteados(32), pd: sorteados(32), pl: sorteados(32), multi: true };
      await ap.transporte.criar(caixa);
      g.entrada = {
        publica: paraB64(par.publica),
        privada: paraB64(par.privada),
        caixa: { id: paraB64(caixa.id), pd: paraB64(caixa.pd), pl: paraB64(caixa.pl) },
        gestao: paraB64(sorteados(32)),
        assinante: paraB64(sorteados(32)),
      };
    }
    await g.apresentarMe();
    return g;
  }

  /**
   * O que o perfil público do núcleo recebe (public.rede_nucleo_entrada_iniciar ou a troca com o passe de gestão): id e passe de
   * depósito da caixa de entrada, a chave X-Wing, a chave de gestão com a assinatura, e o resumo do passe de gestão (nunca o passe).
   */
  publicacaoDaEntrada(nucleo: string): (EntradaPublica & { gestao_h: string }) | null {
    return this.entrada ? publicarEntrada(nucleo, this.entrada) : null;
  }

  /**
   * Quem pediu para entrar lê a caixa de resposta: o pacote de boas-vindas embrulhado com `kr`. Confere a assinatura, a cadeia de
   * papéis (quem mandou é da mediação), entra pelo Welcome e confere que o grupo é o anunciado.
   */
  static async entrarPelaResposta(ap: Aparelho, resposta: Caixa, kr: Uint8Array, tipo: TipoDeGrupo): Promise<Grupo | null> {
    const idH = resumoDaCaixa(resposta.id);
    for (const p of await ap.transporte.buscar(resposta, 0)) {
      const d = await desembrulhar(kr, idH, BigInt(0), p.envelope);
      if (!d || d.tipo !== TIPO.boasVindas) continue;
      let bv: BoasVindas;
      try {
        bv = JSON.parse(new TextDecoder().decode(d.bytes));
      } catch {
        continue;
      }
      const papeis = conferirBoasVindas(bv);
      if (!papeis) continue;
      const id = deB64(bv.grupo);
      const conversa = await ap.cc.transaction((c) => c.processWelcomeMessage(new ap.M.Welcome(deB64(bv.welcome))));
      if (paraB64(conversa.copyBytes()) !== bv.grupo) {
        await ap.cc.transaction((c) => c.wipeConversation(conversa));
        continue;
      }
      const g = new Grupo(ap, id, tipo, await novoParXWing(), null);
      g.cadeia = bv.cadeia;
      const clientes = await g.clientes();
      for (const a of bv.apresentacoes) if (clientes.has(a.cliente)) g.membros.set(a.cliente, a);
      if (bv.chaveDeEntrada) {
        try {
          g.entrada = JSON.parse(new TextDecoder().decode(deB64(bv.chaveDeEntrada)));
        } catch {
          g.entrada = null;
        }
      }
      await g.novaEpoca();
      // O Welcome pode ser de uma época que já passou (a mediação pôs outras pessoas depois): primeiro alcança a época atual,
      // depois se apresenta nela (senão a apresentação fica numa caixa que os outros já deixaram de ler).
      await g.receber();
      await g.apresentarMe();
      return g;
    }
    return null;
  }

  /** Monta um pedido de entrada para um núcleo (a tela deposita na caixa de entrada pública dele). */
  static async montarPedido(ap: Aparelho, textoCurto: string): Promise<{ pedido: PedidoDeEntrada; resposta: Caixa }> {
    const resposta = { id: sorteados(32), pd: sorteados(32), pl: sorteados(32), multi: false };
    await ap.transporte.criar(resposta);
    const pacote = await ap.cc.transaction((c) => c.generateKeyPackage(ap.ref));
    return {
      resposta,
      pedido: { identidade: ap.identidade.publica, kr: sorteados(32), resposta: { id: resposta.id, pd: resposta.pd }, pacote: pacote.serialize(), texto: textoCurto },
    };
  }

  // ── Mediação ────────────────────────────────────────────────────────────────────────────────────────────────────────────

  /** Lê os pedidos de entrada (só quem tem a chave de entrada: a mediação). */
  async pedidosDeEntrada(): Promise<PedidoDeEntrada[]> {
    if (!this.entrada) return [];
    const caixa = { id: deB64(this.entrada.caixa.id), pd: deB64(this.entrada.caixa.pd), pl: deB64(this.entrada.caixa.pl), multi: true };
    const privada = deB64(this.entrada.privada);
    const saida: PedidoDeEntrada[] = [];
    for (const p of await this.ap.transporte.buscar(caixa, 0)) {
      const aberto = await abrirPedido(privada, p.envelope);
      if (aberto) saida.push(aberto);
    }
    return saida;
  }

  /** Aceita um pedido: põe a pessoa pelo MLS e manda as boas-vindas para a caixa de resposta dela. */
  async aceitar(pedido: PedidoDeEntrada): Promise<"aceito" | "ocupada"> {
    if (!this.souMediacao()) throw new Error("sem_papel");
    let welcome: Uint8Array | null = null;
    const r = await this.commit("adicionar", (c) => c.addClientsToConversation(this.conversa, [new this.ap.M.KeyPackage(pedido.pacote)]), (b) => {
      welcome = b.welcome ? b.welcome.serialize() : null;
    });
    if (r === "ocupada") return r;
    if (!welcome) throw new Error("sem_welcome");
    const bv = await assinarBoasVindas(this.ap.identidade, {
      grupo: paraB64(this.id),
      welcome: paraB64(welcome),
      cadeia: this.cadeia,
      apresentacoes: [...this.membros.values()],
    });
    const resposta = { id: pedido.resposta.id, pd: pedido.resposta.pd };
    const envelope = await embrulhar(pedido.kr, resumoDaCaixa(resposta.id), BigInt(0), TIPO.boasVindas, texto(JSON.stringify(bv)));
    const d = await this.ap.transporte.depositar(resposta, envelope);
    if (!d.ok) throw new Error(`resposta_${d.erro}`);
    return "aceito";
  }

  /** Tira folhas do grupo (só a mediação). Quem sai não tira os segredos da época seguinte. */
  async remover(clientes: string[]): Promise<"removido" | "ocupada"> {
    if (!this.souMediacao()) throw new Error("sem_papel");
    const ids = (await this.ap.cc.transaction((c) => c.getClientIds(this.conversa))).filter((c) => clientes.includes(paraB64(c.copyBytes())));
    if (ids.length === 0) throw new Error("ninguem");
    const r = await this.commit("remover", (c) => c.removeClientsFromConversation(this.conversa, ids));
    if (r === "ocupada") return r;
    for (const c of clientes) this.membros.delete(c);
    return "removido";
  }

  /** Muda a lista de papéis (só a mediação). Quem entra na mediação recebe a chave de entrada, cifrada só para o aparelho dela. */
  async mudarPapeis(mediacao: string[]): Promise<void> {
    const nova = await novosPapeis(this.ap.identidade, this.id, this.papeis, mediacao);
    await this.mandarAplicacao({ t: "papeis", l: nova });
    const antes = this.papeis.mediacao;
    this.cadeia.push(nova);
    if (!this.entrada) return;
    for (const a of this.membros.values()) {
      if (mediacao.includes(a.identidade) && !antes.includes(a.identidade) && a.cliente !== this.meuCliente) {
        const e = await selarChaveDeEntrada(deB64(a.xwing), this.entrada);
        await this.mandarAplicacao({ t: "chave-entrada", para: a.cliente, e: paraB64(e) });
      }
    }
  }

  // ── Todo membro ─────────────────────────────────────────────────────────────────────────────────────────────────────────

  async mandarTexto(corpo: string): Promise<void> {
    await this.mandarAplicacao({ t: "texto", c: paraB64(texto(corpo)) });
  }

  /** Post restrito (p2): cifrado com a chave de posts da época, dentro de uma mensagem do MLS. */
  async postar(corpo: Uint8Array): Promise<void> {
    await this.receber();
    await this.mandarAplicacao({ t: "post", c: paraB64(await cifrarPost(this.segredos, this.id, corpo)) });
  }

  /** A combinação de uma chamada de voz (oferta, resposta, candidatos): assinada pela folha, como toda mensagem do MLS. */
  async mandarVoz(combinacao: Uint8Array): Promise<void> {
    await this.mandarAplicacao({ t: "voz", c: paraB64(combinacao) });
  }

  /**
   * Um anexo cifrado (Prompt 4, itens 137 e 138): só o CORPO (chave, endereço no depósito, resumos, tamanho e duração), como um tipo
   * novo de conteúdo dentro da mensagem de aplicação do MLS. O arquivo vai cifrado pelo depósito; nada do MLS nem do embrulho muda.
   */
  async mandarAnexo(corpo: Uint8Array): Promise<void> {
    if (!lerCorpoDeAnexo(corpo)) throw new Error("anexo_invalido");
    await this.mandarAplicacao({ t: "anexo", c: paraB64(corpo) });
  }

  /**
   * Uma posição compartilhada (Prompt 4, itens 2 e 7): o corpo (já arredondado no aparelho) como um tipo novo de conteúdo dentro da
   * mensagem de aplicação do MLS. Nada do MLS nem do embrulho muda. Quem recebe guarda só a última de cada pessoa (lib/rede/perto).
   */
  async mandarPosicao(corpo: Uint8Array): Promise<void> {
    if (!lerCorpoDePosicao(corpo)) throw new Error("posicao_invalida");
    await this.mandarAplicacao({ t: "posicao", c: paraB64(corpo) });
  }

  /** A chave da voz da época (a sala de voz tira dela as chaves da chamada). */
  chaveDeVoz(): Uint8Array {
    return this.segredos.voz;
  }

  /** Troca a chave da própria folha (segurança depois de um comprometimento). Qualquer membro pode. */
  async atualizar(): Promise<"atualizado" | "ocupada"> {
    const r = await this.commit("atualizar", (c) => c.updateKeyingMaterial(this.conversa));
    return r === "ocupada" ? r : "atualizado";
  }

  /** Sair: pede à mediação que tire esta folha e apaga o grupo deste aparelho. */
  async sair(): Promise<void> {
    await this.mandarAplicacao({ t: "sair" });
    await this.esquecer();
  }

  /** Apaga o grupo do aparelho (estado do MLS e segredos na memória). */
  async esquecer(): Promise<void> {
    try {
      await this.ap.cc.transaction((c) => c.wipeConversation(this.conversa));
    } catch {
      // já não existia
    }
    this.removido = true;
    for (const s of [this.segredos, this.anterior?.segredos]) {
      if (!s) continue;
      for (const b of [s.caixa.id, s.caixa.pd, s.caixa.pl, s.embrulho, s.post, s.voz]) b.fill(0);
    }
    this.folha.privada.fill(0);
  }

  /**
   * Busca o que chegou na caixa da época e processa em ordem. Um commit aceito leva à época seguinte (caixa nova); o que ficou
   * na caixa anterior depois dele (mensagens de quem ainda não tinha visto o commit) é lido uma vez mais.
   */
  async receber(): Promise<void> {
    if (this.removido) return;
    for (let voltas = 0; voltas < 64; voltas++) {
      const mudou = await this.lerCaixa();
      if (this.removido) return;
      if (!mudou) break;
    }
    if (this.anterior) {
      const { segredos, cursor } = this.anterior;
      for (const p of await this.ap.transporte.buscar(segredos.caixa, cursor)) {
        this.anterior.cursor = Math.max(this.anterior.cursor, p.ordem);
        const d = await desembrulhar(segredos.embrulho, resumoDaCaixa(segredos.caixa.id), segredos.epoca, p.envelope);
        if (d?.tipo === TIPO.aplicacao) await this.processarAplicacao(d.bytes, segredos);
      }
    }
  }

  // ── Por dentro ──────────────────────────────────────────────────────────────────────────────────────────────────────────

  private async clientes(): Promise<Set<string>> {
    return new Set((await this.ap.cc.transaction((c) => c.getClientIds(this.conversa))).map((c) => paraB64(c.copyBytes())));
  }

  private async novaEpoca(): Promise<void> {
    const [segredo, epoca] = await this.ap.cc.transaction(async (c) => {
      const s = await c.exportSecretKey(this.conversa, 32);
      return [s.copyBytes(), await c.conversationEpoch(this.conversa)] as const;
    });
    const anteriores = this.segredos;
    this.segredos = derivarSegredos(segredo, this.id, epoca, this.tipo);
    segredo.fill(0);
    this.anterior = anteriores ? { segredos: anteriores, cursor: this.cursor } : null;
    this.cursor = 0;
    this.caixaGarantida = false;
  }

  /** Antes do primeiro depósito numa época, a caixa precisa existir (criar é idempotente; gasta um passe). */
  private async garantirCaixa(): Promise<void> {
    if (this.caixaGarantida) return;
    await this.ap.transporte.criar(this.segredos.caixa);
    this.caixaGarantida = true;
  }

  private async apresentarMe(): Promise<void> {
    const a = await apresentar(this.ap.identidade, this.id, this.ap.cliente.copyBytes(), this.folha.publica);
    this.membros.set(a.cliente, a);
    await this.mandarAplicacao({ t: "apresentacao", a });
    if (this.cadeia.length === 1 && this.papeis.por === this.eu) await this.mandarAplicacao({ t: "papeis", l: this.papeis });
  }

  private async mandarAplicacao(m: Aplicacao): Promise<void> {
    if (this.removido) throw new Error("fora_do_grupo");
    await this.garantirCaixa();
    const cifrado = await this.ap.cc.transaction((c) => c.encryptMessage(this.conversa, texto(JSON.stringify(m))));
    const envelope = await embrulhar(this.segredos.embrulho, resumoDaCaixa(this.segredos.caixa.id), this.segredos.epoca, TIPO.aplicacao, cifrado);
    const r = await this.ap.transporte.depositar(this.segredos.caixa, envelope);
    if (!r.ok) throw new Error(`deposito_${r.erro}`);
  }

  /**
   * Um commit: lê tudo antes (para estar na época certa), assina a autorização, e só deixa a biblioteca concluir se o depósito
   * único na caixa da época passar. Depois, a época nova: segredos novos, caixa nova.
   */
  private async commit(
    acao: AcaoDoCommit,
    fazer: (c: Parameters<Parameters<CoreCrypto["transaction"]>[0]>[0]) => Promise<void>,
    aoMandar?: (b: CommitBundle) => void,
  ): Promise<"ocupada" | "atualizado" | "removido" | "aceito"> {
    await this.receber();
    if (this.removido) throw new Error("fora_do_grupo");
    await this.garantirCaixa();
    const epoca = this.segredos.epoca;
    const s = this.segredos;
    let ocupada = false;
    this.ap.transporteDoMotor.aoMandar = async (pacote) => {
      const a = await autorizar(this.ap.identidade, this.id, epoca, acao, pacote.commit);
      const aut = texto(JSON.stringify(a));
      const envelope = await embrulhar(s.embrulho, resumoDaCaixa(s.caixa.id), epoca, TIPO.commit, juntar(u32(aut.length), aut, pacote.commit));
      const r = await this.ap.transporte.depositar(s.caixa, envelope, undefined, true);
      if (!r.ok) {
        ocupada = r.erro === "ocupada";
        throw new this.ap.M.MlsTransportError.MessageRejected({ reason: r.erro });
      }
      aoMandar?.(pacote);
    };
    try {
      await this.ap.cc.transaction((c) => fazer(c));
    } catch (erro) {
      if (ocupada) {
        await this.receber();
        return "ocupada";
      }
      throw erro;
    } finally {
      this.ap.transporteDoMotor.aoMandar = null;
    }
    // O nosso commit fica na caixa anterior: quem lê pula, porque já está na época nova.
    await this.novaEpoca();
    if (this.anterior) this.anterior.cursor = Number.MAX_SAFE_INTEGER;
    return acao === "remover" ? "removido" : acao === "adicionar" ? "aceito" : "atualizado";
  }

  /** Lê a caixa da época a partir do cursor. Devolve true se um commit mudou a época (e há caixa nova a ler). */
  private async lerCaixa(): Promise<boolean> {
    const s = this.segredos;
    const idH = resumoDaCaixa(s.caixa.id);
    for (const p of await this.ap.transporte.buscar(s.caixa, this.cursor)) {
      this.cursor = Math.max(this.cursor, p.ordem);
      const d = await desembrulhar(s.embrulho, idH, s.epoca, p.envelope);
      if (!d) continue;
      if (d.tipo === TIPO.aplicacao) {
        await this.processarAplicacao(d.bytes, s);
        continue;
      }
      if (d.tipo !== TIPO.commit || d.bytes.length < 4) continue;
      const n = lerU32(d.bytes, 0);
      if (4 + n > d.bytes.length) continue;
      let a: Autorizacao;
      try {
        a = JSON.parse(new TextDecoder().decode(d.bytes.subarray(4, 4 + n)));
      } catch {
        this.ignorados.push("autorizacao_ilegivel");
        continue;
      }
      const commit = d.bytes.slice(4 + n);
      const conhecidos = new Set([...this.membros.values()].map((m) => m.identidade));
      const juizo = julgarCommit(this.id, s.epoca, commit, a, this.papeis, conhecidos);
      if (!juizo.ok) {
        this.ignorados.push(juizo.motivo);
        continue;
      }
      const antes = await this.clientes();
      let ativo: boolean;
      try {
        const r = await this.ap.cc.transaction((c) => c.decryptMessage(this.conversa, commit));
        ativo = r.tag !== "Commit" || r.inner.isActive;
      } catch {
        this.ignorados.push("commit_recusado_pela_biblioteca");
        continue;
      }
      if (!ativo) {
        await this.esquecer();
        return false;
      }
      const depois = await this.clientes();
      if (!mudancaConfere(a.acao, antes, depois)) this.suspeitas.push("commit_mudou_outra_coisa");
      for (const c of antes) if (!depois.has(c)) this.membros.delete(c);
      await this.novaEpoca();
      return true;
    }
    return false;
  }

  private async processarAplicacao(bytes: Uint8Array, s: SegredosDaEpoca): Promise<void> {
    let r;
    try {
      r = await this.ap.cc.transaction((c) => c.decryptMessage(this.conversa, bytes));
    } catch {
      return; // repetida, de época que não temos mais, adulterada: a biblioteca recusa
    }
    if (r.tag !== "ApplicationMessage") return;
    const de = paraB64(r.inner.senderClientId.copyBytes());
    let m: Aplicacao;
    try {
      m = JSON.parse(new TextDecoder().decode(r.inner.plaintext));
    } catch {
      return;
    }
    const autor = this.membros.get(de)?.identidade ?? null;
    switch (m.t) {
      case "apresentacao":
        if (m.a?.cliente === de && apresentacaoValida(this.id, m.a)) this.membros.set(de, m.a);
        else this.suspeitas.push("apresentacao_falsa");
        return;
      case "papeis":
        if (aceitarPapeis(this.id, this.papeis, m.l)) this.cadeia.push(m.l);
        else if (!(m.l?.versao <= this.papeis.versao)) this.suspeitas.push("papeis_recusados");
        return;
      case "chave-entrada":
        if (m.para !== this.meuCliente || !autor || !this.papeis.mediacao.includes(autor) || !this.souMediacao()) return;
        this.entrada = (await abrirChaveDeEntrada(this.folha.privada, deB64(m.e))) ?? this.entrada;
        return;
      case "sair":
        if (this.souMediacao()) this.pedidosDeSaida.add(de);
        return;
      case "texto":
        this.mensagens.push({ tipo: "texto", autor, corpo: deB64(m.c), epoca: s.epoca });
        return;
      case "post": {
        const corpo = await abrirPost(s, this.id, deB64(m.c));
        if (corpo) this.mensagens.push({ tipo: "post", autor, corpo, epoca: s.epoca });
        return;
      }
      case "voz":
        this.mensagens.push({ tipo: "voz", autor, corpo: deB64(m.c), epoca: s.epoca });
        return;
      case "anexo": {
        let corpo: Uint8Array | null = null;
        try {
          corpo = typeof m.c === "string" ? deB64(m.c) : null;
        } catch {
          return;
        }
        if (corpo && lerCorpoDeAnexo(corpo)) this.mensagens.push({ tipo: "anexo", autor, corpo, epoca: s.epoca });
        return;
      }
      case "posicao": {
        let corpo: Uint8Array | null = null;
        try {
          corpo = typeof m.c === "string" ? deB64(m.c) : null;
        } catch {
          return;
        }
        // De folha que ainda não se apresentou (sem autor), a posição não serve: não há de quem ela é.
        if (corpo && autor && lerCorpoDePosicao(corpo)) this.mensagens.push({ tipo: "posicao", autor, corpo, epoca: s.epoca });
        return;
      }
    }
  }
}
