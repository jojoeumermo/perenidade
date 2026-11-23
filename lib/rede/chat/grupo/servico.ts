// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A conversa em grupo do chat (recurso "alumia-chat-grupo"), NO APARELHO. Documento: docs/rede/CHAT-PRIVADO.md ("Conversa em grupo").
//
// O motor é o que já existia e NÃO muda: o grupo com membros escondidos (lib/rede/membros/grupo.ts: MLS do @wireapp/core-crypto na
// suíte híbrida ML-KEM-768 + X25519, embrulho da época, caixas anônimas da época tiradas do exportador do MLS, papéis assinados pela
// identidade da conta). Este arquivo só junta as peças para a tela:
//   - criar o grupo (quem cria é a mediação); o nome vai DENTRO do grupo (linha "nome"), nunca ao servidor;
//   - convidar pelo @: só quem tem conversa a dois aberta com a pessoa. O convite, o pedido de entrada (com o pacote de chave do MLS)
//     e a recusa vão pela conversa a dois (o controle "grupo", lib/rede/chat/r2/servico.ts); o aparelho de quem administra confere
//     que a identidade do pedido é a que ele conhece daquela conversa, e só então põe a pessoa pelo MLS. As boas-vindas vão para a
//     caixa de resposta sorteada por quem pediu, como na entrada dos núcleos;
//   - conversar: cada mensagem é uma linha cifrada pelo MLS (formato.ts), com prazo para sumir e "ver uma vez"; o anexo é o corpo do
//     anexo cifrado do chat (lib/rede/chat/anexo-cifrado.ts) dentro da aplicação "anexo" do grupo;
//   - quem está no grupo: as apresentações assinadas (de dentro do cifrado) e, para o @ de cada uma, a linha "eu" de cada pessoa e a
//     linha "quem" da mediação, conferidas no registro público das chaves; o código de segurança com cada pessoa é o da conversa a
//     dois (a mesma identidade da conta);
//   - sair (a mediação tira a folha no próximo commit) e tirar alguém (só a mediação).
// Tudo o que este aparelho sabe dos grupos fica na guarda dele (no navegador, a guarda selada dos grupos, apagada no "Sair rápido").
// O servidor não guarda membro, nome de grupo nem convite: só caixas anônimas e envelopes de tamanho fixo.
// Sem "@/": roda no Node nos testes (scripts/testar-chat-grupo.mjs).
import { type Aparelho, Grupo, type RetratoDoGrupo } from "../../membros/grupo";
import { deB64, paraB64, resumo, sorteados } from "../../membros/bytes";
import { codigoDeSeguranca } from "../r2/certificados";
import { lerCorpoDeAnexo } from "../anexo-cifrado";
import {
  type CorpoDoConvite,
  eLinhaDoGrupo,
  LIMITES,
  limparNome,
  lerLinha,
  type Linha,
  montarCorpoDoConvite,
  montarLinha,
  pedidoDoCorpo,
  pedidoParaCorpo,
  type PrazoDoGrupo,
  PRAZOS_DO_GRUPO,
  type QuemE,
} from "./formato";

const DIA = 86_400_000;
/** Convite recebido sem resposta, e pedido aceito à espera das boas-vindas: somem em 30 dias. */
export const VIDA_DO_CONVITE = 30 * DIA;
/** Até quantas mensagens cada grupo guarda neste aparelho (as mais novas). */
export const MENSAGENS_GUARDADAS = 1000;
/** Até quantos convites recebidos ficam esperando resposta (os mais novos). */
export const CONVITES_GUARDADOS = 50;

const erro = (codigo: string) => Object.assign(new Error(codigo), { code: codigo });
/** O id de um anexo: o resumo do corpo (o endereço no depósito é sorteado, então dois anexos nunca têm o mesmo). */
const idDoAnexo = (autor: string, corpo: Uint8Array) => `${autor}.a${paraB64(resumo(corpo)).slice(0, 22)}`;

/** Onde o aparelho guarda (chave → valor JSON). No navegador, a guarda selada dos grupos; nos testes, a memória. */
export interface GuardaDosGrupos {
  ler<T>(chave: string): Promise<T | null>;
  guardar(chave: string, valor: unknown): Promise<void>;
  apagar(chave: string): Promise<void>;
}

