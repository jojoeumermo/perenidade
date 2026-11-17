// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Onda 12, frente 12D: as chamadas das seções do perfil, dos links (e da conferência deles), do histórico de voluntariado e dos
// pacotes iniciais (supabase/migracoes/20261118-alumia-o12-perfil.sql). Banco sem a migração: as leituras do perfil voltam
// vazias (o perfil fica como sempre foi). Na prévia (NEXT_PUBLIC_ALUMIA_PREVIA=sim), dados de exemplo guardados na sessão do
// navegador, sem banco e sem rede nenhuma.
import { getClient } from "@/lib/backend";
import { chamar } from "@/lib/rede/cliente";
import { bancoSemAFuncao } from "@/lib/rede/cliente-org";
import { redeDescoberta } from "@/lib/rede/cliente-descoberta";
import { previaLigada } from "@/lib/rede/org/exemplos";
import type { PacoteDePessoas } from "@/lib/rede/tipos-descoberta";
import { arrumarSecoes, type ConferidoComo, type FrenteDeVoluntariado, type LinkDoPerfil, type SecaoDoPerfil, type Voluntariado } from "./secoes-perfil";

export interface ComunidadeNoPerfil {
  slug: string;
  nome: string;
  cor: string;
}

export interface LinkVisto {
  titulo: string;
  url: string;
  conferido: ConferidoComo | null;
}

/** O que as seções de um perfil mostram a quem olha. `secoes` nulo: a pessoa nunca escolheu (o perfil fica como sempre foi). */
export interface SecoesVistas {
  secoes: SecaoDoPerfil[] | null;
  sobre?: string | null;
  links?: LinkVisto[];
  comunidades?: ComunidadeNoPerfil[];
  voluntariado?: { frente: FrenteDeVoluntariado; de: number; ate: number | null }[];
}

export interface MeuLink extends LinkVisto {
  id: string;
  /** O código para a bio do Instagram, enquanto a mediação não decide. */
  codigo: string | null;
  mediacao: boolean;
}

export interface MinhasSecoes {
  secoes: SecaoDoPerfil[] | null;
  sobre: string;
  comunidades: string[];
  possiveis: ComunidadeNoPerfil[];
  links: MeuLink[];
  voluntariado: (Voluntariado & { id: string; situacao: "esperando" | "confirmado" | "recusado" })[];
}

export interface ResumoDePacote {
  slug: string;
  titulo: string;
  descricao: string;
}

export interface MeusPacotes {
  convites: ResumoDePacote[];
  dentro: ResumoDePacote[];
  aparece: boolean;
}

export interface PacoteParaCuidar extends ResumoDePacote {
  ordem: number;
  ativo: boolean;
  dentro: string[];
  /** Há convites esperando resposta? */
  ha_convites: boolean;
  /** Quantos, só a partir de 3 (nulo abaixo disso). */
  convites: number | null;
}

export interface VoluntariadoNaFila {
  id: string;
  quem: string;
  frente: FrenteDeVoluntariado;
  de: number;
  ate: number | null;
}

export interface LinkNaFila {
  id: string;
  url: string;
  codigo: string;
  handle: string;
}

export const previa = previaLigada;

// ───────────────────────────── Prévia ─────────────────────────────

const CHAVE = "alumia:previa:o12-perfil";
const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface EstadoDaPrevia {
  secoes: Record<string, { secoes: SecaoDoPerfil[] | null; sobre: string; comunidades: string[]; links: MeuLink[]; voluntariado: MinhasSecoes["voluntariado"] }>;
  pacotes: { convites: string[]; dentro: string[]; aparece: boolean };
  fila: VoluntariadoNaFila[];
  filaLinks: LinkNaFila[];
}

const COMUNIDADES_DA_PREVIA: ComunidadeNoPerfil[] = [
  { slug: "passe-livre-sp", nome: "Passe Livre SP", cor: "#e8321f" },
  { slug: "marxismo", nome: "Marxismo", cor: "#a27bff" },
  { slug: "cultura-hip-hop", nome: "Cultura hip-hop", cor: "#ffc21a" },
];

