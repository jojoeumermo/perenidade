// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As chamadas da lei e da ajuda ao banco (supabase/migracoes/20261114-alumia-o8-lei.sql): os termos e o reaceite, a situação da
// minha conta e o pedido de revisão (fora da porta), a denúncia de conteúdo ilegal e o painel da lei para a mediação. Com
// NEXT_PUBLIC_ALUMIA_PREVIA=sim, um dublê com dados de exemplo (nada vai ao banco).
import { chamar, type Chamar } from "../../../lib/rede/cliente";
import { PRAZO_DA_RETENCAO_HORAS, PRAZO_DO_RECURSO_DIAS, PRAZOS_DAS_DENUNCIAS, VERSAO_DOS_TERMOS } from "./versao";

export interface TermosEu {
  logado: boolean;
  vigente: number;
  publicada_em: string;
  mudou: string;
  aceita?: boolean;
  aceita_em?: string | null;
  anterior?: boolean;
}

export interface DecisaoDaConta {
  id: string;
  acao: "reter" | "suspender";
  regra: string;
  motivo: string;
  criado_em: string;
  automatica: boolean;
  prazo: string;
  pode_recorrer: boolean;
  recurso: { situacao: "aberto" | "mantido" | "revertido"; criado_em: string; responder_ate: string; decidido_em: string | null } | null;
}

export interface MinhaConta {
  logado: boolean;
  suspensa?: boolean;
  retida?: { desde: string; responder_ate: string } | null;
  decisoes?: DecisaoDaConta[];
}

export interface DenunciaNaFila {
  id: string;
  protocolo: string;
  alvo_tipo: string;
  categoria: string;
  situacao: string;
  criado_em: string;
  texto: string;
  titulo: string | null;
  trecho: string | null;
  responder_ate: string;
  vencida: boolean;
}

export interface ContaRetida {
  id: string;
  conta: string;
  desde: string;
  responder_ate: string;
  vencida: boolean;
  protocolo: string | null;
  denuncia: string | null;
  texto: string | null;
  pode: boolean;
}

export interface RecursoAberto {
  id: string;
  texto: string;
  criado_em: string;
  responder_ate: string;
  vencido: boolean;
  acao: { acao: string; alvo_tipo: string; regra: string; motivo: string; criado_em: string; automatica: boolean };
  conta: string | null;
  trecho: string | null;
  minha: boolean;
}

export interface PainelDaLeiDados {
  contadores: {
    ilegais: number;
    ilegais_vencendo: number;
    ilegais_vencidas: number;
    denuncias_vencidas: number;
    retidas: number;
    retidas_vencidas: number;
    recursos: number;
    recursos_vencidos: number;
  };
  ilegais: DenunciaNaFila[];
  retidas: ContaRetida[];
  recursos: RecursoAberto[];
}

export interface DenunciaFeita {
  protocolo: string;
  prioridade: number;
  retido: boolean;
  ja: boolean;
  responder_ate: string;
}

export function criarClienteDaLei(c: Chamar) {
  return {
    termos: () => c<TermosEu>("alumia_termos_eu", {}),
    aceitar: (versao: number) => c<TermosEu>("alumia_termos_aceitar", { p_versao: versao }),
    minhaConta: () => c<MinhaConta>("alumia_lei_minha_conta", {}),
    recorrerConta: (acao: string, texto: string) => c<{ ok: boolean; responder_ate: string }>("alumia_lei_recorrer_conta", { p_acao: acao, p_texto: texto }),
    denunciar: (alvoTipo: "post" | "perfil" | "comunidade", alvo: string, texto: string) =>
      c<DenunciaFeita>("rede_mod_denunciar", { p_alvo_tipo: alvoTipo, p_alvo: alvo, p_categoria: "ilegal", p_texto: texto }),
    painel: () => c<PainelDaLeiDados>("alumia_lei_painel", {}),
    decidirMenor: (retencao: string, decisao: "liberar" | "manter", motivo: string) =>
      c<{ situacao: string }>("alumia_lei_menor_decidir", { p_retencao: retencao, p_decisao: decisao, p_motivo: motivo }),
    rever: (recurso: string, decisao: "mantido" | "revertido", motivo: string) =>
      c<{ situacao: string }>("rede_mod_rever", { p_recurso: recurso, p_decisao: decisao, p_motivo: motivo }),
  };
}

export const PREVIA_DA_LEI = process.env.NEXT_PUBLIC_ALUMIA_PREVIA === "sim";

const H = 3_600_000;
const daqui = (horas: number) => new Date(Date.now() + horas * H).toISOString();

