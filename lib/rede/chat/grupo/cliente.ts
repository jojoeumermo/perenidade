// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A conversa em grupo (recurso "alumia-chat-grupo") para a TELA: a lista (grupos, convites, esperando), criar, convidar pelo @,
// responder a um convite, conversar (texto, anexo cifrado, prazo, ver uma vez), quem está, código de segurança, tirar e sair.
// Nenhuma cifra aqui e nada vai ao servidor por este arquivo: tudo passa pelos grupos deste aparelho (./servico.ts), montados no
// navegador por ./navegador.ts, que só é baixado quando a tela do grupo aparece. Na prévia (NEXT_PUBLIC_ALUMIA_PREVIA=sim), o dublê
// de ./exemplos.ts responde no lugar, com dados inventados e só na memória da aba.
import { type CorpoDeAnexo, type DiasDoAnexo, lerCorpoDeAnexo } from "../anexo-cifrado";
import { dubleDosGrupos } from "./exemplos";
import type { PrazoDoGrupo } from "./formato";
import type { GrupoNaLista, MensagemDoGrupo, PessoaDoGrupo } from "./servico";

export type { GrupoNaLista, MensagemDoGrupo, PessoaDoGrupo, PrazoDoGrupo };

/** A prévia com dados de exemplo está ligada? (A referência é literal para o Next gravar o valor no código do navegador.) */
const PREVIA = process.env.NEXT_PUBLIC_ALUMIA_PREVIA === "sim";

export interface ConviteNaTela {
  g: string;
  nome: string;
  codinome: string;
  quando: number;
}
export interface ListaDosGrupos {
  grupos: GrupoNaLista[];
  convites: ConviteNaTela[];
  esperando: ConviteNaTela[];
}
export interface OpcoesDoGrupo {
  prazo: PrazoDoGrupo;
  umaVez?: boolean;
}

export interface ClienteDosGrupos {
  lista(conta: string): Promise<ListaDosGrupos>;
  criar(conta: string, nome: string): Promise<string>;
  renomear(conta: string, id: string, nome: string): Promise<void>;
  convidar(conta: string, id: string, codinome: string): Promise<void>;
  convitesFeitos(conta: string, id: string): Promise<{ codinome: string; quando: number }[]>;
  responder(conta: string, convite: string, aceitar: boolean): Promise<void>;
  mensagens(conta: string, id: string): Promise<MensagemDoGrupo[]>;
  mandarTexto(conta: string, id: string, texto: string, opcoes: OpcoesDoGrupo): Promise<void>;
  mandarAnexo(conta: string, id: string, arquivo: Uint8Array<ArrayBuffer>, mime: string, duracaoMs: number, opcoes: OpcoesDoGrupo): Promise<void>;
  abrirAnexo(id: string, corpo: CorpoDeAnexo): Promise<Blob | null>;
  corpoDoAnexo(m: MensagemDoGrupo): CorpoDeAnexo | null;
  tirarAnexoDoDeposito(corpo: CorpoDeAnexo): Promise<void>;
  apagarMensagem(conta: string, id: string, mensagem: string): Promise<void>;
  pessoas(conta: string, id: string): Promise<PessoaDoGrupo[]>;
  codigo(conta: string, pessoa: { conta: string; identidade: string }): Promise<string>;
  tirar(conta: string, id: string, identidade: string): Promise<void>;
  sair(conta: string, id: string): Promise<void>;
  esquecer(conta: string, id: string): Promise<void>;
  marcarLido(conta: string, id: string): Promise<void>;
  /** Avisa a tela quando uma caixa de grupo foi lida pela agenda ou um convite chegou. Devolve a função que para de ouvir. */
  aoMudar(fazer: () => void): () => void;
}

const erro = (codigo: string) => Object.assign(new Error(codigo), { code: codigo });
const navegador = () => import("./navegador");
async function grupos(conta: string) {
  const g = await (await navegador()).gruposDaConta(conta);
  if (!g) throw erro("dm_sem_chave");
  return g;
}
/** Depois de mudar a lista (grupo novo, convite aceito, saída), a agenda passa a buscar as caixas certas. */
const acertar = () => navegador().then((n) => n.acertarVigias()).catch(() => undefined);

const deB64u = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4)), (c) => c.charCodeAt(0));

