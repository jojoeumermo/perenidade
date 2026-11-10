// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O B1 dos atos no cliente: tarefas, caronas e petição (supabase/migracoes/20261110-alumia-b1-atos.sql). Desconfia do que vem do
// servidor (uma função com defeito não consegue pôr um codinome nem um número de pessoas na tela de quem não organiza) e confere
// os campos com os MESMOS limites do banco, para a pessoa ver o problema antes de mandar. Puro; sem "@/" (roda no Node nos testes).
import { LIMITES_DO_ATO, MEIOS_DA_CARONA, type CaronaDoAto, type MeioDaCarona, type PeticaoDoAto, type QuadroDeTarefas, type TarefaDoAto } from "../tipos-atos";

const inteiro = (n: unknown, min: number, max: number): number | null =>
  typeof n === "number" && Number.isInteger(n) && n >= min && n <= max ? n : null;

/** As tarefas como a tela pode mostrar: `quem` e `assumidas` só sobram para quem organiza. */
export function limparTarefas(q: QuadroDeTarefas | null | undefined): QuadroDeTarefas {
  const organiza = q?.organiza === true;
  const tarefas = Array.isArray(q?.tarefas) ? q.tarefas : [];
  return {
    organiza,
    tarefas: tarefas
      .filter((t): t is TarefaDoAto => !!t && typeof t.id === "string" && typeof t.item === "string")
      .map((t) => ({
        id: t.id,
        item: t.item,
        quantos: inteiro(t.quantos, 1, LIMITES_DO_ATO.tarefaQuantosMax) ?? 1,
        completa: t.completa === true,
        eu: t.eu === true,
        assumidas: organiza ? inteiro(t.assumidas, 0, 10_000) : null,
        quem: organiza && Array.isArray(t.quem) ? t.quem.filter((x): x is string => typeof x === "string").slice(0, 50) : null,
      })),
  };
}

const MEIOS = new Set<string>(MEIOS_DA_CARONA);

/** As caronas como a tela pode mostrar (nunca quem; só "é minha"). */
export function limparCaronas(lista: CaronaDoAto[] | null | undefined): CaronaDoAto[] {
  return (Array.isArray(lista) ? lista : [])
    .filter((k) => !!k && typeof k.id === "string" && typeof k.saida === "string" && (k.tipo === "oferta" || k.tipo === "pedido"))
    .map((k) => ({
      id: k.id,
      tipo: k.tipo,
      meio: (MEIOS.has(k.meio) ? k.meio : "outro") as MeioDaCarona,
      saida: k.saida,
      vagas: inteiro(k.vagas, 0, LIMITES_DO_ATO.vagasMax),
      sai_em: typeof k.sai_em === "string" ? k.sai_em : null,
      minha: k.minha === true,
      apagar: k.apagar === true,
    }));
}

/** A petição como a tela pode mostrar: total só a partir de 3; nada de lista. */
export function limparPeticao(p: PeticaoDoAto | null | undefined): PeticaoDoAto | null {
  if (!p || typeof p.id !== "string") return null;
  const total = typeof p.total === "number" && Number.isInteger(p.total) && p.total >= 3 ? p.total : null;
  return {
    id: p.id,
    ato: String(p.ato ?? ""),
    alvo: String(p.alvo ?? ""),
    texto: String(p.texto ?? ""),
    prazo: typeof p.prazo === "string" ? p.prazo : null,
    aberta: p.aberta === true,
    total,
    assinei: p.assinei === true,
    organiza: p.organiza === true,
  };
}

/**
 * Parece telefone, e-mail, documento ou endereço com número? A MESMA ideia de interno.rede3_pub_dado_pessoal (o servidor confere
 * de novo; aqui é só para avisar antes). Também pega telefone sem DDD ("98888-7777"), que numa carona é contato exposto.
 */
export function pareceDadoPessoal(texto: string): boolean {
  const t = texto ?? "";
  return (
    /\d{3}\.?\d{3}\.?\d{3}-?\d{2}/.test(t) ||
    /\(?\d{2}\)?\s?9\d{4}[-\s]?\d{4}/.test(t) ||
    /\d{4,5}[-\s]?\d{4}/.test(t) ||
    /[a-z0-9._%+-]+@[a-z0-9-]+\.[a-z.]{2,}/i.test(t) ||
    /\b(rua|avenida|av|travessa|alameda|rodovia|estrada|praça|praca|largo|beco|viela)\b[^\n,.]{2,60}(,\s*|\s+n[ºo°]\.?\s*)\d{1,5}\b/i.test(t)
  );
}

