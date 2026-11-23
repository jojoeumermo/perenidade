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
  // Acabamento da Faixa 1: aparência e leitura, posts que se repetem e a linha dos #temas.
  "aparencia", "series", "temas",
  // A linha com regra aberta (interruptor "alumia-linha-aberta").
  "linhas", "como-a-linha",
  // Onda 8: a lei e a ajuda da Alumia, os meus dados e os convites (no host próprio, as da Alumia, não as do site).
  "termos", "privacidade", "regras", "ajuda", "meus-dados", "convite",
  // Onda 9: o modo ato (com o guia sem sinal) e os rótulos assináveis.
  "modo-ato", "rotulos",
  // Onda 11: o estudo (questões, turmas, agenda, redação) e as conquistas com o mural de aprovados.
  "questoes", "turmas", "agenda", "redacao", "conquistas", "aprovados",
  // Onda 12: o pacote inicial (/alumia/pacote/[slug]), com quem aceitou entrar nele (nunca indexado).
  "pacote",
  // Onda 13: o mapa e o ao vivo (/alumia/mapa, /alumia/mapa/ao-vivo), as pontes e o Mural dos Trabalhadores.
  "mapa", "pontes", "trabalhadores",
  // P5 (A5): a página de denúncia da própria Alumia.
  "denunciar",
  // Prompt 4: a segurança pessoal (registro de abuso, plantão jurídico, interruptor de sumiço).
  "seguranca-pessoal",
  // Prompt 4: a criação coletiva (rascunho coletivo, margem do acervo, cartaz e zine).
  "criacao",
  // Prompt 4: a cultura (obra seriada, mural de arte, cineclube, clube de leitura e playlist).
  "cultura",
  // Prompt 4: a memória da luta e o desafio do dia.
  "memoria-da-luta", "desafio",
  // Prompt 4: organização e ação coletiva.
  "organizar",
  // Prompt 4: a ação coletiva (Parte F).
  "acao-coletiva",
  // Prompt 4: o perto (localização cifrada, pedido de ajuda e volta para casa).
  "perto",
  // Prompt 4: descoberta e estudo (assuntos em movimento, linhas compartilháveis, simulado, mentoria, editais e o resto da Parte G).
  "descobrir", "estudar",
  // Prompt 4: conta e convivência (Parte H).
  "conta",
  // Prompt 4: o leitor de fios (lote "pontes", item 133).
  "fio",
] as const;

/**
 * Páginas do site que também abrem no endereço da Alumia (entrar na conta, conduta do site): a sessão é por endereço. Os termos,
 * a privacidade e os meus dados da Alumia (onda 8) são telas dela, em ROTAS_DA_ALUMIA.
 */
export const PAGINAS_LIVRES_NA_ALUMIA = ["entrar", "conduta", "fora-do-ar"] as const;

/**
 * A entrada da Alumia (P5, A3): entrar e criar conta na Alumia é só dentro dela, no portão (components/rede/entrada/PortaoDaAlumia.tsx),
 * nunca na página de entrar do site. `volta` é a tela da Alumia para onde a pessoa vai depois de entrar (/alumia/organizacoes,
 * /pt/alumia/p/<id>, o antigo /comunidade/…); qualquer outra coisa (outro endereço, "//", barra invertida) vira a linha. O portão
 * abre a aba pedida (?entrar ou ?criar) e, depois de entrar, mostra a própria tela. `extra`: outros parâmetros que vão junto (a
 * volta de um link de e-mail, ?code=…), já sem o "?".
 */
