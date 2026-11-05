// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
// A casca do aplicativo (components/app/): quando vale e como o endereço vira aba. Sem React e sem disco: roda no
// servidor, no navegador e no Node (scripts/testar-app-casca.mjs). Arquitetura em docs/APP.md.

/**
 * Quando a casca vale: tela de celular (abaixo de 768 px) ou o site instalado (display-mode: standalone) num aparelho de
 * toque (tablet). O computador, no navegador ou instalado, não muda. O CSS (app/app-casca.css) usa a MESMA consulta.
 */
export const CONSULTA_CASCA = "(max-width: 767.98px), (display-mode: standalone) and (pointer: coarse)";

/** As abas de baixo, nesta ordem. */
export type AbaDoApp = "inicio" | "estudar" | "jogos" | "comunidade" | "eu";
export const ABAS: readonly AbaDoApp[] = ["inicio", "estudar", "jogos", "comunidade", "eu"];

/** A raiz de cada aba (sem o idioma). Tocar na aba aberta, estando numa tela de dentro, volta para cá. */
export const RAIZ_DA_ABA: Record<AbaDoApp, string> = {
  inicio: "/",
  estudar: "/trilhas",
  jogos: "/jogos",
  comunidade: "/comunidade",
  eu: "/meu-estudo",
};

/** O primeiro trecho do endereço (depois do idioma) que pertence a cada aba. A ordem não importa: nenhum trecho se repete. */
const TRECHOS_DA_ABA: Record<Exclude<AbaDoApp, "inicio">, readonly string[]> = {
  estudar: ["trilhas", "estantes", "acervo", "enem", "escola", "nivelamento", "questoes", "glossario", "estudo-em-grupo", "reforco", "professores", "materiais", "guia", "comecar", "busca"],
  jogos: ["jogos", "laboratorios", "ferramentas", "estudio-de-pratica", "criancas"],
  comunidade: ["comunidade", "mural", "nucleos", "debates", "eventos", "plantao"],
  eu: ["meu-estudo", "caderno", "meus-dados", "entrar", "historico", "por-onde-andei", "modo-seguro", "privacidade"],
};

/** Tira o idioma do começo do endereço e devolve os trechos: "/pt/trilhas/x?y=1#z" vira ["trilhas", "x"]. */
export function trechosDoEndereco(pathname: string | null | undefined): string[] {
  const limpo = (pathname ?? "").split(/[?#]/)[0];
  const partes = limpo.split("/").filter(Boolean);
  return /^[a-z]{2}$/.test(partes[0] ?? "") ? partes.slice(1) : partes;
}

/** A aba a que o endereço pertence (nenhuma, nas telas soltas como a política de privacidade de um módulo novo). */
export function abaDoEndereco(pathname: string | null | undefined): AbaDoApp | null {
  const trechos = trechosDoEndereco(pathname);
  if (trechos.length === 0) return "inicio";
  for (const aba of ABAS) if (aba !== "inicio" && TRECHOS_DA_ABA[aba].includes(trechos[0])) return aba;
  return null;
}

/** Está na tela-raiz da aba? Então não há "voltar": a barra de cima mostra a marca e o nome da aba. */
export function ehRaizDaAba(pathname: string | null | undefined): boolean {
  const aba = abaDoEndereco(pathname);
  if (!aba) return false;
  return trechosDoEndereco(pathname).length <= trechosDoEndereco(RAIZ_DA_ABA[aba]).length;
}

/**
 * Telas onde a casca some e a tela ocupa o aparelho todo (laboratório aberto, leitura da aula em foco): quem decide é a
 * própria página, pelo gancho `useTelaCheia` (components/app/telas.ts). Aqui ficam só os endereços que SEMPRE são tela cheia.
 */
export function ehTelaCheiaPorEndereco(pathname: string | null | undefined): boolean {
  const t = trechosDoEndereco(pathname);
  // /laboratorios/<laboratorio>: o hub (/laboratorios) é lista e mantém a barra.
  return t[0] === "laboratorios" && t.length >= 2;
}

/** A Rede Lúcia v2 (quando ligada) e o painel têm a barra e o gesto deles; a casca fica de fora. */
export function ehTelaComCascaPropria(pathname: string | null | undefined, redeV2Ligada: boolean): boolean {
  const t = trechosDoEndereco(pathname);
  return t[0] === "painel" || (redeV2Ligada && t[0] === "comunidade");
}

/** A página de cima de um endereço: a aula volta para a trilha, a trilha para as disciplinas, o resto para a aba. */
export function paginaDeCima(trechos: string[]): string {
  if (trechos[0] === "estantes") return "/trilhas";
  const acima = trechos.slice(0, -1);
  return acima.length === 0 ? "/" : `/${acima.join("/")}`;
}
