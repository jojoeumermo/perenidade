// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Moderação que chega de fora (modo "fediverso-total"):
//   • Flag (denúncia encaminhada por outra instância; vem do ator da instância, com o perfil e os posts em "object" e o comentário em
//     "content"): só os alvos DAQUI entram, e a denúncia vai para a mediação (ação denuncia_recebida → protocolo). Nada de quem
//     denunciou lá é guardado além do ator que assinou (o da instância).
//   • Block de alguém de fora a uma pessoa daqui (e o Undo): ação bloqueio_recebido. A Alumia esconde um do outro; o ActivityPub
//     não obriga a honrar, mas o Mastodon recomenda.
// Sem "@/". Só roda no servidor.
import type { ResultadoDaCaixa } from "../caixa";
import { banco } from "../servidor";
import { htmlParaTexto } from "../texto";
import { handleLocal, idDe, listaDeIds, postLocal } from "./nota";

/** Flag recebida. */
export async function receberDenuncia(atividade: Record<string, unknown>, autor: string): Promise<ResultadoDaCaixa> {
  const alvos = [...new Set(listaDeIds(atividade.object).filter((x) => handleLocal(x) || postLocal(x)))].slice(0, 20);
  if (!alvos.length) return { status: 202, motivo: "denuncia_sem_alvo_daqui" };
  const conteudo = htmlParaTexto(typeof atividade.content === "string" ? atividade.content : "", 1000);
  const r = await banco<{ protocolo?: string | null }>("denuncia_recebida", { ator_instancia: autor, alvos, conteudo });
  return { status: 202, motivo: r.protocolo ? "denuncia" : "denuncia_recusada" };
}

/** Block (sim) ou Undo de Block (não) de alguém de fora a uma pessoa daqui. */
export async function receberBloqueio(bloqueio: Record<string, unknown>, autor: string, sim: boolean): Promise<ResultadoDaCaixa> {
  if (!sim && idDe(bloqueio.actor) !== autor) return { status: 202, motivo: "ignorado" };
  const alvo = handleLocal(idDe(bloqueio.object));
  if (!alvo) return { status: 202, motivo: "alvo_desconhecido" };
  await banco("bloqueio_recebido", { ator: autor, alvo_handle: alvo, sim });
  return { status: 202, motivo: sim ? "bloqueio" : "desbloqueio" };
}
