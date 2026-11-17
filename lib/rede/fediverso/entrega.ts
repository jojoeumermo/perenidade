// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A entrega: pega na fila do banco (interno.rede_fed_fila) as atividades vencidas, monta cada uma NA HORA (um post só sai se ainda
// pode sair: interno.rede_fed_federavel é conferida de novo), assina com a chave do ator e entrega na caixa de entrada da outra
// instância. Falha temporária volta para a fila com espera crescente (até 8 tentativas); recusa definitiva (4xx) sai da fila.
// Com o modo "fediverso-total" (desligado por padrão; PLANO-FEDIVERSO, F2):
//   • os tipos novos (contrato 3.4): like, undo-like, announce, undo-announce, flag (assinada pelo ATOR DA INSTÂNCIA: quem denunciou
//     aqui não aparece lá), block, undo-block, group-announce e group-accept;
//   • vazão maior: até 200 itens por chamada, 10 de cada vez e no máximo 2 por domínio;
//   • circuito por domínio: o banco conta as falhas de conexão entre as chamadas (fila_feito com status e domínio) e, na 5ª seguida,
//     mata o domínio (1 h, 6 h, 24 h) e devolve "morto_ate"; fila_pegar nem entrega item de domínio morto. Na mesma rodada, os itens
//     seguintes de um domínio morto (ou que pediu calma) voltam sem tocar na rede e sem gastar tentativa;
//   • 410 numa caixa: o banco apaga o seguidor daquela caixa (fila_feito com status 410);
//   • 429: respeita o Retry-After (segundos ou data; "espera", em segundos, no fila_feito), e os outros itens do domínio esperam junto;
//   • orçamento de tempo: a rodada para de começar entregas em 45 s (a rota tem 60 s); o que sobrou volta sem gastar tentativa;
//   • chave que falta (quem só aceitou o consentimento novo e nunca teve o ator lido lá fora; a comunidade cujo Group ninguém leu)
//     é gerada aqui, como em atorComChaves (RSA não se gera no SQL). Só sem chave mesmo depois disso o item é descartado.
// Sem "@/". Só roda no servidor.
import { createHash, randomUUID } from "node:crypto";
import { assinarPedido } from "./assinatura";
import * as documentos from "./documentos";
import { atividadeCreate, atividadeDelete, atividadeFollow, atividadeResposta, atividadeUndoFollow, atividadeUpdate, atividadeUpdateDoAtor, CONTEXTO, documentoDoAtor, imagemDoBanco, PUBLICO, type PostFederado } from "./documentos";
import type { EnderecosDaFederacao } from "./enderecos";
import { pedirAoFediverso } from "./http";
import { abrirChave, atorComChaves, banco, chaveDaInstancia, comunidadeComChaves, fed, modoTotal } from "./servidor";

type TipoDaFila =
  | "create"
  | "update"
  | "delete"
  | "accept"
  | "reject"
  | "follow"
  | "undo-follow"
  | "like"
  | "undo-like"
  | "announce"
  | "undo-announce"
  | "flag"
  | "block"
  | "undo-block"
  | "group-announce"
  | "group-accept";

interface ItemDaFila {
  id: number;
  tipo: TipoDaFila;
  objeto: string;
  destino: string;
  /**
   * pedido: o id do Follow; atividade: o id (ou o uuid) da atividade (Like, Announce, Flag, Block), para o Undo bater, ou, no
   * group-announce, qual atividade o Group repassa ('create' | 'update' | 'delete'); alvos/conteudo: da Flag; slug: reserva da
   * comunidade (o banco manda em "comunidade").
   */
  extra: { pedido?: string; atividade?: string; alvos?: string[]; conteudo?: string; slug?: string };
  tentativas: number;
  /** O @ de quem assina (nulo nos itens da instância e do Group). */
  handle: string | null;
  /** A comunidade (Group) dona do item, quando é o Group que assina. */
  comunidade?: string | null;
  /** Quem assina, como o banco diz: a pessoa, o Group ou o ator da instância. */
  assinante?: "pessoa" | "grupo" | "instancia";
  chave_publica: string | null;
  chave_privada: string | null;
}

