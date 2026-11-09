// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Alumia: a rede social do instituto (o nome interno continua "rede", em código, tabelas e pastas). Ela tem endereço próprio,
// alumia.institutolucia.org, e vive nas rotas /[lang]/alumia/** (até 09/11/2026 eram /[lang]/comunidade/**, que agora vão com
// 308 para as novas: lib/rede/rota-alumia.ts). O proxy.ts reescreve o endereço próprio para essas rotas sem mudar a URL. Este arquivo é a lógica pura dessa troca (roda no proxy, nas páginas, no navegador e nos
// testes, sem os atalhos "@/" de propósito):
//
//   - NEXT_PUBLIC_ALUMIA_URL (ex.: https://alumia.institutolucia.org) liga o endereço próprio. Sem ela, nada muda: a Alumia
//     continua em /[lang]/alumia e os links do site apontam para lá. Com ela, o site manda "Comunidade" para lá.
//   - Um pedido que chega num host que começa com "alumia." (alumia.institutolucia.org, alumia.localhost para testar) é da Alumia.
//   - A sessão da conta fica no armazenamento do navegador, que é separado por endereço: quem entra pela Alumia entra de novo
//     no próprio subdomínio (a página /[lang]/entrar também abre lá). Passo a passo em docs/rede/ALUMIA-DOMINIO.md.

/** O nome da rede social do instituto, num lugar só (T32, item 1). O site continua "Instituto Lúcia". */
export const NOME_REDE = "Alumia";

/** O endereço próprio da Alumia, sem a barra do fim; vazio enquanto o domínio não está ligado. A referência é literal para o Next gravar o valor no navegador. */
export const ALUMIA_URL = (process.env.NEXT_PUBLIC_ALUMIA_URL ?? "").trim().replace(/\/+$/, "");

/** O endereço próprio é válido (https, ou http só em teste local)? */
export function urlDaAlumiaOk(url: string): boolean {
  return /^https:\/\/[a-z0-9.-]+(:\d+)?$/i.test(url) || /^http:\/\/[a-z0-9.-]*localhost(:\d+)?$/i.test(url);
}

export const alumiaComEndereco = urlDaAlumiaOk(ALUMIA_URL);

const IDIOMAS = ["pt", "en", "es", "fr", "ru", "zh"];

/** As telas da Alumia: no endereço próprio, /pt/p/<id> é o mesmo que /pt/alumia/p/<id>. */
export const ROTAS_DA_ALUMIA = [
  "p", "c", "u", "buscar", "explorar", "avisos", "editar-perfil", "denuncias", "silenciados", "cuidado", "moderacao",
  "comunidades", "propor", "aula", "nucleos", "tag", "salvos", "fediverso", "conversas",
  // Onda 5 (PLANO-ALUMIA, F0): as rotas novas, cada uma atrás da sua flag (lib/rede/rotas-novas.ts; 404 com a flag desligada).
  "atos", "ato", "organizacoes", "stories", "seguranca", "identidades", "aparelhos", "o-que-guardamos", "transparencia",
  "calendario", "listas", "leve",
] as const;

/** Páginas do site que também abrem no endereço da Alumia (entrar na conta, regras, privacidade): a sessão é por endereço. */
export const PAGINAS_LIVRES_NA_ALUMIA = ["entrar", "conduta", "privacidade", "termos", "meus-dados", "fora-do-ar"] as const;

/** O host (com ou sem porta) é o da Alumia? */
export function hostDaAlumia(host: string | null | undefined): boolean {
  const nome = (host ?? "").toLowerCase().trim().replace(/:\d+$/, "");
  if (!nome) return false;
  if (nome.startsWith("alumia.")) return true;
  if (!alumiaComEndereco) return false;
  try {
    return new URL(ALUMIA_URL).hostname.toLowerCase() === nome;
  } catch {
    return false;
  }
}

/**
 * O endereço de uma tela da Alumia para um link: `caminho` é relativo à Alumia ("" = a linha, "/p/<id>", "/u/<handle>").
 * Com o endereço próprio ligado, vai para lá (português sem prefixo, os outros idiomas com ele); sem ele, /[lang]/alumia.
 */
export function enderecoDaAlumia(lang: string, caminho = "", base: string = ALUMIA_URL): string {
  const resto = caminho && !caminho.startsWith("/") && !caminho.startsWith("?") ? `/${caminho}` : caminho;
  if (urlDaAlumiaOk(base)) return lang === "pt" ? `${base}${resto.startsWith("/") ? resto : `/${resto}`}` : `${base}/${lang}${resto}`;
  return `/${lang}/alumia${resto}`;
}

/**
 * Converte um caminho do site (/[lang]/alumia/…, ou o antigo /[lang]/comunidade/…) no endereço próprio da Alumia, ou nulo
 * quando ele não é da Alumia. Os dois prefixos dão o mesmo destino: um salto só.
 */
export function caminhoDoSiteParaAlumia(pathname: string, search = "", base: string = ALUMIA_URL): string | null {
  if (!urlDaAlumiaOk(base)) return null;
  const m = /^\/([a-z]{2})\/(?:alumia|comunidade)(\/.*)?$/.exec(pathname);
  if (!m || !IDIOMAS.includes(m[1])) return null;
  return `${enderecoDaAlumia(m[1], m[2] ?? "", base)}${search}`;
}

