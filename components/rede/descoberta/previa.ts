// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os dados de EXEMPLO de Explorar, Buscar, #tema, Avisos e Salvos na prévia da Alumia (NEXT_PUBLIC_ALUMIA_PREVIA=sim: máquina de
// quem desenvolve e fotos de conferência). Em produção a variável não existe e as telas falam com o banco. Só codinomes
// inventados; nenhuma lista de pessoas (nem em pacote, nem em aviso: o aviso diz "Bruno Catraca e mais 2", nunca a lista).
import { listaDeExemplo, postDeExemplo, postsDeExemplo } from "@/lib/rede/conversa/exemplos";
import type { redeDescoberta } from "@/lib/rede/cliente-descoberta";
import type { Post } from "@/lib/rede/tipos";
import type { ItemDeAviso, PaginaDeAvisos } from "@/lib/rede/tipos-avisos";
import type { Explorar, PaginaDaTag, PaginaOrdenada, ResultadoDaBusca } from "@/lib/rede/tipos-descoberta";

const MIN = 60_000;
const antes = (minutos: number) => new Date(Date.now() - minutos * MIN).toISOString();
const autor = (codinome: string, handle: string) => ({ id: null, codinome, handle, perfil: true, equipe: false });

/** Os posts de exemplo com #temas (os da comunidade da prancha + três da semana). */
export function postsComTemas(): Post[] {
  return [
    postDeExemplo({
      id: "00000000-0000-4000-8000-0000000000d1",
      texto: "Assembleia da #TarifaZero na quinta, 19h, no DCE. Quem vem de longe: tem carona saindo da Zona Leste. #PasseLivre",
      comunidade: "passe-livre-sp",
      autor: autor("Rosa Vermelha", "rosavermelha"),
      criado_em: antes(35),
      respostas: 9,
    }),
    ...postsDeExemplo("passe-livre-sp"),
    postDeExemplo({
      id: "00000000-0000-4000-8000-0000000000d2",
      texto: "Juntamos as contas de 40 entregadores: o app fica, em média, com 38% de cada corrida. Planilha aberta no núcleo. #MaisValia #TarifaZero",
      comunidade: "marxismo",
      autor: autor("Entregador do Porto", "porto@mastodon.social"),
      criado_em: antes(180),
      respostas: 27,
    }),
    postDeExemplo({
      id: "00000000-0000-4000-8000-0000000000d3",
      texto: "Mutirão de cadastro da ocupação sábado de manhã. Traga caneta e paciência. #MoradiaDigna",
      comunidade: "moradia-zona-leste",
      autor: autor("Moradia ZL", "moradiazl"),
      criado_em: antes(400),
      respostas: 4,
    }),
  ];
}

const pagina = (itens: Post[], ordem: string): PaginaOrdenada => ({ itens, proximo: null, ordem, fim_por_teto: false });
const comTag = (tag: string) => postsComTemas().filter((p) => p.texto.toLowerCase().includes(`#${tag}`) || tag === "tarifazero");
const ordenar = (itens: Post[], ordem: string) =>
  ordem === "uteis" || ordem === "em_debate" ? [...itens].sort((a, b) => b.respostas - a.respostas)
  : ordem === "sem_resposta" ? itens.filter((p) => p.respostas < 5)
  : itens;

