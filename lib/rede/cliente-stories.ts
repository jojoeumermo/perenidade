// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As chamadas dos stories ao banco (PLANO-ALUMIA F5 e §5). As funções rede_story_* estão em
// supabase/migracoes/20261109-alumia-f5.sql: o front-end chama pelos nomes daqui. Enquanto o banco não as tem, a tela
// mostra "o banco ainda não tem os stories" (nunca dado inventado). Só com NEXT_PUBLIC_ALUMIA_PREVIA=sim a tela usa o dublê de
// lib/rede/stories/exemplos.ts, com dados de exemplo e sem enviar nada. Sem "@/" de propósito (roda no Node nos testes).
//
// Privacidade (PLANO-ALUMIA §6.4; LGPD art. 6º, III, necessidade, e art. 11, dado sensível): NENHUMA chamada daqui diz ao
// servidor que alguém VIU um story. Abrir os stories de alguém é uma leitura igual a abrir um perfil; o "já vi" fica só no
// aparelho (lib/rede/stories/aparelho.ts). Resposta, reação, voto e "me avise" vão só para a autora (os dois últimos nem
// para ela: ela vê só a soma, a partir de 3).
import { chamar, type Chamar } from "./cliente";
import type {
  AtoParaContagem, FaixaDeStories, FigurinhaEnquete, PedidoDeStory, ReacaoDoStory, Story,
} from "./tipos-stories";
import type { CategoriaDeDenuncia } from "./tipos-moderacao";

/** O depósito privado dos stories (§5): caminho "<uid>/<id>.webp", leitura só por endereço assinado de vida curta. */
export const DEPOSITO_DOS_STORIES = "rede-stories";

/** Quanto vale o endereço assinado da imagem (10 min): basta para ver o story; depois disso, abrir de novo pede outro. */
export const VIDA_DO_ENDERECO = 600;

/** Troca caminhos do depósito por endereços assinados (só os que a regra do depósito deixa esta pessoa ler). */
export type Assinar = (caminhos: string[]) => Promise<Record<string, string>>;

export interface ClienteDeStories {
  /** É o dublê da prévia (dados de exemplo; nada vai ao servidor)? */
  readonly previa: boolean;
  /** As bolinhas do alto da linha: os meus stories no ar e os de quem eu posso ver. */
  faixa: () => Promise<FaixaDeStories>;
  /** Os stories no ar de uma autora, do mais antigo para o mais novo (só os que eu posso ver; bloqueio vale). */
  abrir: (handle: string) => Promise<Story[]>;
  /** Os meus stories no ar (com a soma das enquetes, a partir de 3). */
  meus: () => Promise<Story[]>;
  publicar: (pedido: PedidoDeStory) => Promise<{ id: string; expira_em: string }>;
  apagar: (id: string) => Promise<{ apagado: boolean }>;
  /** Resposta (texto ou à figurinha de pergunta): vai SÓ para a autora e some com o story. */
  responder: (id: string, texto: string) => Promise<{ ok: boolean }>;
  /** Reação do conjunto fechado: vai só para a autora. */
  reagir: (id: string, reacao: ReacaoDoStory) => Promise<{ ok: boolean }>;
  /** Voto secreto na enquete: a autora vê só a soma (a partir de 3); devolve a figurinha como eu passo a ver. */
  votar: (id: string, opcao: 0 | 1) => Promise<FigurinhaEnquete>;
  /** "Me avise quando começar": um lembrete MEU do ato; ninguém (nem a autora) sabe quem pediu. */
  avisar: (id: string, sim: boolean) => Promise<{ avisar: boolean }>;
  /** Os atos que posso pôr numa contagem (os próximos que organizo ou confirmei; F2, só pelo id). */
  atos: () => Promise<AtoParaContagem[]>;
  denunciar: (id: string, categoria: CategoriaDeDenuncia, texto?: string) => Promise<{ protocolo: string }>;
  /** Guarda a imagem (já refeita no aparelho, sem metadado) no depósito privado e devolve o caminho. */
  enviarImagem: (imagem: Blob) => Promise<string>;
}