/** A conversa a dois aberta com uma pessoa, e a identidade da conta dela que este aparelho conhece (e o registro confirmou). */
export interface ContatoDoGrupo {
  conta: string;
  codinome: string;
  conversa: string;
  identidade: Uint8Array;
}

export interface DependenciasDosGrupos {
  /** O aparelho do MLS dos grupos: motor, credencial, identidade da conta (só assina textos do grupo) e o transporte das caixas. */
  ap: Aparelho;
  guarda: GuardaDosGrupos;
  eu: { conta: string; codinome: string };
  /** Manda o corpo do convite pela conversa a dois (o controle "grupo" do chat). */
  mandarPelaConversa(conversa: string, corpo: string): Promise<void>;
  /** A conversa a dois ABERTA com o @, com a identidade conhecida e conferida; null se não há (ou se a identidade mudou). */
  contatoPorCodinome(codinome: string): Promise<ContatoDoGrupo | null>;
  /** O mesmo, pela conta de quem mandou o controle. */
  contatoPorConta(conta: string): Promise<ContatoDoGrupo | null>;
  /** A identidade é a última do registro público das chaves para esta conta? */
  conferirIdentidade(conta: string, identidade: Uint8Array): Promise<"confere" | "nao_confere" | "quebrado">;
  agora?: () => number;
}

export type Conferida = "confere" | "nao_confere" | "quebrado" | null;
interface PessoaGuardada {
  conta: string;
  codinome: string;
  conferida: Conferida;
}
interface GrupoGuardado {
  id: string;
  nome: string;
  criadoEm: number;
  ultimaEm: number;
  naoLidas: number;
  /** identidade (b64url) → quem ela diz ser. */
  pessoas: Record<string, PessoaGuardada>;
  /** "removido": a mediação tirou este aparelho; o grupo fica na lista (só leitura) até a pessoa tirar. */
  fora?: "removido";
}
interface ConviteRecebido {
  g: string;
  nome: string;
  conta: string;
  codinome: string;
  conversa: string;
  quando: number;
}
interface ConviteFeito {
  g: string;
  grupo: string;
  conta: string;
  codinome: string;
  conversa: string;
  quando: number;
}
interface Esperando {
  g: string;
  nome: string;
  conta: string;
  codinome: string;
  resposta: { id: string; pd: string; pl: string };
  kr: string;
  quando: number;
}
interface EstadoDosGrupos {
  v: 1;
  grupos: Record<string, GrupoGuardado>;
  recebidos: Record<string, ConviteRecebido>;
  feitos: Record<string, ConviteFeito>;
  esperando: Record<string, Esperando>;
}
const VAZIO = (): EstadoDosGrupos => ({ v: 1, grupos: {}, recebidos: {}, feitos: {}, esperando: {} });

export interface MensagemDoGrupo {
  /** "<identidade do autor>.<id de dentro>": o mesmo em todos os aparelhos do grupo. */
  id: string;
  autor: string;
  minha: boolean;
  quando: number;
  expira: number;
  texto: string;
  /** O corpo do anexo cifrado (base64url), quando é anexo. */
  anexo?: string;
  umaVez: boolean;
}

export interface GrupoNaLista {
  id: string;
  nome: string;
  ultimaEm: number;
  naoLidas: number;
  /** Quantas pessoas, só a partir de 3 (abaixo disso, nenhum número). */
  contagem: number | null;
  souMediacao: boolean;
  fora: "removido" | null;
  /** O grupo foi marcado como suspeito (um commit mudou outra coisa, papéis forjados, apresentação falsa). */
  suspeito: boolean;
}
export interface PessoaDoGrupo {
  identidade: string;
  conta: string | null;
  codinome: string | null;
  eu: boolean;
  mediacao: boolean;
  conferida: Conferida;
}

export class GruposDoAparelho {
  private estado: EstadoDosGrupos = VAZIO();
  private aberto = false;
  private readonly grupos = new Map<string, Grupo>();
  private fila: Promise<unknown> = Promise.resolve();
  private readonly d: DependenciasDosGrupos;

  constructor(d: DependenciasDosGrupos) {
    this.d = d;
  }

  private agora() {
    return this.d.agora ? this.d.agora() : Date.now();
  }
  private get minhaIdentidade(): string {
    return paraB64(this.d.ap.identidade.publica);
  }