/** O que a prévia responde no lugar de redeDescoberta (mesmas assinaturas das partes que as telas usam). */
export const descobertaDaPrevia: Pick<typeof redeDescoberta, "explorar" | "tag" | "linha" | "buscar"> = {
  async explorar(): Promise<Explorar> {
    const cores = Object.fromEntries(listaDeExemplo().map((c) => [c.slug, c.cor]));
    const com = (slug: string, nome: string, descricao: string, categoria: "lutas" | "disciplinas" | "instituto", membro = false) => ({
      slug, nome, descricao, categoria, tipo: "aberta", cor: cores[slug] ?? "", membro,
    });
    return {
      tags: [
        { tag: "tarifazero", posts: 214 },
        { tag: "passelivre", posts: 96 },
        { tag: "maisvalia", posts: 41 },
        { tag: "moradiadigna", posts: 33 },
        { tag: "entregadores", posts: 18 },
      ],
      comunidades: [
        com("passe-livre-sp", "Passe Livre SP", "Pela tarifa zero no transporte de São Paulo.", "lutas", true),
        com("estudantes-ufpe", "Estudantes UFPE", "Assistência estudantil, RU e moradia na UFPE.", "lutas"),
        com("moradia-zona-leste", "Moradia Zona Leste", "Ocupações, despejos e mutirões da ZL.", "lutas"),
        com("cultura-hip-hop", "Cultura e hip-hop", "Saraus, batalhas e quem faz cultura na quebrada.", "lutas"),
        com("marxismo", "Marxismo · aula em debate", "As aulas do Instituto discutidas em grupo.", "disciplinas"),
        com("instituto", "Instituto Lúcia", "Avisos e conversas da casa.", "instituto"),
      ],
      linhas: [
        { slug: "transporte", titulo: "Transporte e tarifa", regra: "Posts com #TarifaZero ou #PasseLivre, das comunidades de luta, do mais novo ao mais antigo." },
        { slug: "trabalho-por-app", titulo: "Trabalho por aplicativo", regra: "Posts com #Entregadores ou #MaisValia, do mais novo ao mais antigo." },
      ] as Explorar["linhas"],
      pacotes: [],
      ordens: ["novos", "uteis", "sem_resposta", "em_debate"],
      eu: null,
    };
  },
  async tag(tag: string, ordem: string = "novos"): Promise<PaginaDaTag> {
    return { ...pagina(ordenar(comTag(tag), ordem), ordem), tag, linha: tag === "tarifazero" ? { slug: "transporte", titulo: "Transporte e tarifa", regra: "Posts com #TarifaZero ou #PasseLivre." } : null };
  },
  async linha(...[, ordem = "novos"]: Parameters<typeof redeDescoberta.linha>): Promise<PaginaOrdenada> {
    return pagina(ordenar(postsComTemas(), ordem), ordem);
  },
  async buscar(q: string, ordem: string = "relevancia"): Promise<ResultadoDaBusca> {
    const termo = q.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    const sem = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    const itens = postsComTemas().filter((p) => sem(p.texto).includes(termo));
    return {
      ...pagina(ordem === "novos" ? itens : [...itens].sort((a, b) => b.respostas - a.respostas), ordem),
      q,
      pessoas: [],
      comunidades: listaDeExemplo().filter((c) => sem(c.nome).includes(termo) || termo.length >= 3 && sem(c.slug).includes(termo.slice(0, 4))).map((c) => ({ slug: c.slug, nome: c.nome, categoria: c.categoria, tipo: c.tipo })),
    };
  },
};

/** Os avisos da prévia, já agrupados como o banco agrupa (rede3_aviso_grupos): uma linha por conversa, nunca a lista de quem. */
export function avisosDaPrevia(): PaginaDeAvisos {
  const item = (p: Partial<ItemDeAviso> & Pick<ItemDeAviso, "id" | "tipo">): ItemDeAviso => ({
    total: 1, pessoas: 1, lido: false, criado_em: antes(10), post: null, alvo: null, titulo: null, atores: [], texto: null, ...p,
  });
  const itens = [
    item({ id: "a1", tipo: "resposta", total: 4, pessoas: 3, post: "00000000-0000-4000-8000-0000000000c1", titulo: "Quanto da corrida fica com o app?", atores: ["Bruno Catraca", "Entregador do Porto"], criado_em: antes(6) }),
    item({ id: "a2", tipo: "mencao", post: "00000000-0000-4000-8000-0000000000d1", alvo: "00000000-0000-4000-8000-0000000000d1", atores: ["Rosa Vermelha"], criado_em: antes(42) }),
    item({ id: "a3", tipo: "apoio", total: 12, pessoas: 12, post: "00000000-0000-4000-8000-0000000000b1", titulo: "A planilha do reajuste", lido: true, criado_em: antes(180) }),
    item({ id: "a4", tipo: "seguidor", total: 3, pessoas: 3, atores: ["Moradia ZL", "Rosa Vermelha"], lido: true, criado_em: antes(60 * 26) }),
    item({ id: "a5", tipo: "moderacao", texto: "A moderação de Passe Livre SP fixou “Sexta tem ato: como vai funcionar”.", lido: true, criado_em: antes(60 * 50) }),
  ];
  return { itens, proximo: null, nao_lidos: itens.filter((i) => !i.lido).length } as PaginaDeAvisos;
}

/** Os salvos da prévia: só a própria pessoa vê. */
export function salvosDaPrevia(): Post[] {
  return postsComTemas().slice(1, 4).map((p) => ({ ...p, salvei: true }));
}
