// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O que a Escola Lúcia Maria pede ao banco (supabase/migracoes/2026-11-escola.sql). Só do navegador. O servidor guarda
// somas anônimas por dia; o resto (turma por curso, ouvidoria) é o que a pessoa manda de propósito. Explicação em
// docs/escola/banco.md.
//
// Sem o serviço (desenvolvimento sem Supabase) ou com ele fora do ar, as leituras devolvem vazio e as contagens não
// fazem nada, sem quebrar a página. As ações que a pessoa pede (entrar numa turma, mandar à ouvidoria) devolvem null sem
// o serviço e, com ele, repassam o código de recusa do banco (BackendError: 'entre_primeiro', 'consentimento'…) para a
// tela explicar.
import { hasBackend, rpc } from "@/lib/backend";
import { CHAVE_DAS_MARCAS, deveContar, lerMarcas, marcar, type Periodo, type TipoDaEscola } from "./contagem-local";

export type { Periodo, TipoDaEscola } from "./contagem-local";

function lerGuardado(): unknown {
  try {
    return JSON.parse(localStorage.getItem(CHAVE_DAS_MARCAS) ?? "[]");
  } catch {
    return [];
  }
}

function guardar(marcas: string[]): boolean {
  try {
    localStorage.setItem(CHAVE_DAS_MARCAS, JSON.stringify(marcas));
    globalThis.dispatchEvent?.(new Event("lucia:estudo"));
    return true;
  } catch {
    return false;
  }
}

/**
 * Soma +1 anônimo, uma vez por período e aparelho. A marca é gravada antes do pedido: se o pedido falhar, não tenta de
 * novo no mesmo período (contar a menos é melhor do que contar duas vezes). Sem armazenamento, não conta, porque não
 * daria para segurar a repetição. Engole qualquer erro.
 */
export function contarEscola(tipo: TipoDaEscola, alvo: string, periodo: Periodo): void {
  if (!hasBackend || typeof window === "undefined") return;
  const hoje = new Date();
  const marcas = lerGuardado();
  if (!deveContar(marcas, tipo, alvo, periodo, hoje)) return;
  if (!guardar(marcar(marcas, tipo, alvo, periodo, hoje))) return;
  void rpc("contar_escola", { p_tipo: tipo, p_alvo: alvo }).catch(() => {});
}

/** Já contou este tipo e alvo neste período, neste aparelho? (Para a tela dizer "seu voto já foi somado".) */
export function jaContou(tipo: TipoDaEscola, alvo: string, periodo: Periodo): boolean {
  if (typeof window === "undefined") return false;
  const marcas = lerMarcas(lerGuardado());
  return marcas.length > 0 && !deveContar(marcas, tipo, alvo, periodo, new Date());
}

export interface ContagemDaEscola {
  alvo: string;
  total: number;
}

/** Os totais de um tipo nos últimos `dias` (1 a 400), em ordem de alvo. Prefixo 'AAAA.S/' para a assembleia. */
export async function lerContagensEscola(tipo: TipoDaEscola, dias = 30, prefixo?: string): Promise<ContagemDaEscola[]> {
  if (!hasBackend) return [];
  try {
    const lista = await rpc<{ alvo: string; total: number | string }[]>("escola_contagens", { p_tipo: tipo, p_dias: dias, p_prefixo: prefixo ?? null });
    return Array.isArray(lista) ? lista.map((l) => ({ alvo: String(l.alvo), total: Number(l.total) || 0 })) : [];
  } catch {
    return [];
  }
}

export interface PresencaDeHoje {
  aulasHoje: number;
  aulasTerminadas7d: number;
  matriculasMes: number;
}

let presenca: Promise<PresencaDeHoje | null> | null = null;

/** Os três números da presença somada. Um pedido por visita (memória do módulo); sem serviço ou com falha, null. */
export function presencaHoje(): Promise<PresencaDeHoje | null> {
  if (!hasBackend) return Promise.resolve(null);
  presenca ??= rpc<{ aulas_hoje?: number | string; aulas_terminadas_7d?: number | string; matriculas_mes?: number | string }>("escola_presenca_hoje")
    .then((r) => ({ aulasHoje: Number(r?.aulas_hoje) || 0, aulasTerminadas7d: Number(r?.aulas_terminadas_7d) || 0, matriculasMes: Number(r?.matriculas_mes) || 0 }))
    .catch(() => null);
  return presenca;
}

