// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os dados de EXEMPLO das telas novas da F3 (PLANO-ALUMIA §8 F3): a comunidade, a conversa e "Comunidades ativas" exatamente
// como nas pranchas (docs/plano-2026-11/alumia-pranchas/celular-comunidade.png, celular-conversa-fediverso.png e
// computador-inicio.webp). Só valem com NEXT_PUBLIC_ALUMIA_PREVIA=sim (máquina de quem desenvolve e fotos de conferência): em
// produção a variável não existe e as telas falam com o banco. Todos os nomes são codinomes inventados; nenhuma pessoa real.
// Sem "@/" de propósito (roda no Node nos testes).
import { atosDeExemplo } from "../atos/exemplos";
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

/** As regras de exemplo das comunidades que não são a da prancha (as mesmas quatro da casa, em linguagem curta). */
const REGRAS_DA_CASA = [
  { numero: 1, titulo: "Codinome sempre", texto: "Nada de nome civil, endereço, placa ou rosto de quem não pediu." },
  { numero: 2, titulo: "Fonte no que afirma", texto: "Número e notícia vêm com a fonte." },
  { numero: 3, titulo: "Sem ataque a pessoa", texto: "Critique a ideia e quem decide, não quem comenta." },
];

/**
 * A página de exemplo de uma comunidade da prévia, pelo slug: a "Passe Livre SP" da prancha celular-comunidade, ou uma das outras
 * de listaDeExemplo() com o nome, a cor e a descrição dela. Slug que não está na lista: nulo (a tela mostra "não encontrada").
 */