  /** Uma operação dos grupos por vez neste aparelho (o motor e a guarda não aceitam duas cruzadas). */
  naFila<T>(fazer: () => Promise<T>): Promise<T> {
    const vez = this.fila.then(fazer, fazer);
    this.fila = vez.catch(() => undefined);
    return vez;
  }

  private async abrir(): Promise<void> {
    if (this.aberto) return;
    const e = await this.d.guarda.ler<EstadoDosGrupos>("lista");
    this.estado = e?.v === 1 ? e : VAZIO();
    this.aberto = true;
  }
  private gravar() {
    return this.d.guarda.guardar("lista", this.estado);
  }
  private async gravarGrupo(id: string, g: Grupo) {
    await this.d.guarda.guardar(`g:${id}`, g.retrato());
  }
  private async mensagensGuardadas(id: string): Promise<MensagemDoGrupo[]> {
    return (await this.d.guarda.ler<MensagemDoGrupo[]>(`m:${id}`)) ?? [];
  }
  private async gravarMensagens(id: string, lista: MensagemDoGrupo[]) {
    const agora = this.agora();
    const vivas = lista.filter((m) => m.expira > agora).sort((a, b) => a.quando - b.quando || a.id.localeCompare(b.id));
    await this.d.guarda.guardar(`m:${id}`, vivas.slice(-MENSAGENS_GUARDADAS));
  }

  /** O grupo aberto neste aparelho (do retrato guardado e da loja do motor); null se o motor não tem mais o grupo. */
  private async grupo(id: string): Promise<Grupo | null> {
    const ja = this.grupos.get(id);
    if (ja) return ja;
    const r = await this.d.guarda.ler<RetratoDoGrupo>(`g:${id}`);
    const g = r ? await Grupo.restaurar(this.d.ap, r) : null;
    if (g) this.grupos.set(id, g);
    return g;
  }
  private async exigirGrupo(id: string): Promise<{ g: Grupo; l: GrupoGuardado }> {
    await this.abrir();
    const l = this.estado.grupos[id];
    const g = l && !l.fora ? await this.grupo(id) : null;
    if (!l || !g || g.removido) throw erro("grupo_fora");
    return { g, l };
  }

  private async mandarLinha(g: Grupo, l: Linha) {
    await g.mandarTexto(montarLinha(l));
  }

  /** Repete uma operação de commit enquanto outro aparelho ganhou a corrida da época ("ocupada"). */
  private async comRepeticao<T extends string>(fazer: () => Promise<T>): Promise<T> {
    let r = await fazer();
    for (let i = 0; r === "ocupada" && i < 4; i++) r = await fazer();
    if (r === "ocupada") throw erro("grupo_ocupado");
    return r;
  }

  // ── Para a tela ─────────────────────────────────────────────────────────────────────────────────────────────────────────

  lista(): Promise<{ grupos: GrupoNaLista[]; convites: ConviteRecebido[]; esperando: Esperando[] }> {
    return this.naFila(async () => {
      await this.abrir();
      const grupos: GrupoNaLista[] = [];
      for (const l of Object.values(this.estado.grupos)) {
        const g = l.fora ? null : await this.grupo(l.id).catch(() => null);
        grupos.push({
          id: l.id, nome: l.nome, ultimaEm: l.ultimaEm, naoLidas: l.naoLidas, contagem: g?.contagemParaTela() ?? null,
          souMediacao: g?.souMediacao() ?? false, fora: l.fora ?? (g ? null : "removido"), suspeito: (g?.suspeitas.length ?? 0) > 0,
        });
      }
      return {
        grupos: grupos.sort((a, b) => b.ultimaEm - a.ultimaEm),
        convites: Object.values(this.estado.recebidos).sort((a, b) => b.quando - a.quando),
        esperando: Object.values(this.estado.esperando).sort((a, b) => b.quando - a.quando),
      };
    });
  }

  /** Cria um grupo com este nome: quem cria é a mediação. Devolve o id (o do grupo no MLS, só neste aparelho e nos dos membros). */
  criar(nome: string): Promise<string> {
    return this.naFila(async () => {
      await this.abrir();
      const n = limparNome(nome);
      if (!n || [...n].length > LIMITES.nome) throw erro("nome_invalido");
      const g = await Grupo.criar(this.d.ap, "grupo", false);
      const id = paraB64(g.id);
      this.grupos.set(id, g);
      const agora = this.agora();
      this.estado.grupos[id] = { id, nome: n, criadoEm: agora, ultimaEm: agora, naoLidas: 0, pessoas: { [this.minhaIdentidade]: { conta: this.d.eu.conta, codinome: this.d.eu.codinome, conferida: "confere" } } };
      await this.mandarLinha(g, { t: "nome", n });
      await this.mandarLinha(g, { t: "eu", u: this.d.eu.conta, c: this.d.eu.codinome });
      await this.gravarGrupo(id, g);
      await this.gravar();
      return id;
    });
  }

