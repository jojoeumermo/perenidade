// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Perfil livre: as chamadas da aparência do perfil e do Tear ao banco (supabase/migracoes/20261110-alumia-perfil.sql) e, SÓ na
// prévia (NEXT_PUBLIC_ALUMIA_PREVIA=sim), os dados de exemplo das telas, guardados na sessão do navegador para o "Salvar" da prévia
// mudar o perfil de exemplo sem ir a banco nenhum. Tudo o que chega passa por arrumarAparencia (só valores conhecidos).
import { chamar, rede } from "@/lib/rede/cliente";
import type { PaginaDaLinha, Post } from "@/lib/rede/tipos";
import { bancoSemAFuncao } from "@/lib/rede/cliente-org";
import { previaLigada } from "@/lib/rede/org/exemplos";
import { APARENCIA_PADRAO, arrumarAparencia, pedidoDaAparencia, type AparenciaDoPerfil } from "@/lib/rede/aparencia";
import type { ExtrasDoPerfil, PedidoDeExtras } from "@/lib/rede/tipos-org";
import type { PerfilDaRede, PerfilMeu } from "@/lib/rede/tipos-perfil";

/** Uma organização que a pessoa escolheu mostrar (o banco devolve o @ e o codinome de quem tem selo). */
export interface OrgNoPerfil {
  handle: string;
  codinome: string;
}

/** A aparência lida, já arrumada, mais os nomes das organizações (que a aparência guarda só como @). */
export interface AparenciaLida {
  aparencia: AparenciaDoPerfil;
  orgs: OrgNoPerfil[];
}

export const previa = previaLigada;

/** O que o banco devolve em `orgs` é [{handle, codinome}]; o que se manda é ["handle"]. Aceita os dois. */
export function lerAparencia(bruto: unknown): AparenciaLida {
  const b = (bruto && typeof bruto === "object" ? { ...(bruto as Record<string, unknown>) } : {}) as Record<string, unknown>;
  const orgs: OrgNoPerfil[] = [];
  if (Array.isArray(b.orgs)) {
    for (const o of b.orgs) {
      if (typeof o === "string") orgs.push({ handle: o, codinome: o });
      else if (o && typeof o === "object" && typeof (o as OrgNoPerfil).handle === "string") {
        const x = o as OrgNoPerfil;
        orgs.push({ handle: x.handle, codinome: typeof x.codinome === "string" && x.codinome ? x.codinome : x.handle });
      }
    }
    b.orgs = orgs.map((o) => o.handle);
  }
  const aparencia = arrumarAparencia(b);
  return { aparencia, orgs: orgs.filter((o) => aparencia.orgs.includes(o.handle)) };
}

// ───────────────────────────── Prévia (só NEXT_PUBLIC_ALUMIA_PREVIA=sim) ─────────────────────────────

const CHAVE = "alumia:previa:perfil-livre";
const daqui3Horas = () => new Date(Date.now() + 3 * 3600e3).toISOString();

/** As aparências de exemplo (personagens inventados das pranchas, com codinome). */
function exemplos(): Record<string, unknown> {
  return {
    faisca: {
      acento: "dourado", tema: "brasa", layout: "classico", faixa: [0, 1, 2, 3, 4, 5, 6, 7, 8, 1, 0],
      rosto: "0011110001222210122332211232232112222221012442100122221000111100",
      capa: { tipo: "mosaico", palavra: "CATRACA", semente: 7 },
      abas: ["posts", "atos", "destaques", "respostas", "midia", "organizacoes", "escola"],
      fixados: ["exemplo-1"], destaques: [
        { tipo: "ato", ref: "exemplo-ato-1", titulo: "Passe Livre Já", cor: "vermelho" },
        { tipo: "post", ref: "exemplo-2", titulo: "Como montamos o núcleo", cor: "turquesa" },
        { tipo: "post", ref: "exemplo-3", titulo: "Leituras da semana", cor: "roxo" },
      ],
      orgs: [{ handle: "mandatapopular", codinome: "Mandata Popular" }],
      tocando: { texto: "Canção do trabalhador (coro da ocupação)", link: "https://institutolucia.org/cancoes", ate: daqui3Horas() },
    },
    rosavermelha: { acento: "rosa", tema: "tingido", layout: "centro", faixa: [5, 3, 5, 0, 5, 3, 5, 0, 5, 3, 5], capa: { tipo: "mosaico", palavra: "MORADIA", semente: 31 }, abas: ["posts", "midia", "atos"] },
    liaquilombo: { acento: "verde", tema: "papel", layout: "cartaz", faixa: [4, 1, 4, 3, 4, 1, 4, 3, 4, 1, 4], capa: { tipo: "mosaico", palavra: "QUILOMBO", semente: 12 } },
  };
}

