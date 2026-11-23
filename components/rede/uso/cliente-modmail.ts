// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// "Falar com a moderação" (R1): as chamadas ao banco (supabase/migracoes/20261123-r1-uso.sql) e o dublê da prévia
// (NEXT_PUBLIC_ALUMIA_PREVIA=sim), que guarda tudo só na memória da aba. O banco confere tudo de novo: o interruptor
// "alumia-falar-moderacao", quem pode ler cada conversa, os limites e o tamanho do texto. Nunca vem quem da mediação escreveu.
import { chamar, type Chamar } from "../../../lib/rede/cliente";

export interface ConversaComAMediacao {
  id: string;
  comunidade: string;
  nome: string;
  numero: number;
  situacao: "aberta" | "encerrada";
  atualizada_em: string;
  com_codinome: boolean;
  /** Há resposta que o lado de quem chama ainda não leu. */
  nova: boolean;
  /** Só para a mediação, e só quando a pessoa escolheu mostrar. */
  codinome: string | null;
}

export interface MensagemDaConversa {
  de: "pessoa" | "mediacao";
  texto: string;
  em: string;
  minha: boolean;
}

export interface ConversaInteira extends ConversaComAMediacao {
  lado: "pessoa" | "mediacao";
  mensagens: MensagemDaConversa[];
}

export const LIMITE_DO_TEXTO = 2000;

/** O cliente sobre uma forma de chamar (os testes passam uma simulada). */
export function criarClienteModmail(c: Chamar) {
  return {
    ligado: () => c<boolean>("rede_modmail_ligado"),
    abrir: (comunidade: string, texto: string, comCodinome: boolean) => c<ConversaComAMediacao>("rede_modmail_abrir", { p_comunidade: comunidade, p_texto: texto, p_com_codinome: comCodinome }),
    minhas: () => c<ConversaComAMediacao[]>("rede_modmail_minhas"),
    caixa: (comunidade: string) => c<ConversaComAMediacao[]>("rede_modmail_caixa", { p_comunidade: comunidade }),
    conversa: (id: string) => c<ConversaInteira>("rede_modmail_conversa", { p_id: id }),
    escrever: (id: string, texto: string) => c<ConversaComAMediacao>("rede_modmail_escrever", { p_id: id, p_texto: texto }),
    encerrar: (id: string) => c<ConversaComAMediacao>("rede_modmail_encerrar", { p_id: id }),
  };
}

export type ClienteModmail = ReturnType<typeof criarClienteModmail>;

/**
 * O dublê da prévia: a Faísca escreveu uma vez para a mediação da comunidade de exemplo, que já respondeu. Na caixa da mediação,
 * a conversa nº 2 é de alguém que não mostrou o codinome. Nada sai da aba.
 */
