// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A entrega: pega na fila do banco (interno.rede_fed_fila) as atividades vencidas, monta cada uma NA HORA (um post só sai se ainda
// pode sair: interno.rede_fed_federavel é conferida de novo), assina com a chave do ator e entrega na caixa de entrada da outra
// instância. Falha temporária volta para a fila com espera crescente (até 8 tentativas); recusa definitiva (4xx) sai da fila.
// Com o modo "fediverso-total" (desligado por padrão; PLANO-FEDIVERSO, F2):
//   • os tipos novos (contrato 3.4): like, undo-like, announce, undo-announce, flag (assinada pelo ATOR DA INSTÂNCIA: quem denunciou
//     aqui não aparece lá), block, undo-block, group-announce e group-accept;
//   • vazão maior: até 200 itens por chamada, 10 de cada vez e no máximo 2 por domínio;
//   • circuito por domínio: um domínio "morto" (o banco diz até quando, em dominio_estado) não gasta tentativa: o item só espera.
//     Dentro de uma mesma chamada, 5 falhas de conexão seguidas num domínio já param os itens seguintes dele;
//   • 410 numa caixa: recusa definitiva com o status, e o banco apaga o seguidor daquela caixa (fila_feito com status 410);
//   • 429: respeita o Retry-After (segundos ou data), e os outros itens do domínio esperam junto, sem gastar tentativa.
// Sem "@/". Só roda no servidor.
import { createHash, randomUUID } from "node:crypto";
import { assinarPedido } from "./assinatura";
import * as documentos from "./documentos";
import { atividadeCreate, atividadeDelete, atividadeFollow, atividadeResposta, atividadeUndoFollow, atividadeUpdate, CONTEXTO, PUBLICO, type PostFederado } from "./documentos";
import type { EnderecosDaFederacao } from "./enderecos";
import { pedirAoFediverso } from "./http";
import { abrirChave, banco, chaveDaInstancia, fed, modoTotal } from "./servidor";

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
  /** pedido: o id do Follow; atividade: o id da atividade (Like, Announce, Flag, Block) para o Undo bater; alvos/conteudo: da Flag; slug: da comunidade. */
  extra: { pedido?: string; atividade?: string; alvos?: string[]; conteudo?: string; slug?: string };
  tentativas: number;
  handle: string;
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
 * O id da atividade de um item (Like, Announce, Block, Flag): o que o banco guardou em extra.atividade ou, sem ele, um id FIXO por
 * pessoa e objeto (o Undo precisa repetir o mesmo id do original para a outra instância achar o que desfazer).
 */
function idDaAtividade(item: ItemDaFila, tipo: string): string {
  const guardado = item.extra?.atividade;
  if (typeof guardado === "string" && guardado.startsWith(`${fed.base}/`)) return guardado;
  return fed.atividade(tipo, createHash("sha256").update(`${item.handle}\n${item.objeto}`).digest("hex").slice(0, 32));
}

/** Monta a atividade de um item; nulo quando ela não deve mais sair (o post deixou de poder sair, por exemplo). */
async function montar(item: ItemDaFila): Promise<Atividade | null> {
  const c = construtores;
  switch (item.tipo) {
    case "create":
    case "update": {
      const post = await banco<PostFederado | { apagado: true } | null>("post", { id: item.objeto });
      if (!post || "apagado" in post) return null;
      return item.tipo === "create" ? atividadeCreate(fed, post) : atividadeUpdate(fed, post);
    }
    case "delete":
      return atividadeDelete(fed, item.handle, item.objeto);
    case "accept":
      return atividadeResposta(fed, "Accept", item.handle, item.objeto, item.extra.pedido ?? "", randomUUID());
    case "reject":
      return atividadeResposta(fed, "Reject", item.handle, item.objeto, item.extra.pedido ?? "", randomUUID());
    case "follow":
      return item.extra.pedido ? atividadeFollow(fed, item.handle, item.objeto, item.extra.pedido) : null;
    case "undo-follow":
      return item.extra.pedido ? atividadeUndoFollow(fed, item.handle, item.objeto, item.extra.pedido, randomUUID()) : null;
    default:
      return modoTotal() ? montarTotal(item, c) : null;
  }
}

