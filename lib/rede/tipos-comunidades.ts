// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os tipos do pacote "comunidades" da Rede v2 (supabase/migracoes/2026-11-rede-comunidades.sql, docs/rede/V2.md): lista e página
// de comunidade, propostas, "discutir esta aula", núcleo e turma. Sem os atalhos "@/" de propósito (roda no Node nos testes).
// Nada de contagem de membros: a lista de quem é de uma comunidade nunca sai (LGPD art. 5º, II e art. 11).
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
  lista: (lang: string) => `/${lang}/comunidade/comunidades`,
  propor: (lang: string) => `/${lang}/comunidade/propor`,
  /** "Discutir esta aula": a comunidade da disciplina (c) filtrada pela aula. */
  aula: (lang: string, trilha: string, aula: string, comunidade: string) => `/${lang}/comunidade/aula/${trilha}/${aula}?c=${comunidade}`,
  nucleos: (lang: string) => `/${lang}/comunidade/nucleos`,
  nucleo: (lang: string, id: string) => `/${lang}/comunidade/nucleos/${id}`,
} as const;
