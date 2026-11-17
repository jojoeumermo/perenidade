// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As chamadas dos rótulos e da transparência ao banco (supabase/migracoes/20261115-alumia-o9-transparencia.sql): o relatório
// público (fora da porta), o painel da coordenação (pedidos de autoridade e o aviso de ordem sigilosa) e os rótulos (catálogo,
// assinatura, marcas de uma página de posts, marcar, retirar, contestar e a fila da mediação). Com NEXT_PUBLIC_ALUMIA_PREVIA=sim,
// um dublê com dados de exemplo (nada vai ao banco).
import { chamar, type Chamar } from "../../../lib/rede/cliente";
import type { CategoriaDoRelatorio, Efeito, NumeroDoRelatorio, Orgao, PedidoDeAutoridade, Resposta, Rotulo } from "./regras";

type Contagem<K extends string> = Record<K, NumeroDoRelatorio>;

export interface NumerosDoTrimestre {
  denuncias: {
    recebidas: NumeroDoRelatorio;
    decididas: NumeroDoRelatorio;
    procedentes: NumeroDoRelatorio;
    descartadas: NumeroDoRelatorio;
    por_tipo: Record<CategoriaDoRelatorio, { recebidas: NumeroDoRelatorio; decididas: NumeroDoRelatorio }>;
  };
  posts_tirados: NumeroDoRelatorio;
  contas: { suspensas: NumeroDoRelatorio; banidas: NumeroDoRelatorio; retidas: NumeroDoRelatorio; redes_barradas: NumeroDoRelatorio };
  recursos: { recebidos: NumeroDoRelatorio; decididos: NumeroDoRelatorio; revertidos: NumeroDoRelatorio };
  rotulos: { marcas: NumeroDoRelatorio; contestadas: NumeroDoRelatorio; revertidas: NumeroDoRelatorio };
}

export interface AutoridadeDoTrimestre {
  recebidos: NumeroDoRelatorio;
  contas: NumeroDoRelatorio;
  por_orgao: Contagem<Orgao>;
  por_pedido: Contagem<PedidoDeAutoridade>;
  por_resposta: Contagem<Resposta>;
}

export interface Trimestre {
  inicio: string;
  fim: string;
  fechado_em: string;
  numeros: NumerosDoTrimestre;
  autoridade: AutoridadeDoTrimestre;
}

export interface Canario {
  renovado_em: string | null;
  vence_em: string | null;
  vencido: boolean;
}

export interface Relatorio {
  trimestres: Trimestre[];
  proximo: { inicio: string; fim: string; sai_em: string };
  canario: Canario;
}

export interface PedidoRegistrado {
  id: string;
  recebido_em: string;
  orgao: Orgao;
  pedido: PedidoDeAutoridade;
  resposta: Resposta;
  contas: number;
  respondido_em: string | null;
  criado_em: string;
  atualizado_em: string;
}

export interface PainelDaTransparenciaDados {
  pedidos: PedidoRegistrado[];
  canario: Canario;
  renovacoes: { renovado_em: string; por: string | null }[];
}

export interface PedidoParaSalvar {
  recebido_em: string;
  orgao: Orgao;
  pedido: PedidoDeAutoridade;
  resposta: Resposta;
  respondido_em?: string | null;
  contas: number;
}

export interface Rotulador {
  id: string;
  tipo: "org" | "mediacao";
  nome: string | null;
  handle: string | null;
  palavra: string | null;
  regras: string;
  efeito: Efeito | null;
  posso: boolean;
  marcas: NumeroDoRelatorio;
  revertidas: NumeroDoRelatorio;
}

export interface MarcaNoPost {
  rotulador: string;
  tipo: "org" | "mediacao";
  nome: string | null;
  rotulo: Rotulo;
  da_conta: boolean;
  contestado: boolean;
  efeito: Efeito;
}

export type SituacaoDaMarca = "vale" | "contestado" | "retirado" | "revertido";

