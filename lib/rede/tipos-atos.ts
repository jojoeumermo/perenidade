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
  /** A meta de presença que a organização publicou (3–30000; é um número dela, não uma contagem). O mosaico divide por max(30, meta). */
  meta?: number | null;
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
  /** A meta de presença (opcional, 3–30000). */
  meta?: number | null;
  /** O link externo de apoio (opcional, só https). */
  link_apoio?: string | null;
  /** O formulário está pronto para publicar? (o servidor confere de novo). */
  pronto: boolean;
  /** Os problemas, por campo, para o compositor mostrar. */
  problemas: Partial<Record<"titulo" | "quando" | "onde" | "cidade" | "descricao" | "meta" | "link_apoio", "vazio" | "curto" | "longo" | "passado" | "longe" | "palavra" | "numero" | "link">>;
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
  metaMin: 3,
  metaMax: 30000,
  linkMax: 300,
  tarefaMin: 2,
  tarefaMax: 80,
  tarefaQuantosMax: 50,
  saidaMin: 3,
  saidaMax: 100,
  vagasMax: 60,
  alvoMin: 3,
  alvoMax: 120,
  peticaoMin: 20,
  peticaoMax: 1500,
} as const;

// ───── Farol do ato (ALUMIA-FUNCOES-E-IDEIAS §2.1, ideia 1; supabase/migracoes/20261110-alumia-atos.sql) ─────

/** Os quatro estados do farol: tranquilo (verde), atenção (âmbar), dispersar (vermelho), ponto de encontro 2 (azul, com o texto). */
export type EstadoDoFarol = "tranquilo" | "atencao" | "dispersar" | "ponto2";
export const ESTADOS_DO_FAROL: readonly EstadoDoFarol[] = ["tranquilo", "atencao", "dispersar", "ponto2"];

/** O farol como a tela recebe. Só vem para quem confirmou presença ou coordena (para os outros, nulo). */
export interface FarolDoAto {
  estado: EstadoDoFarol;
  /** O novo ponto, quando o estado é ponto2; vazio nos outros. */
  texto: string;
  /** Quando a coordenação mudou o farol pela última vez (nulo: nunca mudou). */
  mudado_em: string | null;
  /** Quem lê coordena o ato (pode pedir e confirmar mudança). */
  coordena: boolean;
  /** Só para quem coordena: o pedido esperando a segunda pessoa (15 min). `meu` diz se foi esta pessoa que pediu; quem, nunca. */
  pendente: { estado: EstadoDoFarol; texto: string; meu: boolean; expira_em: string } | null;
}

// ───── Corrente de solidariedade (ideia 7) ─────

/** Uma corrente aberta por uma organização com selo, para uma cidade escrita. */
export interface Corrente {
  id: string;
  /** "Precisamos de 30 pessoas às 5h na ocupação Esperança." */
  texto: string;
  cidade: string;
  /** A meta que a organização publicou (é um número dela, não uma contagem de quem vai). */
  meta: number;
  quando: string | null;
  expira_em: string;
  org: { handle: string | null; nome: string };
  /** A proporção de elos fechados (passos de 10 %), nula abaixo de 3 respostas. NUNCA um número de pessoas. */
  elos: number | null;
  fechada: boolean;
  vou_eu: boolean;
  /** Só para quem age como a organização que abriu; para os outros, nulo. */
  total: number | null;
}

/** Uma organização com selo que esta pessoa gerencia (para abrir corrente). */
export interface OrgQuePosso {
  id: string;
  handle: string | null;
  nome: string;
}

/** O pedido de abrir uma corrente. */
export interface PedidoDeCorrente {
  org: string;
  texto: string;
  cidade: string;
  meta: number;
  quando: string | null;
}

// ───── B1 · quadro de tarefas, caronas e petição (supabase/migracoes/20261110-alumia-b1-atos.sql) ─────

/** Uma tarefa do ato ("caixa de som", 1). `quem` (codinomes) e `assumidas` só vêm para quem organiza; para os outros, nulos. */
export interface TarefaDoAto {
  id: string;
  item: string;
  /** Quantas pessoas a organização pediu (o número é dela, não uma contagem de quem assumiu). */
  quantos: number;
  /** Já tem quem leve (o público vê só isto: nunca quantas pessoas nem quem). */
  completa: boolean;
  /** Esta pessoa assumiu. */
  eu: boolean;
  assumidas: number | null;
  quem: string[] | null;
}

export interface QuadroDeTarefas {
  /** Quem lê organiza o ato (pode pôr e tirar tarefas, vê os codinomes). */
  organiza: boolean;
  tarefas: TarefaDoAto[];
}

export type TipoDeCarona = "oferta" | "pedido";
export type MeioDaCarona = "carro" | "onibus" | "van" | "bicicleta" | "a_pe" | "outro";
export const MEIOS_DA_CARONA: readonly MeioDaCarona[] = ["carro", "onibus", "van", "bicicleta", "a_pe", "outro"];

/** Uma carona (ou pedido de carona). Nunca vem quem ofereceu: só se é desta pessoa. O contato é só pelo chat privado. */
export interface CaronaDoAto {
  id: string;
  tipo: TipoDeCarona;
  meio: MeioDaCarona;
  /** O ponto PÚBLICO de saída ("Metrô Itaquera, saída B"): nada de endereço com número nem telefone. */
  saida: string;
  /** Vagas (0 = lotada; nulo = não disse). */
  vagas: number | null;
  sai_em: string | null;
  minha: boolean;
  /** Esta pessoa pode tirar (a dona, ou quem organiza o ato). */
  apagar: boolean;
}

export interface PedidoDeCarona {
  tipo: TipoDeCarona;
  meio: MeioDaCarona;
  saida: string;
  vagas?: number | null;
  sai_em?: string | null;
}

/** A petição do ato: total só a partir de 3 (e do último marco de 15 min); nunca quem assinou, para ninguém. Nunca federa. */
export interface PeticaoDoAto {
  id: string;
  ato: string;
  alvo: string;
  texto: string;
  prazo: string | null;
  aberta: boolean;
  total: number | null;
  assinei: boolean;
  organiza: boolean;
}

export interface PedidoDePeticao {
  alvo: string;
  texto: string;
  prazo?: string | null;
}

/** O que quem organizou pode editar depois de chamar. Só as chaves presentes mudam; nulo ou vazio tira. */
export interface EdicaoDoAto {
  meta?: number | null;
  link_apoio?: string | null;
}

/** A cor guardada da comunidade, se for uma das 5 (o resto vira indefinido e a pílula usa a cor pelo slug). */
export function corValida(cor: unknown): 1 | 2 | 3 | 4 | 5 | undefined {
  return cor === 1 || cor === 2 || cor === 3 || cor === 4 || cor === 5 ? cor : undefined;
}
