// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Editar conteúdo em arquivo pelo painel: o texto novo vira um branch e um PR no GitHub (API oficial), com token guardado só
// no servidor (GITHUB_CONTEUDO_TOKEN: permissões "Contents" e "Pull requests" de escrita, só neste repositório). Nada vai ao
// ar sozinho: uma pessoa lê o PR e junta (merge); a publicação segue a rotina de sempre. As correções aprovadas
// (docs/backend-1.md) usam o mesmo caminho. O PR nunca leva o nome de quem pediu (LGPD, art. 6º, III: só o necessário).
//
// Sem os atalhos "@/" de propósito: `npm run testar:backend-1` roda este arquivo direto no Node.

/** Pastas de content/ que o painel pode editar (só Markdown). Fora daqui (saúde, Vale o Escrito, dados em JSON): nunca. */
export const PASTAS_EDITAVEIS = ["trilhas", "paginas", "glossario", "professores", "contribuir", "falacias", "debates", "memorial"] as const;

export const LIMITE_DO_ARQUIVO = 200_000;

/** O caminho é um .md de uma pasta permitida, sem "..", sem barra dupla, em minúsculas? */
export function caminhoValido(caminho: unknown): caminho is string {
  if (typeof caminho !== "string" || caminho.length > 200) return false;
  if (!/^content\/[a-z0-9/_.-]+\.md$/.test(caminho)) return false;
  if (caminho.includes("..") || caminho.includes("//")) return false;
  const partes = caminho.split("/");
  if (partes.some((p) => p === "" || p === "." || p.startsWith("."))) return false;
  return partes.length >= 3 && (PASTAS_EDITAVEIS as readonly string[]).includes(partes[1]);
}

/** Troca o trecho só se ele aparecer UMA vez; senão diz por que não. */
export function substituirTrecho(texto: string, trecho: string, troca: string): { ok: true; texto: string } | { ok: false; erro: "trecho_ausente" | "trecho_repetido" | "trecho_vazio" } {
  if (!trecho) return { ok: false, erro: "trecho_vazio" };
  const primeiro = texto.indexOf(trecho);
  if (primeiro < 0) return { ok: false, erro: "trecho_ausente" };
  if (texto.indexOf(trecho, primeiro + trecho.length) >= 0) return { ok: false, erro: "trecho_repetido" };
  return { ok: true, texto: texto.slice(0, primeiro) + troca + texto.slice(primeiro + trecho.length) };
}

/** O navegador manda o texto com \n; se o arquivo era CRLF, devolve em CRLF para o PR não mostrar o arquivo todo mudado. */
export function manterFimDeLinha(original: string, novo: string): string {
  const crlf = /\r\n/.test(original);
  const limpo = novo.replace(/\r\n/g, "\n");
  return crlf ? limpo.replace(/\n/g, "\r\n") : limpo;
}