/** O que fazer com um pedido que chegou no host da Alumia. */
export type DecisaoDaAlumia =
  /** Servir outra rota do app com a mesma URL (reescrita). */
  | { tipo: "reescrever"; destino: string }
  /** Seguir como está (a rota já existe: /[lang]/alumia/**, entrar, regras…). */
  | { tipo: "seguir" }
  /**
   * O endereço antigo (/[lang]/comunidade/…): redirecionar (308, permanente) para o caminho curto no mesmo host (destino),
   * MANTENDO a busca. `completo` é o mesmo lugar em /[lang]/alumia/…: o proxy passa ele ao enderecoAntigoDaRede, para um
   * ?t=/?post= do Fórum ir direto ao destino final, num salto só.
   */
  | { tipo: "mover"; destino: string; completo: string }
  /** Redirecionar (307) para outro caminho no mesmo host da Alumia. */
  | { tipo: "redirecionar"; destino: string }
  /** O resto do site mora no endereço do instituto: redirecionar (307) para lá, mesmo caminho. */
  | { tipo: "site"; destino: string };

const ACTIVITY = /application\/(activity\+json|ld\+json)/i;
const HANDLE = /^[a-z0-9_]{3,20}$/;
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Decide o caminho de um pedido no host da Alumia. `aceita` é o cabeçalho Accept: um servidor do Fediverso que pede um
 * perfil (/@nome, /pt/u/nome) ou um post (/pt/p/<id>) em ActivityPub recebe o documento da federação, não a página.
 */
export function rotaNaAlumia(pathname: string, aceita = ""): DecisaoDaAlumia {
  const partes = pathname.split("/").filter(Boolean);
  const ap = ACTIVITY.test(aceita);

  // /@nome: o endereço curto de um perfil, como nas outras redes do Fediverso.
  if (partes.length === 1 && partes[0].startsWith("@")) {
    const handle = partes[0].slice(1).toLowerCase();
    if (!HANDLE.test(handle)) return { tipo: "reescrever", destino: "/pt/alumia/u/-" };
    return { tipo: "reescrever", destino: ap ? `/api/fediverso/u/${handle}` : `/pt/alumia/u/${handle}` };
  }

  // Sem idioma no começo vale o português: / é a linha, /p/<id> é o post.
  const comIdioma = partes.length > 0 && IDIOMAS.includes(partes[0]);
  const lang = comIdioma ? partes[0] : "pt";
  const resto = comIdioma ? partes.slice(1) : partes;

  if (resto.length === 0) return { tipo: "reescrever", destino: `/${lang}/alumia` };

  // O endereço completo (/pt/alumia/…) continua valendo no host da Alumia: os links internos da rede usam ele. O antigo
  // (/pt/comunidade/…) também é lido aqui, para o ActivityPub abaixo.
  const antigo = resto[0] === "comunidade";
  const telas = resto[0] === "alumia" || antigo ? resto.slice(1) : resto;
  const jaCompleto = resto[0] === "alumia";
  // Um servidor do Fediverso que guardou o "url" antigo (/pt/comunidade/p/<id>, /pt/comunidade/u/<nome>) recebe o documento
  // direto, sem depender de seguir redirecionamento.
  if (ap && telas.length === 2 && telas[0] === "u" && HANDLE.test(telas[1])) return { tipo: "reescrever", destino: `/api/fediverso/u/${telas[1]}` };
  if (ap && telas.length === 2 && telas[0] === "p" && ID.test(telas[1])) return { tipo: "reescrever", destino: `/api/fediverso/p/${telas[1].toLowerCase()}` };

  // O endereço antigo (/pt/comunidade/…) vai com 308, com a busca, para o caminho CURTO do host próprio (/, /p/<id>, /en/p/<id>)
  // quando ele é uma tela da Alumia; senão para /pt/alumia/… (que dá 404, sem laço). O ?t=/?post= do Fórum vai direto ao
  // destino final pelo `completo` (um salto só).
  if (antigo) {
    const completo = `/${lang}/alumia${telas.length ? `/${telas.join("/")}` : ""}`;
    if (telas.length && !(ROTAS_DA_ALUMIA as readonly string[]).includes(telas[0])) return { tipo: "mover", destino: completo, completo };
    const curto = lang === "pt" ? `/${telas.join("/")}` : `/${lang}${telas.length ? `/${telas.join("/")}` : ""}`;
    return { tipo: "mover", destino: curto, completo };
  }
  if (jaCompleto) return comIdioma ? { tipo: "seguir" } : { tipo: "reescrever", destino: `/pt/${resto.join("/")}` };

  if ((ROTAS_DA_ALUMIA as readonly string[]).includes(resto[0])) return { tipo: "reescrever", destino: `/${lang}/alumia/${resto.join("/")}` };
  if ((PAGINAS_LIVRES_NA_ALUMIA as readonly string[]).includes(resto[0])) {
    return comIdioma ? { tipo: "seguir" } : { tipo: "reescrever", destino: `/pt/${resto.join("/")}` };
  }
  // Depois de entrar na conta, a página de entrar manda para o painel: na Alumia, a pessoa volta para a linha.
  if (resto[0] === "painel" && resto.length === 1) return { tipo: "redirecionar", destino: `/${lang}` };
  return { tipo: "site", destino: comIdioma ? pathname : `/pt${pathname === "/" ? "" : pathname}` };
}