export interface MarcaSobreMim {
  id: string;
  tipo: "org" | "mediacao";
  nome: string | null;
  rotulo: Rotulo;
  motivo: string;
  alvo_tipo: "perfil" | "post";
  trecho: string | null;
  situacao: SituacaoDaMarca;
  criado_em: string;
  contestado_em: string | null;
  decidido_em: string | null;
  decisao: string | null;
  pode_contestar: boolean;
}

export interface MarcaDoRotulador {
  id: string;
  rotulo: Rotulo;
  motivo: string;
  situacao: SituacaoDaMarca;
  criado_em: string;
  alvo_tipo: "perfil" | "post";
  conta: string | null;
  handle: string | null;
  trecho: string | null;
  minha: boolean;
}

export interface ContestacaoNaFila {
  id: string;
  tipo: "org" | "mediacao";
  nome: string | null;
  rotulo: Rotulo;
  motivo: string;
  contestacao: string;
  criado_em: string;
  contestado_em: string;
  alvo_tipo: "perfil" | "post";
  conta: string | null;
  trecho: string | null;
  pode: boolean;
}

export function criarClienteDosRotulos(c: Chamar) {
  return {
    relatorio: () => c<Relatorio>("alumia_transparencia", {}),
    painel: () => c<PainelDaTransparenciaDados>("alumia_transp_painel", {}),
    salvarPedido: (id: string | null, p: PedidoParaSalvar) => c<{ id: string; resposta: Resposta; respondido_em: string | null }>("alumia_transp_pedido_salvar", { p_id: id, p }),
    renovarAviso: (frase: string) => c<Canario>("alumia_transp_canario_renovar", { p_frase: frase }),
    catalogo: () => c<Rotulador[]>("alumia_rotulos_catalogo", {}),
    assinar: (rotulador: string, efeito: Efeito | null) => c<{ efeito: Efeito | null }>("alumia_rotulos_assinar", { p_rotulador: rotulador, p_efeito: efeito }),
    dosPosts: (posts: string[]) => c<{ post: string; marcas: MarcaNoPost[] }[]>("alumia_rotulos_dos_posts", { p_posts: posts }),
    abrir: (org: string, regras: string, aberto: boolean) => c<{ id: string; aberto: boolean; regras: string }>("alumia_rotulos_abrir", { p_org: org, p_regras: regras, p_aberto: aberto }),
    marcar: (rotulador: string, alvoTipo: "post" | "perfil", alvo: string, rotulo: Rotulo, motivo: string) =>
      c<{ id: string; situacao: SituacaoDaMarca }>("alumia_rotulos_marcar", { p_rotulador: rotulador, p_alvo_tipo: alvoTipo, p_alvo: alvo, p_rotulo: rotulo, p_motivo: motivo }),
    retirar: (marca: string, motivo: string) => c<{ id: string; situacao: SituacaoDaMarca }>("alumia_rotulos_retirar", { p_marca: marca, p_motivo: motivo }),
    meus: (rotulador: string) => c<MarcaDoRotulador[]>("alumia_rotulos_meus", { p_rotulador: rotulador }),
    sobreMim: () => c<MarcaSobreMim[]>("alumia_rotulos_sobre_mim", {}),
    contestar: (marca: string, texto: string) => c<{ id: string; situacao: SituacaoDaMarca }>("alumia_rotulos_contestar", { p_marca: marca, p_texto: texto }),
    fila: () => c<ContestacaoNaFila[]>("alumia_rotulos_fila", {}),
    decidir: (marca: string, decisao: "manter" | "reverter", motivo: string) =>
      c<{ id: string; situacao: SituacaoDaMarca }>("alumia_rotulos_decidir", { p_marca: marca, p_decisao: decisao, p_motivo: motivo }),
  };
}

export const PREVIA_DOS_ROTULOS = process.env.NEXT_PUBLIC_ALUMIA_PREVIA === "sim";

// ── O dublê da prévia ─────────────────────────────────────────────────────────────────────────────────────────────────────

const DIA = 86_400_000;
const diasAtras = (n: number) => new Date(Date.now() - n * DIA).toISOString();
const dia = (d: Date) => d.toISOString().slice(0, 10);

