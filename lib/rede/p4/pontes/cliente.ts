// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As chamadas do lote "pontes" do Prompt 4 ao banco (supabase/migracoes/20261127-p4-pontes.sql). Nenhuma devolve lista de pessoas:
// a lista de aprovados é de servidores; o "pouco útil" devolve só o voto de quem chama; o fio devolve só o que quem lê vê. Sem "@/".
import { chamar, type Chamar } from "../../cliente";

export interface ServidorAprovado {
  dominio: string;
  desde: string;
}
export interface Aprovados {
  ligado: boolean;
  so_aprovados: boolean;
  lista: ServidorAprovado[];
}
export interface PonteBluesky {
  escolheu: boolean;
  aberta: boolean;
  ativa: boolean;
  barrada: boolean;
  ligado: boolean;
}
export interface ParteDoFio {
  id: string;
  titulo: string | null;
  texto: string;
  corpo: string | null;
  criado_em: string;
}
export interface FioComoTexto {
  autor: string;
  itens: ParteDoFio[];
}

export function criarClienteDasPontes(c: Chamar) {
  return {
    /** 82: a lista e o modo (só a mediação). */
    aprovados: () => c<Aprovados>("rede_p4_fed_aprovados_ver"),
    aprovar: (dominio: string, sim: boolean) => c<Aprovados>("rede_p4_fed_aprovar", { p_dominio: dominio, p_sim: sim }),
    modo: (soAprovados: boolean) => c<Aprovados>("rede_p4_fed_modo", { p_so_aprovados: soAprovados }),
    /** 85: a escolha da comunidade (só a moderação dela). */
    bluesky: (slug: string) => c<PonteBluesky>("rede_p4_bluesky_ver", { p_slug: slug }),
    blueskyEscolher: (slug: string, sim: boolean) => c<PonteBluesky>("rede_p4_bluesky_escolher", { p_slug: slug, p_sim: sim }),
    /** 131: a minha escolha (nulo = só ler). */
    soSeguidos: (sim: boolean | null = null) => c<{ so_seguidos: boolean; ligado: boolean }>("rede_p4_avisos_so_seguidos", { p_sim: sim }),
    /** 132: marcar ou desfazer; devolve só o meu voto. As duas vão pelo servidor do site (lib/rede/voto/cliente.ts, VOTO_PELO_SERVIDOR). */
    poucoUtil: (post: string, sim: boolean) => c<{ eu: boolean }>("rede_p4_pouco_util", { p_post: post, p_sim: sim }),
    poucoUtilMeus: (posts: string[]) => c<string[]>("rede_p4_pouco_util_meus", { p_posts: posts }),
    /** 133: o fio da autora como texto corrido. */
    fio: (id: string) => c<FioComoTexto>("rede_p4_fio_texto", { p_id: id }),
  };
}

export const pontes = criarClienteDasPontes(chamar);
