// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Curtidas (Like), impulsos (Announce) e o desfazer deles (Undo) que chegam de fora (modo "fediverso-total").
//   • Like/Announce de um post DAQUI → ação interacao (contrato 3.1), que guarda e avisa o autor (respeitando as preferências dele).
//   • Announce de uma nota de FORA (quem alguém daqui segue impulsionou) → a nota é buscada NA ORIGEM (nunca se confia no corpo do
//     impulso) e entra pela nota_recebida como impulso; só nota pública ou não listada, de instância não bloqueada.
//   • Undo de Like/Announce: só vale com o objeto embutido e do mesmo ator (ninguém desfaz a curtida dos outros).
// Sem "@/". Só roda no servidor.
import type { ResultadoDaCaixa } from "../caixa";
import { banco } from "../servidor";
import { buscarNaOrigem } from "./repasse";
import { dominio, idDe, lerNota, listaDeIds, postLocal, PUBLICOS, urlHttps } from "./nota";

const TIPO: Record<string, "like" | "announce"> = { Like: "like", EmojiReact: "like", Announce: "announce" };

/** Like ou Announce recebido (já com a assinatura do ator conferida). */
export async function receberInteracao(atividade: Record<string, unknown>, autor: string): Promise<ResultadoDaCaixa> {
  const tipo = TIPO[String(atividade.type)];
  const atividadeId = urlHttps(idDe(atividade), 500);
  if (!tipo || !atividadeId || dominio(atividadeId) !== dominio(autor)) return { status: 202, motivo: "ignorado" };
  const objetoId = idDe(atividade.object);
  const local = postLocal(objetoId);
  if (local) {
    const r = await banco<{ ok: boolean; perfil_autor?: string | null }>("interacao", { tipo, ator: autor, atividade_id: atividadeId, post_local: local, sim: true });
    return { status: 202, motivo: r.ok ? tipo : "interacao_recusada" };
  }
  if (tipo !== "announce" || !objetoId) return { status: 202, motivo: "ignorado" };
  // Impulso de uma nota de fora: só impulso público, e a nota confirmada na origem.
  if (![...listaDeIds(atividade.to), ...listaDeIds(atividade.cc)].some((x) => PUBLICOS.has(x))) return { status: 202, motivo: "impulso_nao_publico" };
  if (await banco<boolean>("bloqueado", { url: objetoId }).catch(() => true)) return { status: 202, motivo: "instancia_bloqueada" };
  const { doc } = await buscarNaOrigem(objetoId);
  if (!doc) return { status: 202, motivo: "impulso_nao_confirmado" };
  const autorDaNota = Array.isArray(doc.attributedTo) ? idDe(doc.attributedTo[0]) : idDe(doc.attributedTo);
  if (!autorDaNota) return { status: 202, motivo: "impulso_nao_confirmado" };
  const lida = lerNota(doc, autorDaNota);
  if (!lida.ok) return { status: 202, motivo: lida.motivo };
  if (lida.nota.visibilidade !== "publico" && lida.nota.visibilidade !== "nao_listado") return { status: 202, motivo: "impulso_nao_publico" };
  const r = await banco<{ guardado: boolean; motivo?: string }>("nota_recebida", { ...lida.nota, impulso: { ator: autor, atividade_id: atividadeId } });
  return { status: 202, motivo: r.guardado ? "impulso" : (r.motivo ?? "descartado") };
}

/** Undo de Like/Announce (o objeto embutido, do mesmo ator). */
export async function desfazerInteracao(desfeita: Record<string, unknown>, autor: string): Promise<ResultadoDaCaixa> {
  const tipo = TIPO[String(desfeita.type)];
  const atividadeId = urlHttps(idDe(desfeita), 500);
  if (!tipo || !atividadeId || idDe(desfeita.actor) !== autor || dominio(atividadeId) !== dominio(autor)) return { status: 202, motivo: "ignorado" };
  await banco("interacao", { tipo, ator: autor, atividade_id: atividadeId, post_local: postLocal(idDe(desfeita.object)), sim: false });
  return { status: 202, motivo: `desfez_${tipo}` };
}
