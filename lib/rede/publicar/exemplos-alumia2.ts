// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os dados de EXEMPLO da cara nova da Alumia (F1), tirados das pranchas (docs/plano-2026-11/alumia-pranchas: computador-inicio,
// celular-inicio). Só aparecem com NEXT_PUBLIC_ALUMIA_PREVIA=sim (previaLigada, ./alumia2.ts), para conferir as telas sem banco;
// nunca em produção e nunca misturados com post de verdade. São personagens inventados das pranchas, com codinome (nunca nome
// civil, INVENTARIO §1) e sem nenhum número de pessoa abaixo de 3. Sem os atalhos "@/" de propósito (roda no Node nos testes).
import type { EnqueteDoPost } from "../tipos-publicar";
import type { Post, Situacao } from "../tipos";
import type { CorDaComunidadeNum } from "./alumia2";

/** A situação de exemplo: a Faísca, membro, com @nome escolhido. */
export const SITUACAO_DE_EXEMPLO: Situacao = {
  logado: true,
  membro: true,
  maior: true,
  regras_versao: 1,
  codinome: "Faísca",
  codinome_ok: true,
  handle: "faisca",
  modo: "aberto",
  equipe: false,
  cuida: false,
};

/** As comunidades das pranchas, com a cor de cada uma (os tokens --al-com-1..5). */
export const COMUNIDADES_DE_EXEMPLO: Record<string, { nome: string; cor: CorDaComunidadeNum; posts_7d: number }> = {
  "passe-livre-sp": { nome: "Passe Livre SP", cor: 1, posts_7d: 214 },
  "estudantes-ufpe": { nome: "Estudantes UFPE", cor: 2, posts_7d: 168 },
  "moradia-zona-leste": { nome: "Moradia Zona Leste", cor: 3, posts_7d: 121 },
  "marxismo-aula": { nome: "Marxismo · aula em debate", cor: 4, posts_7d: 97 },
  "cultura-hip-hop": { nome: "Cultura e hip-hop", cor: 5, posts_7d: 64 },
};

const MIN = 60_000;

function base(id: string, agora: number, minutos: number): Post {
  return {
    id,
    tipo: "post",
    titulo: null,
    texto: "",
    corpo: null,
    longo: false,
    comunidade: null,
    flair: null,
    publico: "membros",
    criado_em: new Date(agora - minutos * MIN).toISOString(),
    editado_em: null,
    fixado: false,
    travado: false,
    aceita: null,
    verificada: false,
    resposta_a: null,
    raiz: id,
    nivel: 0,
    aviso: "",
    cita: null,
    chamado: null,
    meu: false,
    retido: false,
    motivo: "",
    modero: false,
    autor: { id: null, codinome: "", handle: null, perfil: true, equipe: false },
    respostas: 0,
    na_conversa: null,
    util: 0,
    util_eu: false,
    apoios: null,
    apoiei: false,
    salvei: false,
    vou: null,
    vou_eu: false,
    midia: [],
    citado: null,
  };
}

/** Os cinco posts das pranchas, do mais novo ao mais antigo (ordem de chegada). Ids começam com "exemplo-": nunca vão ao banco. */
export function postsDeExemplo(agora: number = Date.now()): Post[] {
  const amanha11 = new Date(agora + 86_400_000);
  amanha11.setHours(11, 0, 0, 0);
  return [
    {
      ...base("exemplo-rosa", agora, 12),
      comunidade: "estudantes-ufpe",
      texto:
        "Assembleia do DCE aprovou paralisação na quinta. Quem é de Recife e não sabe por onde começar: o núcleo vai panfletar no RU amanhã, cola com a gente. Leva água e uma caneta.",
      autor: { id: "exemplo-rosa", codinome: "Rosa Vermelha", handle: "rosavermelha", perfil: true, equipe: false },
      chamado: { tipo: "Panfletagem no RU", quando: amanha11.toISOString(), onde: "Restaurante Universitário, Recife", situacao: "confirmado" },
      respostas: 14,
      apoiei: true,
    },
    {
      ...base("exemplo-mandata", agora, 25),
      comunidade: "passe-livre-sp",
      texto:
        "Prestação de contas da semana: votamos contra o reajuste da tarifa na Câmara (passou por 31 a 18). Quinta, 19h, plenária aberta aqui na Alumia: mande sua pergunta, a gente responde ao vivo, em ordem de chegada.",
      autor: { id: "exemplo-mandata", codinome: "Mandata Popular", handle: "mandatapopular", perfil: true, equipe: false },
      org: { handle: "mandatapopular", codinome: "Mandata Popular", verificada_em: "2026-10-02" },
      respostas: 52,
      apoiei: true,
    },
    {
      ...base("exemplo-tiao", agora, 34),
      comunidade: "moradia-zona-leste",
      texto:
        "A ocupação Esperança recebeu ordem de despejo para segunda. São 140 famílias. A Defensoria entrou com recurso hoje; precisamos de gente na porta às 6h, e de quem saiba filmar com o celular na horizontal.",
      autor: { id: "exemplo-tiao", codinome: "Tião do Morro", handle: "tiao@mastodon.social", perfil: true, equipe: false },
      respostas: 27,
    },
    {
      ...base("exemplo-lia", agora, 60),
      comunidade: "marxismo-aula",
      texto:
        "Fiz a aula de mais-valia e fiquei pensando no meu turno de entrega: 9 horas na rua, e a taxa de cada corrida cai toda semana. Alguém já calculou quanto do valor da corrida fica com o app?",
      autor: { id: "exemplo-lia", codinome: "Lia Quilombo", handle: "liaquilombo", perfil: true, equipe: false },
      cita: { tipo: "aula", caminho: "/escola/marxismo/o-que-e-mais-valia", titulo: "O que é mais-valia" },
      respostas: 31,
      apoiei: true,
    },
    {
      ...base("exemplo-cohab", agora, 120),
      tipo: "enquete",
      comunidade: "cultura-hip-hop",
      texto: "Círculo de estudo de sábado: vamos ler o capítulo sobre trabalho e cultura e depois tem roda de rima. Que horas fica melhor pra vocês?",
      autor: { id: "exemplo-cohab", codinome: "Núcleo Cohab 2", handle: "nucleocohab2", perfil: true, equipe: false },
      respostas: 9,
    },
  ];
}

