// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O endereço próprio da Escola (auditoria da Escola de 9/11, risco 1; relatório guardado fora do repositório): escola.institutolucia.org, com a variável
// NEXT_PUBLIC_ESCOLA_URL ligada. No navegador, cada endereço é uma "origem" separada: a sessão, o armazenamento e o
// cofre da Escola ficam fora do alcance de qualquer página do site aberto. Uma falha de injeção numa das centenas de
// páginas do site (editor, laboratórios, comunidade) deixa de alcançar a Escola.
//
// No host da Escola só abrem a Escola (/[lang]/escola/**) e as páginas de entrar e das regras; o resto vai (307) para o
// endereço do instituto. No endereço do instituto, com a variável ligada, /[lang]/escola/** vai (307, temporário de
// propósito: desligar a variável volta tudo como era) para o endereço próprio, menos as duas páginas abertas (o chamado
// de militantes e o manifesto), que continuam no site. Sem a variável, nada muda.
// Sem os atalhos "@/" de propósito (roda no Node nos testes).

export const ESCOLA_URL = (process.env.NEXT_PUBLIC_ESCOLA_URL ?? "").trim().replace(/\/+$/, "");

export function urlDaEscolaOk(url: string): boolean {
  return /^https:\/\/[a-z0-9.-]+(:\d+)?$/i.test(url) || /^http:\/\/[a-z0-9.-]*localhost(:\d+)?$/i.test(url);
}

export const escolaComEndereco = urlDaEscolaOk(ESCOLA_URL);

const IDIOMAS = ["pt", "en", "es", "fr", "ru", "zh"];
/** Páginas da Escola que ficariam no site do instituto. Desde 09/11/2026, nenhuma: o chamado, o manifesto e o entrar
 * abrem no endereço da Escola, no desenho dela, também para quem ainda não é militante (lib/escola/rotas.ts). */
const ABERTAS: string[] = [];
/** Fora da Escola, o que também abre no host dela: entrar, as regras e a página de fora do ar. */
export const PAGINAS_LIVRES_NA_ESCOLA = ["entrar", "conduta", "privacidade", "termos", "meus-dados", "fora-do-ar", "modo-seguro"] as const;

/** O pedido chegou pelo host da Escola? "escola.*" sempre conta (escola.localhost, para testar). */
export function hostDaEscola(host: string | null | undefined, base: string = ESCOLA_URL): boolean {
  const nome = (host ?? "").toLowerCase().trim().replace(/:\d+$/, "");
  if (!nome) return false;
  if (nome.startsWith("escola.")) return true;
  if (!urlDaEscolaOk(base)) return false;
  try {
    return new URL(base).hostname.toLowerCase() === nome;
  } catch {
    return false;
  }
}

export type DecisaoDaEscola = { tipo: "seguir" } | { tipo: "redirecionar"; destino: string } | { tipo: "site"; destino: string };

/** O que fazer com um caminho pedido no host da Escola. */
export function rotaNaEscola(pathname: string): DecisaoDaEscola {
  const partes = pathname.split("/").filter(Boolean);
  if (partes.length === 0) return { tipo: "redirecionar", destino: "/pt/escola" };
  const comIdioma = IDIOMAS.includes(partes[0]);
  const lang = comIdioma ? partes[0] : "pt";
  const resto = comIdioma ? partes.slice(1) : partes;
  if (resto.length === 0) return { tipo: "redirecionar", destino: `/${lang}/escola` };
  if (resto[0] === "escola") {
    if (ABERTAS.includes(resto[1] ?? "")) return { tipo: "site", destino: `/${lang}/${resto.join("/")}` };
    return comIdioma ? { tipo: "seguir" } : { tipo: "redirecionar", destino: `/pt/${resto.join("/")}` };
  }
  if ((PAGINAS_LIVRES_NA_ESCOLA as readonly string[]).includes(resto[0])) {
    return comIdioma ? { tipo: "seguir" } : { tipo: "redirecionar", destino: `/pt/${resto.join("/")}` };
  }
  return { tipo: "site", destino: `/${lang}/${resto.join("/")}` };
}

/** No site do instituto: o endereço da Escola própria para este caminho, ou null (fica onde está). */
export function caminhoDoSiteParaEscola(pathname: string, search = "", base: string = ESCOLA_URL): string | null {
  if (!urlDaEscolaOk(base)) return null;
  const m = /^\/([a-z]{2})\/escola(\/[^?]*)?$/.exec(pathname);
  if (!m || !IDIOMAS.includes(m[1])) return null;
  const sub = (m[2] ?? "").split("/").filter(Boolean)[0] ?? "";
  if (ABERTAS.includes(sub)) return null;
  return `${base}${pathname}${search}`;
}

/** O endereço do site do instituto visto do host da Escola (escola.x → x). */
export function siteVistoDaEscola(protocolo: string, host: string, padrao: URL): URL {
  const h = host.toLowerCase();
  if (h.startsWith("escola.")) return new URL(`${protocolo}//${h.slice("escola.".length)}`);
  return padrao;
}