type Atividade = Record<string, unknown>;

// ── Construtores do contrato 3.3 (dono: F1, em documentos.ts) ──
// Até a junção com F1, valem os dublês abaixo, no mesmo formato. Depois dela, os de documentos.ts ganham sozinhos.
interface Construtores {
  atividadeLike(e: EnderecosDaFederacao, handle: string, objeto: string, id: string): Atividade;
  atividadeAnnounce(e: EnderecosDaFederacao, handle: string, objeto: string, id: string): Atividade;
  atividadeUndo(e: EnderecosDaFederacao, handle: string, atividadeOriginal: Atividade): Atividade;
  atividadeFlag(e: EnderecosDaFederacao, alvos: string[], conteudo: string, id: string): Atividade;
  atividadeBlock(e: EnderecosDaFederacao, handle: string, alvo: string, id: string): Atividade;
  atividadeAnnounceDoGrupo(e: EnderecosDaFederacao, slug: string, atividade: Atividade): Atividade;
}
const doGrupo = (e: EnderecosDaFederacao, slug: string) => `${e.base}/api/fediverso/c/${slug}`;
/** A atividade sem o "@context" (para ir embutida dentro de outra). */
const semContexto = (a: Atividade): Atividade => Object.fromEntries(Object.entries(a).filter(([k]) => k !== "@context"));
const dubles: Construtores = {
  atividadeLike: (e, handle, objeto, id) => ({ "@context": CONTEXTO, id, type: "Like", actor: e.ator(handle), object: objeto }),
  atividadeAnnounce: (e, handle, objeto, id) => ({ "@context": CONTEXTO, id, type: "Announce", actor: e.ator(handle), object: objeto, to: [PUBLICO], cc: [e.seguidores(handle)], published: new Date().toISOString() }),
  atividadeUndo: (e, handle, original) => ({ "@context": CONTEXTO, id: `${String(original.id)}#undo`, type: "Undo", actor: e.ator(handle), object: semContexto(original) }),
  atividadeFlag: (e, alvos, conteudo, id) => ({ "@context": CONTEXTO, id, type: "Flag", actor: e.instancia, object: alvos, content: conteudo }),
  atividadeBlock: (e, handle, alvo, id) => ({ "@context": CONTEXTO, id, type: "Block", actor: e.ator(handle), object: alvo }),
  atividadeAnnounceDoGrupo: (e, slug, atividade) => ({
    "@context": CONTEXTO,
    id: `${doGrupo(e, slug)}/anuncios/${createHash("sha256").update(String(atividade.id)).digest("hex").slice(0, 32)}`,
    type: "Announce",
    actor: doGrupo(e, slug),
    object: semContexto(atividade),
    to: [PUBLICO],
    cc: [`${doGrupo(e, slug)}/seguidores`],
  }),
};
const deF1 = documentos as unknown as Partial<Construtores>;
export const construtores: Construtores = {
  atividadeLike: deF1.atividadeLike ?? dubles.atividadeLike,
  atividadeAnnounce: deF1.atividadeAnnounce ?? dubles.atividadeAnnounce,
  atividadeUndo: deF1.atividadeUndo ?? dubles.atividadeUndo,
  atividadeFlag: deF1.atividadeFlag ?? dubles.atividadeFlag,
  atividadeBlock: deF1.atividadeBlock ?? dubles.atividadeBlock,
  atividadeAnnounceDoGrupo: deF1.atividadeAnnounceDoGrupo ?? dubles.atividadeAnnounceDoGrupo,
};

/**
 * O id da atividade de um item (Like, Announce, Block, Flag): o que o banco guardou em extra.atividade (um endereço nosso daquele
 * tipo, ou o uuid que o banco gerou) ou, sem ele, um id FIXO por pessoa e objeto (o Undo precisa repetir o mesmo id do original
 * para a outra instância achar o que desfazer). Nenhum outro valor vindo do banco vira id de atividade assinada por nós.
 */