export interface TurmaDoCurso {
  inscritos: number;
  eu: boolean;
  sala: string | null;
  sensivel: boolean;
}

const turma = (r: Partial<TurmaDoCurso> | null): TurmaDoCurso => ({ inscritos: Number(r?.inscritos) || 0, eu: r?.eu === true, sala: typeof r?.sala === "string" ? r.sala : null, sensivel: r?.sensivel === true });

/** A turma de um curso num mês ('AAAA-MM'). Sem serviço ou com falha, null. */
export async function turmaDoCurso(mes: string, curso: string): Promise<TurmaDoCurso | null> {
  if (!hasBackend) return null;
  try {
    return turma(await rpc<Partial<TurmaDoCurso>>("turma_curso", { p_mes: mes, p_curso: curso }));
  } catch {
    return null;
  }
}

/**
 * Entrar na turma (ou sair, com entrar=false, que apaga o registro). Exige conta. No curso sensível, entrar só com
 * consentimento=true, dado pela pessoa num quadro destacado; sem ele, o banco recusa com 'consentimento'.
 * Sem serviço, null. Recusa do banco: lança BackendError com o código.
 */
export async function entrarNaTurmaDoCurso(mes: string, curso: string, entrar: boolean, consentimento = false): Promise<TurmaDoCurso | null> {
  if (!hasBackend) return null;
  return turma(await rpc<Partial<TurmaDoCurso>>("turma_curso_entrar", { p_mes: mes, p_curso: curso, p_entrar: entrar, p_consentimento: consentimento }));
}

/** As turmas de curso da conta logada. Sem conta, sem serviço ou com falha, lista vazia. */
export async function minhasTurmasDeCurso(): Promise<{ mes: string; curso: string }[]> {
  if (!hasBackend) return [];
  try {
    const lista = await rpc<{ mes: string; curso: string }[]>("turmas_curso_minhas");
    return Array.isArray(lista) ? lista.map((t) => ({ mes: String(t.mes), curso: String(t.curso) })) : [];
  } catch {
    return [];
  }
}

export type AssuntoDaOuvidoria = "aula" | "curso" | "educador" | "escola" | "outro";

export interface MensagemDaOuvidoria {
  sobre: AssuntoDaOuvidoria;
  /** Caminho da página no site ('/pt/trilhas/…'), opcional. */
  caminho?: string;
  /** De 10 a 3000 caracteres. */
  texto: string;
  /** Opcional: só se a pessoa quiser resposta particular. */
  contato?: string;
  /** Campo-isca: fica vazio para gente; robô preenche. */
  site?: string;
}

/** Manda à ouvidoria. Devolve o protocolo (8 caracteres). Sem serviço, null. Recusa do banco: lança BackendError. */
export async function ouvidoriaEnviar(dados: MensagemDaOuvidoria): Promise<{ ok: boolean; protocolo: string } | null> {
  if (!hasBackend) return null;
  const r = await rpc<{ ok?: boolean; protocolo?: string }>("ouvidoria_enviar", {
    p: { sobre: dados.sobre, caminho: dados.caminho ?? "", texto: dados.texto, contato: dados.contato ?? "", site: dados.site ?? "" },
  });
  return { ok: r?.ok === true, protocolo: typeof r?.protocolo === "string" ? r.protocolo : "" };
}

export interface RespostaPublicaDaOuvidoria {
  protocolo: string;
  sobre: AssuntoDaOuvidoria;
  resumo_publico: string;
  resposta_publica: string;
  respondida_em: string;
}

/** As respostas públicas da ouvidoria (só o resumo da mediação, nunca o texto de quem mandou). Sem serviço, vazio. */
export async function ouvidoriaPublicas(): Promise<RespostaPublicaDaOuvidoria[]> {
  if (!hasBackend) return [];
  try {
    const lista = await rpc<RespostaPublicaDaOuvidoria[]>("ouvidoria_publicas");
    return Array.isArray(lista) ? lista : [];
  } catch {
    return [];
  }
}
