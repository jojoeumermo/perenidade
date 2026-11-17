// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As regras puras da estrutura das comunidades (onda 10, frente 10C), as mesmas de
// supabase/migracoes/20261116-alumia-o10-estrutura.sql: as UFs, a chave que junta as grafias de um município, o nome escrito
// arrumado e os códigos de erro novos. Sem "@/" de propósito (o teste do banco importa daqui).

/** As 27 unidades da federação, na ordem do banco. */
export const UFS = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"] as const;
export type UF = (typeof UFS)[number];

/** Os erros que só esta frente devolve (cada um tem texto em i18n/rede/estrutura). */
export const ERROS_DA_ESTRUTURA = [
  "so_leitura",
  "so_leitura_respostas",
  "mae_e_filha",
  "filha_e_mae",
  "sem_selo",
  "repostar_publico",
  "repostar_fechado",
  "mesma_comunidade",
  "citar_fechado",
  "ja_decidida",
] as const;

/** Quem pode responder numa comunidade só leitura. */
export const RESPOSTAS = ["todos", "membros", "ninguem"] as const;
/** Quem pode trazer posts de outra comunidade para cá. */
export const REPOSTS = ["todos", "moderacao", "ninguem"] as const;
/** A herança de moderação de uma subcomunidade. */
export const HERANCAS = ["propria", "mae"] as const;

/** A mesma conta de interno.normal: minúsculas, sem acento, só letras e números separados por um espaço. */
export function chaveDaCidade(nome: string): string {
  return (nome ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** O nome escrito arrumado como o banco guarda (espaços em excesso fora); vazio vira nulo. */
export function nomeDoLugar(nome: string | null | undefined): string | null {
  const v = (nome ?? "").replace(/\s+/g, " ").trim();
  return v ? v : null;
}

/** O nome cabe no banco? (2 a 80 letras, sem marcação.) */
export function nomeDoLugarValido(nome: string | null | undefined): boolean {
  const v = nomeDoLugar(nome);
  return v === null || (v.length >= 2 && v.length <= 80 && !/[<>{}\\]/.test(v));
}