function idDaAtividade(item: ItemDaFila, tipo: string): string {
  const guardado = item.extra?.atividade;
  if (typeof guardado === "string") {
    if (guardado.startsWith(`${fed.atividade(tipo, "")}`) && /^[A-Za-z0-9_-]{1,64}$/.test(guardado.slice(fed.atividade(tipo, "").length))) return guardado;
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(guardado)) return fed.atividade(tipo, guardado.toLowerCase());
  }
  return fed.atividade(tipo, createHash("sha256").update(`${item.handle ?? ""}\n${item.objeto}`).digest("hex").slice(0, 32));
}

/** A comunidade de um item do Group (o banco manda em "comunidade"; extra.slug fica de reserva). */
function slugDe(item: ItemDaFila): string | null {
  const s = item.comunidade ?? item.extra?.slug ?? "";
  return /^[a-z0-9-]{2,60}$/.test(s) ? s : null;
}

/** Monta a atividade de um item; nulo quando ela não deve mais sair (o post deixou de poder sair, por exemplo). */
async function montar(item: ItemDaFila): Promise<Atividade | null> {
  const c = construtores;
  // O perfil da pessoa mudou (20261112-fediverso-perfil-e-mudanca.sql): o documento do ator, montado agora, como a rota do ator.
  if (item.tipo === "update" && item.objeto.startsWith("ator:")) {
    const handle = item.objeto.slice(5);
    if (!handle || handle !== item.handle) return null;
    const a = await atorComChaves(handle).catch(() => null);
    if (!a || a.estado !== "ligado" || !a.chave_publica) return null;
    const x = a as typeof a & { avatar_url?: string | null; capa_url?: string | null; discoverable?: boolean | null; trancado?: boolean | null };
    const doc = documentoDoAtor(fed, {
      handle,
      nome: a.nome ?? handle,
      bio: a.bio ?? "",
      ligado_em: a.ligado_em ?? null,
      chave_publica: a.chave_publica,
      ...(modoTotal() ? { avatar: imagemDoBanco(fed, x.avatar_url), capa: imagemDoBanco(fed, x.capa_url), discoverable: x.discoverable === true, trancado: x.trancado === true } : {}),
    }, modoTotal() ? undefined : { total: false, grupos: false });
    return atividadeUpdateDoAtor(fed, handle, doc as Record<string, unknown>) as unknown as Atividade;
  }
  if (item.tipo === "create" || item.tipo === "update") {
    const post = await banco<PostFederado | { apagado: true } | null>("post", { id: item.objeto });
    if (!post || "apagado" in post) return null;
    return item.tipo === "create" ? atividadeCreate(fed, post) : atividadeUpdate(fed, post);
  }
  const handle = item.handle ?? "";
  switch (item.tipo) {
    case "delete":
      return handle ? atividadeDelete(fed, handle, item.objeto) : null;
    case "accept":
      return handle ? atividadeResposta(fed, "Accept", handle, item.objeto, item.extra.pedido ?? "", randomUUID()) : null;
    case "reject":
      return handle ? atividadeResposta(fed, "Reject", handle, item.objeto, item.extra.pedido ?? "", randomUUID()) : null;
    case "follow":
      return handle && item.extra.pedido ? atividadeFollow(fed, handle, item.objeto, item.extra.pedido) : null;
    case "undo-follow":
      return handle && item.extra.pedido ? atividadeUndoFollow(fed, handle, item.objeto, item.extra.pedido, randomUUID()) : null;
    default:
      return modoTotal() ? montarTotal(item, handle, c) : null;
  }
}

