// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As regras do Mural de Saúde lidas de content/saude/regras.json, o único lugar onde elas são escritas. O banco tem a
// mesma lista (levada por `npm run mural:sincronizar`) e confere de novo no servidor: este arquivo só adianta o aviso
// na tela. A normalização aqui e em interno.saude_normalizar precisa ser idêntica (o teste do mural confere as duas).
import regras from "@/content/saude/regras.json";

export type Regras = typeof regras;
export const REGRAS = regras;
/** O nome público do mural. Para trocar, mude "nome" em content/saude/regras.json. */
export const NOME_VITRINE: string = regras.nome;
export const TEXTOS = regras.textos;

type Categoria = { ligada: boolean; conselho: string; profissoes?: string[]; consulta?: string; formatoDoRegistro?: string; exemploDoRegistro?: string };
const CATEGORIAS = regras.categorias as Record<string, Categoria>;

/** A categoria profissional de um conselho (CRP → psicologia). */
export function categoriaDe(conselho: string): string {
  const c = conselho.trim().toUpperCase();
  return Object.entries(CATEGORIAS).find(([, v]) => v.conselho === c)?.[0] ?? "";
}
export const categoria = (conselho: string): Categoria | undefined => CATEGORIAS[categoriaDe(conselho)];
/** A categoria está aberta no mural? Só a psicologia, por ora. */
export const categoriaLigada = (conselho: string) => Boolean(categoria(conselho)?.ligada);
/** Os conselhos das categorias abertas. */
export const conselhosLigados = () => Object.values(CATEGORIAS).filter((c) => c.ligada).map((c) => c.conselho);
export const todosOsConselhos = () => Object.values(CATEGORIAS).map((c) => c.conselho);

const ACENTOS: Record<string, string> = { á: "a", à: "a", â: "a", ã: "a", ä: "a", ª: "a", é: "e", è: "e", ê: "e", ë: "e", í: "i", ì: "i", î: "i", ï: "i", ó: "o", ò: "o", ô: "o", õ: "o", ö: "o", º: "o", ú: "u", ù: "u", û: "u", ü: "u", ç: "c", ñ: "n" };
const TROCAS: Record<string, string> = { "4": "a", "3": "e", "1": "i", "0": "o", "5": "s", "7": "t", "@": "a", $: "s" };

/** Minúsculas, sem acento: a base dos padrões especiais (preço e CPF), antes de trocar números por letras. */
export function semAcento(texto: string): string {
  return [...texto.toLowerCase()].map((c) => ACENTOS[c] ?? c).join("");
}

/**
 * O texto como o filtro enxerga: sem acento e sem caixa, números que imitam letras trocados (gr4tis → gratis),
 * pontuação virando espaço. Com `juntar`, as letras soltas em sequência viram uma palavra (g r a t i s → gratis).
 */
export function normalizar(texto: string, juntar = false): string {
  const base = [...semAcento(texto)].map((c) => TROCAS[c] ?? c).join("").replace(/[^a-z0-9%]+/g, " ").trim();
  if (!juntar) return base;
  const saida: string[] = [];
  let soltas = "";
  for (const palavra of base.split(" ")) {
    if (palavra.length === 1) {
      soltas += palavra;
      continue;
    }
    if (soltas) saida.push(soltas);
    soltas = "";
    saida.push(palavra);
  }
  if (soltas) saida.push(soltas);
  return saida.filter(Boolean).join(" ");
}

/** O padrão de um termo da lista: cada palavra normalizada; "*" no fim de uma palavra aceita qualquer final. */
export function padraoDoTermo(termo: string): RegExp {
  const palavras = termo.split(/\s+/).map((p) => {
    const aberta = p.endsWith("*");
    return normalizar(aberta ? p.slice(0, -1) : p).replace(/%/g, "%") + (aberta ? "[a-z0-9%]*" : "");
  });
  return new RegExp(`(^| )${palavras.join(" ")}( |$)`);
}

export interface Bloqueio {
  grupo: string;
  campo: string;
  motivo: string;
  sugestao: string;
}

const LISTA = regras.bloqueio.map((g) => ({ ...g, padroes: g.termos.map(padraoDoTermo) }));
const ESPECIAIS = regras.padroesEspeciais.map((p) => ({ ...p, padrao: new RegExp(p.regex) }));

/** Confere um texto: devolve a primeira regra que ele quebra, ou null. */
export function conferirTexto(texto: string, campo = "texto"): Bloqueio | null {
  if (!texto.trim()) return null;
  const cru = semAcento(texto);
  for (const p of ESPECIAIS) if (p.padrao.test(cru)) return { grupo: p.grupo, campo, motivo: p.motivo, sugestao: p.sugestao };
  const versoes = [normalizar(texto), normalizar(texto, true)];
  for (const g of LISTA) {
    if (g.padroes.some((padrao) => versoes.some((v) => padrao.test(v)))) return { grupo: g.grupo, campo, motivo: g.motivo, sugestao: g.sugestao };
  }
  return null;
}

/** Confere vários campos de uma vez (o que vai a público num perfil). */
export function conferirCampos(campos: Record<string, string | string[] | undefined>): Bloqueio | null {
  for (const [campo, valor] of Object.entries(campos)) {
    const texto = Array.isArray(valor) ? valor.join(" · ") : (valor ?? "");
    const achado = conferirTexto(texto, campo);
    if (achado) return achado;
  }
  return null;
}

/** O nome que cada campo tem na tela, para a mensagem de bloqueio. */
export const NOME_DO_CAMPO: Record<string, string> = { nome: "Nome", abordagem: "Abordagem", areas: "Áreas de atuação", cidade: "Cidade", bio: "Sobre meu trabalho", profissao: "Profissão" };