/** O trimestre que começa em `d` (dia 1 de jan., abr., jul. ou out.). */
function trimestreDe(d: Date) {
  return new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1, 12);
}
function maisMeses(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth() + n, d.getDate(), 12);
}

function relatorioDeExemplo(vazio: boolean): Relatorio {
  const atual = trimestreDe(new Date());
  const proximo = { inicio: dia(atual), fim: dia(new Date(maisMeses(atual, 3).getTime() - DIA)), sai_em: dia(new Date(maisMeses(atual, 3).getTime() + 14 * DIA)) };
  if (vazio) return { trimestres: [], proximo, canario: { renovado_em: diasAtras(97), vence_em: diasAtras(7), vencido: true } };
  const m = "menos_de_3" as const;
  const trimestre = (inicio: Date, escala: number): Trimestre => ({
    inicio: dia(inicio),
    fim: dia(new Date(maisMeses(inicio, 3).getTime() - DIA)),
    fechado_em: new Date(maisMeses(inicio, 3).getTime() + 15 * DIA).toISOString(),
    numeros: {
      denuncias: {
        recebidas: 148 * escala, decididas: 141 * escala, procedentes: 96 * escala, descartadas: 45 * escala,
        por_tipo: {
          menores: { recebidas: 4, decididas: 4 }, ameaca: { recebidas: 11 * escala, decididas: 11 * escala }, exposicao: { recebidas: 7, decididas: 7 },
          violencia: { recebidas: m, decididas: m }, autolesao: { recebidas: m, decididas: m }, odio: { recebidas: 23 * escala, decididas: 22 * escala },
          assedio: { recebidas: 19 * escala, decididas: 18 * escala }, golpe: { recebidas: 31 * escala, decididas: 30 * escala },
          spam: { recebidas: 44 * escala, decididas: 42 * escala }, ilegal: { recebidas: 3, decididas: 3 }, outro: { recebidas: 6 * escala, decididas: 4 * escala },
        },
      },
      posts_tirados: 87 * escala,
      contas: { suspensas: 12 * escala, banidas: 5, retidas: m, redes_barradas: m },
      recursos: { recebidos: 21 * escala, decididos: 20 * escala, revertidos: 6 },
      rotulos: { marcas: 34 * escala, contestadas: 8, revertidas: 3 },
    },
    autoridade: {
      recebidos: escala > 1 ? 4 : m, contas: escala > 1 ? 6 : m,
      por_orgao: { judiciario: escala > 1 ? 3 : m, policia: m, ministerio_publico: m, eleitoral: m, administrativo: m, estrangeiro: m, outro: m },
      por_pedido: { dados_de_conta: escala > 1 ? 3 : m, identificar_autor: m, retirar_conteudo: m, preservar_dados: m, outro: m },
      por_resposta: { em_analise: m, atendido: m, atendido_em_parte: m, recusado: escala > 1 ? 3 : m, sem_dados: m },
    },
  });
  return {
    trimestres: [trimestre(maisMeses(atual, -3), 2), trimestre(maisMeses(atual, -6), 1)],
    proximo,
    canario: { renovado_em: diasAtras(12), vence_em: new Date(Date.now() + 78 * DIA).toISOString(), vencido: false },
  };
}