export const PACOTES_DA_PREVIA: (ResumoDePacote & { pessoas: string[] })[] = [
  { slug: "comecar", titulo: "Para começar", descricao: "Gente que acolhe quem chega: tira dúvida, indica leitura e chama para o próximo ato.", pessoas: ["rosavermelha", "liaquilombo", "nucleocohab2"] },
  { slug: "estudo-de-sabado", titulo: "Estudo de sábado", descricao: "Quem puxa os círculos de estudo nos núcleos.", pessoas: ["liaquilombo", "nucleocohab2", "faisca"] },
];

function inicial(): EstadoDaPrevia {
  return {
    secoes: {
      faisca: {
        secoes: ["sobre", "links", "comunidades", "voluntariado", "trilhas", "destaques"],
        sobre:
          "Comecei no Passe Livre em 2019, panfletando na saída da escola. Hoje ajudo a puxar o núcleo da Zona Leste e o círculo de estudo de sábado.\n\nGosto de mapa, de planilha de atraso de ônibus e de roda de conversa que termina em tarefa.",
        comunidades: ["passe-livre-sp", "marxismo"],
        links: [
          { id: "l1", titulo: "Mapa dos atrasos da Zona Leste", url: "https://exemplo.org/atrasos", conferido: "rel_me", codigo: null, mediacao: false },
          { id: "l2", titulo: "Instagram do núcleo", url: "https://www.instagram.com/nucleozl", conferido: "mediacao", codigo: null, mediacao: false },
          { id: "l3", titulo: "Caderno de leituras", url: "https://cadernos.exemplo.org/faisca", conferido: null, codigo: null, mediacao: false },
        ],
        voluntariado: [
          { id: "v1", frente: "traducao", de: 2024, ate: null, situacao: "confirmado" },
          { id: "v2", frente: "educacao", de: 2022, ate: 2023, situacao: "confirmado" },
          { id: "v3", frente: "eventos", de: 2025, ate: null, situacao: "esperando" },
        ],
      },
      liaquilombo: {
        secoes: ["sobre", "voluntariado"],
        sobre: "Entregadora de dia, estudante da Escola de noite.",
        comunidades: [],
        links: [],
        voluntariado: [{ id: "v9", frente: "mentoria", de: 2025, ate: null, situacao: "confirmado" }],
      },
    },
    pacotes: { convites: ["comecar"], dentro: ["estudo-de-sabado"], aparece: true },
    fila: [
      { id: "f1", quem: "Lia Quilombo (@liaquilombo)", frente: "mentoria", de: 2025, ate: null },
      { id: "f2", quem: "Rosa Vermelha (@rosavermelha)", frente: "comunicacao", de: 2023, ate: 2025 },
    ],
    filaLinks: [{ id: "i1", url: "https://www.instagram.com/rosa.dce", codigo: "alumia-3f9a1c07", handle: "rosavermelha" }],
  };
}

function lerPrevia(): EstadoDaPrevia {
  try {
    const bruto = window.sessionStorage.getItem(CHAVE);
    if (bruto) return JSON.parse(bruto) as EstadoDaPrevia;
  } catch {
    // sem armazenamento: começa do exemplo
  }
  return inicial();
}

function guardarPrevia(e: EstadoDaPrevia) {
  try {
    window.sessionStorage.setItem(CHAVE, JSON.stringify(e));
  } catch {
    // sem armazenamento: a prévia só não lembra depois de recarregar
  }
}

function vistasDaPrevia(handle: string): SecoesVistas {
  const s = lerPrevia().secoes[handle];
  if (!s || s.secoes === null) return { secoes: null };
  const r: SecoesVistas = { secoes: s.secoes };
  if (s.secoes.includes("sobre")) r.sobre = s.sobre || null;
  if (s.secoes.includes("links")) r.links = s.links.map(({ titulo, url, conferido }) => ({ titulo, url, conferido }));
  if (s.secoes.includes("comunidades")) r.comunidades = s.comunidades.map((c) => COMUNIDADES_DA_PREVIA.find((x) => x.slug === c)).filter((c): c is ComunidadeNoPerfil => Boolean(c));
  if (s.secoes.includes("voluntariado")) r.voluntariado = s.voluntariado.filter((v) => v.situacao === "confirmado").map(({ frente, de, ate }) => ({ frente, de, ate }));
  return r;
}

