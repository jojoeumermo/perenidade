// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prompt 4, itens 33, 34, 36 e 37: as chamadas da criação coletiva ao banco (supabase/migracoes/20261127-p4-criacao-coletiva.sql),
// atrás de "alumia-p4-criacao-coletiva" (lib/recursos.ts) e da mesma chave no banco. O cartaz e a zine são desenhados no aparelho
// (cartaz.ts e zine.ts): o banco só entrega a identidade da organização e os posts que podem sair.
// Privacidade: nenhuma resposta diz quem escreveu uma sugestão, anotação ou resposta (só "minha"). Sem "@/" de propósito.
import { ligado } from "../../recursos";
import type { Chamar } from "../cliente";
import { alumia2Ligada } from "../rotas-novas";

/** O interruptor do grupo (o banco confere de novo em cada chamada). */
export const FLAG_CRIACAO_COLETIVA = "alumia-p4-criacao-coletiva" as const;

/** A tela pode usar o grupo? "rede-v2" + "alumia-2" + "alumia-p4-criacao-coletiva". */
export function criacaoColetivaLigada(): boolean {
  return alumia2Ligada() && ligado(FLAG_CRIACAO_COLETIVA);
}

export interface MinhaComunidade {
  slug: string;
  nome: string;
  modero: boolean;
  edito: boolean;
}

export interface ItemDoRascunho {
  pagina: string;
  titulo: string;
  tipo: "nota" | "manifesto";
  situacao: "aberto" | "fechado";
  versao: number;
  editado_em: string;
  sugestoes_abertas: boolean;
}

export interface PaginaDoAcervo {
  pagina: string;
  titulo: string;
  versao: number;
  editado_em: string;
}

export interface Rascunhos {
  comunidade: { slug: string; nome: string };
  pode_criar: boolean;
  rascunhos: ItemDoRascunho[];
  paginas: PaginaDoAcervo[];
}

export interface Sugestao {
  id: string;
  base: number;
  trecho: string;
  proposta: string;
  motivo: string;
  situacao: "aberta" | "aceita" | "recusada";
  criado_em: string;
  decidido_em: string | null;
  minha: boolean;
}

export interface RespostaDaMargem {
  id: string;
  texto: string;
  criado_em: string;
  minha: boolean;
}

export interface Anotacao {
  id: string;
  versao: number;
  inicio: number | null;
  fim: number | null;
  trecho: string;
  texto: string;
  resolvida: boolean;
  criado_em: string;
  minha: boolean;
  respostas: RespostaDaMargem[];
}

export interface PaginaComMargem {
  comunidade: string;
  pagina: { pagina: string; titulo: string; corpo: string; versao: number; editado_em: string; travada: boolean };
  rascunho: { tipo: "nota" | "manifesto"; situacao: "aberto" | "fechado"; fechado_em: string | null } | null;
  sugestoes: Sugestao[];
  anotacoes: Anotacao[];
  pode: { anotar: boolean; editar: boolean; sugerir: boolean; decidir: boolean; fechar: boolean; moderar: boolean };
}

export type Fonte = "archivo" | "garamond" | "sistema" | "mono";

export interface Identidade {
  fundo: string;
  destaque: string;
  texto: string;
  fonte: Fonte;
  assinatura: string;
  mudou_em?: string;
}

export interface OrgDoEstudio {
  handle: string;
  nome: string;
  palavra: string | null;
  selo: boolean;
  gerencio: boolean;
  identidade: Identidade | null;
}

/** Um post como sai para a zine: sem foto, sem lugar de ato e sem número (interno.alumia_alc_item). */
export interface PostDaZine {
  id: string;
  tipo: string;
  titulo: string | null;
  texto: string;
  longo: boolean;
  aviso: string;
  criado_em: string;
  comunidade: { slug: string; nome: string } | null;
  autor: { codinome: string; handle: string | null };
  meu: boolean;
}

