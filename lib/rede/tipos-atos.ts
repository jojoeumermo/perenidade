// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os tipos dos atos da Alumia (Onda 5, frente F2; PLANO-ALUMIA §5 "F2 · Atos" e §6). O que as funções do banco da F2 vão devolver
// (rede_atos, rede_ato, rede_ato_proximo, rede_ato_mudar): a etapa de back-end cria as funções com ESTE contrato.
// Sem os atalhos "@/" de propósito (roda no Node nos testes).
//
// Privacidade (LGPD art. 5º, II e art. 11: ir a um ato revela opinião política, dado sensível):
//   - nunca vem lista de quem confirmou; o mosaico recebe só a PROPORÇÃO acesa (passos de 10 %, nula abaixo de 3);
//   - o total exato de confirmações (`total`) só vem para quem organizou; para todo o resto vem nulo;
//   - "Perto" é a cidade que a pessoa escreveu, nunca a posição do aparelho; o ato traz só o ponto público dele.

/** A situação do ato (rede_chamados.situacao): confirmado, adiado (com a data de antes) ou cancelado. */
export type SituacaoDoAto = "confirmado" | "adiado" | "cancelado";

/** Os dois filtros da tela dos atos (prancha celular-modo-atos): pela cidade escrita, ou das comunidades/pessoas que sigo. */
export type FiltroDosAtos = "perto" | "seguindo";

/** A comunidade que chamou o ato (a pílula colorida). */
export interface ComunidadeDoAto {
  slug: string;
  nome: string;
  /** A cor que a comunidade escolheu (1–5, tokens --al-com-N). Sem ela, a cor sai do slug (corDaComunidade). */
  cor?: 1 | 2 | 3 | 4 | 5 | null;
}

/** Um ato como a tela mostra. `id` é o id do post do chamado (a conversa do ato é a conversa desse post). */
export interface Ato {
  id: string;
  /** O nome do ato como foi escrito ("Passe Livre Já"). */
  titulo: string;
  /** A palavra do mosaico (só A–Z e espaço, até 14; a mesma regra do banco). */
  palavra: string;
  comunidade: ComunidadeDoAto | null;
  /** Quem chamou: só o @nome público (pessoa ou organização), nunca o nome civil. */
  chamado_por: string | null;
  /** Quando começa (ISO). */
  inicio: string;
  /** A data de antes, quando foi adiado ("era 12/11"). */
  inicio_anterior: string | null;
  /** O ponto público do ato ("Praça da Sé") e o detalhe ("concentração na escadaria da catedral"). */
  onde: string;
  /** A cidade do ato, escrita por quem chamou (é ela que põe o ato em "Perto"). */
  cidade: string;
  /** O chamado: o texto que diz por que ir e o que levar. */
  descricao: string;
  situacao: SituacaoDoAto;
  /** Por que foi cancelado ou adiado ("cancelada pela chuva · nova data em breve"); vazio se não houver. */
  motivo: string;
  /** A proporção acesa do mosaico (0,1 … 1); nula abaixo de 3 confirmações. NUNCA um número de pessoas. */
  acesos: number | null;
  /** Só para quem organizou: quantas pessoas confirmaram. Para os outros, nulo. */
  total: number | null;
  /** A própria pessoa confirmou ("Você vai"). */
  vou_eu: boolean;
  /** Quem está vendo organizou o ato (pode adiar, cancelar e ver o total). */
  meu: boolean;
  /** Respostas na conversa do ato que esta pessoa pode ver (as respostas podem ser públicas; pessoas, nunca). */
  respostas: number;
  /** Link externo de apoio (vaquinha, fundo de greve): só https; nada de pagamento aqui. */
  link_apoio: string | null;
}

/** Uma página de atos (40 por vez no máximo). `proximo` é o cursor da próxima, nulo quando acabou. */
export interface PaginaDeAtos {
  itens: Ato[];
  proximo: string | null;
}

/** O que o "Você vai" devolve: a nova proporção (o mosaico acende na hora) e, só para quem organizou, o total. */
export interface RespostaDoVou {
  vou_eu: boolean;
  acesos: number | null;
  total: number | null;
}

/** O pedido de mudar a situação (só quem organizou): adiar pede a nova data; o aviso "ato_mudou" vai só a quem confirmou. */
export interface PedidoDeMudanca {
  situacao: SituacaoDoAto;
  /** Nova data (ISO) quando adia. */
  inicio?: string | null;
  motivo?: string;
}

/** O que o formulário do ato (tipo "Ato" no compositor) entrega ao compositor, para ir junto no rede_publicar. */
export interface DadosDoAto {
  tipo: "ato";
  titulo: string;
  palavra: string;
  /** ISO, com o fuso do aparelho de quem escreveu. */
  quando: string | null;
  onde: string;
  cidade: string;
  descricao: string;
  /** O formulário está pronto para publicar? (o servidor confere de novo). */
  pronto: boolean;
  /** Os problemas, por campo, para o compositor mostrar. */
  problemas: Partial<Record<"titulo" | "quando" | "onde" | "cidade" | "descricao", "vazio" | "curto" | "longo" | "passado" | "longe" | "palavra">>;
}

/** Os limites do formulário (os mesmos do banco: rede_chamados e rede_publicar). */
export const LIMITES_DO_ATO = {
  tituloMin: 2,
  tituloMax: 60,
  ondeMin: 3,
  ondeMax: 140,
  cidadeMin: 2,
  cidadeMax: 80,
  descricaoMax: 500,
  /** Até um ano à frente (rede_publicar: quando > now() + 365 days é inválido). */
  diasMax: 365,
} as const;

/** A cor guardada da comunidade, se for uma das 5 (o resto vira indefinido e a pílula usa a cor pelo slug). */
export function corValida(cor: unknown): 1 | 2 | 3 | 4 | 5 | undefined {
  return cor === 1 || cor === 2 || cor === 3 || cor === 4 || cor === 5 ? cor : undefined;
}