  /** Muda o nome (só a mediação). O nome vai dentro do grupo, para os aparelhos dos membros. */
  renomear(id: string, nome: string): Promise<void> {
    return this.naFila(async () => {
      const { g, l } = await this.exigirGrupo(id);
      if (!g.souMediacao()) throw erro("sem_papel");
      const n = limparNome(nome);
      if (!n || [...n].length > LIMITES.nome) throw erro("nome_invalido");
      await this.mandarLinha(g, { t: "nome", n });
      l.nome = n;
      await this.gravarGrupo(id, g);
      await this.gravar();
    });
  }

  /**
   * Convida pelo @ (só a mediação, só quem tem conversa a dois aberta com a pessoa). O convite vai pela conversa a dois; a pessoa
   * aceita ou recusa no aparelho dela.
   */
  convidar(id: string, codinome: string): Promise<void> {
    return this.naFila(async () => {
      const { g, l } = await this.exigirGrupo(id);
      if (!g.souMediacao()) throw erro("sem_papel");
      const c = await this.d.contatoPorCodinome(codinome.trim().replace(/^@+/, "").toLowerCase());
      if (!c) throw erro("grupo_sem_conversa");
      if (c.conta === this.d.eu.conta) throw erro("grupo_sou_eu");
      const ja = paraB64(c.identidade);
      if (g.apresentados().some((a) => a.identidade === ja)) throw erro("grupo_ja_esta");
      const convite = paraB64(sorteados(16));
      // Um convite pendente por pessoa e grupo: o novo toma o lugar do antigo.
      for (const [k, f] of Object.entries(this.estado.feitos)) if (f.grupo === id && f.conta === c.conta) delete this.estado.feitos[k];
      this.estado.feitos[convite] = { g: convite, grupo: id, conta: c.conta, codinome: c.codinome, conversa: c.conversa, quando: this.agora() };
      await this.gravar();
      await this.d.mandarPelaConversa(c.conversa, montarCorpoDoConvite({ t: "convite", g: convite, n: l.nome }));
    });
  }

  /** Os convites que eu fiz e ainda esperam resposta, num grupo. */
  convitesFeitos(id: string): Promise<{ codinome: string; quando: number }[]> {
    return this.naFila(async () => {
      await this.abrir();
      return Object.values(this.estado.feitos).filter((f) => f.grupo === id).map((f) => ({ codinome: f.codinome, quando: f.quando }));
    });
  }

  /**
   * Chegou um controle "grupo" pela conversa a dois (já aberto e conferido pelo chat: é da OUTRA pessoa da conversa, que não está
   * bloqueada). Convite: fica esperando a resposta da pessoa. Pedido: só de quem eu convidei, com a identidade que eu conheço dela;
   * aí entra pelo MLS. Recusa: o convite sai.
   */
  aoChegarConvite(x: { conversa: string; autor: string; codinome: string; corpo: CorpoDoConvite; quando: number }): Promise<void> {
    return this.naFila(async () => {
      await this.abrir();
      const c = x.corpo;
      if (c.t === "convite") {
        if (this.estado.esperando[c.g]) return;
        this.estado.recebidos[c.g] = { g: c.g, nome: c.n, conta: x.autor, codinome: x.codinome, conversa: x.conversa, quando: x.quando };
        const velhos = Object.values(this.estado.recebidos).sort((a, b) => b.quando - a.quando).slice(CONVITES_GUARDADOS);
        for (const v of velhos) delete this.estado.recebidos[v.g];
        await this.gravar();
        return;
      }
      const feito = this.estado.feitos[c.g];
      if (!feito || feito.conta !== x.autor || feito.conversa !== x.conversa) return;
      if (c.t === "recusa") {
        delete this.estado.feitos[c.g];
        await this.gravar();
        return;
      }
      // O pedido: a identidade tem de ser a que este aparelho conhece (e o registro confirmou) da pessoa convidada.
      const contato = await this.d.contatoPorConta(x.autor);
      if (!contato || paraB64(contato.identidade) !== c.i) return;
      const l = this.estado.grupos[feito.grupo];
      const g = l && !l.fora ? await this.grupo(feito.grupo) : null;
      if (!g || g.removido || !g.souMediacao()) return;
      delete this.estado.feitos[c.g];
      await this.gravar();
      await this.comRepeticao(() => g.aceitar(pedidoDoCorpo(c)));
      l.pessoas[c.i] = { conta: contato.conta, codinome: contato.codinome, conferida: "confere" };
      // Quem acabou de entrar não leu as épocas de antes: a mediação diz quem é quem (cada pessoa confere no registro).
      const quem: QuemE[] = Object.entries(l.pessoas).map(([i, p]) => ({ i, u: p.conta, c: p.codinome })).slice(0, LIMITES.quem);
      await this.mandarLinha(g, { t: "quem", l: quem });
      await this.mandarLinha(g, { t: "nome", n: l.nome });
      l.ultimaEm = this.agora();
      await this.gravarGrupo(feito.grupo, g);
      await this.gravar();
    });
  }

