// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O lugar do mapa (frente 13B, L1-19): a cidade ESCRITA por quem chamou o ato ou cadastrou o núcleo vira um município do desenho.
// A mesma regra de interno.rede_mapa_lugar (supabase/migracoes/20261119-alumia-o13-mapa.sql): minúsculas, sem acento, pontuação
// vira espaço, e a UF escrita no fim ("Recife - PE", "Recife/PE", "Recife (PE)") sai do nome. A precisão é a do município: nada de
// posição do aparelho, nada de endereço. Sem os atalhos "@/" de propósito (o teste roda no Node).

export const UFS = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"] as const;
export type UF = (typeof UFS)[number];

/** As capitais: quando o nome existe em mais de um estado e ninguém escreveu a UF, a capital é a que se quis dizer. */
export const CAPITAIS: Record<UF, string> = {
  AC: "rio branco", AL: "maceio", AP: "macapa", AM: "manaus", BA: "salvador", CE: "fortaleza", DF: "brasilia", ES: "vitoria", GO: "goiania",
  MA: "sao luis", MT: "cuiaba", MS: "campo grande", MG: "belo horizonte", PA: "belem", PB: "joao pessoa", PR: "curitiba", PE: "recife",
  PI: "teresina", RJ: "rio de janeiro", RN: "natal", RS: "porto alegre", RO: "porto velho", RR: "boa vista", SC: "florianopolis",
  SP: "sao paulo", SE: "aracaju", TO: "palmas",
};

export const ehUF = (x: string): x is UF => (UFS as readonly string[]).includes(x);

// As letras que o banco troca (interno.rede_ato_cidade): as mesmas, na mesma ordem.
const COM = "áàâãäåéèêëíìîïóòôõöúùûüçñýÿÁÀÂÃÄÅÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑÝ";
const SEM = "aaaaaaeeeeiiiiooooouuuucnyyAAAAAAEEEEIIIIOOOOOUUUUCNY";

/** A chave da cidade do banco: tira acento, minúsculas, espaços simples (a de interno.rede_ato_cidade), até 80 letras. */
export function chaveDaCidade(texto: string): string | null {
  const trocado = [...texto.slice(0, 80)].map((c) => {
    const i = COM.indexOf(c);
    return i < 0 ? c : SEM[i];
  }).join("");
  const k = trocado.replace(/\s+/g, " ").trim().toLowerCase();
  return k || null;
}

/** Só letras e números, separados por um espaço ("olho d'agua" → "olho d agua"). */
export const soLetras = (k: string) => k.replace(/[^a-z0-9]+/g, " ").trim();

/** A cidade escrita vira {nome, uf}; a UF só quando veio escrita no fim. Nulo quando não sobra nome (menos de 2 letras). */
export function lugarEscrito(texto: string | null | undefined): { nome: string; uf: UF | null } | null {
  const k = chaveDaCidade(texto ?? "");
  if (!k) return null;
  const m = /^(.*?)[\s,/(–-]+([a-z]{2})\)?$/.exec(k);
  if (m && ehUF(m[2].toUpperCase()) && k !== "sento se") {
    const nome = soLetras(m[1]);
    if (nome.length >= 2) return { nome, uf: m[2].toUpperCase() as UF };
  }
  const nome = soLetras(k);
  return nome.length >= 2 ? { nome, uf: null } : null;
}

/** O nome de um município do IBGE na mesma forma da chave ("Olho D'Água das Flores" → "olho d agua das flores"). */
export function nomeNaChave(nomeDoMunicipio: string): string {
  return soLetras(chaveDaCidade(nomeDoMunicipio) ?? "");
}