export function paginaDeExemplo(slug: string, agora: number = Date.now()): PaginaDaComunidade | null {
  const item = listaDeExemplo().find((c) => c.slug === slug);
  if (!item) return null;
  if (slug !== "passe-livre-sp") {
    return {
      comunidade: {
        slug,
        nome: item.nome,
        descricao: item.descricao,
        categoria: item.categoria,
        tipo: item.tipo,
        publico_padrao: "membros",
        icone: "",
        cor: item.cor,
        aulas: item.categoria === "disciplinas" ? ["introducao-ao-marxismo/mais-valia"] : [],
        trilhas: item.categoria === "disciplinas" ? ["introducao-ao-marxismo"] : [],
        regras: REGRAS_DA_CASA,
        etiquetas: [],
        moderacao: ["Uma", "Duas", "Três"],
        membro: false,
        banido: false,
      },
      situacao: null,
      modero: false,
      pedidos: null,
      posts_7d: item.posts_7d ?? null,
      fixados: [],
    };
  }
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
      aulas: ["direito-a-cidade/david-harvey-a-cidade-como-negocio", "economia-fundamental/preco-salario-e-inflacao"],
      trilhas: ["direito-a-cidade"],
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
    posts_7d: 214,
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

/** Um post de exemplo de cada comunidade que não é a da prancha (codinomes inventados). */
const OUTROS_POSTS: Record<string, { id: string; texto: string; codinome: string; handle: string; minutos: number; respostas: number }[]> = {
  "estudantes-ufpe": [
    { id: "00000000-0000-4000-8000-0000000000e1", texto: "O RU fechou de novo no sábado. Quem mora na casa do estudante ficou sem almoço. Vamos levar isso pro conselho na terça.", codinome: "Maré Alta", handle: "marealta", minutos: 15, respostas: 23 },
    { id: "00000000-0000-4000-8000-0000000000e2", texto: "Resumo da assembleia: a bolsa permanência atrasou para 312 estudantes. A planilha com os números está no núcleo.", codinome: "Frevo Vermelho", handle: "frevovermelho", minutos: 140, respostas: 8 },
  ],
  "moradia-zona-leste": [
    { id: "00000000-0000-4000-8000-0000000000e3", texto: "Mutirão de cadastro da ocupação sábado de manhã. Traga caneta e paciência.", codinome: "Moradia ZL", handle: "moradiazl", minutos: 400, respostas: 4 },
  ],
  marxismo: [
    { id: "00000000-0000-4000-8000-0000000000c1", texto: "Fiz a aula de mais-valia e fiquei pensando no meu turno de entrega. Alguém já calculou quanto do valor da corrida fica com o app?", codinome: "Lia Quilombo", handle: "liaquilombo", minutos: 60, respostas: 31 },
  ],
  "cultura-hip-hop": [
    { id: "00000000-0000-4000-8000-0000000000e4", texto: "Sarau na laje da Dona Cida, sexta, 20h. Microfone aberto, quem quiser recitar chega cedo.", codinome: "Rima Firme", handle: "rimafirme", minutos: 300, respostas: 6 },
  ],
};

/** Os posts da comunidade (a linha "c:<slug>") da prancha. */
export function postsDeExemplo(slug: string, agora: number = Date.now()): Post[] {
  if (slug !== "passe-livre-sp") {
    return (OUTROS_POSTS[slug] ?? []).map((p) =>
      postDeExemplo({ id: p.id, texto: p.texto, comunidade: slug, autor: { id: null, codinome: p.codinome, handle: p.handle, perfil: true, equipe: false }, criado_em: antes(p.minutos, agora), respostas: p.respostas }, agora),
    );
  }
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
  const item = (slug: string, nome: string, cor: string, posts: number, descricao: string, categoria: ItemDaLista["categoria"] = "lutas"): ItemDaLista => ({
    slug,
    nome,
    descricao,
    categoria,
    tipo: "aberta",
    icone: "",
    cor,
    situacao: null,
    posts_7d: posts,
    // Pessoas diferentes na semana: só o total e só a partir de 3 (abaixo disso, "poucas"), como no banco.
    pessoas_7d: posts >= 12 ? Math.max(3, Math.round(posts / 4)) : null,
  });
  return [
    item("passe-livre-sp", "Passe Livre SP", "#1fc2b5", 214, "Pela tarifa zero no transporte de São Paulo."),
    item("estudantes-ufpe", "Estudantes UFPE", "#ff5c8a", 168, "Assistência estudantil, RU e moradia na UFPE."),
    item("moradia-zona-leste", "Moradia Zona Leste", "#ff8a1f", 121, "Ocupações, despejos e mutirões da Zona Leste."),
    item("marxismo", "Marxismo · aula em debate", "#5b8cff", 97, "As aulas do Instituto discutidas em grupo.", "disciplinas"),
    item("cultura-hip-hop", "Cultura e hip-hop", "#a27bff", 40, "Saraus, batalhas e quem faz cultura na quebrada."),
    item("quieta", "Comunidade quieta", "", 2, "Uma comunidade com pouco movimento esta semana."),
  ];
}

/** Os três posts da semana com #temas (Explorar, Buscar e #tema na prévia: components/rede/descoberta/previa.ts). */
export function postsDaSemanaDeExemplo(agora: number = Date.now()): Post[] {
  const autor = (codinome: string, handle: string) => ({ id: null, codinome, handle, perfil: true, equipe: false });
  return [
    postDeExemplo({
      id: "00000000-0000-4000-8000-0000000000d1",
      texto: "Assembleia da #TarifaZero na quinta, 19h, no DCE. Quem vem de longe: tem carona saindo da Zona Leste. #PasseLivre",
      comunidade: "passe-livre-sp",
      autor: autor("Rosa Vermelha", "rosavermelha"),
      criado_em: antes(35, agora),
      respostas: 9,
    }, agora),
    postDeExemplo({
      id: "00000000-0000-4000-8000-0000000000d2",
      texto: "Juntamos as contas de 40 entregadores: o app fica, em média, com 38% de cada corrida. Planilha aberta no núcleo. #MaisValia #TarifaZero",
      comunidade: "marxismo",
      autor: autor("Entregador do Porto", "porto@mastodon.social"),
      criado_em: antes(180, agora),
      respostas: 27,
    }, agora),
    postDeExemplo({
      id: "00000000-0000-4000-8000-0000000000d3",
      texto: "Mutirão de cadastro da ocupação sábado de manhã. Traga caneta e paciência. #MoradiaDigna",
      comunidade: "moradia-zona-leste",
      autor: autor("Moradia ZL", "moradiazl"),
      criado_em: antes(400, agora),
      respostas: 4,
    }, agora),
  ];
}

/** As respostas de exemplo da conversa de cada ato (codinomes inventados). Sem lista de quem vai: só o que se diz na conversa. */
const RESPOSTAS_DOS_ATOS: Record<string, { texto: string; codinome: string; handle: string; minutos: number; a?: number }[]> = {
  "0e1b6c1a-5d1f-4c3e-9a51-6f3a2b1c0d01": [
    { texto: "Vou com a faixa do grêmio. Alguém sabe se a escadaria da catedral vai estar livre às 18h ou é melhor concentrar na lateral?", codinome: "Catraca Livre", handle: "catracalivre", minutos: 50 },
    { texto: "A coordenação confirmou a escadaria. Equipe de cuidado de colete amarelo, ponto de água ao lado da banca de jornal.", codinome: "Passe Livre SP", handle: "passelivre_sp", minutos: 44, a: 0 },
    { texto: "Levo a planilha impressa de quanto a tarifa pesa no mês. Dá pra distribuir na concentração.", codinome: "Bruno Catraca", handle: "brunocatraca", minutos: 31 },
    { texto: "Quem vem da Zona Leste: a gente sai junto da estação Itaquera às 16h30.", codinome: "Marta Sé", handle: "martase", minutos: 18 },
  ],
};

/** A conversa de um ato de exemplo (o post do chamado, com o mesmo id do ato), com o número de respostas do cartão do ato. */
function arvoreDoAto(id: string, agora: number): Arvore | null {
  const achado = atosDeExemplo(agora).find((a) => a.ato.id === id);
  if (!achado) return null;
  const { ato } = achado;
  const raiz = postDeExemplo(
    {
      id,
      tipo: "chamado",
      titulo: ato.titulo,
      texto: ato.descricao,
      comunidade: ato.comunidade?.slug ?? null,
      autor: { id: null, codinome: ato.comunidade?.nome ?? ato.chamado_por ?? "", handle: ato.chamado_por, perfil: true, equipe: false },
      chamado: { tipo: "ato", quando: ato.inicio, onde: ato.onde, situacao: ato.situacao, inicio_anterior: ato.inicio_anterior, palavra: ato.palavra, acesos: ato.acesos },
      criado_em: antes(60 * 20, agora),
      respostas: ato.respostas,
      na_conversa: ato.respostas,
      vou_eu: ato.vou_eu,
    },
    agora,
  );
  const lista = RESPOSTAS_DOS_ATOS[id] ?? [
    { texto: "Conta comigo. Vou avisar o pessoal do núcleo.", codinome: "Maré Alta", handle: "marealta", minutos: 40 },
    { texto: "Alguém leva água a mais? Eu levo a faixa.", codinome: "Rima Firme", handle: "rimafirme", minutos: 22 },
  ];
  const ids = lista.map((_, i) => `${id.slice(0, -2)}${(0xa0 + i).toString(16)}`);
  const respostas: PostDaArvore[] = lista.map((r, i) => ({
    ...postDeExemplo(
      {
        id: ids[i],
        texto: r.texto,
        raiz: id,
        comunidade: raiz.comunidade,
        resposta_a: r.a === undefined ? id : ids[r.a],
        nivel: r.a === undefined ? 1 : 2,
        autor: { id: null, codinome: r.codinome, handle: r.handle, perfil: true, equipe: false },
        criado_em: antes(r.minutos, agora),
        respostas: lista.filter((o) => o.a === i).length,
      },
      agora,
    ),
    servidor: null,
  }));
  return { post: raiz, acima: [], respostas, sintese: null, ordem: "antigas", raiz: id, pode_aceitar: false, pode_sintese: false, mais: false, pronomes_da_raiz: null };
}

/** A conversa de um post de comunidade da prévia (o fixado e os da linha de cada comunidade), com duas respostas de exemplo. */
function arvoreDoPostDeComunidade(id: string, agora: number): Arvore | null {
  const posts = listaDeExemplo().flatMap((c) => [...(paginaDeExemplo(c.slug, agora)?.fixados ?? []), ...postsDeExemplo(c.slug, agora)]).concat(postsDaSemanaDeExemplo(agora));
  const post = posts.find((p) => p.id === id);
  if (!post) return null;
  const raiz = { ...post, na_conversa: post.respostas };
  const respostas: PostDaArvore[] = [
    { texto: "Concordo. Dá pra levar isso pra próxima reunião da comunidade?", codinome: "Faísca", handle: "faisca", minutos: 12 },
    { texto: "Tenho os números da última vez, posto aqui à noite com a fonte.", codinome: "Frevo Vermelho", handle: "frevovermelho", minutos: 6 },
  ].map((r, i) => ({
    ...postDeExemplo(
      {
        id: `${id.slice(0, -2)}${(0xd0 + i).toString(16)}`,
        texto: r.texto,
        raiz: id,
        comunidade: post.comunidade,
        resposta_a: id,
        nivel: 1,
        autor: { id: null, codinome: r.codinome, handle: r.handle, perfil: true, equipe: false },
        criado_em: antes(r.minutos, agora),
      },
      agora,
    ),
    servidor: null,
  }));
  return { post: raiz, acima: [], respostas, sintese: null, ordem: "antigas", raiz: id, pode_aceitar: false, pode_sintese: false, mais: false, pronomes_da_raiz: null };
}

/**
 * A conversa de exemplo pelo id: a da Lia (prancha celular-conversa-fediverso), a de um ato (o mesmo id do ato, com o número do
 * botão "Conversa do ato") ou a de um post de comunidade da prévia. Id que não é de nenhum exemplo: nulo ("não encontrada"),
 * nunca a conversa de outro post.
 */
export function arvoreDeExemplo(id: string, agora: number = Date.now()): Arvore | null {
  if (id === ID.lia) return arvoreDaLia(id, agora);
  return arvoreDoAto(id, agora) ?? arvoreDoPostDeComunidade(id, agora);
}

/** A conversa da prancha celular-conversa-fediverso: a dúvida da Lia, a resposta que ajudou e a que veio do Fediverso. */
function arvoreDaLia(id: string, agora: number): Arvore {
  const raiz = postDeExemplo(
    {
      id,
      texto:
        "Fiz a aula de mais-valia e fiquei pensando no meu turno de entrega: 9 horas na rua, e a taxa de cada corrida cai toda semana. Alguém já calculou quanto do valor da corrida fica com o app?",
      comunidade: "marxismo",
      autor: { id: null, codinome: "Lia Quilombo", handle: "liaquilombo", perfil: true, equipe: false },
      cita: { tipo: "aula", caminho: "/trilhas/introducao-ao-marxismo/mais-valia", titulo: "O que é mais-valia" },
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
