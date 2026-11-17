// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Atividade REPASSADA (inbox forwarding): a resposta de C a um post de B chega pela instância de B, assinada por B, mas o ator é C.
// O Mastodon resolve isso com LD Signatures e ele mesmo desaconselha implementá-las (docs.joinmastodon.org/spec/security). A saída
// comum, e a daqui: (1) conferir a assinatura HTTP do REPASSADOR, com a chave dele (buscada pelo keyId, dono conferido); (2) NÃO
// confiar no corpo: buscar o objeto pelo id na ORIGEM (pedido assinado pelo ator da instância, com a trava de SSRF de http.ts) e
// só seguir com o que a origem confirma. Delete repassado só vale se a origem responde 404/410. Sem "@/". Só roda no servidor.
import { conferirAssinatura, type MotivoDaRecusa } from "../assinatura";
import { atorRemoto, banco, buscarDocumento, buscarDocumentoComStatus, type AtorRemoto } from "../servidor";
import { autorDe, dominio, idDe, TIPOS_DE_NOTA, urlHttps } from "./nota";

export type ResultadoDoRepasse = { ok: true; repassador: AtorRemoto } | { ok: false; status: number; motivo: MotivoDaRecusa | "chave_desconhecida" | "instancia_bloqueada" };

/** O ator dono de um keyId: o próprio documento do keyId sem o "#…" (Mastodon) ou o "owner" do documento da chave. */
async function donoDaChave(chaveId: string): Promise<AtorRemoto | null> {
  if (!urlHttps(chaveId, 500)) return null;
  const semFragmento = chaveId.split("#")[0];
  let ator = await atorRemoto(semFragmento).catch(() => null);
  if (ator && ator.chave_id !== chaveId) ator = await atorRemoto(semFragmento, { renovar: true }).catch(() => null);
  if (ator?.chave_id === chaveId && ator.chave_publica) return ator;
  // A chave é um documento à parte (algumas instâncias): o dono dela é quem diz "owner", e o ator do dono tem de apontar a mesma chave.
  const chave = await buscarDocumento(chaveId).catch(() => null);
  const dono = chave ? urlHttps(chave.owner, 500) : null;
  if (!dono || dominio(dono) !== dominio(chaveId)) return null;
  const doDono = await atorRemoto(dono, { renovar: true }).catch(() => null);
  return doDono?.chave_id === chaveId && doDono.chave_publica ? doDono : null;
}

/** Confere a assinatura de quem repassou (instância diferente da do ator da atividade). */
export async function conferirRepassador({
  chaveId,
  metodo,
  caminho,
  ler,
  corpo,
}: {
  chaveId: string;
  metodo: string;
  caminho: string;
  ler: (nome: string) => string | null;
  corpo: Uint8Array;
}): Promise<ResultadoDoRepasse> {
  // Banco fora do ar conta como bloqueado: na dúvida, o repasse não entra.
  if (await banco<boolean>("bloqueado", { url: chaveId }).catch(() => true)) return { ok: false, status: 403, motivo: "instancia_bloqueada" };
  const repassador = await donoDaChave(chaveId);
  if (!repassador?.chave_publica) return { ok: false, status: 401, motivo: "chave_desconhecida" };
  const r = conferirAssinatura({ metodo, caminho, ler, corpo, chavePublica: repassador.chave_publica });
  return r.ok ? { ok: true, repassador } : { ok: false, status: 401, motivo: r.motivo };
}

/** Busca um objeto pelo id na origem. Só vale se o documento que volta tem o MESMO id (sem redirecionar para outro objeto). */
export async function buscarNaOrigem(id: string): Promise<{ status: number; doc: Record<string, unknown> | null }> {
  if (!urlHttps(id, 500)) return { status: 0, doc: null };
  const r = await buscarDocumentoComStatus(id).catch(() => ({ status: 0, doc: null, final: null }));
  if (!r.doc || idDe(r.doc) !== id) return { status: r.status, doc: null };
  return { status: r.status, doc: r.doc };
}

/** Quem escreveu a nota (a pessoa, antes do canal do PeerTube: autorDe). */
const autorDaNota = (doc: Record<string, unknown>) => autorDe(doc);

/**
 * A atividade repassada, refeita só com o que a origem confirma; nulo quando não dá para confirmar (e nada é gravado).
 *   Create/Update de nota: o objeto buscado na origem, do mesmo domínio do ator e atribuído a ele.
 *   Delete: só se a origem responde 404 ou 410 para o objeto (sumiu mesmo).
 *   O resto (Follow, Like, Flag…) não se repassa: nulo.
 */
export async function confirmarNaOrigem(atividade: Record<string, unknown>, autor: string): Promise<Record<string, unknown> | null> {
  const tipo = String(atividade.type ?? "");
  const objetoId = idDe(atividade.object);
  if (!objetoId || dominio(objetoId) !== dominio(autor)) return null;
  if (tipo === "Create" || tipo === "Update") {
    const { doc } = await buscarNaOrigem(objetoId);
    if (!doc || !TIPOS_DE_NOTA.has(String(doc.type)) || autorDaNota(doc) !== autor) return null;
    return { ...atividade, object: doc };
  }
  if (tipo === "Delete") {
    if (objetoId === autor) return null;
    const { status, doc } = await buscarNaOrigem(objetoId);
    return status === 404 || status === 410 || doc?.type === "Tombstone" ? { ...atividade, object: objetoId } : null;
  }
  return null;
}