function chamarDubleDosRotulos(): Chamar {
  const vazio = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("previa") === "vazia";
  const rotuladores: Rotulador[] = [
    { id: "r-med", tipo: "mediacao", nome: null, handle: null, palavra: null, regras: "", efeito: "avisar", posso: true, marcas: "menos_de_3", revertidas: "menos_de_3" },
    { id: "r-lume", tipo: "org", nome: "Coletivo Lume", handle: "coletivolume", palavra: "LUME", regras: "Marcamos golpes de falsa vaquinha e perfis que se passam por coletivos de São Paulo. Toda marca é conferida por duas pessoas do coletivo antes de entrar.", efeito: null, posso: true, marcas: "menos_de_3", revertidas: "menos_de_3" },
    { id: "r-sind", tipo: "org", nome: "Sindicato dos Metroviários", handle: "metroviarios", palavra: "SIND", regras: "Marcamos contas que espalham boato sobre greve e assédio coordenado contra a categoria. Respondemos contestação em até 3 dias.", efeito: "esconder", posso: false, marcas: 9, revertidas: "menos_de_3" },
  ];
  const sobreMim: MarcaSobreMim[] = [
    { id: "s1", tipo: "org", nome: "Coletivo Lume", rotulo: "spam", motivo: "O mesmo link de rifa colado em doze comunidades no mesmo dia.", alvo_tipo: "post", trecho: "Rifa solidária do grêmio! Números a R$ 5, sorteio sábado...", situacao: "vale", criado_em: diasAtras(1), contestado_em: null, decidido_em: null, decisao: null, pode_contestar: true },
    { id: "s2", tipo: "mediacao", nome: null, rotulo: "golpe", motivo: "Pix pedido em nome de uma ocupação que não confirmou a vaquinha.", alvo_tipo: "post", trecho: "Ajude a ocupação com qualquer valor, chave Pix na bio", situacao: "revertido", criado_em: diasAtras(9), contestado_em: diasAtras(8), decidido_em: diasAtras(6), decisao: "A ocupação confirmou a vaquinha à mediação.", pode_contestar: false },
  ];
  const meus: MarcaDoRotulador[] = [
    { id: "m1", rotulo: "golpe", motivo: "Pede Pix para uma vaquinha que nenhum coletivo confirmou.", situacao: "vale", criado_em: diasAtras(2), alvo_tipo: "post", conta: "Faísca Ligeira", handle: "faiscaligeira", trecho: "Doe para a vaquinha do ato, Pix na bio!", minha: true },
    { id: "m2", rotulo: "perfil_falso", motivo: "Usa o nome e a foto do coletivo sem ser do coletivo.", situacao: "contestado", criado_em: diasAtras(5), alvo_tipo: "perfil", conta: "Coletivo Lume Oficial", handle: "lume_oficial", trecho: null, minha: false },
  ];
  const fila: ContestacaoNaFila[] = [
    { id: "f1", tipo: "org", nome: "Coletivo Lume", rotulo: "perfil_falso", motivo: "Usa o nome e a foto do coletivo sem ser do coletivo.", contestacao: "Sou ex-integrante do coletivo e a página é de um núcleo de bairro que existe desde 2019.", criado_em: diasAtras(5), contestado_em: diasAtras(4), alvo_tipo: "perfil", conta: "Coletivo Lume Oficial", trecho: null, pode: true },
    { id: "f2", tipo: "mediacao", nome: null, rotulo: "spam", motivo: "O mesmo convite em vinte comunidades em uma hora.", contestacao: "Era o convite da plenária e cada comunidade é de um bairro diferente.", criado_em: diasAtras(3), contestado_em: diasAtras(2), alvo_tipo: "post", conta: "Rua de Baixo", trecho: "Plenária aberta sábado às 15h na quadra da escola estadual...", pode: false },
  ];
  const painel: PainelDaTransparenciaDados = {
    pedidos: [
      { id: "p1", recebido_em: dia(new Date(Date.now() - 3 * DIA)), orgao: "policia", pedido: "dados_de_conta", resposta: "em_analise", contas: 1, respondido_em: null, criado_em: diasAtras(3), atualizado_em: diasAtras(3) },
      { id: "p2", recebido_em: dia(new Date(Date.now() - 40 * DIA)), orgao: "judiciario", pedido: "retirar_conteudo", resposta: "atendido_em_parte", contas: 2, respondido_em: dia(new Date(Date.now() - 36 * DIA)), criado_em: diasAtras(40), atualizado_em: diasAtras(36) },
      { id: "p3", recebido_em: dia(new Date(Date.now() - 71 * DIA)), orgao: "ministerio_publico", pedido: "identificar_autor", resposta: "recusado", contas: 1, respondido_em: dia(new Date(Date.now() - 65 * DIA)), criado_em: diasAtras(71), atualizado_em: diasAtras(65) },
    ],
    canario: vazio ? { renovado_em: diasAtras(97), vence_em: diasAtras(7), vencido: true } : { renovado_em: diasAtras(12), vence_em: new Date(Date.now() + 78 * DIA).toISOString(), vencido: false },
    renovacoes: [{ renovado_em: diasAtras(12), por: "Coordenação" }, { renovado_em: diasAtras(101), por: "Coordenação" }],
  };
  return async <T,>(funcao: string, argumentos: Record<string, unknown> = {}): Promise<T> => {
    await new Promise((r) => setTimeout(r, 200));
    switch (funcao) {
      case "alumia_transparencia":
        return relatorioDeExemplo(vazio) as T;
      case "alumia_transp_painel":
        return painel as T;
      case "alumia_transp_pedido_salvar": {
        const p = argumentos.p as PedidoParaSalvar;
        const id = (argumentos.p_id as string | null) ?? `p${Date.now()}`;
        const resp = { ...p, id, respondido_em: p.resposta === "em_analise" ? null : (p.respondido_em || dia(new Date())), criado_em: new Date().toISOString(), atualizado_em: new Date().toISOString() } as PedidoRegistrado;
        painel.pedidos = [resp, ...painel.pedidos.filter((x) => x.id !== id)].sort((a, b) => b.recebido_em.localeCompare(a.recebido_em));
        return { id, resposta: resp.resposta, respondido_em: resp.respondido_em } as T;
      }
      case "alumia_transp_canario_renovar":
        painel.canario = { renovado_em: new Date().toISOString(), vence_em: new Date(Date.now() + 90 * DIA).toISOString(), vencido: false };
        painel.renovacoes = [{ renovado_em: new Date().toISOString(), por: "Coordenação" }, ...painel.renovacoes];
        return painel.canario as T;
      case "alumia_rotulos_catalogo":
        return rotuladores as T;
      case "alumia_rotulos_assinar": {
        const r = rotuladores.find((x) => x.id === argumentos.p_rotulador);
        if (r) r.efeito = (argumentos.p_efeito as Efeito | null) ?? null;
        return { efeito: r?.efeito ?? null } as T;
      }
      case "alumia_rotulos_dos_posts":
        // O exemplo nunca marca um post cifrado: a mediação não lê o que só o grupo abre.
        return ((argumentos.p_posts as string[]) ?? []).filter((post) => !post.includes("cifrado")).slice(0, 1).map((post) => ({
          post, marcas: [{ rotulador: "r-med", tipo: "mediacao", nome: null, rotulo: "golpe", da_conta: false, contestado: false, efeito: "avisar" }],
        })) as T;
      case "alumia_rotulos_sobre_mim":
        return sobreMim as T;
      case "alumia_rotulos_contestar":
        sobreMim.forEach((m) => { if (m.id === argumentos.p_marca) Object.assign(m, { situacao: "contestado", contestado_em: new Date().toISOString(), pode_contestar: false }); });
        return { id: argumentos.p_marca, situacao: "contestado" } as T;
      case "alumia_rotulos_meus":
        // O dublê bate com o catálogo acima: quem pode rotular vê as duas marcas dela (no catálogo, "menos de 3").
        return (argumentos.p_rotulador === "r-sind" ? [] : meus) as T;
      case "alumia_rotulos_marcar":
        return { id: `m${Date.now()}`, situacao: "vale" } as T;
      case "alumia_rotulos_retirar": {
        const i = meus.findIndex((m) => m.id === argumentos.p_marca);
        if (i >= 0) meus.splice(i, 1);
        return { id: argumentos.p_marca, situacao: "retirado" } as T;
      }
      case "alumia_rotulos_fila":
        return fila as T;
      case "alumia_rotulos_decidir": {
        const i = fila.findIndex((f) => f.id === argumentos.p_marca);
        if (i >= 0) fila.splice(i, 1);
        return { id: argumentos.p_marca, situacao: argumentos.p_decisao === "manter" ? "vale" : "revertido" } as T;
      }
      case "alumia_rotulos_abrir":
        return { id: "r-novo", aberto: argumentos.p_aberto !== false, regras: argumentos.p_regras } as T;
      default:
        return {} as T;
    }
  };
}

export const rotulos = criarClienteDosRotulos(PREVIA_DOS_ROTULOS ? chamarDubleDosRotulos() : chamar);