function minhasDaPrevia(): MinhasSecoes {
  const s = lerPrevia().secoes.faisca ?? { secoes: null, sobre: "", comunidades: [], links: [], voluntariado: [] };
  return { ...s, possiveis: COMUNIDADES_DA_PREVIA };
}

function mudarPrevia(f: (e: EstadoDaPrevia) => void): EstadoDaPrevia {
  const e = lerPrevia();
  f(e);
  guardarPrevia(e);
  return e;
}

// ───────────────────────────── As chamadas ─────────────────────────────

/** As seções de um perfil (nulo = não pode ver). Banco sem a migração: como se a pessoa nunca tivesse escolhido. */
export async function secoesDe(handle: string): Promise<SecoesVistas | null> {
  if (previa()) return vistasDaPrevia(handle);
  try {
    const r = await chamar<SecoesVistas | null>("alumia_perfil_secoes", { p_handle: handle });
    return r ? { ...r, secoes: r.secoes === null ? null : arrumarSecoes(r.secoes) } : null;
  } catch (e) {
    if (bancoSemAFuncao(e)) return { secoes: null };
    throw e;
  }
}

export async function minhasSecoes(): Promise<MinhasSecoes> {
  if (previa()) return minhasDaPrevia();
  return chamar<MinhasSecoes>("alumia_perfil_secoes_minhas");
}

export async function salvarSecoes(p: { secoes?: SecaoDoPerfil[]; sobre?: string; comunidades?: string[] }): Promise<MinhasSecoes> {
  if (previa()) {
    await espera(350);
    mudarPrevia((e) => {
      const atual = e.secoes.faisca ?? { secoes: null, sobre: "", comunidades: [], links: [], voluntariado: [] };
      e.secoes.faisca = { ...atual, ...(p.secoes ? { secoes: p.secoes } : {}), ...(p.sobre !== undefined ? { sobre: p.sobre } : {}), ...(p.comunidades ? { comunidades: p.comunidades } : {}) };
    });
    return minhasDaPrevia();
  }
  return chamar<MinhasSecoes>("alumia_perfil_secoes_salvar", { p });
}

export async function salvarLinks(links: LinkDoPerfil[]): Promise<MinhasSecoes> {
  if (previa()) {
    await espera(350);
    mudarPrevia((e) => {
      const atual = e.secoes.faisca;
      if (!atual) return;
      atual.links = links.map((l, i) => {
        const velho = atual.links.find((x) => x.url === l.url);
        return velho ? { ...velho, titulo: l.titulo } : { id: `n${Date.now()}-${i}`, titulo: l.titulo, url: l.url, conferido: null, codigo: null, mediacao: false };
      });
    });
    return minhasDaPrevia();
  }
  return chamar<MinhasSecoes>("alumia_perfil_links_salvar", { p: links.map((l) => ({ titulo: l.titulo, url: l.url })) });
}

/**
 * Pede ao servidor do site que confira o rel="me" da página do link. O servidor busca a página de lá sem mandar nada da pessoa.
 * Devolve "ok", "nao_achou" ou o código de um erro.
 */
export async function conferirLink(id: string): Promise<"ok" | "nao_achou" | string> {
  if (previa()) {
    await espera(900);
    let achou = false;
    mudarPrevia((e) => {
      const l = e.secoes.faisca?.links.find((x) => x.id === id);
      // Na prévia, o site de exemplo "aponta de volta" quando o endereço é do exemplo.org.
      achou = Boolean(l && /exemplo\.org/.test(l.url));
      if (l && achou) l.conferido = "rel_me";
    });
    return achou ? "ok" : "nao_achou";
  }
  try {
    const supabase = await getClient();
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return "entre_primeiro";
    const r = await fetch("/api/rede/perfil-link", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ link: id }), cache: "no-store" });
    const corpo = (await r.json().catch(() => null)) as { ok?: boolean; motivo?: string } | null;
    if (corpo?.ok) return "ok";
    return corpo?.motivo ?? "sem_servico";
  } catch {
    return "sem_conexao";
  }
}