  /** Aceita (manda o pedido de entrada pela conversa a dois) ou recusa um convite recebido. */
  responder(convite: string, aceitar: boolean): Promise<void> {
    return this.naFila(async () => {
      await this.abrir();
      const r = this.estado.recebidos[convite];
      if (!r) throw erro("nao_encontrado");
      delete this.estado.recebidos[convite];
      if (!aceitar) {
        await this.gravar();
        await this.d.mandarPelaConversa(r.conversa, montarCorpoDoConvite({ t: "recusa", g: convite })).catch(() => undefined);
        return;
      }
      const { pedido, resposta } = await Grupo.montarPedido(this.d.ap, "");
      this.estado.esperando[convite] = {
        g: convite, nome: r.nome, conta: r.conta, codinome: r.codinome,
        resposta: { id: paraB64(resposta.id), pd: paraB64(resposta.pd), pl: paraB64(resposta.pl) }, kr: paraB64(pedido.kr), quando: this.agora(),
      };
      await this.gravar();
      await this.d.mandarPelaConversa(r.conversa, montarCorpoDoConvite(pedidoParaCorpo(convite, pedido)));
    });
  }

  /** As caixas que este aparelho busca (a agenda das caixas busca cada uma no seu horário): "g:<grupo>" e "e:<convite>". */
  vigiadas(): Promise<string[]> {
    return this.naFila(async () => {
      await this.abrir();
      return [...Object.values(this.estado.grupos).filter((l) => !l.fora).map((l) => `g:${l.id}`), ...Object.keys(this.estado.esperando).map((g) => `e:${g}`)];
    });
  }

  /** Busca tudo (os testes; a tela usa a agenda, uma caixa por vez). Devolve quantas mensagens novas chegaram. */
  async receber(): Promise<number> {
    let n = 0;
    for (const qual of await this.vigiadas()) n += await this.receberUm(qual).catch(() => 0);
    return n;
  }

  /** Busca uma caixa: "g:<grupo>" (a da época do grupo) ou "e:<convite>" (a resposta de quem administra). */
  receberUm(qual: string): Promise<number> {
    return this.naFila(async () => {
      await this.abrir();
      if (qual.startsWith("e:")) return this.esperar(qual.slice(2));
      if (qual.startsWith("g:")) return this.lerGrupo(qual.slice(2));
      return 0;
    });
  }

  private async esperar(convite: string): Promise<number> {
    const e = this.estado.esperando[convite];
    if (!e) return 0;
    if (this.agora() - e.quando > VIDA_DO_CONVITE) {
      delete this.estado.esperando[convite];
      await this.gravar();
      return 0;
    }
    const g = await Grupo.entrarPelaResposta(this.d.ap, { id: deB64(e.resposta.id), pd: deB64(e.resposta.pd), pl: deB64(e.resposta.pl), multi: false }, deB64(e.kr), "grupo");
    if (!g) return 0;
    const id = paraB64(g.id);
    this.grupos.set(id, g);
    delete this.estado.esperando[convite];
    const agora = this.agora();
    this.estado.grupos[id] = {
      id, nome: e.nome, criadoEm: agora, ultimaEm: agora, naoLidas: 0,
      pessoas: { [this.minhaIdentidade]: { conta: this.d.eu.conta, codinome: this.d.eu.codinome, conferida: "confere" } },
    };
    await this.mandarLinha(g, { t: "eu", u: this.d.eu.conta, c: this.d.eu.codinome });
    const n = await this.depoisDeReceber(id, g);
    await this.gravar();
    return n;
  }