export type ProblemaDoCampo = "vazio" | "curto" | "longo" | "numero" | "dado_pessoal" | "passado";

const tamanho = (s: string, min: number, max: number): ProblemaDoCampo | null => {
  const v = s.replace(/\s+/g, " ").trim();
  if (!v) return "vazio";
  if (v.length < min) return "curto";
  if (v.length > max) return "longo";
  return null;
};

/** Confere uma tarefa antes de mandar. */
export function conferirTarefa(item: string, quantos: number): { item?: ProblemaDoCampo; quantos?: ProblemaDoCampo } {
  const L = LIMITES_DO_ATO;
  const p: { item?: ProblemaDoCampo; quantos?: ProblemaDoCampo } = {};
  const t = tamanho(item, L.tarefaMin, L.tarefaMax) ?? (pareceDadoPessoal(item) ? "dado_pessoal" : null);
  if (t) p.item = t;
  if (inteiro(quantos, 1, L.tarefaQuantosMax) === null) p.quantos = "numero";
  return p;
}

/** Confere uma carona antes de mandar. `vagas` vazio vale (não disse). */
export function conferirCarona(saida: string, vagas: number | null): { saida?: ProblemaDoCampo; vagas?: ProblemaDoCampo } {
  const L = LIMITES_DO_ATO;
  const p: { saida?: ProblemaDoCampo; vagas?: ProblemaDoCampo } = {};
  const s = tamanho(saida, L.saidaMin, L.saidaMax) ?? (pareceDadoPessoal(saida) ? "dado_pessoal" : null);
  if (s) p.saida = s;
  if (vagas !== null && inteiro(vagas, 1, L.vagasMax) === null) p.vagas = "numero";
  return p;
}

/** Confere a petição antes de mandar. */
export function conferirPeticao(alvo: string, texto: string, prazo: string | null, agora = Date.now()): { alvo?: ProblemaDoCampo; texto?: ProblemaDoCampo; prazo?: ProblemaDoCampo } {
  const L = LIMITES_DO_ATO;
  const p: { alvo?: ProblemaDoCampo; texto?: ProblemaDoCampo; prazo?: ProblemaDoCampo } = {};
  const a = tamanho(alvo, L.alvoMin, L.alvoMax) ?? (pareceDadoPessoal(alvo) ? "dado_pessoal" : null);
  if (a) p.alvo = a;
  const t = tamanho(texto, L.peticaoMin, L.peticaoMax) ?? (pareceDadoPessoal(texto) ? "dado_pessoal" : null);
  if (t) p.texto = t;
  if (prazo) {
    const ms = Date.parse(prazo);
    if (!Number.isFinite(ms) || ms <= agora || ms > agora + L.diasMax * 86_400_000) p.prazo = "passado";
  }
  return p;
}

/** A meta escrita no campo ("" = sem meta). Devolve o número, nulo (sem meta) ou "numero" quando não serve. */
export function lerMeta(texto: string): number | null | "numero" {
  const v = texto.replace(/[.\s]/g, "").trim();
  if (!v) return null;
  if (!/^\d+$/.test(v)) return "numero";
  const n = Number(v);
  return n >= LIMITES_DO_ATO.metaMin && n <= LIMITES_DO_ATO.metaMax ? n : "numero";
}

/** O link de apoio escrito no campo ("" = sem link). Só https, até 300, sem telefone. */
export function lerLinkDeApoio(texto: string): string | null | "link" {
  const v = texto.trim();
  if (!v) return null;
  // A mesma conferência do banco (rede_ato_editar): CPF e telefone com DDD; números soltos num link são comuns e passam.
  if (!/^https:\/\/[^\s<>"']{4,}$/.test(v) || v.length > LIMITES_DO_ATO.linkMax || /\d{3}\.?\d{3}\.?\d{3}-?\d{2}|\(?\d{2}\)?\s?9\d{4}[-\s]?\d{4}/.test(v)) return "link";
  return v;
}
