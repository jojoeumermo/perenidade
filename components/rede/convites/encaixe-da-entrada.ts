// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O ENCAIXE da porta de entrada (onda 8, frente 8D) na tela de entrada da Alumia (components/rede/entrada/, que é da entrada).
// Como os encaixes das frentes (components/rede/encaixes.tsx): a entrada importa daqui, de um caminho fixo, e só esta frente
// edita este arquivo.
//   - livres: as telas que abrem sem conta aprovada (a página do convite, /alumia/convite/<código>);
//   - useProvaDaPorta / ProvaDoAparelho: o "criar conta" passando pela porta (prova no aparelho, conferida no servidor antes de a
//     conta existir), no lugar do desafio de terceiros;
//   - antesDoPedido: o passe do servidor antes do pedido de entrada (com o convite guardado neste aparelho);
//   - entrarPelaPorta / avisoPelaPorta (onda 9): entrar com a senha e pedir um e-mail pelo servidor, com a prova no aparelho.
import { abrirPortaDoPedido, type ResultadoDoPedido } from "@/lib/rede/convites/cliente";

export { ProvaDoAparelho, useProvaDaPorta, type EstadoDaProva } from "./ProvaDoAparelho";
export { avisoPelaPorta, entrarPelaPorta } from "@/lib/rede/convites/cliente";

/** As telas da porta que abrem sem conta aprovada. */
export const LIVRES_DA_PORTA = /\/convite\/[0-9a-f]{32}\/?$/;

/**
 * Antes do pedido de entrada. Devolve o código de erro para a tela (o mesmo vocabulário do banco: "muitos_pedidos" etc.), ou nulo
 * para seguir. Sem o servidor da porta (rota ou função do banco que ainda não existe, rede caída), segue: quem decide é o banco,
 * que só exige o passe com a porta ligada.
 */
export async function antesDoPedido(): Promise<string | null> {
  const r: ResultadoDoPedido = await abrirPortaDoPedido().catch((): ResultadoDoPedido => ({ ok: false, motivo: "sem_servico" }));
  if (r.ok || r.motivo === "sem_servico") return null;
  return r.motivo === "porta_cheia" ? "muitos_pedidos" : r.motivo;
}