export interface MeuPostParaZine {
  id: string;
  titulo: string | null;
  texto: string;
  criado_em: string;
}

export interface ClienteDaCriacao {
  readonly previa: boolean;
  aberto: () => Promise<boolean>;
  minhasComunidades: () => Promise<MinhaComunidade[]>;
  rascunhos: (slug: string) => Promise<Rascunhos>;
  criarRascunho: (slug: string, titulo: string, tipo: "nota" | "manifesto", corpo: string) => Promise<{ pagina: string; versao: number }>;
  pagina: (slug: string, pagina: string) => Promise<PaginaComMargem>;
  sugerir: (slug: string, pagina: string, base: number, trecho: string, proposta: string, motivo: string) => Promise<{ id: string }>;
  decidir: (id: string, aceitar: boolean) => Promise<{ situacao: "aceita" | "recusada"; versao: number }>;
  anotar: (slug: string, pagina: string, versao: number, inicio: number | null, fim: number | null, texto: string) => Promise<{ id: string; trecho: string }>;
  responder: (id: string, texto: string) => Promise<{ id: string }>;
  resolver: (id: string, sim: boolean) => Promise<{ resolvida: boolean }>;
  apagar: (tipo: "anotacao" | "resposta" | "sugestao", id: string) => Promise<{ apagado: boolean }>;
  fechar: (slug: string, pagina: string, fechar: boolean) => Promise<{ situacao: "aberto" | "fechado" }>;
  estudioOrgs: () => Promise<OrgDoEstudio[]>;
  salvarIdentidade: (handle: string, identidade: Identidade) => Promise<Identidade>;
  zinePosts: (ids: string[]) => Promise<{ itens: PostDaZine[]; fora: number }>;
  zineMeus: () => Promise<MeuPostParaZine[]>;
}

/** O cliente de verdade sobre uma forma de chamar (os testes passam uma simulada). */
export function criarClienteDaCriacao(c: Chamar): ClienteDaCriacao {
  return {
    previa: false,
    aberto: () => c<boolean>("rede_p4_cc_aberto"),
    minhasComunidades: () => c<MinhaComunidade[]>("rede_p4_cc_minhas_comunidades"),
    rascunhos: (slug) => c<Rascunhos>("rede_p4_cc_rascunhos", { p_slug: slug }),
    criarRascunho: (slug, titulo, tipo, corpo) => c("rede_p4_cc_rascunho_criar", { p_slug: slug, p_titulo: titulo, p_tipo: tipo, p_corpo: corpo }),
    pagina: (slug, pagina) => c<PaginaComMargem>("rede_p4_cc_pagina", { p_slug: slug, p_pagina: pagina }),
    sugerir: (slug, pagina, base, trecho, proposta, motivo) =>
      c("rede_p4_cc_sugerir", { p_slug: slug, p_pagina: pagina, p_base: base, p_trecho: trecho, p_proposta: proposta, p_motivo: motivo }),
    decidir: (id, aceitar) => c("rede_p4_cc_sugestao_decidir", { p_id: id, p_aceitar: aceitar }),
    anotar: (slug, pagina, versao, inicio, fim, texto) =>
      c("rede_p4_cc_anotar", { p_slug: slug, p_pagina: pagina, p_versao: versao, p_inicio: inicio, p_fim: fim, p_texto: texto }),
    responder: (id, texto) => c("rede_p4_cc_anotacao_responder", { p_id: id, p_texto: texto }),
    resolver: (id, sim) => c("rede_p4_cc_anotacao_resolver", { p_id: id, p_sim: sim }),
    apagar: (tipo, id) => c("rede_p4_cc_apagar", { p_tipo: tipo, p_id: id }),
    fechar: (slug, pagina, fechar) => c("rede_p4_cc_rascunho_fechar", { p_slug: slug, p_pagina: pagina, p_fechar: fechar }),
    estudioOrgs: () => c<OrgDoEstudio[]>("rede_p4_cc_estudio_orgs"),
    salvarIdentidade: (handle, identidade) => c<Identidade>("rede_p4_cc_org_identidade_salvar", { p_handle: handle, p: identidade }),
    zinePosts: (ids) => c("rede_p4_cc_zine_posts", { p_ids: ids }),
    zineMeus: () => c<MeuPostParaZine[]>("rede_p4_cc_zine_meus"),
  };
}

