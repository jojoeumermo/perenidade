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
  AtoParaContagem, CartaoDoPost, ComunidadeParaMencao, CorDoStory, DestaqueDeStories, FaixaDeStories, FigurinhaEnquete, GrupoDaFaixa, ItemDaCaixa,
  PedidoDeStory, PessoaDaRoda, ReacaoDoStory, RespostaDoStory, Story,
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
  /** Guarda a imagem ou o vídeo (já refeitos no aparelho, sem metadado) no depósito privado e devolve o caminho. */
  enviarImagem: (imagem: Blob, aoProgresso?: (fracao: number) => void) => Promise<string>;
  /** As comunidades que posso mencionar (as minhas). */
  comunidades: () => Promise<ComunidadeParaMencao[]>;
  /** Os destaques do perfil de alguém (só os que têm story que eu vejo; a dona vê todos). */
  destaques: (handle: string) => Promise<DestaqueDeStories[]>;
  /** Os stories de um destaque que eu posso ver. */
  destaque: (id: string) => Promise<Story[]>;
  /** Guarda um story meu num destaque (novo, sem id) e/ou renomeia o destaque. */
  salvarDestaque: (p: { destaque: string | null; titulo: string | null; story: string | null; cor?: CorDoStory | null }) => Promise<{ id: string; titulo: string; cor: CorDoStory }>;
  tirarDoDestaque: (destaque: string, story: string) => Promise<{ ok: boolean }>;
  apagarDestaque: (destaque: string) => Promise<{ apagado: boolean }>;
  /** A ordem dos meus destaques na fileira do perfil. */
  ordenarDestaques: (ids: string[]) => Promise<{ ok: boolean }>;
  /** A ordem dos stories dentro de um destaque meu. */
  ordenarNoDestaque: (destaque: string, ids: string[]) => Promise<{ ok: boolean }>;
  /** A capa de um destaque meu (um story com foto dele; nulo = a primeira foto). */
  capaDoDestaque: (destaque: string, story: string | null) => Promise<{ ok: boolean }>;
  /** Troca a foto de um story meu pela versão borrada de novo (já enviada com enviarImagem). */
  trocarMidia: (story: string, caminho: string) => Promise<{ ok: boolean }>;
  /** O cartão do post/ato do "Pôr no story", como vai aparecer (só se eu vejo). */
  post: (id: string) => Promise<CartaoDoPost | null>;
  /** Resposta à figurinha de pergunta (vai só para a autora, marcada como da pergunta). */
  responderPergunta: (id: string, texto: string) => Promise<{ ok: boolean }>;
  /** As respostas de um story meu (quem mandou escolheu falar comigo, como numa mensagem). */
  respostas: (id: string) => Promise<RespostaDoStory[]>;
  /** Os meus stories que receberam resposta. */
  caixa: () => Promise<ItemDaCaixa[]>;
  /** "Vou" pela figurinha: a mesma confirmação da página do ato (rede_ato_vou). */
  vou: (ato: string, sim: boolean) => Promise<{ vou_eu: boolean }>;
  /** A minha roda de confiança (só eu vejo) e pôr/tirar alguém dela (a pessoa não é avisada). */
  roda: () => Promise<PessoaDaRoda[]>;
  mudarRoda: (handle: string, sim: boolean) => Promise<PessoaDaRoda[]>;
  /** As bolinhas dos stories no ar que mencionam uma comunidade (ou são só para ela), dos que eu vejo. */
  daComunidade: (slug: string) => Promise<GrupoDaFaixa[]>;
}

/** O cliente de verdade sobre uma forma de chamar (os testes passam uma simulada). */
export function criarClienteDeStories(
  c: Chamar,
  enviar: (imagem: Blob, aoProgresso?: (fracao: number) => void) => Promise<string> = enviarAoDeposito,
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
    comunidades: () => c<ComunidadeParaMencao[]>("rede_story_comunidades"),
    destaques: (handle) => c<DestaqueDeStories[]>("rede_story_destaques", { p_handle: handle }).then((l) => capasAssinadas(l, assinar)),
    destaque: (id) => c<Story[]>("rede_story_destaque_abrir", { p_id: id }).then((l) => comEnderecos(l, assinar)),
    salvarDestaque: (p) =>
      c<{ id: string; titulo: string; cor: CorDoStory }>("rede_story_destaque_salvar", { p_destaque: p.destaque, p_titulo: p.titulo, p_story: p.story, p_cor: p.cor ?? null }),
    tirarDoDestaque: (destaque, story) => c<{ ok: boolean }>("rede_story_destaque_tirar", { p_destaque: destaque, p_story: story }),
    apagarDestaque: (destaque) => c<{ apagado: boolean }>("rede_story_destaque_apagar", { p_destaque: destaque }),
    ordenarDestaques: (ids) => c<{ ok: boolean }>("rede_story_destaque_ordem", { p_ids: ids }),
    ordenarNoDestaque: (destaque, ids) => c<{ ok: boolean }>("rede_story_destaque_ordenar", { p_destaque: destaque, p_ids: ids }),
    capaDoDestaque: (destaque, story) => c<{ ok: boolean }>("rede_story_destaque_capa", { p_destaque: destaque, p_story: story }),
    trocarMidia: (story, caminho) => c<{ ok: boolean }>("rede_story_trocar_midia", { p_story: story, p_caminho: caminho }),
    post: (id) => c<CartaoDoPost | null>("rede_story_post", { p_id: id }),
    responderPergunta: (id, texto) => c<{ ok: boolean }>("rede_story_responder_pergunta", { p_id: id, p_texto: texto }),
    respostas: (id) => c<RespostaDoStory[]>("rede_story_respostas", { p_id: id }),
    caixa: () => c<ItemDaCaixa[]>("rede_story_caixa"),
    vou: (ato, sim) => c<{ vou_eu: boolean }>("rede_ato_vou", { p_id: ato, p_sim: sim }),
    roda: () => c<PessoaDaRoda[]>("rede_roda"),
    mudarRoda: (handle, sim) => c<PessoaDaRoda[]>("rede_roda_mudar", { p_handle: handle, p_sim: sim }),
    daComunidade: (slug) => c<GrupoDaFaixa[]>("rede_story_da_comunidade", { p_slug: slug }),
  };
}