/** O cliente de verdade sobre uma forma de chamar (os testes passam uma simulada). */
export function criarClienteDeStories(
  c: Chamar,
  enviar: (imagem: Blob) => Promise<string> = enviarAoDeposito,
  assinar: Assinar = assinarNoDeposito,
): ClienteDeStories {
  return {
    previa: false,
    faixa: () => c<FaixaDeStories>("rede_story_faixa"),
    abrir: (handle) => c<Story[]>("rede_story_abrir", { p_handle: handle }).then((l) => comEnderecos(l, assinar)),
    meus: () => c<Story[]>("rede_story_meus").then((l) => comEnderecos(l, assinar)),
    publicar: (pedido) => c<{ id: string; expira_em: string }>("rede_story_publicar", { p: pedido }),
    apagar: (id) => c<{ apagado: boolean }>("rede_story_apagar", { p_id: id }),
    responder: (id, texto) => c<{ ok: boolean }>("rede_story_responder", { p_id: id, p_texto: texto }),
    reagir: (id, reacao) => c<{ ok: boolean }>("rede_story_reagir", { p_id: id, p_reacao: reacao }),
    votar: (id, opcao) => c<FigurinhaEnquete>("rede_story_votar", { p_id: id, p_opcao: opcao }),
    avisar: (id, sim) => c<{ avisar: boolean }>("rede_story_avisar", { p_id: id, p_sim: sim }),
    atos: () => c<AtoParaContagem[]>("rede_story_atos"),
    denunciar: (id, categoria, texto = "") => c<{ protocolo: string }>("rede_story_denunciar", { p_id: id, p_categoria: categoria, p_texto: texto }),
    enviarImagem: enviar,
  };
}

/** Um id aleatório para o arquivo (nada do conteúdo nem da pessoa no nome além da pasta, que a regra do depósito exige). */
function idDoArquivo(): string {
  const c = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID();
  const b = new Uint8Array(16);
  c.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

/**
 * O banco devolve o caminho da imagem (fundo.caminho), nunca um endereço: aqui cada caminho vira um endereço assinado de vida curta,
 * pedido com a sessão da própria pessoa (a regra do depósito, public.rede_story_pode, decide de novo). Sem endereço, o story
 * aparece com o fundo de cor, sem a imagem. Puro sobre `assinar` (os testes passam um simulado).
 */
export async function comEnderecos(lista: Story[], assinar: Assinar): Promise<Story[]> {
  if (!Array.isArray(lista)) return lista;
  const caminhos = [...new Set(lista.flatMap((s) => (s.fundo?.tipo === "imagem" && s.fundo.caminho ? [s.fundo.caminho] : [])))];
  if (caminhos.length === 0) return lista;
  let enderecos: Record<string, string> = {};
  try {
    enderecos = await assinar(caminhos);
  } catch {
    enderecos = {};
  }
  return lista.map((s) => {
    if (s.fundo?.tipo !== "imagem" || !s.fundo.caminho) return s;
    const url = enderecos[s.fundo.caminho];
    return url ? { ...s, fundo: { ...s.fundo, url } } : { ...s, fundo: { tipo: "listras", cor: s.fundo.cor } };
  });
}

async function assinarNoDeposito(caminhos: string[]): Promise<Record<string, string>> {
  const { getClient } = await import("../backend");
  const cliente = await getClient();
  const { data, error } = await cliente.storage.from(DEPOSITO_DOS_STORIES).createSignedUrls(caminhos, VIDA_DO_ENDERECO);
  if (error || !data) return {};
  const saida: Record<string, string> = {};
  for (const x of data) if (x.path && x.signedUrl && !x.error) saida[x.path] = x.signedUrl;
  return saida;
}

/** A extensão pelo tipo que o canvas devolveu (o Safari antigo devolve PNG quando não sabe fazer WEBP). */
export function extensaoDaImagem(tipo: string): { ext: "webp" | "png" | "jpg"; tipo: string } {
  if (tipo === "image/png") return { ext: "png", tipo };
  if (tipo === "image/jpeg") return { ext: "jpg", tipo };
  return { ext: "webp", tipo: "image/webp" };
}

/** Envia ao depósito com a sessão da própria pessoa (a regra do depósito confere a pasta = uid). */
async function enviarAoDeposito(imagem: Blob): Promise<string> {
  const { getClient } = await import("../backend");
  const cliente = await getClient();
  const { data } = await cliente.auth.getSession();
  const uid = data.session?.user.id;
  if (!uid) throw new Error("sem_sessao");
  const { ext, tipo } = extensaoDaImagem(imagem.type);
  const caminho = `${uid}/${idDoArquivo()}.${ext}`;
  const { error } = await cliente.storage.from(DEPOSITO_DOS_STORIES).upload(caminho, imagem, { contentType: tipo, upsert: false, cacheControl: "3600" });
  if (error) throw new Error(error.message || "falha_no_envio");
  return caminho;
}

/** A prévia com dados de exemplo está ligada? (só no desenvolvimento e nas fotos; a referência é literal para o Next gravar) */
export const previaDosStories = process.env.NEXT_PUBLIC_ALUMIA_PREVIA === "sim";

let dubleGuardado: Promise<ClienteDeStories> | null = null;

/** O cliente que as telas usam: o de verdade, ou o dublê da prévia (carregado sob demanda, só quando ligado). */
export function clienteDosStories(): Promise<ClienteDeStories> {
  if (!previaDosStories) return Promise.resolve(storiesDoBanco);
  dubleGuardado ??= import("./stories/exemplos").then((m) => m.criarClienteDaPrevia());
  return dubleGuardado;
}

export const storiesDoBanco = criarClienteDeStories(chamar);
