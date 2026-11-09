// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os dados de EXEMPLO das telas novas da F3 (PLANO-ALUMIA §8 F3): a comunidade, a conversa e "Comunidades ativas" exatamente
// como nas pranchas (docs/plano-2026-11/alumia-pranchas/celular-comunidade.png, celular-conversa-fediverso.png e
// computador-inicio.webp). Só valem com NEXT_PUBLIC_ALUMIA_PREVIA=sim (máquina de quem desenvolve e fotos de conferência): em
// produção a variável não existe e as telas falam com o banco. Todos os nomes são codinomes inventados; nenhuma pessoa real.
// Sem "@/" de propósito (roda no Node nos testes).
import type { Post } from "../tipos";
import type { Arvore, PostDaArvore } from "../tipos-conversa";
import type { ItemDaLista, PaginaDaComunidade } from "../tipos-comunidades";

/** A prévia com dados de exemplo está ligada? Só com NEXT_PUBLIC_ALUMIA_PREVIA=sim (o Next troca o valor na hora de montar). */
export function previaDaAlumiaLigada(): boolean {
  return process.env.NEXT_PUBLIC_ALUMIA_PREVIA === "sim";
}

const MIN = 60_000;
const antes = (minutos: number, agora: number) => new Date(agora - minutos * MIN).toISOString();

/** Um post de exemplo com tudo o que o contrato pede; só o que muda vem em `p`. */
export function postDeExemplo(p: Partial<Post> & Pick<Post, "id" | "texto">, agora: number = Date.now()): Post {
  return {
    tipo: "post",
    titulo: null,
    corpo: null,
    longo: false,
    comunidade: null,
    flair: null,
    publico: "membros",
    criado_em: antes(60, agora),
    editado_em: null,
    fixado: false,
    travado: false,
    aceita: null,
    verificada: false,
    resposta_a: null,
    raiz: p.id,
    nivel: 0,
    aviso: "",
    cita: null,
    chamado: null,
    meu: false,
    retido: false,
    motivo: "",
    modero: false,
    autor: { id: null, codinome: "Faísca", handle: "faisca", perfil: true, equipe: false },
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
    ...p,
  };
}

const ID = {
  fixado: "00000000-0000-4000-8000-0000000000f1",
  bruno: "00000000-0000-4000-8000-0000000000b1",
  mandata: "00000000-0000-4000-8000-0000000000a1",
  lia: "00000000-0000-4000-8000-0000000000c1",
  r1: "00000000-0000-4000-8000-0000000000c2",
  r2: "00000000-0000-4000-8000-0000000000c3",
  r3: "00000000-0000-4000-8000-0000000000c4",
} as const;
export const IDS_DE_EXEMPLO = ID;

/** A página da comunidade "Passe Livre SP" da prancha celular-comunidade. */
export function paginaDeExemplo(slug: string, agora: number = Date.now()): PaginaDaComunidade {
  return {
    comunidade: {
      slug,
      nome: "Passe Livre SP",
      descricao: "Pela tarifa zero no transporte de São Paulo. Atos, contas da tarifa e quem decide o preço da passagem.",
      categoria: "lutas",
      tipo: "aberta",
      publico_padrao: "membros",
      icone: "",
      cor: "#1fc2b5",
      aulas: ["economia-politica/quem-paga-a-tarifa"],
      trilhas: ["economia-politica"],
      regras: [
        { numero: 1, titulo: "Codinome sempre", texto: "Nada de nome civil, endereço, placa ou rosto de quem não pediu." },
        { numero: 2, titulo: "Fonte nas contas", texto: "Número de tarifa vem com a fonte (planilha, lei, diário oficial)." },
        { numero: 3, titulo: "Sem ataque a pessoa", texto: "Critique a decisão e quem decide, não a pessoa que comenta." },
        { numero: 4, titulo: "Ato com lugar público", texto: "Ponto de encontro só em lugar público; nada de casa de ninguém." },
      ],
      etiquetas: [{ nome: "Ato", cor: "#e8321f" }, { nome: "Contas", cor: "#ffc21a" }],
      moderacao: ["Catraca Livre", "Marta Sé"],
      membro: false,
      banido: false,
    },
    situacao: null,
    modero: false,
    pedidos: null,
    fixados: [
      postDeExemplo(
        {
          id: ID.fixado,
          titulo: "Sexta tem ato: como vai funcionar",
          texto: "Concentração 17h30 na escadaria da Sé. Quem tiver faixa, traga. Equipe de cuidado de colete amarelo.",
          comunidade: slug,
          fixado: true,
          autor: { id: null, codinome: "Catraca Livre", handle: "catracalivre", perfil: true, equipe: false },
          criado_em: antes(60 * 26, agora),
          respostas: 9,
        },
        agora,
      ),
    ],
  };
}