/** O dublê da prévia: as mesmas formas que o banco devolve, com exemplos. */
function chamarDubleDaLei(): Chamar {
  const painel: PainelDaLeiDados = {
    contadores: { ilegais: 3, ilegais_vencendo: 1, ilegais_vencidas: 1, denuncias_vencidas: 2, retidas: 1, retidas_vencidas: 0, recursos: 2, recursos_vencidos: 1 },
    ilegais: [
      { id: "i1", protocolo: "7F3A20C91B", alvo_tipo: "post", categoria: "ilegal", situacao: "aberta", criado_em: daqui(-27), texto: "Venda de remédio controlado sem receita.", titulo: null, trecho: "Tenho caixas de [remédio] para vender, chama no privado...", responder_ate: daqui(-3), vencida: true },
      { id: "i2", protocolo: "B81D0E44A2", alvo_tipo: "post", categoria: "ilegal", situacao: "em_analise", criado_em: daqui(-20), texto: "Divulga link de material pirata.", titulo: "Apostilas", trecho: "Segue a pasta com todas as apostilas do cursinho...", responder_ate: daqui(4), vencida: false },
      { id: "i3", protocolo: "0C9E51F7D3", alvo_tipo: "perfil", categoria: "ilegal", situacao: "aberta", criado_em: daqui(-2), texto: "Perfil que se passa por um sindicato para pedir dinheiro.", titulo: null, trecho: null, responder_ate: daqui(22), vencida: false },
    ],
    retidas: [
      { id: "r1", conta: "Faísca do Norte", desde: daqui(-5), responder_ate: daqui(19), vencida: false, protocolo: "5A2C7E19F0", denuncia: "d1", texto: "Escreveu numa resposta que tem 15 anos.", pode: true },
    ],
    recursos: [
      { id: "c1", texto: "A foto era de um ato público e todo mundo nela tinha pedido para aparecer.", criado_em: daqui(-190), responder_ate: daqui(-22), vencido: true,
        acao: { acao: "remover", alvo_tipo: "post", regra: "ninguem_exposto", motivo: "Rosto de pessoas sem borrar.", criado_em: daqui(-200), automatica: false }, conta: null, trecho: "Olha a força do nosso ato de ontem na praça!", minha: false },
      { id: "c2", texto: "Errei a idade no formulário: tenho 19 anos. Posso mostrar à mediação numa conversa.", criado_em: daqui(-30), responder_ate: daqui(138), vencido: false,
        acao: { acao: "suspender", alvo_tipo: "perfil", regra: "menor_de_18", motivo: "A própria pessoa disse que tem 16 anos.", criado_em: daqui(-40), automatica: false }, conta: "Rua de Baixo", trecho: null, minha: true },
    ],
  };
  const conta: MinhaConta = {
    logado: true,
    suspensa: true,
    retida: { desde: daqui(-5), responder_ate: daqui(PRAZO_DA_RETENCAO_HORAS - 5) },
    decisoes: [
      { id: "a1", acao: "reter", regra: "precaucao_menor", motivo: "Conta retida por precaução até a mediação ler a denúncia (protocolo da denúncia: 5A2C7E19F0).", criado_em: daqui(-5), automatica: true, prazo: daqui(24 * 30 - 5), pode_recorrer: true, recurso: null },
    ],
  };
  return async <T,>(funcao: string, argumentos: Record<string, unknown> = {}): Promise<T> => {
    await new Promise((r) => setTimeout(r, 250));
    switch (funcao) {
      case "alumia_termos_eu":
        return { logado: true, vigente: VERSAO_DOS_TERMOS.numero, publicada_em: VERSAO_DOS_TERMOS.data, mudou: "", aceita: false, aceita_em: null, anterior: false } as T;
      case "alumia_termos_aceitar":
        return { logado: true, vigente: VERSAO_DOS_TERMOS.numero, publicada_em: VERSAO_DOS_TERMOS.data, mudou: "", aceita: true, aceita_em: new Date().toISOString(), anterior: false } as T;
      case "alumia_lei_minha_conta":
        return conta as T;
      case "alumia_lei_recorrer_conta":
        conta.decisoes = conta.decisoes?.map((d) => (d.id === argumentos.p_acao ? { ...d, pode_recorrer: false, recurso: { situacao: "aberto", criado_em: new Date().toISOString(), responder_ate: daqui(PRAZO_DO_RECURSO_DIAS * 24), decidido_em: null } } : d));
        return { ok: true, responder_ate: daqui(PRAZO_DO_RECURSO_DIAS * 24) } as T;
      case "rede_mod_denunciar":
        return { protocolo: "E4B7C2A90D", prioridade: 1, retido: false, ja: false, responder_ate: daqui(PRAZOS_DAS_DENUNCIAS.ilegal) } as T;
      case "alumia_lei_painel":
        return painel as T;
      default:
        return { situacao: "ok" } as T;
    }
  };
}

export const lei = criarClienteDaLei(PREVIA_DA_LEI ? chamarDubleDaLei() : chamar);