/** Nome do branch: "painel/<arquivo>-<data e hora>-<sufixo>". Só letras minúsculas, números e hífen. */
export function nomeDoBranch(caminho: string, agora: Date = new Date(), sufixo = Math.random().toString(36).slice(2, 6)): string {
  const base = caminho.replace(/^content\//, "").replace(/\.md$/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "conteudo";
  const marca = agora.toISOString().replace(/[-:T]/g, "").slice(0, 14);
  return `painel/${base}-${marca}-${sufixo.replace(/[^a-z0-9]/g, "").slice(0, 6) || "x"}`;
}

export type TipoDePR = "edicao" | "correcao";

/** Título e corpo do PR. Sem nome de pessoa: quem pediu fica só no registro do banco. */
export function textoDoPR(tipo: TipoDePR, caminho: string, resumo: string): { titulo: string; corpo: string } {
  const limpo = resumo.replace(/[\r\n]+/g, " ").trim().slice(0, 200);
  const titulo = (tipo === "correcao" ? "Correção aprovada: " : "Edição pelo painel: ") + caminho.replace(/^content\//, "");
  const linhas = [
    tipo === "correcao" ? "Correção aprovada no painel por uma pessoa que não é quem propôs." : "Edição feita por uma pessoa da equipe no painel.",
    "",
    `Arquivo: \`${caminho}\``,
  ];
  if (limpo) linhas.push(`Resumo: ${limpo}`);
  linhas.push("", 'Nada foi publicado: leia as mudanças em "Files changed" e junte (merge) só se estiver certo. A publicação segue a rotina de sempre.');
  return { titulo, corpo: linhas.join("\n") };
}

export interface ConfigGitHub {
  token: string;
  repo: string;
  base: string;
}

const cabecalhos = (token: string) => ({ Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "Content-Type": "application/json" });
const api = (repo: string, resto: string) => `https://api.github.com/repos/${repo}${resto}`;
const trechoDoCaminho = (caminho: string) => caminho.split("/").map(encodeURIComponent).join("/");

export class ErroGitHub extends Error {
  etapa: string;
  status: number;
  constructor(etapa: string, status: number) {
    super(`${etapa}:${status}`);
    this.etapa = etapa;
    this.status = status;
  }
}

async function chamar(buscar: typeof fetch, etapa: string, url: string, token: string, init: RequestInit = {}): Promise<unknown> {
  const resposta = await buscar(url, { ...init, headers: cabecalhos(token), signal: AbortSignal.timeout(15_000) }).catch(() => null);
  if (!resposta) throw new ErroGitHub(etapa, 0);
  if (!resposta.ok) throw new ErroGitHub(etapa, resposta.status);
  return resposta.json();
}

/** Lê o arquivo no branch base (texto e sha). */
export async function lerArquivo(c: ConfigGitHub, caminho: string, buscar: typeof fetch = fetch): Promise<{ texto: string; sha: string }> {
  const dados = (await chamar(buscar, "ler", api(c.repo, `/contents/${trechoDoCaminho(caminho)}?ref=${encodeURIComponent(c.base)}`), c.token)) as { content?: string; sha?: string; encoding?: string };
  if (!dados.content || !dados.sha || dados.encoding !== "base64") throw new ErroGitHub("ler", 404);
  return { texto: Buffer.from(dados.content, "base64").toString("utf8"), sha: dados.sha };
}

/**
 * Abre o PR: cria o branch a partir do base, grava o arquivo nele e abre o pull request. Nunca junta (merge) nada.
 * Devolve o número e o endereço do PR.
 */
export async function abrirPR(
  c: ConfigGitHub,
  p: { caminho: string; novoTexto: string; shaAtual: string; tipo: TipoDePR; resumo: string },
  buscar: typeof fetch = fetch,
  agora: Date = new Date(),
): Promise<{ numero: number; url: string; branch: string }> {
  if (!caminhoValido(p.caminho)) throw new ErroGitHub("caminho", 400);
  if (p.novoTexto.length > LIMITE_DO_ARQUIVO) throw new ErroGitHub("tamanho", 413);
  const ref = (await chamar(buscar, "base", api(c.repo, `/git/ref/heads/${encodeURIComponent(c.base)}`), c.token)) as { object?: { sha?: string } };
  const shaBase = ref.object?.sha;
  if (!shaBase) throw new ErroGitHub("base", 404);
  const branch = nomeDoBranch(p.caminho, agora);
  await chamar(buscar, "branch", api(c.repo, "/git/refs"), c.token, { method: "POST", body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: shaBase }) });
  const { titulo, corpo } = textoDoPR(p.tipo, p.caminho, p.resumo);
  await chamar(buscar, "gravar", api(c.repo, `/contents/${trechoDoCaminho(p.caminho)}`), c.token, {
    method: "PUT",
    body: JSON.stringify({ message: titulo, content: Buffer.from(p.novoTexto, "utf8").toString("base64"), sha: p.shaAtual, branch }),
  });
  const pr = (await chamar(buscar, "pr", api(c.repo, "/pulls"), c.token, { method: "POST", body: JSON.stringify({ title: titulo, body: corpo, head: branch, base: c.base }) })) as { number?: number; html_url?: string };
  if (!pr.number || !pr.html_url) throw new ErroGitHub("pr", 502);
  return { numero: pr.number, url: pr.html_url, branch };
}

/** Configuração do servidor, ou null se o token não foi posto (sem ele, a edição por PR nem aparece). */
export function configDoServidor(env: Record<string, string | undefined> = process.env): ConfigGitHub | null {
  const token = env.GITHUB_CONTEUDO_TOKEN;
  if (!token) return null;
  return { token, repo: env.GITHUB_PUBLICAR_REPO || "jojoeumermo/perenidade", base: env.GITHUB_CONTEUDO_BASE || "master" };
}