  private async lerGrupo(id: string): Promise<number> {
    const l = this.estado.grupos[id];
    if (!l || l.fora) return 0;
    const g = await this.grupo(id);
    if (!g) {
      l.fora = "removido";
      await this.gravar();
      return 0;
    }
    await g.receber();
    const n = await this.depoisDeReceber(id, g);
    await this.gravar();
    return n;
  }

  /** Lê o que o grupo decifrou, guarda as mensagens, trata as linhas e, na mediação, tira quem pediu para sair. */
  private async depoisDeReceber(id: string, g: Grupo): Promise<number> {
    const l = this.estado.grupos[id];
    const chegaram = g.mensagens.splice(0);
    const agora = this.agora();
    const lista = await this.mensagensGuardadas(id);
    let novas = 0;
    const conferir: { i: string; conta: string }[] = [];
    for (const m of chegaram) {
      if (!m.autor) continue;
      if (m.tipo === "anexo") {
        const a = lerCorpoDeAnexo(m.corpo);
        if (!a) continue;
        const ident = idDoAnexo(m.autor, m.corpo);
        if (lista.some((x) => x.id === ident)) continue;
        lista.push({ id: ident, autor: m.autor, minha: false, quando: agora, expira: agora + a.dias * DIA, texto: "", anexo: paraB64(m.corpo), umaVez: !!a.umaVez });
        novas++;
        continue;
      }
      if (m.tipo !== "texto") continue;
      let t: string;
      try {
        t = new TextDecoder("utf-8", { fatal: true }).decode(m.corpo);
      } catch {
        continue;
      }
      // Um texto do grupo que não é desta tela (os tópicos, o "quem leva o quê"): não aparece como mensagem aqui.
      if (!eLinhaDoGrupo(t)) continue;
      const linha = lerLinha(t);
      if (!linha) continue;
      const mediacao = g.papeis.mediacao.includes(m.autor);
      switch (linha.t) {
        case "msg": {
          const ident = `${m.autor}.${linha.id}`;
          if (lista.some((x) => x.id === ident)) break;
          // O "quando" de quem escreveu, sem passar de agora (um relógio adiantado não põe a mensagem no fim para sempre).
          const quando = Math.min(linha.q, agora);
          lista.push({ id: ident, autor: m.autor, minha: false, quando, expira: quando + linha.p * DIA, texto: linha.c, umaVez: linha.u === 1 });
          novas++;
          break;
        }
        case "apagar": {
          const i = lista.findIndex((x) => x.id === `${m.autor}.${linha.id}`);
          if (i >= 0) lista.splice(i, 1);
          break;
        }
        case "nome":
          if (mediacao) l.nome = linha.n;
          break;
        case "eu":
          l.pessoas[m.autor] = { conta: linha.u, codinome: linha.c, conferida: null };
          conferir.push({ i: m.autor, conta: linha.u });
          break;
        case "quem":
          if (!mediacao) break;
          for (const q of linha.l) {
            if (l.pessoas[q.i]?.conferida === "confere" && l.pessoas[q.i].conta === q.u) continue;
            l.pessoas[q.i] = { conta: q.u, codinome: q.c, conferida: null };
            conferir.push({ i: q.i, conta: q.u });
          }
          break;
      }
    }
    // Quem diz ser quem: a identidade da apresentação tem de ser a do registro público para aquela conta.
    for (const c of conferir) {
      const p = l.pessoas[c.i];
      if (!p || p.conta !== c.conta) continue;
      p.conferida = c.i === this.minhaIdentidade ? (c.conta === this.d.eu.conta ? "confere" : "nao_confere") : await this.d.conferirIdentidade(c.conta, deB64(c.i)).catch(() => "quebrado" as const);
    }
    if (g.removido) l.fora = "removido";
    // A mediação tira quem pediu para sair (a folha que mandou "sair").
    if (!g.removido && g.souMediacao() && g.pedidosDeSaida.size) {
      const sair = [...g.pedidosDeSaida];
      const presentes = new Set(g.apresentados().map((a) => a.cliente));
      const ainda = sair.filter((c) => presentes.has(c));
      if (ainda.length) await this.comRepeticao(() => g.remover(ainda)).catch(() => undefined);
      for (const c of sair) g.pedidosDeSaida.delete(c);
    }
    // Quem não está mais na árvore sai da lista de pessoas.
    const ficam = new Set(g.apresentados().map((a) => a.identidade));
    if (!g.removido) for (const i of Object.keys(l.pessoas)) if (!ficam.has(i) && i !== this.minhaIdentidade) delete l.pessoas[i];
    if (novas) {
      l.naoLidas += novas;
      l.ultimaEm = Math.max(l.ultimaEm, ...lista.slice(-novas).map((x) => x.quando));
    }
    await this.gravarMensagens(id, lista);
    if (!g.removido) await this.gravarGrupo(id, g);
    return novas;
  }

