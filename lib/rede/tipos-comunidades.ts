// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os tipos do pacote "comunidades" da Rede v2 (supabase/migracoes/2026-11-rede-comunidades.sql, docs/rede/V2.md): lista e página
// de comunidade, propostas, "discutir esta aula", núcleo e turma. Sem os atalhos "@/" de propósito (roda no Node nos testes).
// Nada de contagem de membros: a lista de quem é de uma comunidade nunca sai (LGPD art. 5º, II e art. 11).
import { sementeDe } from "./mosaico";
import type { Comunidade, Post } from "./tipos";

/** Onde a pessoa está numa comunidade. Nulo = fora dela. */
export type SituacaoNaComunidade = "membro" | "pendente" | "banido" | null;

export interface ItemDaLista {
  slug: string;
  nome: string;
  descricao: string;
  categoria: "lutas" | "disciplinas" | "instituto";
  tipo: "aberta" | "restrita" | "fechada";
  icone: string;
  cor: string;
  situacao: SituacaoNaComunidade;
  /** T32: visitante vê das lutas e do Instituto só uma amostra (nome, descrição e regras), sem posts nem contagens. */
  amostra?: boolean;
  /** Posts da última semana (agregado, sem nome). Nulo na amostra; ausente antes da migração 20261106-t32-alumia-vitrine.sql. */
  posts_7d?: number | null;
  /** Pessoas que escreveram na última semana: só a partir de 3 (abaixo disso, nulo: "poucas"), nunca quem. */
  pessoas_7d?: number | null;
  /** As regras, só na amostra para visitante. */
  regras?: { numero: number; titulo: string; texto: string }[] | null;
}

/** A página inteira: a comunidade (como `rede_comunidade`), a situação de quem lê, os fixados e, para a moderação, os pedidos. */
export interface PaginaDaComunidade {
  comunidade: Comunidade;
  situacao: SituacaoNaComunidade;
  modero: boolean;
  /** Só a moderação vê quantos pedidos esperam; para os outros vem nulo. */
  pedidos: number | null;
  fixados: Post[];
}

export interface PedidoDeEntrada {
  usuario: string;
  codinome: string;
  quando: string;
}

export interface PedidoDeProposta {
  slug: string;
  nome: string;
  objetivo: string;
  regras: string;
  /** Os @nomes de quem vai moderar (ao menos 2). */
  moderadores: string[];
}

export interface MinhaProposta {
  id: string;
  slug: string;
  nome: string;
  situacao: "aberta" | "aprovada" | "recusada";
  motivo: string;
  criado_em: string;
}

export interface PropostaNaFila extends MinhaProposta {
  objetivo: string;
  regras: string;
  autor: string;
  moderadores: string[];
}

export interface NucleoResumo {
  id: string;
  nome: string;
  cidade: string;
  trilha: string | null;
  papel: "mediacao" | "membro";
}

export type LocalDoEncontro = "praca" | "biblioteca" | "sindicato" | "escola" | "universidade" | "associacao" | "online" | "outro";
export const LOCAIS_DE_ENCONTRO: LocalDoEncontro[] = ["praca", "biblioteca", "sindicato", "escola", "universidade", "associacao", "online", "outro"];

export interface EncontroDoNucleo {
  id: string;
  quando: string;
  local_tipo: LocalDoEncontro;
  local_texto: string;
}

export interface PaginaDoNucleo extends NucleoResumo {
  mediacao: string[];
  encontros: EncontroDoNucleo[];
}

export interface SituacaoDaTurma {
  mes: string;
  slug: string;
  inscrito: boolean;
  entrou: boolean;
}

/** "trilha/aula": o que liga um post a uma aula (cada parte: letras minúsculas, números e "-"). */
export const aulaOk = (s: string): boolean => /^[a-z0-9-]{2,80}\/[a-z0-9-]{2,80}$/.test(s);
export const mesOk = (s: string): boolean => /^[0-9]{4}-(0[1-9]|1[0-2])$/.test(s);

/** Os endereços do pacote (relativos ao idioma): um lugar só, para as telas, os links e os testes. */
export const enderecosCom = {
  lista: (lang: string) => `/${lang}/alumia/comunidades`,
  propor: (lang: string) => `/${lang}/alumia/propor`,
  /** "Discutir esta aula": a comunidade da disciplina (c) filtrada pela aula. */
  aula: (lang: string, trilha: string, aula: string, comunidade: string) => `/${lang}/alumia/aula/${trilha}/${aula}?c=${comunidade}`,
  nucleos: (lang: string) => `/${lang}/alumia/nucleos`,
  nucleo: (lang: string, id: string) => `/${lang}/alumia/nucleos/${id}`,
} as const;

// ── Onda 5 (PLANO-ALUMIA F3): contas puras da página nova da comunidade e de "Comunidades ativas" ──────────────────────────

/** As cinco cores de comunidade das pranchas, na ordem dos tokens --al-com-1 … --al-com-5 (styles/alumia-tokens.css). */
export const CORES_DAS_PRANCHAS = ["#1fc2b5", "#ff5c8a", "#ff8a1f", "#5b8cff", "#a27bff"] as const;

/**
 * A cor (1–5) de uma comunidade nas telas novas: a cor que a moderação escolheu (rede_comunidades.cor, "#rrggbb") vai para a
 * mais parecida das cinco das pranchas, para o alto contraste e o e-ink continuarem trocando a cor por tinta; sem cor escolhida,
 * sai do slug (a mesma comunidade tem sempre a mesma cor).
 */
export function corDaComunidadeNova(slug: string, cor?: string | null): 1 | 2 | 3 | 4 | 5 {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(cor ?? "");
  if (!m) return ((sementeDe(slug) % 5) + 1) as 1 | 2 | 3 | 4 | 5;
  const [r, g, b] = [m[1], m[2], m[3]].map((x) => parseInt(x, 16));
  let melhor = 0;
  let menor = Infinity;
  CORES_DAS_PRANCHAS.forEach((c, i) => {
    const d = (parseInt(c.slice(1, 3), 16) - r) ** 2 + (parseInt(c.slice(3, 5), 16) - g) ** 2 + (parseInt(c.slice(5, 7), 16) - b) ** 2;
    if (d < menor) {
      menor = d;
      melhor = i;
    }
  });
  return (melhor + 1) as 1 | 2 | 3 | 4 | 5;
}

/** "214 posts esta semana": só a partir de 3 (abaixo, "poucos"); nunca quem escreveu (só posts, agregados). */
export function postsDaSemana(n: number | null | undefined): number | null {
  return typeof n === "number" && Number.isInteger(n) && n >= 3 ? n : null;
}

/**
 * "Comunidades ativas" (prancha computador-inicio, coluna da direita): as com mais posts nos últimos 7 dias, sem algoritmo e sem
 * patrocínio; no empate, ordem alfabética. Fica de fora a amostra de visitante (sem contagem) e quem não teve post na semana.
 */
export function comunidadesAtivas(lista: readonly ItemDaLista[], quantas = 4): ItemDaLista[] {
  return lista
    .filter((c) => !c.amostra && typeof c.posts_7d === "number" && c.posts_7d > 0)
    .sort((a, b) => (b.posts_7d ?? 0) - (a.posts_7d ?? 0) || a.nome.localeCompare(b.nome, "pt-BR"))
    .slice(0, Math.max(0, quantas));
}