const gruposR2: ClienteDosGrupos = {
  async lista(conta) {
    const l = await (await grupos(conta)).lista();
    const naTela = (c: { g: string; nome: string; codinome: string; quando: number }): ConviteNaTela => ({ g: c.g, nome: c.nome, codinome: c.codinome, quando: c.quando });
    return { grupos: l.grupos, convites: l.convites.map(naTela), esperando: l.esperando.map(naTela) };
  },
  async criar(conta, nome) {
    const id = await (await grupos(conta)).criar(nome);
    await acertar();
    return id;
  },
  renomear: async (conta, id, nome) => (await grupos(conta)).renomear(id, nome),
  convidar: async (conta, id, codinome) => (await grupos(conta)).convidar(id, codinome),
  convitesFeitos: async (conta, id) => (await grupos(conta)).convitesFeitos(id),
  async responder(conta, convite, aceitar) {
    await (await grupos(conta)).responder(convite, aceitar);
    await acertar();
  },
  mensagens: async (conta, id) => (await grupos(conta)).mensagens(id),
  async mandarTexto(conta, id, texto, opcoes) {
    await (await grupos(conta)).mandarTexto(id, texto, { prazo: opcoes.prazo, umaVez: opcoes.umaVez });
  },
  /** Cifra NO APARELHO, sobe só o cifrado ao depósito (sem sessão, com passe anônimo) e manda a chave e o endereço dentro do grupo. */
  async mandarAnexo(conta, id, arquivo, mime, duracaoMs, opcoes) {
    const g = await grupos(conta);
    const { contextoDaConversa, montarCorpoDeAnexo, prepararAnexo } = await import("../anexo-cifrado");
    const dias: DiasDoAnexo = opcoes.prazo;
    const { cifrado, corpo } = await prepararAnexo(arquivo, mime, duracaoMs, contextoDaConversa("grupo", id), { dias, ...(opcoes.umaVez ? { umaVez: true } : {}) });
    const { depositarAnexo } = await import("../anexo-deposito");
    const endereco = await depositarAnexo(cifrado, dias);
    await g.mandarAnexo(id, montarCorpoDeAnexo({ ...corpo, endereco }));
  },
  async abrirAnexo(id, corpo) {
    const { baixarAnexo } = await import("../anexo-deposito");
    const { abrirAnexo, contextoDaConversa } = await import("../anexo-cifrado");
    const cifrado = await baixarAnexo(corpo);
    if (!cifrado) return null;
    const aberto = await abrirAnexo(cifrado, corpo, contextoDaConversa("grupo", id));
    return aberto ? new Blob([aberto], { type: corpo.mime }) : null;
  },
  corpoDoAnexo: (m) => (m.anexo ? lerCorpoDoAnexoGuardado(m.anexo) : null),
  async tirarAnexoDoDeposito(corpo) {
    const { tirarAnexo } = await import("../anexo-deposito");
    await tirarAnexo(corpo.endereco).catch(() => undefined);
  },
  apagarMensagem: async (conta, id, mensagem) => (await grupos(conta)).apagarMensagem(id, mensagem),
  pessoas: async (conta, id) => (await grupos(conta)).pessoas(id),
  codigo: async (conta, pessoa) => (await grupos(conta)).codigo(pessoa.conta, pessoa.identidade),
  tirar: async (conta, id, identidade) => (await grupos(conta)).tirar(id, identidade),
  async sair(conta, id) {
    await (await grupos(conta)).sair(id);
    await acertar();
  },
  esquecer: async (conta, id) => (await grupos(conta)).esquecer(id),
  marcarLido: async (conta, id) => (await grupos(conta)).marcarLido(id),
  aoMudar(fazer) {
    let parar: (() => void) | null = null;
    let vivo = true;
    void navegador().then((n) => {
      if (vivo) parar = n.aoMudarNosGrupos(() => fazer());
    }, () => undefined);
    return () => {
      vivo = false;
      parar?.();
    };
  },
};

/** O corpo do anexo guardado (base64url) lido de novo e conferido; null fora do formato. */
function lerCorpoDoAnexoGuardado(s: string): CorpoDeAnexo | null {
  try {
    return lerCorpoDeAnexo(deB64u(s));
  } catch {
    return null;
  }
}

export const gruposDoChat: ClienteDosGrupos = PREVIA ? dubleDosGrupos() : gruposR2;
