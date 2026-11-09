// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os dados ILUSTRATIVOS da F4: o "perfil de exemplo" da página para organizações (sempre com o aviso "dados ilustrativos") e a
// prévia das telas quando NEXT_PUBLIC_ALUMIA_PREVIA=sim (antes de o banco ter as funções rede_org_*). Tudo inventado, como nas
// pranchas: nenhuma organização, pessoa ou votação real. Codinome sempre; nenhum nome civil; nenhuma lista de pessoas (só @ de
// quem ESCOLHEU aparecer na fila da plenária). Sem os atalhos "@/" de propósito (roda no Node nos testes).
import type { ExtrasDoPerfil, OrgPublica, PlenariaAoVivo } from "../tipos-org";

/** O @ do perfil de exemplo (o da prancha computador-inicio). */
export const HANDLE_DE_EXEMPLO = "mandatapopular";

/** A prévia (dados de exemplo no lugar do banco) está ligada? Só com NEXT_PUBLIC_ALUMIA_PREVIA=sim. */
export function previaLigada(): boolean {
  return process.env.NEXT_PUBLIC_ALUMIA_PREVIA === "sim";
}

/** Uma data ISO a `dias` (e `horas`) de agora, para os prazos do exemplo não ficarem velhos. */
function daqui(dias: number, horas = 0, agora: Date = new Date()): string {
  return new Date(agora.getTime() + dias * 86_400_000 + horas * 3_600_000).toISOString();
}

/** Uma data AAAA-MM-DD a `dias` de hoje. */
function dia(dias: number, agora: Date = new Date()): string {
  return daqui(dias, 0, agora).slice(0, 10);
}

/** A organização do exemplo, com consulta aberta, consulta fechada, plenária ao vivo, "Como votamos" e três núcleos. */
export function orgDeExemplo(agora: Date = new Date()): OrgPublica {
  return {
    handle: HANDLE_DE_EXEMPLO,
    codinome: "Mandata Popular",
    tipo: "mandato",
    bio: "Mandato coletivo na Câmara Municipal. Tudo o que votamos fica aqui, com o porquê. A base decide junto.",
    cidade: "São Paulo",
    verificadaEm: dia(-6, agora),
    documento: "diploma do mandato",
    palavra: "POVO",
    sigo: false,
    sino: false,
    gerencio: false,
    nucleos: [
      { id: "n-zl", nome: "Núcleo Zona Leste", cor: 3, quando: "terças, 19h", onde: "Zona Leste", sou: false, pedi: false },
      { id: "n-centro", nome: "Núcleo Centro", cor: 1, quando: "sábados, 10h", onde: "Centro", sou: false, pedi: false },
      { id: "n-estudantes", nome: "Núcleo Estudantes", cor: 2, quando: "quartas, 18h", onde: null, sou: false, pedi: false },
    ],
    votacoes: [
      {
        id: "v1",
        data: dia(-3, agora),
        projeto: "PL 412 · reajuste da tarifa de ônibus",
        voto: "nao",
        porque: "A base votou contra na consulta (71%). Tarifa mais cara tira gente do ônibus.",
        resultado: "aprovado por 31 a 18",
        fonte: "https://www.saopaulo.sp.leg.br/",
      },
      {
        id: "v2",
        data: dia(-10, agora),
        projeto: "PL 377 · concessão dos parques municipais",
        voto: "nao",
        porque: "Parque é de quem usa. Concessão fecha portão e cobra entrada.",
        resultado: "aprovado por 29 a 20",
        fonte: "https://www.saopaulo.sp.leg.br/",
      },
      {
        id: "v3",
        data: dia(-17, agora),
        projeto: "PL 350 · merenda com produção agroecológica",
        voto: "sim",
        porque: "Comida de verdade na escola e renda para quem planta perto.",
        resultado: "aprovado por 44 a 5",
        fonte: "https://www.saopaulo.sp.leg.br/",
      },
    ],
    consultas: [
      {
        id: "c-aberta",
        pergunta: "Como o mandato deve votar o PL 430 (fim da tarifa zero aos domingos)?",
        metodo: "simples",
        opcoes: [
          { id: "contra", texto: "Votar contra", proporcao: null },
          { id: "emendas", texto: "A favor com emendas", proporcao: null },
          { id: "abster", texto: "Abster", proporcao: null },
        ],
        prazo: daqui(2, 4, agora),
        compromisso: "O mandato vota como a base decidir, se o quórum for atingido.",
        quorum: 300,
        situacao: "aberta",
        votantes: null,
        quorumAtingido: null,
        possoVotar: false,
        votei: false,
        nucleos: ["Núcleo Zona Leste", "Núcleo Centro", "Núcleo Estudantes"],
      },
      {
        id: "c-fechada",
        pergunta: "Como o mandato deve votar o PL 412 (reajuste da tarifa)?",
        metodo: "simples",
        opcoes: [
          { id: "contra", texto: "Votar contra", proporcao: 0.71 },
          { id: "emendas", texto: "A favor com emendas", proporcao: 0.18 },
          { id: "abster", texto: "Abster", proporcao: 0.11 },
        ],
        prazo: daqui(-4, 0, agora),
        compromisso: "O mandato vota como a base decidir, se o quórum for atingido.",
        quorum: 300,
        situacao: "fechada",
        votantes: 1318,
        quorumAtingido: true,
        possoVotar: false,
        votei: false,
        nucleos: ["Núcleo Zona Leste", "Núcleo Centro", "Núcleo Estudantes"],
      },
    ],
    plenarias: [
      {
        id: "p-agora",
        org: { handle: HANDLE_DE_EXEMPLO, codinome: "Mandata Popular" },
        titulo: "Plenária aberta com a Mandata Popular",
        descricao: "A base pergunta, o mandato responde. Perguntas em ordem de chegada, sem filtro de assessoria.",
        inicio: daqui(0, -1, agora),
        aoVivo: true,
        sala: "https://www.youtube.com/",
        naSala: 1204,
        naFila: 214,
        fila: [
          { id: "q1", handle: "ritadazl", texto: "Por que o mandato votou contra a concessão dos parques?", criadaEm: daqui(0, -1, agora), respondida: true },
          { id: "q2", handle: "joaocobrador", texto: "Quando volta a discussão da tarifa zero aos domingos?", criadaEm: daqui(0, -0.9, agora), respondida: false },
          { id: "q3", handle: null, texto: "Como faço para entrar num núcleo se trabalho de noite?", criadaEm: daqui(0, -0.8, agora), respondida: false },
        ],
        pergunteiEu: false,
      },
    ],
  };
}