function guardadosDaPrevia(): Record<string, unknown> {
  try {
    const bruto = window.sessionStorage.getItem(CHAVE);
    return bruto ? (JSON.parse(bruto) as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function guardarNaPrevia(handle: string, campo: "aparencia" | "extras" | "meu", valor: unknown) {
  try {
    const g = guardadosDaPrevia();
    g[`${campo}:${handle}`] = valor;
    window.sessionStorage.setItem(CHAVE, JSON.stringify(g));
  } catch {
    // sem armazenamento: a prévia só não lembra depois de recarregar
  }
}

function extrasDaPrevia(handle: string): ExtrasDoPerfil | null {
  const g = guardadosDaPrevia()[`extras:${handle}`];
  if (g) return g as ExtrasDoPerfil;
  if (handle !== "faisca") return null;
  return {
    status: { tipo: "ato", texto: "no ato da Paulista", ate: new Date(Date.now() + 5 * 3600e3).toISOString() },
    pronomes: "ela/dela",
    campos: [
      { rotulo: "Núcleo", valor: "Zona Leste" },
      { rotulo: "Luta", valor: "Tarifa Zero" },
      { rotulo: "Site", valor: "https://institutolucia.org" },
    ],
    destaques: [],
  };
}

/** O perfil de exemplo da Faísca (a pessoa logada da prévia) e de quem aparece nas pranchas. */
export function perfilDaPrevia(handle: string): PerfilDaRede | null {
  const nomes: Record<string, string> = { faisca: "Faísca", rosavermelha: "Rosa Vermelha", liaquilombo: "Lia Quilombo", nucleocohab2: "Núcleo Cohab 2" };
  const codinome = nomes[handle];
  if (!codinome) return null;
  const meu = guardadosDaPrevia()[`meu:${handle}`] as Partial<PerfilMeu> | undefined;
  return {
    id: `exemplo-${handle}`,
    codinome: meu?.codinome ?? codinome,
    handle,
    bio:
      meu?.bio ??
      (handle === "faisca"
        ? "Militante do **Passe Livre** na Zona Leste. Estudando _O Capital_ com o núcleo.\nCatraca livre é direito! #TarifaZero"
        : "Na luta por moradia digna. #OcupaSP"),
    modo: "aberto",
    equipe: false,
    selos: handle === "faisca" ? ["escola:carteirinha", "escola:degrau-2", "escola:aulas-14"] : [],
    meu: handle === "faisca",
    sigo: false,
    pendente: false,
    fixado: null,
    avatar: { tipo: null },
    capa: { tipo: null },
    estudando: null,
    pedidos: handle === "faisca" ? 0 : null,
  } as PerfilDaRede;
}

/** O "meu perfil" da prévia (para o editor). */
export function meuDaPrevia(): PerfilMeu {
  const p = perfilDaPrevia("faisca")!;
  return {
    id: p.id ?? "exemplo-faisca",
    codinome: p.codinome,
    handle: "faisca",
    bio: p.bio,
    modo: "aberto",
    avatar: { tipo: null },
    capa: { tipo: null },
    estudando: null,
    selos_trilhas: [],
    selos_mostrar: false,
    selos: p.selos,
    handle_troca_em: null,
    pedidos: 0,
    fixado: null,
  };
}

// ───────────────────────────── As chamadas ─────────────────────────────

/** A aparência de um perfil (nula = não pode ver). Sem a migração no banco: o padrão (ou o exemplo, na prévia). */
export async function aparenciaDe(handle: string): Promise<AparenciaLida> {
  if (previa()) {
    const g = guardadosDaPrevia()[`aparencia:${handle}`];
    return lerAparencia(g ?? exemplos()[handle] ?? {});
  }
  try {
    return lerAparencia(await chamar<unknown>("rede_perfil_aparencia", { p_handle: handle }));
  } catch (e) {
    if (bancoSemAFuncao(e)) return { aparencia: { ...APARENCIA_PADRAO }, orgs: [] };
    throw e;
  }
}

/** Salvar a minha aparência inteira (o banco confere tudo de novo). Na prévia, guarda na sessão. */
export async function salvarAparencia(handle: string, a: AparenciaDoPerfil, orgs: OrgNoPerfil[]): Promise<AparenciaLida> {
  if (previa()) {
    const bruto = { ...pedidoDaAparencia(a), orgs: orgs.filter((o) => a.orgs.includes(o.handle)) };
    guardarNaPrevia(handle, "aparencia", bruto);
    await espera(450);
    return lerAparencia(bruto);
  }
  return lerAparencia(await chamar<unknown>("rede_perfil_aparencia_editar", { p: pedidoDaAparencia(a) }));
}

/** Os extras (status, pronomes, campos). */
export async function extrasDe(handle: string): Promise<ExtrasDoPerfil | null> {
  if (previa()) return extrasDaPrevia(handle);
  try {
    return await chamar<ExtrasDoPerfil | null>("rede_perfil_extras", { p_handle: handle });
  } catch (e) {
    if (bancoSemAFuncao(e)) return null;
    throw e;
  }
}

export async function salvarExtras(handle: string, p: PedidoDeExtras, atual: ExtrasDoPerfil | null): Promise<ExtrasDoPerfil> {
  if (previa()) {
    const status = p.status === undefined ? (atual?.status ?? null) : p.status ? { tipo: p.status.tipo, texto: p.status.texto, ate: new Date(Date.now() + p.status.horas * 3600e3).toISOString() } : null;
    const novo: ExtrasDoPerfil = { status, pronomes: p.pronomes === undefined ? (atual?.pronomes ?? null) : p.pronomes, campos: p.campos ?? atual?.campos ?? [], destaques: atual?.destaques ?? [] };
    guardarNaPrevia(handle, "extras", novo);
    return novo;
  }
  return chamar<ExtrasDoPerfil>("rede_perfil_extras_editar", { p });
}

/** As abas Respostas, Mídia e Atos (rede_perfil_linha). Sem a função no banco: página vazia. Na prévia: posts das pranchas. */
export async function linhaDoPerfil(handle: string, aba: "respostas" | "midia" | "atos", cursor: string | null = null): Promise<PaginaDaLinha> {
  if (previa()) {
    const m = await import("@/lib/rede/publicar/exemplos-alumia2");
    const todos = m.postsDeExemplo();
    const fatia = aba === "respostas" ? todos.slice(1, 3) : aba === "midia" ? todos.slice(3, 4) : todos.filter((p) => p.chamado).slice(0, 3);
    return { itens: handle === "faisca" ? fatia : [], proximo: null };
  }
  try {
    return await chamar<PaginaDaLinha>("rede_perfil_linha", { p_handle: handle, p_aba: aba, p_cursor: cursor });
  } catch (e) {
    if (bancoSemAFuncao(e)) return { itens: [], proximo: null };
    throw e;
  }
}

/** Os posts fixados (até 3), na ordem; o que não se pode ver some. Na prévia: os das pranchas. */
export async function postsFixados(ids: string[]): Promise<Post[]> {
  if (ids.length === 0) return [];
  if (previa()) {
    const m = await import("@/lib/rede/publicar/exemplos-alumia2");
    const todos = m.postsDeExemplo();
    return ids.map((id, i) => todos.find((p) => p.id === id) ?? todos[i]).filter(Boolean).slice(0, 3);
  }
  const lidos = await Promise.all(ids.map((id) => rede.post(id).then((c) => c.post).catch(() => null)));
  return lidos.filter((p): p is Post => p !== null);
}

/** Os meus posts recentes (para escolher fixados e destaques). */
export async function meusPosts(handle: string): Promise<Post[]> {
  if (previa()) {
    const m = await import("@/lib/rede/publicar/exemplos-alumia2");
    return m.postsDeExemplo().slice(0, 6);
  }
  const r = await rede.linha(`u:${handle}`, null, 20).catch(() => ({ itens: [] as Post[] }));
  return r.itens.filter((p) => p.meu && !p.retido);
}

/** Trocar o codinome (rede_codinome_definir). */
export async function trocarCodinome(handle: string, codinome: string): Promise<string> {
  if (previa()) {
    guardarMeuNaPrevia(handle, { codinome });
    return codinome;
  }
  const r = await chamar<{ nome: string }>("rede_codinome_definir", { p_codinome: codinome });
  return r.nome;
}

/** Bio e codinome da prévia (o de verdade vai por redePerfil.editar). */
export function guardarMeuNaPrevia(handle: string, meu: Partial<PerfilMeu>) {
  const antes = (guardadosDaPrevia()[`meu:${handle}`] as Partial<PerfilMeu> | undefined) ?? {};
  guardarNaPrevia(handle, "meu", { ...antes, ...meu });
}

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));