export function entradaDaAlumia(lang: string, volta?: string | null, criar = false, extra = ""): string {
  const lingua = IDIOMAS.includes(lang) ? lang : "pt";
  const caminho = (volta ?? "").split(/[?#]/)[0];
  const m = /^\/(?:(?:pt|en|es|fr|ru|zh)\/)?(?:alumia|comunidade)((?:\/[\w\-~@][\w\-.~%@]*)*)\/?$/.exec(caminho);
  return `/${lingua}/alumia${m?.[1] ?? ""}?${criar ? "criar" : "entrar"}${extra ? `&${extra}` : ""}`;
}

/** A entrada da Alumia para quem chegou na página de entrar do site com a busca `busca` (?volta=/alumia/…&criar&code=…). */
export function entradaDaAlumiaPelaBusca(lang: string, busca: string): string {
  const p = new URLSearchParams(busca);
  const criar = p.has("criar");
  const volta = p.get("volta");
  for (const k of ["criar", "entrar", "volta"]) p.delete(k);
  return entradaDaAlumia(lang, volta, criar, p.toString());
}

/** A volta (?volta=) é uma tela da Alumia? Então a página de entrar do site manda para a entrada da Alumia. */
export function voltaDaAlumia(volta: string | null | undefined): boolean {
  return /^\/(?:(?:pt|en|es|fr|ru|zh)\/)?(?:alumia|comunidade)(?:[/?#]|$)/.test(volta ?? "");
}

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
  /**
   * Redirecionar (307) para outro caminho no mesmo host da Alumia. `busca` (com o "?") vai junto quando existe: o proxy a põe no
   * endereço novo (sem ela, a busca do pedido é tirada). `permanente`: 308, o endereço mudou de vez.
   */
  | { tipo: "redirecionar"; destino: string; busca?: string; permanente?: true }
  /** O resto do site mora no endereço do instituto: redirecionar (307) para lá, mesmo caminho. */
  | { tipo: "site"; destino: string };

const ACTIVITY = /application\/(activity\+json|ld\+json)/i;
const HANDLE = /^[a-z0-9_]{3,20}$/;
/** nome@servidor de uma conta de fora: o nome como os outros servidores aceitam (com ponto e hífen no meio), o servidor com ponto. */
const CONTA_DE_FORA = /^([a-z0-9_](?:[a-z0-9_.-]{0,62}[a-z0-9_])?)@((?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63})$/;
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Decide o caminho de um pedido no host da Alumia. `aceita` é o cabeçalho Accept: um servidor do Fediverso que pede um
 * perfil (/@nome, /pt/u/nome) ou um post (/pt/p/<id>) em ActivityPub recebe o documento da federação, não a página.
 */
export function rotaNaAlumia(pathname: string, aceita = "", busca = ""): DecisaoDaAlumia {
  const partes = pathname.split("/").filter(Boolean);
  const ap = ACTIVITY.test(aceita);

  // /@nome: o endereço curto de um perfil, como nas outras redes do Fediverso.
  if (partes.length === 1 && partes[0].startsWith("@")) {
    const handle = partes[0].slice(1).toLowerCase();
    // /@nome@servidor: "ver esta conta daqui", como nas outras redes do Fediverso. Vai para o perfil de fora (/alumia/fediverso
    // ?conta=); é redirecionamento, e não reescrita, porque a busca não cabe no caminho reescrito. A página confere a flag.
    if (!ap && CONTA_DE_FORA.test(handle)) return { tipo: "redirecionar", destino: "/pt/alumia/fediverso", busca: `?conta=${encodeURIComponent(`@${handle}`)}` };
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
  // P5 (A3): entrar e criar conta na Alumia é só no portão dela. A página de entrar do site, no endereço da Alumia, vai de vez para
  // a entrada da Alumia (a tela da volta, com a aba pedida e os outros parâmetros, como o ?code= de um link de e-mail).
  if (resto[0] === "entrar" && resto.length === 1) {
    const destino = entradaDaAlumiaPelaBusca(lang, busca);
    const i = destino.indexOf("?");
    return { tipo: "redirecionar", destino: destino.slice(0, i), busca: destino.slice(i), permanente: true };
  }
  if ((PAGINAS_LIVRES_NA_ALUMIA as readonly string[]).includes(resto[0])) {
    return comIdioma ? { tipo: "seguir" } : { tipo: "reescrever", destino: `/pt/${resto.join("/")}` };
  }
  // Depois de entrar na conta, a página de entrar manda para o painel: na Alumia, a pessoa volta para a linha.
  if (resto[0] === "painel" && resto.length === 1) return { tipo: "redirecionar", destino: `/${lang}` };
  return { tipo: "site", destino: comIdioma ? pathname : `/pt${pathname === "/" ? "" : pathname}` };
}
