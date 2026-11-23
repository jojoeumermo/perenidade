// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As regras do aparelho do grupo "conta, identidade e convivência" (Prompt 4, Parte H). Nada aqui fala com o servidor: são contas
// puras, que o teste (scripts/testar-p4-conta.mjs) prova no Node.
//   79  Releia antes de enviar: o texto parece agressivo? (uma lista curta, no aparelho; nada vai a lugar nenhum)
//   107 Níveis de proteção: o tour por tipo de risco sugere um nível
//   108 Checkup de privacidade: os passos da revisão e quando é hora de fazer de novo
//   111 Respostas rápidas: arrumar a lista guardada no aparelho
//   112 Horário de atendimento: a conta "fora do horário" (a mesma do banco) e o horário por extenso
// Sem "@/" de propósito.

// ── 79. Releia antes de enviar ──

/**
 * Palavras e expressões que costumam ferir, em português (o idioma da Alumia) e nas formas mais comuns em inglês e espanhol. É uma
 * lista curta de propósito: o aviso é um convite a reler, nunca um bloqueio, e erra para o lado de não avisar.
 */
const OFENSAS = [
  "idiota", "imbecil", "burra", "burro", "otaria", "otario", "otária", "otário", "babaca", "escrota", "escroto", "vagabunda", "vagabundo",
  "lixo humano", "retardada", "retardado", "nojenta", "nojento", "ridicula", "ridiculo", "ridícula", "ridículo", "desgraçada", "desgraçado",
  "desgracada", "desgracado", "arrombada", "arrombado", "piranha", "puta", "filha da puta", "filho da puta", "fdp", "vai se foder",
  "vai tomar no", "cala a boca", "cala boca", "some daqui", "se mata", "morre", "merda", "porra", "caralho", "cuzão", "cuzao", "pau no cu",
  "estúpida", "estúpido", "estupida", "estupido", "anta", "jumenta", "jumento", "palhaça", "palhaço", "palhaca", "palhaco",
  "idiot", "stupid", "moron", "shut up", "kill yourself", "go die", "fuck you", "bitch",
  "pendeja", "pendejo", "estúpida", "imbécil", "cállate", "callate", "hijo de puta",
];
const SEM_ACENTO = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const LISTA = [...new Set(OFENSAS.map(SEM_ACENTO))];

export type MotivoDoReleia = "palavra" | "gritando" | "exclamacoes";

/**
 * O texto parece agressivo? Devolve os motivos (vazio = não). Conta: palavra da lista (inteira, sem acento), texto em maiúsculas
 * (a partir de 12 letras, mais de 70% maiúsculas) e três ou mais pontos de exclamação seguidos. Só no aparelho.
 */
export function pareceAgressivo(texto: string): MotivoDoReleia[] {
  const t = String(texto ?? "");
  const motivos: MotivoDoReleia[] = [];
  const limpo = ` ${SEM_ACENTO(t).replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ")} `;
  if (LISTA.some((p) => limpo.includes(` ${p} `))) motivos.push("palavra");
  const letras = t.replace(/[^A-Za-zÀ-ÿ]/g, "");
  if (letras.length >= 12 && letras.replace(/[^A-ZÀ-Þ]/g, "").length / letras.length > 0.7) motivos.push("gritando");
  if (/!{3,}/.test(t)) motivos.push("exclamacoes");
  return motivos;
}

// ── 107. O tour por tipo de risco ──

export type Nivel = "basico" | "reforcado" | "maximo";
export const NIVEIS: readonly Nivel[] = ["basico", "reforcado", "maximo"];
export type Risco = "comeco" | "exposta" | "perseguida" | "ato";
export const RISCOS: readonly Risco[] = ["comeco", "exposta", "perseguida", "ato"];

/** O nível que o tour sugere para cada tipo de risco (a pessoa sempre escolhe; a sugestão só marca um). */
export function nivelDoRisco(r: Risco): Nivel {
  if (r === "perseguida") return "maximo";
  if (r === "exposta" || r === "ato") return "reforcado";
  return "basico";
}

// ── 108. Checkup de privacidade ──

/** Os passos da revisão guiada, na ordem. Cada um leva a uma tela que já existe. */
export const PASSOS_DO_CHECKUP = ["nivel", "mencoes", "perfil", "aparelhos", "fediverso", "sair_rapido", "dados"] as const;
export type PassoDoCheckup = (typeof PASSOS_DO_CHECKUP)[number];

/** A cada quantos dias o checkup volta a ser sugerido. */
export const DIAS_DO_CHECKUP = 90;

/** É hora de fazer o checkup de novo? (nunca feito, ou feito há DIAS_DO_CHECKUP dias ou mais). Data em ISO ou nula. */
export function hojeTemCheckup(ultimo: string | null, agora: number = Date.now()): boolean {
  if (!ultimo) return true;
  const t = Date.parse(ultimo);
  if (!Number.isFinite(t)) return true;
  return agora - t >= DIAS_DO_CHECKUP * 86_400_000;
}

// ── 111. Respostas rápidas ──

export const MAX_RESPOSTAS = 12;
export const MAX_LETRAS_DA_RESPOSTA = 500;

/** Arruma a lista guardada: só texto, sem vazias nem repetidas, cada uma até 500 letras, no máximo 12. */
export function arrumarRespostas(bruto: unknown): string[] {
  if (!Array.isArray(bruto)) return [];
  const saida: string[] = [];
  for (const x of bruto) {
    if (typeof x !== "string") continue;
    const t = x.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim().slice(0, MAX_LETRAS_DA_RESPOSTA);
    if (t && !saida.includes(t)) saida.push(t);
    if (saida.length >= MAX_RESPOSTAS) break;
  }
  return saida;
}

// ── 112. Horário de atendimento ──

/** Como o banco guarda: dias 0..6 (0 = domingo), "de" e "até" em minutos do dia (São Paulo). */
export interface Atendimento {
  dias: number[];
  de: number;
  ate: number;
}

/** "HH:MM" → minutos; nulo se não for uma hora válida. */
export function minutosDe(hhmm: string): number | null {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm.trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/** Minutos → "HH:MM". */
export function horaDe(minutos: number): string {
  const h = Math.floor(minutos / 60) % 24;
  const m = minutos % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** O dia da semana e os minutos de agora no relógio de São Paulo. */
export function agoraEmSaoPaulo(em: Date = new Date()): { dia: number; minutos: number } {
  const partes = new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(em);
  const v = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? "";
  const dia = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(v("weekday"));
  return { dia, minutos: Number(v("hour")) * 60 + Number(v("minute")) };
}

/** Fora do horário? A mesma conta do banco (interno.rede_p4_ct_fora): atravessa a meia-noite quando "de" > "até". */
export function foraDoHorario(a: Atendimento | null, em: Date = new Date()): boolean | null {
  if (!a) return null;
  const { dia, minutos } = agoraEmSaoPaulo(em);
  const ontem = (dia + 6) % 7;
  if (a.de < a.ate) return !(a.dias.includes(dia) && minutos >= a.de && minutos < a.ate);
  return !((a.dias.includes(dia) && minutos >= a.de) || (a.dias.includes(ontem) && minutos < a.ate));
}
