// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As chamadas da F4 (perfis e organizações) ao banco: uma função por rpc, as de supabase/migracoes/20261109-alumia-f4.sql
// (PLANO-ALUMIA §5 F4). Num banco sem a migração a função responde "banco_desatualizado"; a tela trata isso como "ainda não há"
// (nada quebra) e, só com NEXT_PUBLIC_ALUMIA_PREVIA=sim, mostra os dados de exemplo de lib/rede/org/exemplos.ts. A conta nova de
// uma organização nasce no servidor (app/api/rede/org/selo, com lib/rede/contas-extra.ts), porque só ele tem a chave de serviço. Usa `chamar` de lib/rede/cliente.ts, que os testes trocam por uma forma simulada. Sem "@/" de propósito.
//
// Nenhuma função aqui recebe ou devolve lista de pessoas (quem segue, quem votou, quem é de um núcleo, quem está na sala) nem o
// vínculo entre a organização e quem cuida dela (PLANO-ALUMIA §6.1 e §6.6; LGPD art. 5º, II e art. 11).
import { BackendError, getClient } from "../backend";
import { chamar, type Chamar } from "./cliente";
import { aoVivoDeExemplo, extrasDeExemplo, HANDLE_DE_EXEMPLO, orgDeExemplo, previaLigada } from "./org/exemplos";
import type { PaginaDaLinha } from "./tipos";
import type {
  ExtrasDoPerfil, OrgPublica, PedidoDeConsulta, PedidoDeExtras, PedidoDeNucleo, PedidoDePlenaria, PedidoDeSelo, PedidoDeVotacao, PedidoNaFila, PedidoParaONucleo,
  PlenariaAoVivo, VotacaoDaOrg,
} from "./tipos-org";

/** O pedido do selo que precisa de conta nova vai ao servidor (que confere a sessão e cria a conta sem senha). */
export type CriarContaDaOrg = (p: PedidoDeSelo) => Promise<{ id: string; situacao: "esperando" }>;

/** No navegador: manda o pedido à rota do servidor com o token da sessão. */
export const criarContaPeloServidor: CriarContaDaOrg = async (p) => {
  const supabase = await getClient();
  const token = (await supabase.auth.getSession()).data.session?.access_token;
  if (!token) throw new BackendError("entre_primeiro");
  const r = await fetch("/api/rede/org/selo", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ p }) }).catch(() => {
    throw new BackendError("sem_conexao");
  });
  const corpo = (await r.json().catch(() => null)) as { id?: string; situacao?: "esperando"; erro?: string } | null;
  if (!r.ok || !corpo?.id) throw new BackendError(corpo?.erro ?? "falha");
  return { id: corpo.id, situacao: "esperando" };
};

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

export function criarClienteOrg(c: Chamar, previa: () => boolean = previaLigada, criarConta: CriarContaDaOrg = criarContaPeloServidor) {
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
    /**
     * Pedir o selo. Se o @ já é de uma organização que eu gerencio, o banco põe o pedido na fila; se o @ está livre, o banco
     * responde `criar` e o servidor cria a conta da organização (sem senha) e põe o pedido na fila.
     */
    pedirSelo: async (p: PedidoDeSelo): Promise<{ id: string; situacao: "esperando" }> => {
      const r = await c<{ id: string; situacao: "esperando" } | { criar: true }>("rede_org_pedir_selo", { p });
      return "criar" in r ? criarConta(p) : r;
    },
    /** Só a equipe (painel): a fila de pedidos do selo. Mostra a organização e o documento público; nunca quem pediu. */
    filaDoSelo: () => c<PedidoNaFila[]>("rede_org_selo_fila"),
    decidirSelo: (id: string, aceitar: boolean, motivo: string) => c<{ ok: true }>("rede_org_selo_decidir", { p_id: id, p_aceitar: aceitar, p_motivo: motivo }),
    /** Só a equipe: tirar o selo, com motivo (os gestores são avisados). */
    tirarSelo: (handle: string, motivo: string) => c<{ ok: true }>("rede_org_selo_tirar", { p_handle: handle, p_motivo: motivo }),
    /** Gestores: o dono põe ou tira alguém; qualquer gestor sai. As respostas são só "ok" (o vínculo não volta). */
    adicionarGestor: (org: string, handle: string) => c<{ ok: true }>("rede_org_gestor_adicionar", { p_org: org, p_handle: handle }),
    removerGestor: (org: string, handle: string) => c<{ ok: true }>("rede_org_gestor_remover", { p_org: org, p_handle: handle }),
    sairDaGestao: (org: string) => c<{ ok: true }>("rede_org_gestor_sair", { p_org: org }),
    /** Só gestor: criar núcleo, ver e decidir os pedidos para entrar (codinome e @, nada mais). */
    criarNucleo: (handle: string, p: PedidoDeNucleo) => c<{ id: string }>("rede_org_nucleo_criar", { p_handle: handle, p }),
    pedidosDosNucleos: (handle: string) => c<PedidoParaONucleo[]>("rede_org_nucleo_pedidos", { p_handle: handle }),
    decidirNucleo: (nucleo: string, handle: string, aceitar: boolean) => c<{ ok: true }>("rede_org_nucleo_decidir", { p_nucleo: nucleo, p_handle: handle, p_aceitar: aceitar }),
    /** Só gestor: abrir consulta (regra escrita antes e que não muda) e marcar e conduzir plenária. */
    abrirConsulta: (handle: string, p: PedidoDeConsulta) => c<{ id: string }>("rede_org_consulta_abrir", { p_handle: handle, p }),
    abrirPlenaria: (handle: string, p: PedidoDePlenaria) => c<{ id: string }>("rede_org_plenaria_abrir", { p_handle: handle, p }),
    mudarPlenaria: (id: string, situacao: "marcada" | "ao_vivo" | "encerrada", sala: string | null = null) =>
      c<{ ok: true }>("rede_org_plenaria_mudar", { p_id: id, p_situacao: situacao, p_sala: sala }),
    responderPergunta: (pergunta: string) => c<{ ok: true }>("rede_org_plenaria_responder", { p_pergunta: pergunta }),
    retirarPergunta: (pergunta: string, motivo: "ofensa" | "dado_pessoal" | "fora_do_tema" | "repetida") =>
      c<{ ok: true }>("rede_org_plenaria_retirar", { p_pergunta: pergunta, p_motivo: motivo }),
    /** Os extras do perfil de pessoa (status, pronomes, campos, destaques). Sem banco: nada (ou o exemplo na prévia). */
    extras: (handle: string) =>
      lerOuExemplo<ExtrasDoPerfil | null>(() => c<ExtrasDoPerfil | null>("rede_perfil_extras", { p_handle: handle }), () => (previa() ? extrasDeExemplo(handle) : null)),
    /**
     * As abas Respostas e Mídia do perfil de pessoa: os posts da pessoa que respondem a outro, ou que têm imagem, na ordem de
     * chegada e com a mesma visibilidade da linha (rede_linha). Sem banco: página vazia.
     */
    linhaDaPessoa: (handle: string, aba: "respostas" | "midia", cursor: string | null = null) =>
      lerOuExemplo<PaginaDaLinha>(() => c<PaginaDaLinha>("rede_perfil_linha", { p_handle: handle, p_aba: aba, p_cursor: cursor }), () => ({ itens: [], proximo: null })),
    /** Editar os meus extras. */
    editarExtras: (p: PedidoDeExtras) => c<ExtrasDoPerfil>("rede_perfil_extras_editar", { p }),
  };
}

export type ClienteOrg = ReturnType<typeof criarClienteOrg>;

export const redeOrg = criarClienteOrg(chamar);