  mensagens(id: string): Promise<MensagemDoGrupo[]> {
    return this.naFila(async () => {
      const agora = this.agora();
      return (await this.mensagensGuardadas(id)).filter((m) => m.expira > agora);
    });
  }

  marcarLido(id: string): Promise<void> {
    return this.naFila(async () => {
      await this.abrir();
      const l = this.estado.grupos[id];
      if (l && l.naoLidas) {
        l.naoLidas = 0;
        await this.gravar();
      }
    });
  }

  /** Manda um texto. O prazo (1, 7 ou 30 dias) e o "ver uma vez" vão dentro do cifrado. */
  mandarTexto(id: string, texto: string, opcoes: { prazo?: PrazoDoGrupo; umaVez?: boolean } = {}): Promise<MensagemDoGrupo> {
    return this.naFila(async () => {
      const { g, l } = await this.exigirGrupo(id);
      const c = texto.trim().normalize("NFC");
      if (!c || [...c].length > LIMITES.texto) throw erro("texto_invalido");
      const p = opcoes.prazo ?? 7;
      if (!PRAZOS_DO_GRUPO.includes(p)) throw erro("prazo_invalido");
      const linha = { t: "msg" as const, id: paraB64(sorteados(16)), c, q: this.agora(), p, ...(opcoes.umaVez ? { u: 1 as const } : {}) };
      await this.mandarLinha(g, linha);
      const m: MensagemDoGrupo = { id: `${this.minhaIdentidade}.${linha.id}`, autor: this.minhaIdentidade, minha: true, quando: linha.q, expira: linha.q + p * DIA, texto: c, umaVez: !!opcoes.umaVez };
      await this.gravarMensagens(id, [...(await this.mensagensGuardadas(id)), m]);
      l.ultimaEm = m.quando;
      await this.gravarGrupo(id, g);
      await this.gravar();
      return m;
    });
  }

  /** Manda o corpo de um anexo cifrado (o arquivo já subiu cifrado ao depósito: lib/rede/chat/anexo-deposito.ts). */
  mandarAnexo(id: string, corpo: Uint8Array): Promise<MensagemDoGrupo> {
    return this.naFila(async () => {
      const { g, l } = await this.exigirGrupo(id);
      const a = lerCorpoDeAnexo(corpo);
      if (!a) throw erro("anexo_invalido");
      await g.mandarAnexo(corpo);
      const agora = this.agora();
      const m: MensagemDoGrupo = { id: idDoAnexo(this.minhaIdentidade, corpo), autor: this.minhaIdentidade, minha: true, quando: agora, expira: agora + a.dias * DIA, texto: "", anexo: paraB64(corpo), umaVez: !!a.umaVez };
      await this.gravarMensagens(id, [...(await this.mensagensGuardadas(id)), m]);
      l.ultimaEm = agora;
      await this.gravarGrupo(id, g);
      await this.gravar();
      return m;
    });
  }

  /** Apaga uma mensagem: a minha, para todos (o pedido vai dentro do grupo); a de outra pessoa, só deste aparelho. */
  apagarMensagem(id: string, mensagem: string): Promise<void> {
    return this.naFila(async () => {
      await this.abrir();
      const lista = await this.mensagensGuardadas(id);
      const m = lista.find((x) => x.id === mensagem);
      if (!m) return;
      if (m.minha && !m.anexo && this.estado.grupos[id] && !this.estado.grupos[id].fora) {
        const { g } = await this.exigirGrupo(id);
        await this.mandarLinha(g, { t: "apagar", id: m.id.slice(m.id.indexOf(".") + 1) });
        await this.gravarGrupo(id, g);
      }
      await this.gravarMensagens(id, lista.filter((x) => x.id !== mensagem));
    });
  }

