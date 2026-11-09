// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Menções no que sai para o Fediverso. Acha "@nome@instancia" (e "@nome", alguém daqui) no texto de um post, resolve o ator de cada
// uma e devolve o que a Note precisa: as tags Mention, os links do HTML (h-card) e os destinos (o mencionado vai em "cc", senão o
// Mastodon não avisa: [M-AP], "Mention tags are required to generate a notification").
//
// A resolução de quem é de fora usa o WebFinger da outra instância. Quem chama passa o resolvedor (no servidor, `atorPorConta` de
// lib/rede/fediverso/servidor.ts, que busca com a trava de SSRF de lib/rede/fediverso/http.ts): este arquivo fica puro, sem rede
// e sem "@/", e roda nos testes. Até 10 menções por post (o resto fica texto), sem repetir.
import { lerConta } from "./enderecos";
import type { LinksDeMencao } from "./texto";

/** Uma menção achada no texto. `dominio` nulo = alguém daqui (só "@nome"). */
export interface MencaoNoTexto {
  usuario: string;
  dominio: string | null;
}

/** Uma menção resolvida, como o banco guarda e devolve no post (contrato 3.1, ação "post": mencoes). */
export interface MencaoFederada {
  /** "nome@instancia", sem o @ do começo. */
  handle: string;
  /** O id do ator (vai no href da Mention e em "cc"). */
  ator: string;
  /** A caixa de entrada (para a fila entregar a quem foi mencionado). */
  inbox?: string | null;
  /** A página de gente do perfil (o link do HTML); sem ela, o próprio ator. */
  url?: string | null;
}

export const MAX_MENCOES = 10;

const MENCAO = /(^|[\s(])@([a-z0-9_.-]{1,64})(?:@([a-z0-9-]+(?:\.[a-z0-9-]+)+(?::\d{1,5})?))?(?![a-z0-9_@-])/gi;

/** As menções do texto, na ordem, sem repetir (nome e domínio em minúsculas), até `max`. */
export function acharMencoes(texto: string, max = MAX_MENCOES): MencaoNoTexto[] {
  const vistas = new Map<string, MencaoNoTexto>();
  for (const m of texto.slice(0, 20_000).matchAll(MENCAO)) {
    const usuario = m[2].replace(/[.-]+$/, "");
    if (!usuario) continue;
    const dominio = m[3] ? m[3].toLowerCase() : null;
    if (dominio && !lerConta(`${usuario}@${dominio}`)) continue;
    const chave = `${usuario.toLowerCase()}@${dominio ?? ""}`;
    if (!vistas.has(chave)) vistas.set(chave, { usuario: dominio ? usuario : usuario.toLowerCase(), dominio });
    if (vistas.size >= max) break;
  }
  return [...vistas.values()];
}

/** O que o resolvedor de fora devolve (a forma de `AtorRemoto` em servidor.ts basta). */
export interface AtorAchado {
  ator: string;
  inbox?: string | null;
  inbox_compartilhada?: string | null;
  url?: string | null;
}

export interface ComoResolver {
  /** Os domínios daqui (o da Alumia e, no modo total, o curto): "@nome@institutolucia.org" é alguém daqui. */
  dominiosLocais: readonly string[];
  /** Acha o ator de fora pelo WebFinger (no servidor: atorPorConta). Nulo = não existe ou não respondeu. */
  deFora: (usuario: string, dominio: string) => Promise<AtorAchado | null>;
  /** O ator de alguém daqui, se ele federa (nulo = não federa: a menção fica texto e nada sai sobre ele). */
  daqui?: (handle: string) => Promise<{ ator: string; url?: string | null } | null>;
  /** O domínio do acct: de quem é daqui (para o "name" da Mention). */
  dominioDaConta: string;
}

/**
 * Resolve as menções do texto. As de fora vão ao WebFinger em paralelo (cada uma falha sozinha); as daqui só entram se a pessoa
 * federa, para nunca revelar a outra instância o @ de quem não ligou a federação.
 */
export async function resolverMencoes(texto: string, como: ComoResolver): Promise<MencaoFederada[]> {
  const locais = new Set(como.dominiosLocais.map((d) => d.toLowerCase()));
  const achadas = acharMencoes(texto);
  const resolvidas = await Promise.allSettled(
    achadas.map(async (m): Promise<MencaoFederada | null> => {
      if (!m.dominio || locais.has(m.dominio)) {
        const handle = m.usuario.toLowerCase();
        if (!/^[a-z0-9_]{3,20}$/.test(handle) || !como.daqui) return null;
        const a = await como.daqui(handle);
        return a ? { handle: `${handle}@${como.dominioDaConta}`, ator: a.ator, inbox: null, url: a.url ?? null } : null;
      }
      const a = await como.deFora(m.usuario, m.dominio);
      if (!a || !/^https:\/\//.test(a.ator)) return null;
      return { handle: `${m.usuario}@${m.dominio}`, ator: a.ator, inbox: a.inbox_compartilhada ?? a.inbox ?? null, url: a.url ?? null };
    }),
  );
  const saida: MencaoFederada[] = [];
  for (const r of resolvidas) if (r.status === "fulfilled" && r.value && !saida.some((s) => s.ator === r.value!.ator)) saida.push(r.value);
  return saida;
}

/** As tags Mention da Note ([M-AP]: "href" = o ator, "name" = "@nome@instancia"). */
export function tagsDeMencao(mencoes: readonly MencaoFederada[]) {
  return mencoes.filter((m) => /^https:\/\//.test(m.ator)).slice(0, MAX_MENCOES).map((m) => ({ type: "Mention" as const, href: m.ator, name: `@${m.handle.replace(/^@/, "")}` }));
}

/** Os atores mencionados (vão em "cc" da Note e da atividade). */
export function destinosDeMencao(mencoes: readonly MencaoFederada[]): string[] {
  return [...new Set(mencoes.filter((m) => /^https:\/\//.test(m.ator)).slice(0, MAX_MENCOES).map((m) => m.ator))];
}

/**
 * Os links do HTML: "nome@instancia" e, para quem é daqui, também "nome" (o texto escrito na Alumia costuma trazer só "@nome").
 * O link vai para a página de gente (url) quando há; senão, para o ator.
 */
export function linksDeMencao(mencoes: readonly MencaoFederada[], dominiosLocais: readonly string[] = []): LinksDeMencao {
  const locais = new Set(dominiosLocais.map((d) => d.toLowerCase()));
  const links = new Map<string, string>();
  for (const m of mencoes.slice(0, MAX_MENCOES)) {
    const href = m.url && /^https:\/\//.test(m.url) ? m.url : m.ator;
    if (!/^https:\/\//.test(href)) continue;
    const handle = m.handle.replace(/^@/, "").toLowerCase();
    links.set(handle, href);
    const [nome, dominio] = handle.split("@");
    if (dominio && locais.has(dominio)) {
      // "@ana" e "@ana@alumia.institutolucia.org" também ligam quem é daqui.
      links.set(nome, href);
      for (const d of locais) links.set(`${nome}@${d}`, href);
    }
  }
  return links;
}