/** Os posts da comunidade (a linha "c:<slug>") da prancha. */
export function postsDeExemplo(slug: string, agora: number = Date.now()): Post[] {
  return [
    postDeExemplo(
      {
        id: ID.bruno,
        texto: "Fiz a planilha de quanto o reajuste pesa no mês de quem pega dois ônibus por dia. Coloquei no post fixado, confere a sua conta.",
        comunidade: slug,
        autor: { id: null, codinome: "Bruno Catraca", handle: "brunocatraca", perfil: true, equipe: false },
        criado_em: antes(20, agora),
        respostas: 18,
      },
      agora,
    ),
    postDeExemplo(
      {
        id: ID.mandata,
        texto: "Votamos contra o reajuste. A tabela com todos os votos está no nosso perfil, na aba Prestação de contas.",
        comunidade: slug,
        autor: { id: null, codinome: "Mandata Popular", handle: "mandatapopular", perfil: true, equipe: false },
        org: { handle: "mandatapopular", codinome: "Mandata Popular", verificada_em: "2026-11-03T12:00:00Z" },
        criado_em: antes(60, agora),
        respostas: 52,
      },
      agora,
    ),
  ];
}

/** "214 posts esta semana" e as outras da coluna (prancha computador-inicio, "Comunidades ativas"). */
export function listaDeExemplo(): ItemDaLista[] {
  const item = (slug: string, nome: string, cor: string, posts: number, categoria: ItemDaLista["categoria"] = "lutas"): ItemDaLista => ({
    slug,
    nome,
    descricao: "",
    categoria,
    tipo: "aberta",
    icone: "",
    cor,
    situacao: null,
    posts_7d: posts,
    pessoas_7d: null,
  });
  return [
    item("passe-livre-sp", "Passe Livre SP", "#1fc2b5", 214),
    item("estudantes-ufpe", "Estudantes UFPE", "#ff5c8a", 168),
    item("moradia-zona-leste", "Moradia Zona Leste", "#ff8a1f", 121),
    item("marxismo", "Marxismo · aula em debate", "#5b8cff", 97, "disciplinas"),
    item("cultura-hip-hop", "Cultura e hip-hop", "#a27bff", 40),
    item("quieta", "Comunidade quieta", "", 2),
  ];
}

/** A conversa da prancha celular-conversa-fediverso: a dúvida da Lia, a resposta que ajudou e a que veio do Fediverso. */
export function arvoreDeExemplo(id: string, agora: number = Date.now()): Arvore {
  const raiz = postDeExemplo(
    {
      id,
      texto:
        "Fiz a aula de mais-valia e fiquei pensando no meu turno de entrega: 9 horas na rua, e a taxa de cada corrida cai toda semana. Alguém já calculou quanto do valor da corrida fica com o app?",
      comunidade: "marxismo",
      autor: { id: null, codinome: "Lia Quilombo", handle: "liaquilombo", perfil: true, equipe: false },
      cita: { tipo: "aula", caminho: "marxismo/o-que-e-mais-valia", titulo: "O que é mais-valia" },
      criado_em: antes(60, agora),
      respostas: 2,
      na_conversa: 31,
      aceita: ID.r1,
      reacoes: [
        { emoji: "✊", total: 24, minha: false },
        { emoji: "📚", total: 11, minha: true },
        { emoji: "🤔", total: null, minha: false },
      ],
    },
    agora,
  );
  const resposta = (p: Partial<PostDaArvore> & Pick<Post, "id" | "texto">): PostDaArvore => ({
    ...postDeExemplo({ raiz: id, comunidade: "marxismo", ...p }, agora),
    servidor: p.servidor ?? null,
  });
  return {
    post: raiz,
    acima: [],
    respostas: [
      resposta({
        id: ID.r1,
        texto: "Fiz a conta com as minhas corridas de outubro: o cliente pagou R$ 1.840 e eu recebi R$ 1.102. O app ficou com 40%. A planilha está no núcleo.",
        resposta_a: id,
        nivel: 1,
        autor: { id: null, codinome: "Bruno Catraca", handle: "brunocatraca", perfil: true, equipe: false },
        criado_em: antes(48, agora),
        respostas: 1,
      }),
      resposta({
        id: ID.r2,
        texto: "Me passa a planilha? Quero levar pro círculo de estudo de sábado.",
        resposta_a: ID.r1,
        nivel: 2,
        autor: { id: null, codinome: "Lia Quilombo", handle: "liaquilombo", perfil: true, equipe: false },
        criado_em: antes(40, agora),
      }),
      resposta({
        id: ID.r3,
        texto: "Aqui em Porto Alegre a gente montou uma cooperativa de entrega. Posso contar como foi, se ajudar.",
        resposta_a: id,
        nivel: 1,
        autor: { id: null, codinome: "Entregador do Porto", handle: "porto@mastodon.social", perfil: false, equipe: false },
        servidor: "mastodon.social",
        criado_em: antes(30, agora),
      }),
    ],
    sintese: null,
    ordem: "antigas",
    raiz: id,
    pode_aceitar: false,
    pode_sintese: false,
    mais: false,
    pronomes_da_raiz: "ela/dela",
  };
}