/** Os tipos do modo total (contrato 3.4). */
async function montarTotal(item: ItemDaFila, handle: string, c: Construtores): Promise<Atividade | null> {
  switch (item.tipo) {
    case "flag": {
      // Só os alvos de fora (o perfil e os posts denunciados) e o comentário que a pessoa escolheu encaminhar.
      const alvos = (Array.isArray(item.extra.alvos) ? item.extra.alvos : [item.objeto]).filter((x) => typeof x === "string" && /^https:\/\/[^\s]{1,490}$/.test(x)).slice(0, 20);
      if (!alvos.length) return null;
      // O id passa pela mesma conferência dos outros tipos; sem um id aceitável, um novo.
      const id = typeof item.extra.atividade === "string" ? idDaAtividade(item, "flag") : fed.atividade("flag", randomUUID());
      return c.atividadeFlag(fed, alvos, typeof item.extra.conteudo === "string" ? item.extra.conteudo.slice(0, 1000) : "", id);
    }
    case "group-announce": {
      const slug = slugDe(item);
      if (!slug) return null;
      // O Group repassa o que aconteceu com o post da comunidade: criado, editado ou apagado (o banco diz qual em extra.atividade).
      if (item.extra.atividade === "delete") {
        const grupo = doGrupo(fed, slug);
        return c.atividadeAnnounceDoGrupo(fed, slug, { id: `${fed.post(item.objeto)}#delete`, type: "Delete", actor: grupo, to: [PUBLICO], object: { id: fed.post(item.objeto), type: "Tombstone" } });
      }
      const post = await banco<PostFederado | { apagado: true } | null>("post", { id: item.objeto });
      if (!post || "apagado" in post) return null;
      return c.atividadeAnnounceDoGrupo(fed, slug, item.extra.atividade === "update" ? atividadeUpdate(fed, post) : atividadeCreate(fed, post));
    }
    case "group-accept": {
      const slug = slugDe(item);
      if (!slug || !item.extra.pedido) return null;
      const grupo = doGrupo(fed, slug);
      return { "@context": CONTEXTO, id: fed.atividade("accept", randomUUID()), type: "Accept", actor: grupo, object: { id: item.extra.pedido, type: "Follow", actor: item.objeto, object: grupo } };
    }
    default:
      break;
  }
  if (!handle) return null;
  switch (item.tipo) {
    case "like":
      return c.atividadeLike(fed, handle, item.objeto, idDaAtividade(item, "like"));
    case "undo-like":
      return c.atividadeUndo(fed, handle, c.atividadeLike(fed, handle, item.objeto, idDaAtividade(item, "like")));
    case "announce":
      return c.atividadeAnnounce(fed, handle, item.objeto, idDaAtividade(item, "announce"));
    case "undo-announce":
      return c.atividadeUndo(fed, handle, c.atividadeAnnounce(fed, handle, item.objeto, idDaAtividade(item, "announce")));
    case "block":
      return c.atividadeBlock(fed, handle, item.objeto, idDaAtividade(item, "block"));
    case "undo-block":
      return c.atividadeUndo(fed, handle, c.atividadeBlock(fed, handle, item.objeto, idDaAtividade(item, "block")));
    default:
      return null;
  }
}

/** Entrega uma atividade assinada com a chave dada. Devolve o status HTTP (0 = não conectou) e o Retry-After. */
export async function entregarAssinado(destino: string, atividade: Atividade, chaveId: string, chavePrivada: string): Promise<{ status: number; retryAfter: string | null }> {
  const corpo = JSON.stringify(atividade);
  const cab = assinarPedido({ metodo: "POST", url: destino, corpo, chaveId, chavePrivada });
  const r = await pedirAoFediverso(destino, { metodo: "POST", corpo, cabecalhos: { ...cab, Accept: "application/activity+json" }, maxBytes: 64 * 1024, tempoMs: 10_000 });
  return { status: r?.status ?? 0, retryAfter: r?.retryAfter ?? null };
}

/** Entrega uma atividade assinada pela pessoa. Devolve o status HTTP (0 = não conectou). */
export async function entregar(destino: string, atividade: Atividade, handle: string, chavePrivada: string): Promise<number> {
  return (await entregarAssinado(destino, atividade, fed.chave(handle), chavePrivada)).status;
}