/** As capas dos destaques: o caminho vira endereço assinado (sem endereço, a capa fica só com a cor). */
export async function capasAssinadas(lista: DestaqueDeStories[], assinar: Assinar): Promise<DestaqueDeStories[]> {
  if (!Array.isArray(lista)) return lista;
  const caminhos = [...new Set(lista.flatMap((d) => (d.capa?.caminho ? [d.capa.caminho] : [])))];
  if (caminhos.length === 0) return lista;
  let enderecos: Record<string, string> = {};
  try {
    enderecos = await assinar(caminhos);
  } catch {
    enderecos = {};
  }
  return lista.map((d) => {
    const url = d.capa?.caminho ? enderecos[d.capa.caminho] : undefined;
    return d.capa ? { ...d, capa: url ? { ...d.capa, url } : null } : d;
  });
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
  const caminhos = [...new Set(lista.flatMap((s) => ((s.fundo?.tipo === "imagem" || s.fundo?.tipo === "video") && s.fundo.caminho ? [s.fundo.caminho] : [])))];
  if (caminhos.length === 0) return lista;
  let enderecos: Record<string, string> = {};
  try {
    enderecos = await assinar(caminhos);
  } catch {
    enderecos = {};
  }
  return lista.map((s) => {
    if ((s.fundo?.tipo !== "imagem" && s.fundo?.tipo !== "video") || !s.fundo.caminho) return s;
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

/**
 * A extensão pelo tipo que o canvas ou o gravador devolveram (o Safari antigo devolve PNG quando não sabe fazer WEBP; o gravador
 * diz "video/webm;codecs=vp9,opus" ou "video/mp4;codecs=avc1…": vale só o tipo antes do ";").
 */
export function extensaoDaImagem(tipo: string): { ext: "webp" | "png" | "jpg" | "mp4" | "webm"; tipo: string } {
  const base = tipo.split(";")[0].trim().toLowerCase();
  if (base === "image/png") return { ext: "png", tipo: base };
  if (base === "image/jpeg") return { ext: "jpg", tipo: base };
  if (base === "video/mp4") return { ext: "mp4", tipo: base };
  if (base === "video/webm") return { ext: "webm", tipo: base };
  return { ext: "webp", tipo: "image/webp" };
}

/**
 * Envia ao depósito com a sessão da própria pessoa (a regra do depósito confere a pasta = uid). O progresso do envio não vem da
 * biblioteca: a tela mostra o envio como "quase lá" (o andamento real é o da regravação, que vem antes).
 */
async function enviarAoDeposito(imagem: Blob, aoProgresso?: (fracao: number) => void): Promise<string> {
  aoProgresso?.(0.05);
  const { getClient } = await import("../backend");
  const cliente = await getClient();
  const { data } = await cliente.auth.getSession();
  const uid = data.session?.user.id;
  if (!uid) throw new Error("sem_sessao");
  const { ext, tipo } = extensaoDaImagem(imagem.type);
  const caminho = `${uid}/${idDoArquivo()}.${ext}`;
  // Com andamento de verdade: um endereço de envio assinado (o mesmo RLS do envio comum) e um PUT pelo XMLHttpRequest, que
  // conta os bytes que já saíram. Sem ele (navegador antigo, ou o endereço falhou), o envio comum, sem andamento no meio.
  const deposito = cliente.storage.from(DEPOSITO_DOS_STORIES);
  if (aoProgresso && typeof XMLHttpRequest !== "undefined") {
    const { data: assinado } = await deposito.createSignedUploadUrl(caminho).catch(() => ({ data: null }));
    if (assinado?.signedUrl) {
      await enviarComAndamento(assinado.signedUrl, imagem, tipo, (f) => aoProgresso(0.05 + 0.95 * f));
      aoProgresso(1);
      return caminho;
    }
  }
  const { error } = await deposito.upload(caminho, imagem, { contentType: tipo, upsert: false, cacheControl: "3600" });
  if (error) throw new Error(error.message || "falha_no_envio");
  aoProgresso?.(1);
  return caminho;
}

/** PUT do arquivo no endereço assinado, contando o andamento (0 a 1). Erro "falha_no_envio" se o depósito recusar. */
export function enviarComAndamento(url: string, corpo: Blob, tipo: string, aoProgresso: (fracao: number) => void): Promise<void> {
  return new Promise((pronto, falhou) => {
    const x = new XMLHttpRequest();
    x.open("PUT", url);
    x.setRequestHeader("content-type", tipo);
    x.setRequestHeader("cache-control", "max-age=3600");
    x.setRequestHeader("x-upsert", "false");
    x.upload.onprogress = (e) => {
      if (e.lengthComputable && e.total > 0) aoProgresso(Math.min(1, e.loaded / e.total));
    };
    x.onload = () => (x.status >= 200 && x.status < 300 ? pronto() : falhou(new Error("falha_no_envio")));
    x.onerror = () => falhou(new Error("falha_no_envio"));
    x.onabort = () => falhou(new Error("cancelado"));
    x.send(corpo);
  });
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
