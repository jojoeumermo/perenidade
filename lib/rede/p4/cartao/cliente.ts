// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As chamadas do grupo "cartão do post" do prompt 4 (supabase/migracoes/20261127-p4-cartao-do-post.sql): a lista de reações da
// comunidade (item 30) e a pasta dos salvos que vira coleção pública (item 35). Atrás de "alumia-p4-cartao-do-post" (o banco confere
// de novo em cada chamada). Com NEXT_PUBLIC_ALUMIA_PREVIA=sim, um dublê na memória da aba e nada vai ao servidor.
// Privacidade: nenhuma resposta diz quem reagiu, quem da mediação mudou a lista nem quem viu a coleção. Sem "@/" de propósito.
import { chamar, type Chamar } from "../../cliente";
import { REACOES } from "../../tipos-conversa";
import { MAXIMO_DE_EMOJIS } from "./regras";

export const PREVIA_DO_CARTAO = process.env.NEXT_PUBLIC_ALUMIA_PREVIA === "sim";

/** A lista de reações de uma comunidade, como o banco manda (public.rede_p4_reacoes_da_comunidade). */
export interface ReacoesDaComunidade {
  emojis: string[];
  padrao: string[];
  /** A lista é a própria da mediação (e não a fechada de 8)? */
  propria: boolean;
  /** Quem chama pode mudar (é da mediação e o grupo está ligado)? */
  pode_mudar: boolean;
  maximo: number;
}

/** A resposta de tornar uma pasta pública: `ficou_fora` diz só SE algum post ficou só na pasta, nunca quantos nem quais. */
export interface PastaPublica {
  publica: boolean;
  colecao: string | null;
  ficou_fora: boolean;
}

export interface ClienteDoCartao {
  readonly previa: boolean;
  reacoesDaComunidade: (slug: string) => Promise<ReacoesDaComunidade>;
  /** Lista vazia: volta à fechada de 8. */
  mudarReacoes: (slug: string, emojis: string[]) => Promise<{ emojis: string[]; propria: boolean }>;
  tornarPublica: (pasta: string, sim: boolean, titulo?: string | null, descricao?: string) => Promise<PastaPublica>;
  pastasPublicas: () => Promise<{ ligado: boolean; itens: { pasta: string; colecao: string }[] }>;
}

/** O cliente de verdade sobre uma forma de chamar (os testes passam uma simulada). */
export function criarClienteDoCartao(c: Chamar): ClienteDoCartao {
  return {
    previa: false,
    reacoesDaComunidade: (slug) => c<ReacoesDaComunidade>("rede_p4_reacoes_da_comunidade", { p_slug: slug }),
    mudarReacoes: (slug, emojis) => c<{ emojis: string[]; propria: boolean }>("rede_p4_reacoes_mudar", { p_slug: slug, p_emojis: emojis.slice(0, MAXIMO_DE_EMOJIS + 1) }),
    tornarPublica: (pasta, sim, titulo = null, descricao = "") =>
      c<PastaPublica>("rede_p4_pasta_publica", { p_pasta: pasta, p_sim: sim, p_titulo: titulo, p_descricao: descricao }),
    pastasPublicas: () => c<{ ligado: boolean; itens: { pasta: string; colecao: string }[] }>("rede_p4_pastas_publicas", {}),
  };
}

/**
 * O dublê da prévia: a comunidade "marxismo" (a da conversa de exemplo) já tem uma lista própria e quem olha é da mediação, para a tela
 * mostrar as duas coisas. Tudo fica só na memória da aba.
 */
export function criarClienteDaPrevia(): ClienteDoCartao {
  const padrao = REACOES.map((r) => r.emoji);
  const listas = new Map<string, string[]>([["marxismo", ["✊", "📚", "💡", "🌻"]]]);
  const publicas = new Map<string, string>();
  return {
    previa: true,
    reacoesDaComunidade: async (slug) => {
      const propria = listas.get(slug);
      return { emojis: propria ?? padrao, padrao, propria: Boolean(propria), pode_mudar: true, maximo: MAXIMO_DE_EMOJIS };
    },
    mudarReacoes: async (slug, emojis) => {
      if (emojis.length === 0) listas.delete(slug);
      else listas.set(slug, [...emojis]);
      return { emojis: emojis.length === 0 ? padrao : [...emojis], propria: emojis.length > 0 };
    },
    tornarPublica: async (pasta, sim) => {
      if (!sim) {
        publicas.delete(pasta);
        return { publica: false, colecao: null, ficou_fora: false };
      }
      const colecao = publicas.get(pasta) ?? `colecao-${pasta}`;
      publicas.set(pasta, colecao);
      return { publica: true, colecao, ficou_fora: true };
    },
    pastasPublicas: async () => ({ ligado: true, itens: [...publicas].map(([pasta, colecao]) => ({ pasta, colecao })) }),
  };
}

/** O cliente desta montagem: o dublê na prévia, o de verdade fora dela. */
export const clienteDoCartao: ClienteDoCartao = PREVIA_DO_CARTAO ? criarClienteDaPrevia() : criarClienteDoCartao(chamar);