/** Entrega até `limite` itens vencidos da fila. Devolve quantos saíram, quantos voltaram para a fila e quantos foram descartados. */
// `orcamentoMs`: só no modo total (padrão ORCAMENTO_MS); os testes o encurtam.
export async function processarFila(limite = 20, orcamentoMs?: number): Promise<{ entregues: number; adiados: number; descartados: number }> {
  if (modoTotal()) return processarFilaTotal(Math.min(Math.max(limite, 1), LIMITE_TOTAL), orcamentoMs);
  const itens = await banco<ItemDaFila[]>("fila_pegar", { limite });
  const total = { entregues: 0, adiados: 0, descartados: 0 };
  // Poucas de cada vez, para não abrir conexões demais de uma só instância do servidor.
  for (let i = 0; i < itens.length; i += 5) {
    await Promise.all(
      itens.slice(i, i + 5).map(async (item) => {
        const chave = abrirChave(item.chave_privada);
        if (!chave) {
          await banco("fila_feito", { id: item.id, ok: false, definitivo: true, erro: "sem_chave" });
          total.descartados++;
          return;
        }
        const atividade = await montar(item).catch(() => undefined);
        if (atividade === undefined) {
          await banco("fila_feito", { id: item.id, ok: false, erro: "banco" });
          total.adiados++;
          return;
        }
        if (atividade === null) {
          await banco("fila_feito", { id: item.id, ok: true, erro: "" });
          total.descartados++;
          return;
        }
        const status = await entregar(item.destino, atividade, item.handle ?? "", chave);
        if (status >= 200 && status < 300) {
          await banco("fila_feito", { id: item.id, ok: true });
          total.entregues++;
        } else {
          // 4xx (menos 408 e 429) é recusa definitiva; o resto (5xx, sem conexão, tempo) tenta de novo mais tarde.
          const definitivo = status >= 400 && status < 500 && status !== 408 && status !== 429;
          await banco("fila_feito", { id: item.id, ok: false, definitivo, erro: `http_${status}` });
          if (definitivo) total.descartados++;
          else total.adiados++;
        }
      }),
    );
  }
  return total;
}

// ── A fila do modo total ──

/** Teto de itens por chamada, quantos de cada vez e quantos por domínio. */
export const LIMITE_TOTAL = 200;
export const DE_CADA_VEZ = 10;
export const POR_DOMINIO = 2;
/** O Retry-After de um 429 vale até 24 h; sem ele (ou ilegível), 5 minutos. */
const RETRY_PADRAO_MS = 5 * 60_000;
const RETRY_MAXIMO_MS = 24 * 3_600_000;

/** Lê o Retry-After (segundos ou data HTTP) e devolve até quando esperar, entre agora e 24 h. */
export function lerRetryAfter(valor: string | null | undefined, agora = Date.now()): Date {
  const v = (valor ?? "").trim();
  let ms = RETRY_PADRAO_MS;
  if (/^\d{1,9}$/.test(v)) ms = Number(v) * 1000;
  else if (v) {
    const data = Date.parse(v);
    if (Number.isFinite(data)) ms = data - agora;
  }
  return new Date(agora + Math.min(Math.max(ms, 1000), RETRY_MAXIMO_MS));
}

/** Falha "de conexão" (conta para o circuito): não conectou, tempo esgotado ou o portão da outra instância caído. */
export const falhaDeConexao = (status: number) => status === 0 || status === 502 || status === 503 || status === 504 || (status >= 520 && status <= 526);

const dominioDe = (url: string) => {
  try {
    return new URL(url).host;
  } catch {
    return "";
  }
};