export function criarDubleDaPrevia(): ClienteModmail {
  const agora = Date.now();
  const iso = (min: number) => new Date(agora + min * 60_000).toISOString();
  type Linha = ConversaInteira & { autoraSouEu: boolean };
  const linhas: Linha[] = [
    {
      id: "previa-1", comunidade: "", nome: "", numero: 1, situacao: "aberta", atualizada_em: iso(-90), com_codinome: false, nova: true, codinome: null,
      lado: "pessoa", autoraSouEu: true,
      mensagens: [
        { de: "pessoa", texto: "Meu post sobre a assembleia sumiu da linha. Foi removido? Queria entender a regra.", em: iso(-240), minha: true },
        { de: "mediacao", texto: "Oi! Ele foi escondido pelo filtro de links. Já liberamos: era um link conferido. Obrigada por avisar.", em: iso(-90), minha: false },
      ],
    },
    {
      id: "previa-2", comunidade: "", nome: "", numero: 2, situacao: "aberta", atualizada_em: iso(-30), com_codinome: false, nova: true, codinome: null,
      lado: "mediacao", autoraSouEu: false,
      mensagens: [{ de: "pessoa", texto: "Posso divulgar aqui a vaquinha da ocupação do bairro?", em: iso(-30), minha: false }],
    },
    {
      id: "previa-3", comunidade: "", nome: "", numero: 3, situacao: "encerrada", atualizada_em: iso(-3000), com_codinome: true, nova: false, codinome: "Brasa",
      lado: "mediacao", autoraSouEu: false,
      mensagens: [
        { de: "pessoa", texto: "Pedido de revisão da remoção do meu comentário.", em: iso(-3200), minha: false },
        { de: "mediacao", texto: "Revisamos e o comentário voltou. Conversa encerrada.", em: iso(-3000), minha: false },
      ],
    },
  ];
  const espera = () => new Promise((r) => setTimeout(r, 200));
  const item = (l: Linha, lado: "pessoa" | "mediacao"): ConversaComAMediacao => ({
    id: l.id, comunidade: l.comunidade, nome: l.nome, numero: l.numero, situacao: l.situacao, atualizada_em: l.atualizada_em,
    com_codinome: l.com_codinome, nova: l.nova, codinome: lado === "mediacao" && l.com_codinome ? l.codinome : null,
  });
  const achar = (id: string) => {
    const l = linhas.find((x) => x.id === id);
    if (!l) throw new Error("nao_encontrado");
    return l;
  };
  return {
    ligado: async () => true,
    abrir: async (comunidade, texto, comCodinome) => {
      await espera();
      const limpo = texto.trim();
      if (!limpo || limpo.length > LIMITE_DO_TEXTO) throw new Error("invalido:texto");
      const l: Linha = {
        id: `previa-${linhas.length + 1}`, comunidade, nome: "", numero: linhas.length + 1, situacao: "aberta", atualizada_em: new Date().toISOString(),
        com_codinome: comCodinome, nova: false, codinome: comCodinome ? "Faísca" : null, lado: "pessoa", autoraSouEu: true,
        mensagens: [{ de: "pessoa", texto: limpo, em: new Date().toISOString(), minha: true }],
      };
      linhas.unshift(l);
      return item(l, "pessoa");
    },
    minhas: async () => {
      await espera();
      return linhas.filter((l) => l.autoraSouEu).map((l) => item(l, "pessoa"));
    },
    caixa: async () => {
      await espera();
      return linhas.filter((l) => !l.autoraSouEu).map((l) => item(l, "mediacao"));
    },
    conversa: async (id) => {
      await espera();
      const l = achar(id);
      const lado = l.autoraSouEu ? "pessoa" : "mediacao";
      l.nova = false;
      return { ...item(l, lado), lado, mensagens: l.mensagens.map((m) => ({ ...m })) };
    },
    escrever: async (id, texto) => {
      await espera();
      const l = achar(id);
      if (l.situacao !== "aberta") throw new Error("encerrada");
      const lado = l.autoraSouEu ? "pessoa" : "mediacao";
      l.mensagens.push({ de: lado, texto: texto.trim(), em: new Date().toISOString(), minha: true });
      l.atualizada_em = new Date().toISOString();
      return item(l, lado);
    },
    encerrar: async (id) => {
      await espera();
      const l = achar(id);
      l.situacao = "encerrada";
      return item(l, l.autoraSouEu ? "pessoa" : "mediacao");
    },
  };
}

let duble: ClienteModmail | null = null;
let real: ClienteModmail | null = null;

/** O cliente de verdade, ou o dublê na prévia (um só por aba: as telas o usam em dependências de efeito). */
export function clienteModmail(previa: boolean): ClienteModmail {
  if (!previa) return (real ??= criarClienteModmail(chamar));
  duble ??= criarDubleDaPrevia();
  return duble;
}

/** O código curto do erro do banco ("muitas_abertas", "invalido:texto" → "invalido"…), para a tela traduzir. */
export function codigoDoModmail(e: unknown): string {
  const bruto = String((e as { code?: unknown })?.code ?? (e as { message?: unknown })?.message ?? e);
  const achado = ["muitas_abertas", "encerrada", "muitos_pedidos", "desligado", "nao_encontrado", "sem_permissao"].find((c) => bruto.includes(c));
  if (achado) return achado === "sem_permissao" ? "nao_encontrado" : achado;
  if (bruto.includes("invalido")) return "invalido";
  return "falha";
}
