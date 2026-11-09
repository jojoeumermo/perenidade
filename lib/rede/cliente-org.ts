// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As chamadas da F4 (perfis e organizações) ao banco: uma função por rpc, com os nomes que a etapa de back-end vai criar em
// supabase/migracoes/20261109-alumia-f4-org.sql (PLANO-ALUMIA §5 F4). Até lá o banco responde "banco_desatualizado"; a tela
// trata isso como "ainda não há" (nada quebra) e, só com NEXT_PUBLIC_ALUMIA_PREVIA=sim, mostra os dados de exemplo de
// lib/rede/org/exemplos.ts. Usa `chamar` de lib/rede/cliente.ts, que os testes trocam por uma forma simulada. Sem "@/" de propósito.
//
// Nenhuma função aqui recebe ou devolve lista de pessoas (quem segue, quem votou, quem é de um núcleo, quem está na sala) nem o
// vínculo entre a organização e quem cuida dela (PLANO-ALUMIA §6.1 e §6.6; LGPD art. 5º, II e art. 11).
import { chamar, type Chamar } from "./cliente";
import { aoVivoDeExemplo, extrasDeExemplo, HANDLE_DE_EXEMPLO, orgDeExemplo, previaLigada } from "./org/exemplos";
import type { ExtrasDoPerfil, OrgPublica, PedidoDeExtras, PedidoDeSelo, PedidoDeVotacao, PedidoNaFila, PlenariaAoVivo, VotacaoDaOrg } from "./tipos-org";

/**
 * O banco ainda não tem a função (a migração da F4 não rodou) ou não há serviço configurado (desenvolvimento sem banco): a tela
 * segue como se não houvesse nada.
 */
export function bancoSemAFuncao(e: unknown): boolean {
  const codigo = typeof e === "object" && e !== null && "code" in e ? (e as { code: unknown }).code : null;
  return codigo === "banco_desatualizado" || codigo === "sem_servico";
}

/** Lê do banco; se a função ainda não existe, devolve `semFuncao()` (o exemplo na prévia, ou o vazio). Outros erros sobem. */
async function lerOuExemplo<T>(pedido: () => Promise<T>, semFuncao: () => T): Promise<T> {
  try {
    return await pedido();
  } catch (e) {
    if (bancoSemAFuncao(e)) return semFuncao();
    throw e;
  }
}

export function criarClienteOrg(c: Chamar, previa: () => boolean = previaLigada) {
  return {
    /** O perfil público de uma organização pelo @; nulo se o @ não é de organização (aí a tela mostra o perfil de pessoa). */
    org: (handle: string) =>
      lerOuExemplo(
        () => c<OrgPublica | null>("rede_org_perfil", { p_handle: handle }),
        () => (previa() && handle === HANDLE_DE_EXEMPLO ? orgDeExemplo() : null),
      ),
    /** "Ao vivo agora": plenárias acontecendo, das organizações que sigo (ou públicas). Sem banco: vazio (ou o exemplo na prévia). */
    aoVivo: () => lerOuExemplo(() => c<PlenariaAoVivo[]>("rede_org_ao_vivo"), () => (previa() ? aoVivoDeExemplo() : [])),
    /** Seguir a organização (o mesmo seguir de perfil). */
    seguir: (handle: string, sim: boolean) => c<{ sigo: boolean; pendente: boolean }>("rede_perfil_seguir", { p_handle: handle, p_sim: sim }),
    /** O sininho: avisar quando a organização postar (aviso "org_postou", sem texto no push). */
    sino: (handle: string, sim: boolean) => c<{ sino: boolean }>("rede_org_sino", { p_handle: handle, p_sim: sim }),
    /** Pedir para entrar num núcleo da organização (quem media decide; ninguém vê a lista de pedidos além da mediação). */
    entrarNoNucleo: (nucleo: string) => c<{ sou: boolean; pedi: boolean }>("rede_org_nucleo_entrar", { p_nucleo: nucleo }),
    /** Votar numa consulta: `ranking` é a ordem de preferência (na simples, uma opção). O voto é secreto: nada volta além de "votei". */
    votar: (consulta: string, ranking: string[]) => c<{ votei: true }>("rede_org_consulta_votar", { p_consulta: consulta, p_ranking: ranking }),
    /** Mandar pergunta para a fila da plenária (entra no fim, por ordem de chegada). `mostrar`: o meu @ aparece na fila. */
    perguntar: (plenaria: string, texto: string, mostrar: boolean) =>
      c<{ ok: true; naFila: number }>("rede_org_plenaria_perguntar", { p_plenaria: plenaria, p_texto: texto, p_mostrar: mostrar }),
    /** Só gestor: registrar um voto em "Como votamos" (com a fonte pública). */
    registrarVotacao: (handle: string, v: PedidoDeVotacao) => c<VotacaoDaOrg>("rede_org_votacao_registrar", { p_handle: handle, p: v }),
    /** Pedir o selo (cria a conta da organização, se preciso, e põe o pedido na fila da equipe). */
    pedirSelo: (p: PedidoDeSelo) => c<{ id: string; situacao: "esperando" }>("rede_org_pedir_selo", { p }),
    /** Só a equipe (painel): a fila de pedidos do selo. Mostra a organização e o documento público; nunca quem pediu. */
    filaDoSelo: () => c<PedidoNaFila[]>("rede_org_selo_fila"),
    decidirSelo: (id: string, aceitar: boolean, motivo: string) => c<{ ok: true }>("rede_org_selo_decidir", { p_id: id, p_aceitar: aceitar, p_motivo: motivo }),
    /** Os extras do perfil de pessoa (status, pronomes, campos, destaques). Sem banco: nada (ou o exemplo na prévia). */
    extras: (handle: string) =>
      lerOuExemplo<ExtrasDoPerfil | null>(() => c<ExtrasDoPerfil | null>("rede_perfil_extras", { p_handle: handle }), () => (previa() ? extrasDeExemplo(handle) : null)),
    /** Editar os meus extras. */
    editarExtras: (p: PedidoDeExtras) => c<ExtrasDoPerfil>("rede_perfil_extras_editar", { p }),
  };
}

export type ClienteOrg = ReturnType<typeof criarClienteOrg>;

export const redeOrg = criarClienteOrg(chamar);