export async function pedirMediacao(id: string, sim: boolean): Promise<{ codigo: string | null; mediacao: boolean }> {
  if (previa()) {
    await espera(300);
    let r = { codigo: null as string | null, mediacao: false };
    mudarPrevia((e) => {
      const l = e.secoes.faisca?.links.find((x) => x.id === id);
      if (!l) return;
      l.codigo = sim ? (l.codigo ?? "alumia-5e21b7d4") : null;
      l.mediacao = sim;
      r = { codigo: l.codigo, mediacao: l.mediacao };
    });
    return r;
  }
  return chamar("alumia_perfil_link_mediacao", { p_link: id, p_sim: sim });
}

export async function salvarVoluntariado(v: { id?: string; frente: FrenteDeVoluntariado; de: number; ate: number | null }): Promise<MinhasSecoes> {
  if (previa()) {
    await espera(300);
    mudarPrevia((e) => {
      const atual = e.secoes.faisca;
      if (!atual) return;
      if (v.id) atual.voluntariado = atual.voluntariado.map((x) => (x.id === v.id ? { ...x, frente: v.frente, de: v.de, ate: v.ate, situacao: "esperando" } : x));
      else atual.voluntariado = [{ id: `v${Date.now()}`, frente: v.frente, de: v.de, ate: v.ate, situacao: "esperando" }, ...atual.voluntariado];
    });
    return minhasDaPrevia();
  }
  return chamar<MinhasSecoes>("alumia_perfil_voluntariado_salvar", { p: v });
}

export async function apagarVoluntariado(id: string): Promise<MinhasSecoes> {
  if (previa()) {
    mudarPrevia((e) => {
      if (e.secoes.faisca) e.secoes.faisca.voluntariado = e.secoes.faisca.voluntariado.filter((x) => x.id !== id);
    });
    return minhasDaPrevia();
  }
  return chamar<MinhasSecoes>("alumia_perfil_voluntariado_apagar", { p_id: id });
}

// ───────────────────────────── Pacotes ─────────────────────────────

const resumo = (slug: string): ResumoDePacote | null => {
  const p = PACOTES_DA_PREVIA.find((x) => x.slug === slug);
  return p ? { slug: p.slug, titulo: p.titulo, descricao: p.descricao } : null;
};

export async function meusPacotes(): Promise<MeusPacotes> {
  if (previa()) {
    const p = lerPrevia().pacotes;
    return { convites: p.convites.map(resumo).filter((x): x is ResumoDePacote => Boolean(x)), dentro: p.dentro.map(resumo).filter((x): x is ResumoDePacote => Boolean(x)), aparece: p.aparece };
  }
  try {
    return await chamar<MeusPacotes>("alumia_pacotes_meus");
  } catch (e) {
    if (bancoSemAFuncao(e)) return { convites: [], dentro: [], aparece: false };
    throw e;
  }
}

export async function responderPacote(slug: string, sim: boolean): Promise<MeusPacotes> {
  if (previa()) {
    await espera(300);
    mudarPrevia((e) => {
      e.pacotes.convites = e.pacotes.convites.filter((x) => x !== slug);
      e.pacotes.dentro = sim ? [...new Set([...e.pacotes.dentro, slug])] : e.pacotes.dentro.filter((x) => x !== slug);
      if (sim) e.pacotes.aparece = true;
    });
    return meusPacotes();
  }
  return chamar<MeusPacotes>("alumia_pacote_responder", { p_slug: slug, p_sim: sim });
}

/** Um pacote e quem está nele (só quem aceitou). */
export async function pacote(slug: string): Promise<PacoteDePessoas> {
  if (previa()) {
    const p = PACOTES_DA_PREVIA.find((x) => x.slug === slug);
    if (!p) throw new Error("nao_encontrado");
    const { perfilDaPrevia } = await import("@/components/rede/perfil/livre/dados");
    return {
      slug: p.slug,
      titulo: p.titulo,
      descricao: p.descricao,
      pessoas: p.pessoas
        .filter((h) => h !== "faisca")
        .map((h) => {
          const x = perfilDaPrevia(h);
          return { codinome: x?.codinome ?? h, handle: h, bio: (x?.bio ?? "").replace(/[*_]/g, ""), equipe: false, sigo: false };
        }),
    };
  }
  return redeDescoberta.pacote(slug);
}