  /** Quem está no grupo (só dentro do cifrado, neste aparelho): as apresentações conferidas e o @ de cada uma. */
  pessoas(id: string): Promise<PessoaDoGrupo[]> {
    return this.naFila(async () => {
      const { g, l } = await this.exigirGrupo(id);
      const vistas = new Set<string>();
      const saida: PessoaDoGrupo[] = [];
      for (const a of g.apresentados()) {
        if (vistas.has(a.identidade)) continue;
        vistas.add(a.identidade);
        const p = l.pessoas[a.identidade];
        saida.push({ identidade: a.identidade, conta: p?.conta ?? null, codinome: p?.codinome ?? null, eu: a.identidade === this.minhaIdentidade, mediacao: g.papeis.mediacao.includes(a.identidade), conferida: p?.conferida ?? null });
      }
      return saida.sort((a, b) => Number(b.eu) - Number(a.eu) || Number(b.mediacao) - Number(a.mediacao) || (a.codinome ?? "~").localeCompare(b.codinome ?? "~"));
    });
  }

  /** O código de segurança com uma pessoa do grupo: o mesmo da conversa a dois (é da identidade da conta, não do grupo). */
  codigo(conta: string, identidade: string): string {
    return codigoDeSeguranca({ conta: this.d.eu.conta, identidade: this.d.ap.identidade.publica }, { conta, identidade: deB64(identidade) });
  }

  /** Tira uma pessoa (só a mediação): todas as folhas dela saem num commit; ela não lê nada da época seguinte. */
  tirar(id: string, identidade: string): Promise<void> {
    return this.naFila(async () => {
      const { g, l } = await this.exigirGrupo(id);
      if (!g.souMediacao()) throw erro("sem_papel");
      if (identidade === this.minhaIdentidade) throw erro("grupo_sou_eu");
      const clientes = g.apresentados().filter((a) => a.identidade === identidade).map((a) => a.cliente);
      if (!clientes.length) throw erro("nao_encontrado");
      await this.comRepeticao(() => g.remover(clientes));
      delete l.pessoas[identidade];
      await this.gravarGrupo(id, g);
      await this.gravar();
    });
  }

  /**
   * Sai do grupo: pede à mediação que tire esta folha e apaga o grupo deste aparelho. Se eu sou a única pessoa da mediação e há mais
   * gente, a mediação passa antes para a pessoa que está há mais tempo (a primeira apresentada), para o grupo não ficar sem ninguém
   * que convide ou tire.
   */
  sair(id: string): Promise<void> {
    return this.naFila(async () => {
      await this.abrir();
      const l = this.estado.grupos[id];
      if (!l) return;
      const g = l.fora ? null : await this.grupo(id);
      if (g && !g.removido) {
        await g.receber().catch(() => undefined);
        const eu = this.minhaIdentidade;
        const outros = [...new Set(g.apresentados().map((a) => a.identidade))].filter((i) => i !== eu);
        if (g.souMediacao() && outros.length && g.papeis.mediacao.every((m) => m === eu)) await g.mudarPapeis([outros[0]]);
        await g.sair();
      }
      this.grupos.delete(id);
      delete this.estado.grupos[id];
      for (const [k, f] of Object.entries(this.estado.feitos)) if (f.grupo === id) delete this.estado.feitos[k];
      await this.d.guarda.apagar(`g:${id}`);
      await this.d.guarda.apagar(`m:${id}`);
      await this.gravar();
    });
  }

  /** Tira da lista um grupo de que este aparelho foi tirado (só o que estava guardado aqui). */
  esquecer(id: string): Promise<void> {
    return this.naFila(async () => {
      await this.abrir();
      const g = this.grupos.get(id);
      if (g && !g.removido) throw erro("grupo_ativo");
      this.grupos.delete(id);
      delete this.estado.grupos[id];
      await this.d.guarda.apagar(`g:${id}`);
      await this.d.guarda.apagar(`m:${id}`);
      await this.gravar();
    });
  }
}

