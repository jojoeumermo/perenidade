// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As chamadas do B1 das organizações (supabase/migracoes/20261110-alumia-b1-perfil-org.sql): funções e mandatos, eleições, Ata
// Viva e sinais, caixa transparente, lampião (convite e mapa), plenária lida de novo, diretório e atos da organização. Uma função
// por rpc. Com NEXT_PUBLIC_ALUMIA_PREVIA=sim, um dublê na memória (lib/rede/org/b1-exemplos.ts) faz as telas andarem sem banco.
// Sem "@/" de propósito.
//
// Nenhuma função aqui devolve lista de pessoas: quem ocupa função só para quem é de dentro; a fila da ata só para a mesa e por
// codinome; o caixa sem quem lançou, conferiu ou doou (LGPD art. 5º, II e art. 11).
import { chamar, type Chamar } from "./cliente";
import { chamarDubleB1 } from "./org/b1-exemplos";
import { previaLigada } from "./org/exemplos";
import type {
  AtaViva, AtasDaOrg, CaixasDaOrg, ConviteDoLampiao, EleicaoDaOrg, EstadoNoMapa, FuncoesDaOrg, PaginaDoDiretorio, PedidoDeLampiao, Permissao, Posicao, Sinal, TipoDeCaixa, TipoDeFuncao,
} from "./org/b1";
import type { Ato } from "./tipos-atos";
import type { PlenariaDaOrg } from "./tipos-org";

export type AcaoDaMesa =
  | { acao: "chamar"; fala?: string }
  | { acao: "encerrar_fala" }
  | { acao: "ponto"; ponto: string }
  | { acao: "sinais_abrir" }
  | { acao: "sinais_fechar" }
  | { acao: "carimbar"; ponto?: string; carimbo: "aprovado" | "retirado" | "vai_a_base"; deliberacao: string; funcao?: string; prazo?: string }
  | { acao: "tempo"; segundos: number };

export function criarClienteOrgB1(c: Chamar) {
  return {
    funcoes: (handle: string) => c<FuncoesDaOrg | null>("rede_org_funcoes", { p_handle: handle }),
    salvarFuncao: (handle: string, p: { id?: string; tipo: TipoDeFuncao; nome: string; permissoes: Permissao[]; vagas: number }) => c<FuncoesDaOrg>("rede_org_funcao_salvar", { p_handle: handle, p }),
    apagarFuncao: (handle: string, id: string) => c<FuncoesDaOrg>("rede_org_funcao_apagar", { p_handle: handle, p_id: id }),
    darMandato: (handle: string, p: { funcao: string; handle: string; fim: string }) => c<FuncoesDaOrg>("rede_org_mandato_dar", { p_handle: handle, p }),
    encerrarMandato: (mandato: string) => c<FuncoesDaOrg>("rede_org_mandato_encerrar", { p_mandato: mandato }),

    eleicoes: (handle: string) => c<EleicaoDaOrg[] | null>("rede_org_eleicoes", { p_handle: handle }),
    abrirEleicao: (handle: string, p: { funcao: string; inscricoesAte: string; prazo: string; mandatoFim: string; quorum: number | null }) => c<EleicaoDaOrg[]>("rede_org_eleicao_abrir", { p_handle: handle, p }),
    candidatar: (eleicao: string, sim: boolean) => c<EleicaoDaOrg>("rede_org_eleicao_candidatar", { p_eleicao: eleicao, p_sim: sim }),
    votar: (consulta: string, ranking: string[]) => c<{ votei: true }>("rede_org_consulta_votar", { p_consulta: consulta, p_ranking: ranking }),

    atas: (handle: string) => c<AtasDaOrg | null>("rede_org_atas", { p_handle: handle }),
    ata: (id: string) => c<AtaViva | null>("rede_org_ata", { p_id: id }),
    abrirAta: (handle: string, p: { titulo: string; pontos: string[]; falaSegundos: number; plenaria?: string | null }) => c<AtaViva>("rede_org_ata_abrir", { p_handle: handle, p }),
    inscrever: (ata: string, posicao: Posicao | null) => c<AtaViva>("rede_org_ata_inscrever", { p_ata: ata, p_posicao: posicao }),
    sinal: (ata: string, sinal: Sinal | null) => c<AtaViva>("rede_org_ata_sinal", { p_ata: ata, p_sinal: sinal }),
    mesa: (ata: string, p: AcaoDaMesa) => c<AtaViva>("rede_org_ata_mesa", { p_ata: ata, p }),
    fecharAta: (ata: string, publicar: "internet" | "membros" | "seguidores" | null) => c<{ ata: AtaViva; texto: string }>("rede_org_ata_fechar", { p_ata: ata, p_publicar: publicar }),

    caixa: (handle: string) => c<CaixasDaOrg | null>("rede_org_caixa", { p_handle: handle }),
    criarCaixa: (handle: string, p: { nome: string; tipo: TipoDeCaixa; pix: string; link: string; nucleo?: string | null }) => c<CaixasDaOrg>("rede_org_caixa_criar", { p_handle: handle, p }),
    lancar: (caixa: string, p: { tipo: "entrada" | "saida"; centavos: string; descricao: string; dia: string; nota?: string; mime?: string }) => c<CaixasDaOrg>("rede_org_caixa_lancar", { p_caixa: caixa, p }),
    conferir: (lancamento: string) => c<CaixasDaOrg>("rede_org_caixa_conferir", { p_lancamento: lancamento }),
    retirarLancamento: (lancamento: string) => c<CaixasDaOrg>("rede_org_caixa_retirar", { p_lancamento: lancamento }),
    nota: (lancamento: string) => c<{ mime: string; url: string } | null>("rede_org_caixa_nota", { p_lancamento: lancamento }),

    acenderLampiao: (handle: string, p: PedidoDeLampiao) => c<{ id: string; convite: ConviteDoLampiao | null }>("rede_org_nucleo_criar", { p_handle: handle, p }),
    noMapa: (nucleo: string, sim: boolean) => c<{ mapa: boolean; chama: string }>("rede_org_nucleo_mapa", { p_nucleo: nucleo, p_sim: sim }),
    mapa: () => c<EstadoNoMapa[]>("rede_org_mapa"),
    usarConvite: (codigo: string) => c<{ ok?: boolean; tipo?: string }>("rede_fix_convite_usar", { p_codigo: codigo }),

    plenaria: (id: string) => c<PlenariaDaOrg | null>("rede_org_plenaria", { p_id: id }),
    diretorio: (p: { tipo?: string; cidade?: string; busca?: string; depois?: string | null }) => c<PaginaDoDiretorio>("rede_org_diretorio", { p }),
    atos: (handle: string) => c<Ato[] | null>("rede_org_atos", { p_handle: handle }),
  };
}

export type ClienteOrgB1 = ReturnType<typeof criarClienteOrgB1>;

let dubleDaPrevia: Chamar | null = null;
/** O cliente de verdade; na prévia, o dublê (criado uma vez por página). */
export function clienteOrgB1(): ClienteOrgB1 {
  if (previaLigada()) {
    dubleDaPrevia ??= chamarDubleB1();
    return criarClienteOrgB1(dubleDaPrevia);
  }
  return criarClienteOrgB1(chamar);
}