/** Os tipos do modo total (contrato 3.4). */
async function montarTotal(item: ItemDaFila, c: Construtores): Promise<Atividade | null> {
  switch (item.tipo) {
    case "like":
      return c.atividadeLike(fed, item.handle, item.objeto, idDaAtividade(item, "like"));
    case "undo-like":
      return c.atividadeUndo(fed, item.handle, c.atividadeLike(fed, item.handle, item.objeto, idDaAtividade(item, "like")));
    case "announce":
      return c.atividadeAnnounce(fed, item.handle, item.objeto, idDaAtividade(item, "announce"));
    case "undo-announce":
      return c.atividadeUndo(fed, item.handle, c.atividadeAnnounce(fed, item.handle, item.objeto, idDaAtividade(item, "announce")));
    case "block":
      return c.atividadeBlock(fed, item.handle, item.objeto, idDaAtividade(item, "block"));
    case "undo-block":
      return c.atividadeUndo(fed, item.handle, c.atividadeBlock(fed, item.handle, item.objeto, idDaAtividade(item, "block")));
    case "flag": {
      // Só os alvos de fora (o perfil e os posts denunciados) e o comentário que a pessoa escolheu encaminhar.
      const alvos = (Array.isArray(item.extra.alvos) ? item.extra.alvos : [item.objeto]).filter((x) => typeof x === "string" && /^https:\/\//.test(x)).slice(0, 20);
      if (!alvos.length) return null;
      return c.atividadeFlag(fed, alvos, typeof item.extra.conteudo === "string" ? item.extra.conteudo.slice(0, 1000) : "", item.extra.atividade ?? fed.atividade("flag", randomUUID()));
    }
    case "group-announce": {
      const slug = item.extra.slug;
      if (!slug) return null;
      const post = await banco<PostFederado | { apagado: true } | null>("post", { id: item.objeto });
      if (!post || "apagado" in post) return null;
      return c.atividadeAnnounceDoGrupo(fed, slug, atividadeCreate(fed, post));
    }
    case "group-accept": {
      const slug = item.extra.slug;
      if (!slug || !item.extra.pedido) return null;
      const grupo = doGrupo(fed, slug);
      return { "@context": CONTEXTO, id: `${grupo}#accepts/${randomUUID()}`, type: "Accept", actor: grupo, object: { id: item.extra.pedido, type: "Follow", actor: item.objeto, object: grupo } };
    }
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
export async function processarFila(limite = 20): Promise<{ entregues: number; adiados: number; descartados: number }> {
  if (modoTotal()) return processarFilaTotal(Math.min(Math.max(limite, 1), LIMITE_TOTAL));
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
        const status = await entregar(item.destino, atividade, item.handle, chave);
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
/** Falhas de conexão seguidas que matam um domínio, e as esperas dele morto (1 h, 6 h e 24 h; o banco guarda quantas vezes já morreu). */
export const FALHAS_PARA_MORRER = 5;
export const ESPERAS_DO_CIRCUITO_MS = [3_600_000, 6 * 3_600_000, 24 * 3_600_000] as const;
/** O Retry-After de um 429 vale até 24 h; sem ele (ou ilegível), 5 minutos. */
const RETRY_PADRAO_MS = 5 * 60_000;
const RETRY_MAXIMO_MS = 24 * 3_600_000;

/** Até quando um domínio fica morto na n-ésima vez (0 = primeira). */
export function mortoAte(vezes: number, agora = Date.now()): Date {
  return new Date(agora + ESPERAS_DO_CIRCUITO_MS[Math.min(Math.max(vezes, 0), ESPERAS_DO_CIRCUITO_MS.length - 1)]);
}

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
  falhasSeguidas: number;
}

async function processarFilaTotal(limite: number): Promise<{ entregues: number; adiados: number; descartados: number }> {
  const itens = await banco<ItemDaFila[]>("fila_pegar", { limite });
  const total = { entregues: 0, adiados: 0, descartados: 0 };
  const estados = new Map<string, Promise<EstadoDoDominio>>();
  const estadoDe = (dominio: string) => {
    let e = estados.get(dominio);
    if (!e) {
      e = banco<{ morto_ate?: string | null } | null>("dominio_estado", { dominio })
        .then((r) => {
          const ate = r?.morto_ate ? Date.parse(r.morto_ate) : NaN;
          return { esperaAte: Number.isFinite(ate) && ate > Date.now() ? ate : null, motivo: "dominio_morto", falhasSeguidas: 0 };
        })
        .catch(() => ({ esperaAte: null, motivo: "", falhasSeguidas: 0 }));
      estados.set(dominio, e);
    }
    return e;
  };
  let instancia: { privada: string } | null | undefined;

  await emParalelo(
    itens,
    (item) => dominioDe(item.destino),
    async (item) => {
      const dominio = dominioDe(item.destino);
      const estado = await estadoDe(dominio);
      // Domínio esperando (morto ou com 429): o item volta para a fila sem gastar tentativa e sem tocar na rede.
      if (estado.esperaAte && estado.esperaAte > Date.now()) {
        await banco("fila_feito", { id: item.id, ok: false, definitivo: false, erro: estado.motivo, status: 0, dominio, adiar_ate: new Date(estado.esperaAte).toISOString(), sem_tentativa: true });
        total.adiados++;
        return;
      }
      // A Flag sai assinada pelo ator da instância; os Group pela chave da comunidade (que vem no item); o resto pela pessoa.
      let chave: string | null;
      let chaveId: string;
      if (item.tipo === "flag") {
        if (instancia === undefined) instancia = await chaveDaInstancia().catch(() => null);
        chave = instancia?.privada ?? null;
        chaveId = fed.chaveDaInstancia;
      } else if (item.tipo === "group-announce" || item.tipo === "group-accept") {
        chave = abrirChave(item.chave_privada);
        chaveId = `${doGrupo(fed, item.extra.slug ?? "")}#main-key`;
      } else {
        chave = abrirChave(item.chave_privada);
        chaveId = fed.chave(item.handle);
      }
      if (!chave) {
        await banco("fila_feito", { id: item.id, ok: false, definitivo: true, erro: "sem_chave", status: 0, dominio });
        total.descartados++;
        return;
      }
      const atividade = await montar(item).catch(() => undefined);
      if (atividade === undefined) {
        await banco("fila_feito", { id: item.id, ok: false, erro: "banco", status: 0, dominio, sem_tentativa: false });
        total.adiados++;
        return;
      }
      if (atividade === null) {
        await banco("fila_feito", { id: item.id, ok: true, erro: "", status: 0, dominio });
        total.descartados++;
        return;
      }
      const { status, retryAfter } = await entregarAssinado(item.destino, atividade, chaveId, chave);
      if (status >= 200 && status < 300) {
        estado.falhasSeguidas = 0;
        await banco("fila_feito", { id: item.id, ok: true, status, dominio });
        total.entregues++;
        return;
      }
      if (status === 429) {
        // A outra instância pediu calma: este item e os outros do mesmo domínio esperam o que ela pediu.
        const ate = lerRetryAfter(retryAfter);
        estado.esperaAte = Math.max(estado.esperaAte ?? 0, ate.getTime());
        estado.motivo = "http_429";
        await banco("fila_feito", { id: item.id, ok: false, definitivo: false, erro: "http_429", status, dominio, adiar_ate: ate.toISOString() });
        total.adiados++;
        return;
      }
      if (falhaDeConexao(status)) {
        estado.falhasSeguidas++;
        // Cinco seguidas nesta chamada: o domínio para aqui (o banco, que conta entre as chamadas, decide até quando de verdade).
        if (estado.falhasSeguidas >= FALHAS_PARA_MORRER && !estado.esperaAte) {
          estado.esperaAte = mortoAte(0).getTime();
          estado.motivo = "dominio_morto";
        }
        await banco("fila_feito", { id: item.id, ok: false, definitivo: false, erro: `http_${status}`, status, dominio });
        total.adiados++;
        return;
      }
      estado.falhasSeguidas = 0;
      // 410 numa caixa: o ator sumiu lá; o banco apaga o seguidor daquela caixa. Outro 4xx (menos 408) é recusa definitiva.
      const definitivo = status >= 400 && status < 500 && status !== 408;
      await banco("fila_feito", { id: item.id, ok: false, definitivo, erro: `http_${status}`, status, dominio, ...(status === 410 ? { sumiu: item.destino } : {}) });
      if (definitivo) total.descartados++;
      else total.adiados++;
    },
  );
  return total;
}