/**
 * Os "3 posts novos" da prévia: chegam no alto quando a pessoa toca na pílula, para a entrada dos cartões novos poder ser vista
 * (sem eles, a lista voltava igual). Também "exemplo-…": nunca vão ao banco.
 */
export function postsNovosDeExemplo(agora: number = Date.now()): Post[] {
  return [
    {
      ...base("exemplo-novo-sara", agora, 0.5),
      comunidade: "passe-livre-sp",
      texto: "Saiu a pauta da plenária de quinta: tarifa, linhas cortadas na zona sul e a passagem da madrugada. Quem quiser propor ponto, manda até quarta.",
      autor: { id: "exemplo-sara", codinome: "Sara do Grajaú", handle: "saradograjau", perfil: true, equipe: false },
      respostas: 3,
    },
    {
      ...base("exemplo-novo-joao", agora, 1),
      comunidade: "estudantes-ufpe",
      texto: "Faixas prontas para a paralisação. Faltam mãos para pendurar no CFCH amanhã às 7h.",
      autor: { id: "exemplo-joao", codinome: "João Candeeiro", handle: "joaocandeeiro", perfil: true, equipe: false },
      respostas: 5,
    },
    {
      ...base("exemplo-novo-cohab", agora, 2),
      comunidade: "moradia-zona-leste",
      texto: "Atualização da Esperança: a Defensoria conseguiu mais 15 dias. A vigília de segunda continua de pé, só que agora para a assembleia das famílias.",
      autor: { id: "exemplo-cohab", codinome: "Núcleo Cohab 2", handle: "nucleocohab2", perfil: true, equipe: false },
      respostas: 11,
    },
  ];
}

/** A enquete do post de exemplo (61 votos, 42/35/23 %, fecha em 1 dia), como `rede_pub_detalhes` devolveria. */
export function enqueteDeExemplo(agora: number = Date.now()): EnqueteDoPost {
  return {
    prazo: new Date(agora + 86_400_000).toISOString(),
    multipla: false,
    encerrada: false,
    votei: ["exemplo-10h"],
    total: 61,
    opcoes: [
      { id: "exemplo-10h", texto: "10h", votos: 26 },
      { id: "exemplo-14h", texto: "14h", votos: 21 },
      { id: "exemplo-16h", texto: "16h", votos: 14 },
    ],
  };
}

/** O ato das pranchas (o dublê da F2 na prévia): Passe Livre Já, sexta 18h, Praça da Sé. */
export function atoDeExemplo(agora: number = Date.now()) {
  const inicio = new Date(agora + 2 * 86_400_000 + 4 * 3_600_000 + 20 * MIN);
  return {
    id: "exemplo-ato-passe-livre",
    nome: "Passe Livre Já",
    palavra: "PASSE LIVRE",
    comunidade: "passe-livre-sp",
    chamadoPor: "@passelivre_sp",
    quando: inicio.toISOString(),
    quandoTexto: "Sexta, 15 de novembro, 18h",
    curto: "sex 15/11, 18h · Praça da Sé",
    onde: "Praça da Sé, São Paulo",
    detalhe: "concentração na escadaria da catedral",
    proporcao: 0.6,
    conversa: 48,
  };
}

/** Os atos perto (dublê da F2 na prévia) e a plenária ao vivo (dublê da F4). */
export const ATOS_PERTO_DE_EXEMPLO = [
  { dia: "15", mes: "NOV", nome: "Passe Livre Já", linha: "Praça da Sé · sex 18h", situacao: "confirmado" as const },
  { dia: "19", mes: "NOV", nome: "Vigília na ocupação Esperança", linha: "Itaquera · ter 6h · era 12/11", situacao: "adiado" as const },
  { dia: "09", mes: "NOV", nome: "Aula pública no vão do MASP", linha: "cancelada pela chuva · nova data em breve", situacao: "cancelado" as const },
];

export const PLENARIA_DE_EXEMPLO = {
  titulo: "Plenária aberta com a Mandata Popular",
  texto: "A base pergunta, o mandato responde. Perguntas em ordem de chegada, sem filtro de assessoria.",
  naSala: 1204,
};