/** Roda `fazer` em cada item, `max` de cada vez e no máximo `porChave` com a mesma chave (o domínio) ao mesmo tempo. */
export function emParalelo<T>(itens: T[], chave: (t: T) => string, fazer: (t: T) => Promise<void>, max = DE_CADA_VEZ, porChave = POR_DOMINIO): Promise<void> {
  const pendentes = [...itens];
  const ativos = new Map<string, number>();
  let rodando = 0;
  return new Promise((resolve) => {
    const proximo = () => {
      if (!pendentes.length && rodando === 0) return resolve();
      while (rodando < max) {
        const i = pendentes.findIndex((t) => (ativos.get(chave(t)) ?? 0) < porChave);
        if (i === -1) break;
        const [t] = pendentes.splice(i, 1);
        const k = chave(t);
        ativos.set(k, (ativos.get(k) ?? 0) + 1);
        rodando++;
        fazer(t)
          .catch(() => undefined)
          .finally(() => {
            ativos.set(k, (ativos.get(k) ?? 1) - 1);
            rodando--;
            proximo();
          });
      }
    };
    proximo();
  });
}

interface EstadoDoDominio {
  /** Até quando o domínio espera (morto pelo circuito ou pedindo calma com 429). */
  esperaAte: number | null;
  motivo: string;
}

/** Orçamento de uma rodada: depois disso, nenhuma entrega nova começa (cada uma leva até 10 s; a rota tem 60 s). */
export const ORCAMENTO_MS = 45_000;

/** Segundos até uma data (o "espera" do fila_feito), entre 30 s e 12 h, como o banco aceita. */
const segundosAte = (ate: number) => Math.min(Math.max(Math.ceil((ate - Date.now()) / 1000), 30), 43_200);

