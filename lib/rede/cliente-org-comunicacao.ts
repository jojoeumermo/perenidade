// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As chamadas da comunicação da organização (onda 12, frente 12E; supabase/migracoes/20261118-alumia-o12-org.sql): a fila (escrever,
// aprovar, recusar, retirar), os modelos, chamar o núcleo, o boletim e o domínio próprio. Uma função por rpc; a conferência do
// domínio vai à rota do servidor (app/api/rede/org/dominio), que é quem busca no site da organização. Com
// NEXT_PUBLIC_ALUMIA_PREVIA=sim, um dublê na memória (lib/rede/org/comunicacao-exemplos.ts) faz a tela andar sem banco. Sem "@/" de
// propósito.
//
// Nenhuma função aqui devolve pessoa: nem quem escreveu, nem quem aprovou, nem quem assina o boletim (LGPD art. 5º, II e art. 11).
import { BackendError, getClient } from "../backend";
import { chamar, type Chamar } from "./cliente";
import { chamarDubleDaComunicacao } from "./org/comunicacao-exemplos";
import { previaLigada } from "./org/exemplos";
import type {
  ComunicacaoDaOrg, ConferenciaDoDominio, DominioDaComunicacao, DominioVerificado, ItemDaFila, MeuBoletim, ModeloDaOrg, PublicoDaOrg, ResultadoDaChamada,
} from "./org/comunicacao";

/** A conferência do domínio pelo servidor do site (com o token da sessão). */
export type ConferirDominio = (handle: string) => Promise<ConferenciaDoDominio>;

export const conferirPeloServidor: ConferirDominio = async (handle) => {
  const supabase = await getClient();
  const token = (await supabase.auth.getSession()).data.session?.access_token;
  if (!token) throw new BackendError("entre_primeiro");
  const r = await fetch("/api/rede/org/dominio", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ handle }) }).catch(() => {
    throw new BackendError("sem_conexao");
  });
  const corpo = (await r.json().catch(() => null)) as (ConferenciaDoDominio & { erro?: string }) | null;
  if (!r.ok || !corpo || corpo.erro) throw new BackendError(corpo?.erro ?? "falha");
  return corpo;
};

export function criarClienteDaComunicacao(c: Chamar, conferir: ConferirDominio = conferirPeloServidor) {
  return {
    /** A aba Comunicação (nula para quem não fala pela organização nem media um núcleo dela). */
    painel: (handle: string) => c<ComunicacaoDaOrg | null>("rede_org_comunicacao", { p_handle: handle }),
    escrever: (handle: string, p: { texto: string; publico: PublicoDaOrg }) => c<ItemDaFila>("rede_org_fila_escrever", { p_handle: handle, p }),
    decidir: (id: string, aprovar: boolean, motivo = "") => c<ItemDaFila>("rede_org_fila_decidir", { p_id: id, p_aprovar: aprovar, p_motivo: motivo }),
    retirar: (id: string) => c<ItemDaFila>("rede_org_fila_retirar", { p_id: id }),
    salvarModelo: (handle: string, p: { id?: string; nome: string; texto: string; publico: PublicoDaOrg }) => c<ModeloDaOrg[]>("rede_org_modelo_salvar", { p_handle: handle, p }),
    apagarModelo: (handle: string, id: string) => c<ModeloDaOrg[]>("rede_org_modelo_apagar", { p_handle: handle, p_id: id }),
    chamarNucleo: (nucleo: string, texto: string) => c<ResultadoDaChamada>("rede_org_nucleo_chamar", { p_nucleo: nucleo, p_texto: texto }),
    proporBoletim: (handle: string, p: { texto: string; posts: string[]; publico: PublicoDaOrg }) => c<ItemDaFila>("rede_org_boletim_propor", { p_handle: handle, p }),
    /** O meu boletim desta organização (nulo para quem não é membro da Alumia). */
    meuBoletim: (handle: string) => c<MeuBoletim | null>("rede_org_boletim", { p_handle: handle }),
    assinarBoletim: (handle: string, sim: boolean, email: boolean) => c<MeuBoletim>("rede_org_boletim_assinar", { p_handle: handle, p_sim: sim, p_email: email }),
    /** O domínio verificado, para o perfil (nulo sem selo ou sem domínio verificado). */
    dominio: (handle: string) => c<DominioVerificado | null>("rede_org_dominio", { p_handle: handle }),
    pedirDominio: (handle: string, dominio: string) => c<DominioDaComunicacao>("rede_org_dominio_pedir", { p_handle: handle, p_dominio: dominio }),
    tirarDominio: (handle: string) => c<{ ok: true }>("rede_org_dominio_tirar", { p_handle: handle }),
    conferirDominio: (handle: string) => conferir(handle),
  };
}

export type ClienteDaComunicacao = ReturnType<typeof criarClienteDaComunicacao>;

let duble: { c: Chamar; conferir: ConferirDominio } | null = null;
/** O cliente de verdade; na prévia, o dublê (criado uma vez por página). */
export function clienteDaComunicacao(): ClienteDaComunicacao {
  if (previaLigada()) {
    duble ??= chamarDubleDaComunicacao();
    return criarClienteDaComunicacao(duble.c, duble.conferir);
  }
  return criarClienteDaComunicacao(chamar);
}