/**
 * Com NEXT_PUBLIC_ALUMIA_PREVIA=sim, um dublê na memória faz a tela andar sem banco (nada vai a lugar nenhum). Os dados são de
 * exemplo, sem pessoa de verdade.
 */
export function dubleDaCriacao(): ClienteDaCriacao {
  const agora = () => new Date().toISOString();
  const espera = <T>(v: T) => new Promise<T>((ok) => setTimeout(() => ok(structuredClone(v)), 80));
  const corpo = "Direito à moradia. Todo despejo precisa de ordem judicial. Peça a ordem e ligue para a assessoria jurídica do coletivo.";
  const paginas: Record<string, PaginaComMargem> = {
    "cartilha-de-direitos": {
      comunidade: "moradia-exemplo",
      pagina: { pagina: "cartilha-de-direitos", titulo: "Cartilha de direitos", corpo, versao: 1, editado_em: agora(), travada: false },
      rascunho: null,
      sugestoes: [],
      anotacoes: [{ id: "a1", versao: 1, inicio: 19, fim: 58, trecho: corpo.slice(19, 58), texto: "Vale citar o artigo da lei aqui?", resolvida: false, criado_em: agora(), minha: false, respostas: [] }],
      pode: { anotar: true, editar: true, sugerir: false, decidir: false, fechar: false, moderar: false },
    },
  };
  const lista: Rascunhos = { comunidade: { slug: "moradia-exemplo", nome: "Moradia (exemplo)" }, pode_criar: true, rascunhos: [], paginas: [{ pagina: "cartilha-de-direitos", titulo: "Cartilha de direitos", versao: 1, editado_em: agora() }] };
  let ident: Identidade = { fundo: "#0f0e0d", destaque: "#e8321f", texto: "#f3efe6", fonte: "archivo", assinatura: "Coletivo Exemplo" };
  let n = 0;
  const id = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
  return {
    previa: true,
    aberto: () => espera(true),
    minhasComunidades: () => espera([{ slug: "moradia-exemplo", nome: "Moradia (exemplo)", modero: true, edito: true }]),
    rascunhos: () => espera(lista),
    criarRascunho: async (_slug, titulo, tipo, texto) => {
      const pagina = `rascunho-${titulo.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 51) || "x"}`;
      paginas[pagina] = {
        comunidade: "moradia-exemplo",
        pagina: { pagina, titulo, corpo: texto, versao: 1, editado_em: agora(), travada: false },
        rascunho: { tipo, situacao: "aberto", fechado_em: null },
        sugestoes: [],
        anotacoes: [],
        pode: { anotar: true, editar: true, sugerir: true, decidir: true, fechar: true, moderar: true },
      };
      lista.rascunhos.unshift({ pagina, titulo, tipo, situacao: "aberto", versao: 1, editado_em: agora(), sugestoes_abertas: false });
      return espera({ pagina, versao: 1 });
    },
    pagina: (_slug, pagina) => (paginas[pagina] ? espera(paginas[pagina]) : Promise.reject(new Error("nao_encontrado"))),
    sugerir: async (_slug, pagina, _base, trecho, proposta, motivo) => {
      const s: Sugestao = { id: id(), base: paginas[pagina].pagina.versao, trecho, proposta, motivo, situacao: "aberta", criado_em: agora(), decidido_em: null, minha: true };
      paginas[pagina].sugestoes.push(s);
      return espera({ id: s.id });
    },
    decidir: async (sid, aceitar) => {
      const p = Object.values(paginas).find((x) => x.sugestoes.some((s) => s.id === sid))!;
      const s = p.sugestoes.find((x) => x.id === sid)!;
      s.situacao = aceitar ? "aceita" : "recusada";
      s.decidido_em = agora();
      if (aceitar) {
        p.pagina.corpo = p.pagina.corpo.replace(s.trecho, () => s.proposta);
        p.pagina.versao++;
      }
      return espera({ situacao: s.situacao as "aceita" | "recusada", versao: p.pagina.versao });
    },
    anotar: async (_slug, pagina, versao, inicio, fim, texto) => {
      const p = paginas[pagina];
      const trecho = inicio != null && fim != null ? p.pagina.corpo.slice(inicio, fim) : "";
      p.anotacoes.push({ id: id(), versao, inicio, fim, trecho, texto, resolvida: false, criado_em: agora(), minha: true, respostas: [] });
      return espera({ id: p.anotacoes[p.anotacoes.length - 1].id, trecho });
    },
    responder: async (aid, texto) => {
      const a = Object.values(paginas).flatMap((p) => p.anotacoes).find((x) => x.id === aid)!;
      a.respostas.push({ id: id(), texto, criado_em: agora(), minha: true });
      return espera({ id: a.respostas[a.respostas.length - 1].id });
    },
    resolver: async (aid, sim) => {
      const a = Object.values(paginas).flatMap((p) => p.anotacoes).find((x) => x.id === aid)!;
      a.resolvida = sim;
      return espera({ resolvida: sim });
    },
    apagar: async (tipo, aid) => {
      for (const p of Object.values(paginas)) {
        if (tipo === "anotacao") p.anotacoes = p.anotacoes.filter((x) => x.id !== aid);
        if (tipo === "sugestao") p.sugestoes = p.sugestoes.filter((x) => x.id !== aid);
        if (tipo === "resposta") for (const a of p.anotacoes) a.respostas = a.respostas.filter((x) => x.id !== aid);
      }
      return espera({ apagado: true });
    },
    fechar: async (_slug, pagina, fechar) => {
      const p = paginas[pagina];
      if (p.rascunho) p.rascunho.situacao = fechar ? "fechado" : "aberto";
      p.pagina.travada = fechar;
      p.pode.sugerir = !fechar;
      p.pode.decidir = !fechar;
      return espera({ situacao: fechar ? "fechado" : "aberto" });
    },
    estudioOrgs: () => espera([{ handle: "coletivo_exemplo", nome: "Coletivo Exemplo", palavra: "COLETIVO", selo: true, gerencio: true, identidade: ident }]),
    salvarIdentidade: async (_h, i) => {
      ident = { ...i, mudou_em: agora() };
      return espera(ident);
    },
    zinePosts: (ids) =>
      espera({
        itens: ids.slice(0, 12).map((pid, k) => ({
          id: pid, tipo: "post", titulo: k === 0 ? "Por que ocupar" : null,
          texto: "Ocupar é resistir. Quando a cidade deixa casas vazias e gente na rua, organizar a ocupação é cuidar de quem precisa. " + "Aqui contamos como foi o primeiro mês. ".repeat(k + 1),
          longo: false, aviso: "", criado_em: agora(), comunidade: null, autor: { codinome: "Codinome Exemplo", handle: "exemplo" }, meu: true,
        })),
        fora: Math.max(0, ids.length - 12),
      }),
    zineMeus: () =>
      espera([
        { id: "00000000-0000-4000-8000-0000000000a1", titulo: "Por que ocupar", texto: "Ocupar é resistir. Quando a cidade deixa casas vazias…", criado_em: agora() },
        { id: "00000000-0000-4000-8000-0000000000a2", titulo: null, texto: "O mutirão de sábado juntou a vizinhança inteira…", criado_em: agora() },
        { id: "00000000-0000-4000-8000-0000000000a3", titulo: null, texto: "Lista do que falta na cozinha solidária: arroz, óleo…", criado_em: agora() },
      ]),
  };
}