/** A plenária do exemplo no formato da coluna "Ao vivo agora" (prancha computador-inicio). */
export function aoVivoDeExemplo(agora: Date = new Date()): PlenariaAoVivo[] {
  const p = orgDeExemplo(agora).plenarias[0];
  return [{ id: p.id, org: p.org, titulo: p.titulo, descricao: p.descricao, inicio: p.inicio, aoVivo: p.aoVivo, sala: p.sala, naSala: p.naSala, naFila: p.naFila }];
}

/** Os posts do exemplo (a aba Posts do perfil de exemplo, sem banco). */
export function postsDeExemplo(): { id: string; quando: string; comunidade: string; cor: 1 | 2 | 3 | 4 | 5; texto: string }[] {
  return [
    {
      id: "e1",
      quando: "25 min",
      comunidade: "Passe Livre SP",
      cor: 1,
      texto: "Prestação de contas da semana: votamos contra o reajuste da tarifa na Câmara (passou por 31 a 18). Quinta, 19h, plenária aberta aqui na Alumia: mande sua pergunta, a gente responde ao vivo, em ordem de chegada.",
    },
    {
      id: "e2",
      quando: "2 d",
      comunidade: "Moradia Zona Leste",
      cor: 3,
      texto: "Consulta aberta: como votamos o PL 430? Só quem está num núcleo vota, o voto é secreto e o resultado sai para todo mundo.",
    },
  ];
}

/** Os atos do exemplo (a aba Atos do perfil de exemplo). */
export function atosDeExemplo(agora: Date = new Date()): { id: string; nome: string; quando: string; onde: string; situacao: "confirmado" | "adiado" | "cancelado" }[] {
  return [
    { id: "a1", nome: "Passe Livre Já", quando: daqui(6, 0, agora), onde: "Praça da Sé, São Paulo", situacao: "confirmado" },
    { id: "a2", nome: "Plenária na Cohab 2", quando: daqui(12, 0, agora), onde: "Centro comunitário da Cohab 2", situacao: "adiado" },
  ];
}

/** Os extras de um perfil de pessoa na prévia (status, pronomes, campos, destaques). */
export function extrasDeExemplo(handle: string): ExtrasDoPerfil {
  return {
    status: { tipo: "greve", texto: "em greve com a categoria", ate: null },
    pronomes: "ela/dela",
    campos: [
      { rotulo: "Categoria", valor: "Educação" },
      { rotulo: "Núcleo", valor: "Zona Leste" },
      { rotulo: "Site", valor: "https://institutolucia.org" },
    ],
    destaques: [
      { id: "d1", tipo: "ato", titulo: "Passe Livre Já", href: `/pt/alumia/u/${handle}` },
      { id: "d2", tipo: "post", titulo: "Como montamos o núcleo do bairro", href: `/pt/alumia/u/${handle}` },
    ],
  };
}