export async function seguirPacote(slug: string): Promise<{ seguidos: number }> {
  if (previa()) {
    await espera(400);
    return { seguidos: (PACOTES_DA_PREVIA.find((x) => x.slug === slug)?.pessoas.filter((h) => h !== "faisca").length ?? 0) };
  }
  return redeDescoberta.seguirPacote(slug);
}

/** Equipe: os pacotes, com quem entrou e quantos convites esperam. Nulo = quem pede não cuida dos pacotes. */
export async function pacotesParaCuidar(): Promise<PacoteParaCuidar[] | null> {
  if (previa()) {
    return PACOTES_DA_PREVIA.map((p, i) => ({ slug: p.slug, titulo: p.titulo, descricao: p.descricao, ordem: i, ativo: true, dentro: p.pessoas, ha_convites: true, convites: i === 0 ? 4 : null }));
  }
  try {
    return await chamar<PacoteParaCuidar[]>("alumia_pacotes_cuidar");
  } catch {
    return null;
  }
}

export async function salvarPacote(p: { slug: string; titulo: string; descricao: string; ordem: number; ativo: boolean }): Promise<void> {
  if (previa()) return void (await espera(300));
  await chamar("rede_desc_pacote_salvar", { p_slug: p.slug, p_titulo: p.titulo, p_descricao: p.descricao, p_ordem: p.ordem, p_ativo: p.ativo });
}

/** Equipe: convidar (sim) ou tirar (não) alguém do pacote. Convidar não põe no pacote. */
export async function convidarParaPacote(slug: string, handle: string, sim: boolean): Promise<void> {
  if (previa()) return void (await espera(300));
  await chamar("rede_desc_pacote_pessoa", { p_slug: slug, p_handle: handle, p_sim: sim });
}

// ───────────────────────────── Painel e mediação ─────────────────────────────

export async function filaDoVoluntariado(): Promise<VoluntariadoNaFila[]> {
  if (previa()) return lerPrevia().fila;
  return chamar<VoluntariadoNaFila[]>("alumia_painel_voluntariado_fila");
}

export async function decidirVoluntariado(id: string, confirmar: boolean, motivo: string | null): Promise<void> {
  if (previa()) {
    await espera(300);
    mudarPrevia((e) => {
      e.fila = e.fila.filter((x) => x.id !== id);
    });
    return;
  }
  await chamar("alumia_painel_voluntariado_decidir", { p_id: id, p_confirmar: confirmar, p_motivo: motivo });
}

export async function filaDosLinks(): Promise<LinkNaFila[]> {
  if (previa()) return lerPrevia().filaLinks;
  return chamar<LinkNaFila[]>("alumia_perfil_links_fila");
}

export async function decidirLink(id: string, ok: boolean): Promise<void> {
  if (previa()) {
    await espera(300);
    mudarPrevia((e) => {
      e.filaLinks = e.filaLinks.filter((x) => x.id !== id);
    });
    return;
  }
  await chamar("alumia_perfil_link_decidir", { p_link: id, p_ok: ok });
}

/** O código de erro de uma chamada (a mensagem da função do banco), para achar o texto. */
export function codigoDoErroDoPerfil(e: unknown): string {
  if (typeof e === "object" && e !== null && "code" in e && typeof (e as { code: unknown }).code === "string") return (e as { code: string }).code;
  const m = e instanceof Error ? e.message : "";
  return /^[a-z_]+(:[a-z_]+)?$/.test(m) ? m : "generico";
}

/** O texto de um erro do perfil (o código que o banco devolve; o que não se conhece vira o genérico). */
export function textoDoErroDoPerfil(erros: Record<string, string>, e: unknown): string {
  return erros[codigoDoErroDoPerfil(e)] ?? erros.generico;
}