async function processarFilaTotal(limite: number, orcamentoMs = ORCAMENTO_MS): Promise<{ entregues: number; adiados: number; descartados: number }> {
  const inicio = Date.now();
  const itens = await banco<ItemDaFila[]>("fila_pegar", { limite });
  const total = { entregues: 0, adiados: 0, descartados: 0 };
  const estados = new Map<string, Promise<EstadoDoDominio>>();
  const estadoDe = (dominio: string) => {
    let e = estados.get(dominio);
    if (!e) {
      e = banco<{ morto_ate?: string | null } | null>("dominio_estado", { dominio })
        .then((r) => {
          const ate = r?.morto_ate ? Date.parse(r.morto_ate) : NaN;
          return { esperaAte: Number.isFinite(ate) && ate > Date.now() ? ate : null, motivo: "dominio_morto" };
        })
        .catch(() => ({ esperaAte: null, motivo: "" }));
      estados.set(dominio, e);
    }
    return e;
  };
  // As chaves desta rodada (uma busca por pessoa, comunidade e instância, mesmo com muitos itens).
  let instancia: Promise<string | null> | undefined;
  const pessoas = new Map<string, Promise<string | null>>();
  const grupos = new Map<string, Promise<string | null>>();
  const chaveDe = (item: ItemDaFila): { chave: Promise<string | null>; chaveId: string } => {
    const assinante = item.tipo === "flag" ? "instancia" : (item.assinante ?? (item.tipo.startsWith("group-") ? "grupo" : "pessoa"));
    if (assinante === "instancia") {
      instancia ??= chaveDaInstancia().then((k) => k.privada, () => null);
      return { chave: instancia, chaveId: fed.chaveDaInstancia };
    }
    if (assinante === "grupo") {
      const slug = slugDe(item);
      if (!slug) return { chave: Promise.resolve(null), chaveId: "" };
      const chaveId = `${doGrupo(fed, slug)}#main-key`;
      const aberta = abrirChave(item.chave_privada);
      if (aberta) return { chave: Promise.resolve(aberta), chaveId };
      // O Group ainda sem chave (ninguém leu o documento dele): gera agora, como app/api/fediverso/c/[slug] faria.
      let g = grupos.get(slug);
      if (!g) grupos.set(slug, (g = comunidadeComChaves(slug).catch(() => null)));
      return { chave: g, chaveId };
    }
    const handle = item.handle ?? "";
    if (!handle) return { chave: Promise.resolve(null), chaveId: "" };
    const aberta = abrirChave(item.chave_privada);
    if (aberta) return { chave: Promise.resolve(aberta), chaveId: fed.chave(handle) };
    // Sem chave: quem só aceitou o consentimento novo (modo total) nunca teve o ator lido lá fora. Gera agora, se a pessoa ainda
    // federa ("ator" só devolve chave a quem está ligado e sem impedimento, ou saindo com entregas pendentes).
    let k = pessoas.get(handle);
    if (!k) pessoas.set(handle, (k = atorComChaves(handle).then((a) => a?.privada ?? null, () => null)));
    return { chave: k, chaveId: fed.chave(handle) };
  };
  /** Devolve o item à fila sem tocar na rede e sem gastar tentativa (o caminho do 429 no fila_feito devolve a tentativa). */
  const devolver = async (item: ItemDaFila, dominio: string, ate: number, motivo: string) => {
    await banco("fila_feito", { id: item.id, ok: false, definitivo: false, erro: motivo, status: 429, dominio, espera: segundosAte(ate) });
    total.adiados++;
  };

  await emParalelo(
    itens,
    (item) => dominioDe(item.destino),
    async (item) => {
      const dominio = dominioDe(item.destino);
      if (Date.now() - inicio > orcamentoMs) return devolver(item, dominio, Date.now() + 30_000, "sem_tempo");
      const estado = await estadoDe(dominio);
      // Domínio esperando (morto ou com 429): o item volta para a fila sem gastar tentativa e sem tocar na rede.
      if (estado.esperaAte && estado.esperaAte > Date.now()) return devolver(item, dominio, estado.esperaAte, estado.motivo);
      const { chave: prometida, chaveId } = chaveDe(item);
      const chave = await prometida;
      if (!chave || !chaveId) {
        await banco("fila_feito", { id: item.id, ok: false, definitivo: true, erro: "sem_chave" });
        total.descartados++;
        return;
      }
      const atividade = await montar(item).catch(() => undefined);
      if (atividade === undefined) {
        // Falha do banco ao montar: tenta de novo mais tarde (sem "status": não conta para o circuito do domínio).
        await banco("fila_feito", { id: item.id, ok: false, erro: "banco" });
        total.adiados++;
        return;
      }
      if (atividade === null) {
        await banco("fila_feito", { id: item.id, ok: true, erro: "" });
        total.descartados++;
        return;
      }
      const { status, retryAfter } = await entregarAssinado(item.destino, atividade, chaveId, chave);
      if (status >= 200 && status < 300) {
        await banco("fila_feito", { id: item.id, ok: true, status, dominio });
        total.entregues++;
        return;
      }
      if (status === 429) {
        // A outra instância pediu calma: este item e os outros do mesmo domínio esperam o que ela pediu.
        const ate = lerRetryAfter(retryAfter).getTime();
        estado.esperaAte = Math.max(estado.esperaAte ?? 0, ate);
        estado.motivo = "http_429";
        await banco("fila_feito", { id: item.id, ok: false, definitivo: false, erro: "http_429", status, dominio, espera: segundosAte(ate) });
        total.adiados++;
        return;
      }
      if (falhaDeConexao(status)) {
        // O banco conta as falhas seguidas do domínio (entre as chamadas) e, na 5ª, devolve até quando ele fica morto: daí em
        // diante, nesta rodada, os itens dele voltam sem tocar na rede.
        const r = await banco<{ morto_ate?: string | null } | null>("fila_feito", { id: item.id, ok: false, definitivo: false, erro: `http_${status}`, status, dominio }).catch(() => null);
        const morto = r?.morto_ate ? Date.parse(r.morto_ate) : NaN;
        if (Number.isFinite(morto) && morto > Date.now()) {
          estado.esperaAte = Math.max(estado.esperaAte ?? 0, morto);
          estado.motivo = "dominio_morto";
        }
        total.adiados++;
        return;
      }
      // 410 numa caixa: o ator sumiu lá; o banco apaga o seguidor daquela caixa. Outro 4xx (menos 408) é recusa definitiva.
      const definitivo = status >= 400 && status < 500 && status !== 408;
      await banco("fila_feito", { id: item.id, ok: false, definitivo, erro: `http_${status}`, status, dominio });
      if (definitivo) total.descartados++;
      else total.adiados++;
    },
  );
  return total;
}
