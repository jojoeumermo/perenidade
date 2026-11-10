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
import { lembrarRosto, ROSTOS_DA_PREVIA } from "@/lib/rede/rostos";

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
      rosto: ROSTOS_DA_PREVIA.faisca,
      capa: { tipo: "mosaico", palavra: "CATRACA", semente: 7 },
      abas: ["posts", "atos", "destaques", "respostas", "midia", "organizacoes", "escola"],
      fixados: ["exemplo-faisca-1"], destaques: [
        { tipo: "ato", ref: "exemplo-faisca-5", titulo: "Ato contra o aumento", cor: "vermelho" },
        { tipo: "post", ref: "exemplo-faisca-2", titulo: "Como montamos o núcleo", cor: "turquesa" },
        { tipo: "post", ref: "exemplo-faisca-3", titulo: "Os cartazes da oficina", cor: "roxo" },
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

const BIOS: Record<string, string> = {
  faisca: "Militante do **Passe Livre** na Zona Leste. Estudando _O Capital_ com o núcleo.\nCatraca livre é direito! #TarifaZero",
  rosavermelha: "Estudante da UFPE e do DCE. Panfleto, plenária e muita _paciência_. #EducaçãoPública",
  liaquilombo: "Entregadora de dia, estudante da Escola de noite. **Quilombo é organização.** #Antirracismo",
  nucleocohab2: "Núcleo de bairro da Cohab 2: círculo de estudo aos sábados e roda de rima depois. #CulturaÉLuta",
};

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
    bio: meu?.bio ?? BIOS[handle] ?? "",
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

// Os posts de exemplo de CADA personagem (só dela: o perfil nunca mostra post de outra pessoa). Ids "exemplo-<handle>-<n>".
type PostDaPrevia = { texto: string; comunidade?: string; minutos: number; ato?: { tipo: string; dias: number; hora: number; onde: string }; imagem?: { capa: string; alt: string }; resposta?: string; respostas?: number };
const POSTS_DA_PREVIA: Record<string, PostDaPrevia[]> = {
  faisca: [
    { texto: "Panfletagem na estação Itaquera no sábado, 7h. Leva panfleto, água e um casaco: a gente se encontra na saída B.", comunidade: "passe-livre-sp", minutos: 40, ato: { tipo: "Panfletagem na Itaquera", dias: 3, hora: 7, onde: "Estação Itaquera, saída B" }, respostas: 8 },
    { texto: "Como montamos o núcleo: três pessoas, uma lista de linhas que atrasam e uma reunião por semana. Hoje somos vinte e o mapa dos atrasos já foi parar na Câmara.", comunidade: "passe-livre-sp", minutos: 180, respostas: 21 },
    { texto: "Os cartazes da oficina de serigrafia ficaram prontos. Obrigada a quem colou e trouxe tinta!", comunidade: "passe-livre-sp", minutos: 600, imagem: { capa: "c03", alt: "Cartazes coloridos do Passe Livre secando no varal da oficina" }, respostas: 5 },
    { texto: "Concordo: dá para juntar as duas panfletagens no mesmo dia e dividir as estações.", minutos: 15, resposta: "exemplo-rosa", respostas: 2 },
    { texto: "Ato contra o aumento da tarifa na quinta, 17h. Concentração na praça, saída às 18h.", comunidade: "passe-livre-sp", minutos: 1500, ato: { tipo: "Ato contra o aumento", dias: 5, hora: 17, onde: "Praça do Ciclista, São Paulo" }, respostas: 34 },
  ],
  rosavermelha: [
    { texto: "Resumo da assembleia do DCE: paralisação aprovada para quinta, comissão de comunicação aberta a quem quiser entrar.", comunidade: "estudantes-ufpe", minutos: 300, respostas: 19 },
    { texto: "A faixa nova do DCE ficou assim. Pintada por doze mãos.", comunidade: "estudantes-ufpe", minutos: 900, imagem: { capa: "c05", alt: "Faixa vermelha do DCE estendida no pátio" }, respostas: 6 },
    { texto: "Boa! Mando o roteiro da panfletagem para vocês adaptarem.", minutos: 20, resposta: "exemplo-faisca-1", respostas: 1 },
  ],
  liaquilombo: [
    { texto: "Roda de conversa sobre trabalho por aplicativo no sábado, 15h, no centro cultural. Traga a sua conta de quanto fica com o app.", comunidade: "marxismo", minutos: 400, ato: { tipo: "Roda sobre trabalho por app", dias: 4, hora: 15, onde: "Centro cultural do bairro" }, respostas: 12 },
    { texto: "O mural do quilombo urbano ficou pronto.", minutos: 1200, imagem: { capa: "c07", alt: "Mural colorido pintado num muro do bairro" }, respostas: 9 },
    { texto: "Fiz a conta aqui: em média, 38% de cada corrida fica com o app.", minutos: 50, resposta: "exemplo-lia", respostas: 4 },
  ],
  nucleocohab2: [
    { texto: "A roda de rima do mês passado em uma foto.", comunidade: "cultura-hip-hop", minutos: 2000, imagem: { capa: "c02", alt: "Roda de pessoas na quadra ao entardecer" }, respostas: 7 },
  ],
};

/** Os posts de exemplo de uma pessoa (os dela e os das pranchas que ela escreveu), do mais novo ao mais antigo. */
async function postsDaPessoaNaPrevia(handle: string): Promise<Post[]> {
  const m = await import("@/lib/rede/publicar/exemplos-alumia2");
  const agora = Date.now();
  const pranchas = m.postsDeExemplo(agora);
  const molde = pranchas[1];
  const autor = pranchas.find((p) => p.autor.handle === handle)?.autor ?? { id: `exemplo-${handle}`, codinome: perfilDaPrevia(handle)?.codinome ?? handle, handle, perfil: true, equipe: false };
  const proprios = (POSTS_DA_PREVIA[handle] ?? []).map((x, i): Post => {
    const id = `exemplo-${handle}-${i + 1}`;
    let chamado: Post["chamado"] = null;
    if (x.ato) {
      const quando = new Date(agora + x.ato.dias * 86_400_000);
      quando.setHours(x.ato.hora, 0, 0, 0);
      chamado = { tipo: x.ato.tipo, quando: quando.toISOString(), onde: x.ato.onde, situacao: "confirmado" };
    }
    return {
      ...molde,
      id,
      raiz: x.resposta ?? id,
      tipo: "post",
      texto: x.texto,
      comunidade: x.comunidade ?? null,
      criado_em: new Date(agora - x.minutos * 60_000).toISOString(),
      chamado,
      // Sem banco não há depósito de mídia: os posts de exemplo com foto saem só com o texto (a foto real chega pelo cartão).
      midia: [],
      resposta_a: x.resposta ?? null,
      nivel: x.resposta ? 1 : 0,
      autor,
      org: null,
      meu: handle === "faisca",
      respostas: x.respostas ?? 0,
      apoiei: false,
      cita: null,
    };
  });
  const daPrancha = pranchas.filter((p) => p.autor.handle === handle).map((p) => ({ ...p, meu: handle === "faisca" }));
  return [...proprios, ...daPrancha].sort((a, b) => b.criado_em.localeCompare(a.criado_em));
}

// ───────────────────────────── As chamadas ─────────────────────────────

/** O rosto lido vira o avatar daquele @ na rede inteira (lib/rede/rostos.ts). */
function comRosto(handle: string, lida: AparenciaLida): AparenciaLida {
  lembrarRosto(handle, lida.aparencia.rosto);
  return lida;
}

/** A aparência de um perfil (nula = não pode ver). Sem a migração no banco: o padrão (ou o exemplo, na prévia). */
export async function aparenciaDe(handle: string): Promise<AparenciaLida> {
  if (previa()) {
    const g = guardadosDaPrevia()[`aparencia:${handle}`];
    return comRosto(handle, lerAparencia(g ?? exemplos()[handle] ?? {}));
  }
  try {
    return comRosto(handle, lerAparencia(await chamar<unknown>("rede_perfil_aparencia", { p_handle: handle })));
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
    return comRosto(handle, lerAparencia(bruto));
  }
  return comRosto(handle, lerAparencia(await chamar<unknown>("rede_perfil_aparencia_editar", { p: pedidoDaAparencia(a) })));
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
    const dela = await postsDaPessoaNaPrevia(handle);
    const fatia = aba === "respostas" ? dela.filter((p) => p.resposta_a) : aba === "midia" ? dela.filter((p) => p.midia.length > 0) : dela.filter((p) => p.chamado && !p.resposta_a);
    return { itens: fatia, proximo: null };
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
    // Só aparece fixado o que é da própria pessoa (o perfil nunca mostra post de outra).
    const todos = (await Promise.all(Object.keys(POSTS_DA_PREVIA).map(postsDaPessoaNaPrevia))).flat();
    return ids.map((id) => todos.find((p) => p.id === id)).filter((p): p is Post => Boolean(p)).slice(0, 3);
  }
  const lidos = await Promise.all(ids.map((id) => rede.post(id).then((c) => c.post).catch(() => null)));
  return lidos.filter((p): p is Post => p !== null);
}

/** Os meus posts recentes (para escolher fixados e destaques). */
export async function meusPosts(handle: string): Promise<Post[]> {
  // Na prévia: só os da própria pessoa, sem as respostas (fixar e destacar post alheio não existe).
  if (previa()) return (await postsDaPessoaNaPrevia(handle)).filter((p) => !p.resposta_a);
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
