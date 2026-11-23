// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As regras puras do grupo "organização e ação coletiva" (Prompt 4, itens 52 a 67 e 122), sem tela e sem banco. O banco decide de
// verdade quem vê, quem pode e o que sai (supabase/migracoes/20261127-p4-organizacao.sql); aqui ficam as contas que o aparelho faz
// sozinho (as datas das reuniões e o .ics, a rota sem internet, a denúncia coletiva, o rascunho da ata) e as conferências que a tela
// faz antes de chamar o banco. Sem "@/" de propósito (roda nos testes).
import type { Recurso } from "../../recursos";
import { linkDoMapa } from "../atos/chegar";

/** O interruptor do grupo (só pelo nome, desligado; o painel único liga). */
export const FLAG_DA_ORGANIZACAO: Recurso = "alumia-p4-organizacao";

/** A tela do grupo (lib/rede/rotas-novas.ts). */
export const ROTAS_DA_ORGANIZACAO = ["organizar"] as const;

/** Um número de pessoas para mostrar: nulo abaixo de 3 (o mesmo que interno.alumia_pessoas). */
export function pessoas(n: number | null | undefined): number | null {
  return typeof n === "number" && Number.isFinite(n) && n >= 3 ? Math.floor(n) : null;
}

/** Só link https sem usuário e senha na frente; outra coisa vira nulo. */
export function linkSeguro(link: string | null | undefined): string | null {
  if (!link) return null;
  try {
    const u = new URL(link);
    return u.protocol === "https:" && !u.username && !u.password && u.hostname.includes(".") ? u.toString() : null;
  } catch {
    return null;
  }
}

/** O @ de uma organização ou pessoa, como o banco aceita (sem o "@"). */
export function handleLimpo(s: string): string | null {
  const h = s.trim().replace(/^@/, "").toLowerCase();
  return /^[a-z0-9_]{3,20}$/.test(h) ? h : null;
}

// ── 122. Rodízio ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

export type Recorrencia = "semanal" | "quinzenal" | "mensal";

/** A próxima função da escala (a mesma conta do banco, interno.rede_p4_or_proxima_funcao): a seguinte, voltando ao começo. */
export function proximaFuncao(rodizio: readonly string[], atual: string | null): string | null {
  if (rodizio.length === 0) return atual;
  const i = atual ? rodizio.indexOf(atual) : -1;
  return i < 0 ? rodizio[0] : rodizio[(i + 1) % rodizio.length];
}

/** O prazo seguinte (AAAA-MM-DD) do cartão recorrente (a mesma conta do banco, interno.rede_p4_or_proximo_prazo). */
export function proximoPrazo(prazo: string, rec: Recorrencia): string {
  const [a, m, d] = prazo.split("-").map(Number);
  const data = new Date(Date.UTC(a, m - 1, d));
  if (rec === "mensal") {
    const alvo = new Date(Date.UTC(a, m, 1));
    const ultimo = new Date(Date.UTC(a, m + 1, 0)).getUTCDate();
    alvo.setUTCDate(Math.min(d, ultimo));
    return alvo.toISOString().slice(0, 10);
  }
  data.setUTCDate(data.getUTCDate() + (rec === "semanal" ? 7 : 14));
  return data.toISOString().slice(0, 10);
}

// ── 54. Reuniões recorrentes ─────────────────────────────────────────────────────────────────────────────────────────────────

export interface ReuniaoRecorrente {
  id: string;
  titulo: string;
  frequencia: Recorrencia;
  /** 0 = domingo ... 6 = sábado. */
  dia_semana: number;
  /** Só no mensal: a semana do mês (1 a 4, ou 5 = a última). */
  semana_do_mes: number | null;
  /** "HH:MM", hora de Brasília. */
  hora: string;
  duracao_min: number;
  local_tipo: string;
  local_texto: string;
  inicio: string;
  fim: string | null;
  lembrete_min: number;
}

/** O dia da semana (0..6) de uma data AAAA-MM-DD. */
const diaDaSemana = (a: number, m: number, d: number) => new Date(Date.UTC(a, m - 1, d)).getUTCDay();

/** O dia do mês da n-ésima (1..4) ou da última (5) ocorrência do dia da semana. */
function nesimoDoMes(a: number, m: number, dia: number, n: number): number {
  const primeiro = ((dia - diaDaSemana(a, m, 1) + 7) % 7) + 1;
  const ultimoDoMes = new Date(Date.UTC(a, m, 0)).getUTCDate();
  if (n >= 5) {
    let d = primeiro;
    while (d + 7 <= ultimoDoMes) d += 7;
    return d;
  }
  return primeiro + 7 * (n - 1);
}

const ymd = (d: Date) => d.toISOString().slice(0, 10);

/**
 * As próximas `quantas` datas (AAAA-MM-DD) da reunião a partir de `desde` (inclusive), respeitando o início e o fim. Puro: a mesma
 * conta que a agenda faz com a RRULE do .ics.
 */
export function proximasDatas(r: Pick<ReuniaoRecorrente, "frequencia" | "dia_semana" | "semana_do_mes" | "inicio" | "fim">, desde: string, quantas = 4): string[] {
  const saida: string[] = [];
  const base = r.inicio > desde ? r.inicio : desde;
  const [a0, m0, d0] = base.split("-").map(Number);
  if (r.frequencia === "mensal") {
    for (let i = 0; saida.length < quantas && i < 36; i++) {
      const alvo = new Date(Date.UTC(a0, m0 - 1 + i, 1));
      const a = alvo.getUTCFullYear();
      const m = alvo.getUTCMonth() + 1;
      const d = nesimoDoMes(a, m, r.dia_semana, r.semana_do_mes ?? 1);
      const data = ymd(new Date(Date.UTC(a, m - 1, d)));
      if (data < base) continue;
      if (r.fim && data > r.fim) break;
      saida.push(data);
    }
    return saida;
  }
  // Semanal e quinzenal: a primeira ocorrência a partir do início fixa a fase da quinzena.
  const [ai, mi, di] = r.inicio.split("-").map(Number);
  const primeira = new Date(Date.UTC(ai, mi - 1, di + ((r.dia_semana - diaDaSemana(ai, mi, di) + 7) % 7)));
  const passo = r.frequencia === "semanal" ? 7 : 14;
  const alvo = Date.UTC(a0, m0 - 1, d0);
  let atual = primeira.getTime();
  if (atual < alvo) atual += Math.ceil((alvo - atual) / (passo * 864e5)) * passo * 864e5;
  while (saida.length < quantas) {
    const data = ymd(new Date(atual));
    if (r.fim && data > r.fim) break;
    saida.push(data);
    atual += passo * 864e5;
  }
  return saida;
}

const SIGLA = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
const escaparIcs = (texto: string) => texto.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\r?\n/g, "\\n");

/** A regra de repetição do .ics (RFC 5545). */
export function rruleDaReuniao(r: Pick<ReuniaoRecorrente, "frequencia" | "dia_semana" | "semana_do_mes" | "fim">): string {
  const dia = SIGLA[r.dia_semana] ?? "MO";
  const ate = r.fim ? `;UNTIL=${r.fim.replace(/-/g, "")}T235959Z` : "";
  if (r.frequencia === "mensal") return `RRULE:FREQ=MONTHLY;BYDAY=${(r.semana_do_mes ?? 1) >= 5 ? -1 : r.semana_do_mes}${dia}${ate}`;
  return `RRULE:FREQ=WEEKLY${r.frequencia === "quinzenal" ? ";INTERVAL=2" : ""};BYDAY=${dia}${ate}`;
}

/**
 * O .ics da reunião recorrente, feito no aparelho: o evento com a regra de repetição, no fuso de Brasília (com o VTIMEZONE fixo em
 * UTC−3: sem horário de verão desde 2019), e o alarme escolhido. Sem nome de pessoa nenhuma: só a reunião, o tipo de lugar e o lugar.
 */
export function icsDaReuniao(r: ReuniaoRecorrente, agora: Date = new Date()): string {
  const primeira = proximasDatas({ ...r, fim: null }, r.inicio, 1)[0] ?? r.inicio;
  const [h, mi] = r.hora.split(":").map(Number);
  const local = (d: string, min: number) => {
    const t = new Date(Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10)), h, mi) + min * 60_000);
    return t.toISOString().slice(0, 19).replace(/[-:]/g, "");
  };
  const id = r.id.replace(/[^a-z0-9-]/gi, "");
  const linhas = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Instituto Lucia//Alumia reunioes//PT", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "BEGIN:VTIMEZONE", "TZID:America/Sao_Paulo", "BEGIN:STANDARD", "DTSTART:19700101T000000", `TZOFFSETFROM:-0300`, `TZOFFSETTO:-0300`, "TZNAME:-03", "END:STANDARD", "END:VTIMEZONE",
    "BEGIN:VEVENT",
    `UID:reuniao-${id}@alumia.institutolucia.org`,
    `DTSTAMP:${agora.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z")}`,
    `DTSTART;TZID=America/Sao_Paulo:${local(primeira, 0)}`,
    `DTEND;TZID=America/Sao_Paulo:${local(primeira, r.duracao_min)}`,
    rruleDaReuniao(r),
    `SUMMARY:${escaparIcs(r.titulo)}`,
    `LOCATION:${escaparIcs(r.local_texto)}`,
  ];
  if (r.lembrete_min > 0) linhas.push("BEGIN:VALARM", "ACTION:DISPLAY", `TRIGGER:-PT${r.lembrete_min}M`, `DESCRIPTION:${escaparIcs(r.titulo)}`, "END:VALARM");
  linhas.push("END:VEVENT", "END:VCALENDAR", "");
  return linhas.join("\r\n");
}

// ── 56. Banco de tempo ───────────────────────────────────────────────────────────────────────────────────────────────────────

/** Minutos em horas e minutos (o saldo e as trocas do banco de tempo). */
export function duracao(minutos: number): { h: number; min: number } {
  const m = Math.max(0, Math.round(Math.abs(minutos)));
  return { h: Math.floor(m / 60), min: m % 60 };
}

// ── 58. Pontos de apoio ──────────────────────────────────────────────────────────────────────────────────────────────────────

/** Os tipos de ponto de apoio (os mesmos do banco). */
export const TIPOS_DE_PONTO = ["cozinha", "biblioteca", "juridico", "agua", "saude", "abrigo", "outro"] as const;

/** O "como chegar" do ponto: o mesmo link do ato (OpenStreetMap com o endereço e a cidade, nada da pessoa). */
export function comoChegar(ponto: { endereco: string; cidade: string }): string {
  return linkDoMapa(ponto.endereco, ponto.cidade);
}

// ── 59. Rota do ato sem internet ─────────────────────────────────────────────────────────────────────────────────────────────

export type Coordenada = [number, number];
export interface ApoioDaRota {
  lat: number;
  lon: number;
  tipo: string;
  nome: string;
}
export interface RotaDoAto {
  pontos: Coordenada[];
  apoios: ApoioDaRota[];
  atualizada_dia?: string;
}
export interface AtoDaRota {
  id: string;
  titulo: string;
  inicio: string;
  cidade: string;
  ponto: string;
}
/** O que fica guardado no aparelho para ver sem internet: o ato e a rota. */
export interface RotaGuardada {
  ato: AtoDaRota;
  rota: RotaDoAto;
}

/** Os tipos de apoio no percurso (os mesmos do banco). */
export const TIPOS_DE_APOIO_DA_ROTA = ["encontro", "agua", "saude", "banheiro", "juridico", "dispersao", "outro"] as const;

/** Até `max` pontos, mantendo o primeiro, o último e a forma (um a cada tantos). */
export function reduzirPontos<T>(pontos: readonly T[], max = 300): T[] {
  if (pontos.length <= max) return [...pontos];
  const passo = (pontos.length - 1) / (max - 1);
  return Array.from({ length: max }, (_, i) => pontos[Math.round(i * passo)]);
}

const atributo = (tag: string, nome: string): number | null => {
  const m = new RegExp(`\\b${nome}\\s*=\\s*["']([-+]?\\d+(?:\\.\\d+)?)["']`).exec(tag);
  const n = m ? Number(m[1]) : NaN;
  return Number.isFinite(n) ? n : null;
};
const desescapar = (s: string) => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&").trim();

/**
 * Lê um GPX (o arquivo que os mapas livres exportam) no aparelho: os pontos da trilha ou da rota viram a rota (até 300) e os pontos
 * marcados (wpt) viram apoios (até 30), com o nome. Sem rede e sem biblioteca: só o texto do arquivo.
 */
export function gpxParaRota(texto: string): RotaDoAto {
  const pontos: Coordenada[] = [];
  const apoios: ApoioDaRota[] = [];
  const ok = (lat: number | null, lon: number | null): lat is number => lat !== null && lon !== null && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
  for (const m of texto.matchAll(/<(trkpt|rtept)\b[^>]*>/gi)) {
    const lat = atributo(m[0], "lat");
    const lon = atributo(m[0], "lon");
    if (ok(lat, lon)) pontos.push([lat, lon as number]);
  }
  for (const m of texto.matchAll(/<wpt\b([^>]*)>([\s\S]*?)<\/wpt>/gi)) {
    const lat = atributo(m[1], "lat");
    const lon = atributo(m[1], "lon");
    const nome = desescapar(/<name>([\s\S]*?)<\/name>/i.exec(m[2])?.[1] ?? "").slice(0, 80);
    if (ok(lat, lon) && nome.length >= 2 && apoios.length < 30) apoios.push({ lat, lon: lon as number, tipo: "outro", nome });
  }
  return { pontos: reduzirPontos(pontos, 300), apoios };
}

/** Lê "lat, lon" por linha (o que se copia de um mapa livre). Linha que não for coordenada é ignorada. */
export function linhasParaPontos(texto: string): Coordenada[] {
  const saida: Coordenada[] = [];
  for (const linha of texto.split(/\r?\n/)) {
    const m = /^\s*([-+]?\d{1,2}(?:\.\d+)?)\s*[,;\s]\s*([-+]?\d{1,3}(?:\.\d+)?)\s*$/.exec(linha);
    if (!m) continue;
    const lat = Number(m[1]);
    const lon = Number(m[2]);
    if (Math.abs(lat) <= 90 && Math.abs(lon) <= 180) saida.push([lat, lon]);
  }
  return reduzirPontos(saida, 300);
}

/** O comprimento da rota em quilômetros (haversine), com uma casa. */
export function distanciaKm(pontos: readonly Coordenada[]): number {
  const rad = Math.PI / 180;
  let soma = 0;
  for (let i = 1; i < pontos.length; i++) {
    const [la1, lo1] = pontos[i - 1];
    const [la2, lo2] = pontos[i];
    const a = Math.sin(((la2 - la1) * rad) / 2) ** 2 + Math.cos(la1 * rad) * Math.cos(la2 * rad) * Math.sin(((lo2 - lo1) * rad) / 2) ** 2;
    soma += 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(a)));
  }
  return Math.round(soma * 10) / 10;
}

/**
 * O desenho da rota numa caixa de `lado` × `lado` (com margem), sem mapa de fundo: a linha, o começo, o fim e os apoios numerados. A
 * longitude é encolhida pelo cosseno da latitude do meio, para a forma não sair esticada.
 */
export function desenhoDaRota(rota: RotaDoAto, lado = 320, margem = 24): { linha: string; inicio: [number, number]; fim: [number, number]; apoios: { x: number; y: number; n: number }[] } | null {
  if (rota.pontos.length < 2) return null;
  const todos: Coordenada[] = [...rota.pontos, ...rota.apoios.map((a): Coordenada => [a.lat, a.lon])];
  const lats = todos.map((p) => p[0]);
  const lons = todos.map((p) => p[1]);
  const meio = ((Math.min(...lats) + Math.max(...lats)) / 2) * (Math.PI / 180);
  const fx = Math.cos(meio);
  const x0 = Math.min(...lons) * fx;
  const y1 = Math.max(...lats);
  const largura = Math.max(Math.max(...lons) * fx - x0, 1e-6);
  const altura = Math.max(y1 - Math.min(...lats), 1e-6);
  const escala = (lado - 2 * margem) / Math.max(largura, altura);
  const xy = ([lat, lon]: Coordenada): [number, number] => [
    Math.round((margem + (lon * fx - x0) * escala + ((lado - 2 * margem) - largura * escala) / 2) * 10) / 10,
    Math.round((margem + (y1 - lat) * escala + ((lado - 2 * margem) - altura * escala) / 2) * 10) / 10,
  ];
  const linha = rota.pontos.map((p) => xy(p).join(",")).join(" ");
  return { linha, inicio: xy(rota.pontos[0]), fim: xy(rota.pontos[rota.pontos.length - 1]), apoios: rota.apoios.map((a, i) => { const [x, y] = xy([a.lat, a.lon]); return { x, y, n: i + 1 }; }) };
}

/** A chave do aparelho (começa com "lucia:rede", então o Sair rápido apaga junto). */
export const CHAVE_DAS_ROTAS = "lucia:rede:organizar:rotas";

/** As rotas guardadas neste aparelho (até 10), sem as de ato que passou há mais de 2 dias. Nunca lança. */
export function lerRotasGuardadas(guarda: Pick<Storage, "getItem"> | null | undefined, agora = Date.now()): RotaGuardada[] {
  try {
    const lista = JSON.parse(guarda?.getItem(CHAVE_DAS_ROTAS) ?? "[]") as RotaGuardada[];
    if (!Array.isArray(lista)) return [];
    return lista.filter((r) => r && r.ato && typeof r.ato.id === "string" && Array.isArray(r.rota?.pontos) && new Date(r.ato.inicio).getTime() > agora - 2 * 864e5).slice(0, 10);
  } catch {
    return [];
  }
}

/** Guarda (ou troca) a rota de um ato neste aparelho; devolve a lista nova. Nunca lança. */
export function guardarRota(guarda: Pick<Storage, "getItem" | "setItem"> | null | undefined, r: RotaGuardada, agora = Date.now()): RotaGuardada[] {
  const lista = [r, ...lerRotasGuardadas(guarda, agora).filter((x) => x.ato.id !== r.ato.id)].slice(0, 10);
  try {
    guarda?.setItem(CHAVE_DAS_ROTAS, JSON.stringify(lista));
  } catch {
    // sem espaço ou sem acesso: fica só na tela
  }
  return lista;
}

/** Esquece a rota de um ato neste aparelho. */
export function esquecerRota(guarda: Pick<Storage, "getItem" | "setItem"> | null | undefined, ato: string, agora = Date.now()): RotaGuardada[] {
  const lista = lerRotasGuardadas(guarda, agora).filter((x) => x.ato.id !== ato);
  try {
    guarda?.setItem(CHAVE_DAS_ROTAS, JSON.stringify(lista));
  } catch {
    // sem acesso
  }
  return lista;
}

// ── 61. Orçamento participativo ──────────────────────────────────────────────────────────────────────────────────────────────

/** Um valor em reais escrito pela pessoa ("1.500,00", "R$ 30", "12.5") em centavos; nulo se não for um valor. */
export function centavosDoTexto(texto: string): number | null {
  let v = texto.replace(/R\$|\s/gi, "");
  if (!/^\d[\d.,]*$/.test(v)) return null;
  if (v.includes(",")) v = v.replace(/\./g, "").replace(",", ".");
  else if (!/\.\d{1,2}$/.test(v)) v = v.replace(/\./g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(v)) return null;
  const c = Math.round(Number(v) * 100);
  return Number.isSafeInteger(c) && c > 0 ? c : null;
}

// ── 64. Termômetro do território ─────────────────────────────────────────────────────────────────────────────────────────────

export type TipoDeLugar = "ubs" | "escola" | "onibus" | "iluminacao";
export const TIPOS_DE_LUGAR: readonly TipoDeLugar[] = ["ubs", "escola", "onibus", "iluminacao"];

/** Os problemas de cada tipo de lugar (a mesma lista fechada de interno.rede_p4_or_problemas_do_tipo). */
export const PROBLEMAS_DO_LUGAR: Record<TipoDeLugar, readonly string[]> = {
  ubs: ["falta_medico", "falta_remedio", "demora", "fechada", "atendimento"],
  escola: ["falta_professor", "estrutura", "merenda", "seguranca", "vagas"],
  onibus: ["atraso", "lotacao", "pouca_frota", "seguranca", "acessibilidade"],
  iluminacao: ["apagada", "piscando", "ausente", "risco"],
};

export interface LugarDoTermometro {
  id: string;
  tipo: TipoDeLugar;
  nome: string;
  municipio: string;
  uf: string;
  periodo: string;
  avaliei: boolean;
  /** Só com 3 avaliações ou mais; cada problema só a partir de 3. */
  resultado: { avaliacoes: number; nota: number | string; problemas: Record<string, number> } | null;
}

/**
 * O texto da denúncia coletiva, feito no aparelho a partir do agregado (nada de quem avaliou): o modelo com {lugar}, {tipo},
 * {municipio}, {uf}, {nota}, {n} e {problemas}. Sem agregado (menos de 3 avaliações), não há denúncia.
 */
export function denunciaColetiva(l: LugarDoTermometro, t: { tipos: Record<string, string>; problemas: Record<string, string>; modelo: string }): string | null {
  if (!l.resultado || l.resultado.avaliacoes < 3) return null;
  const problemas = Object.entries(l.resultado.problemas).filter(([, n]) => n >= 3).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${t.problemas[k] ?? k} (${n})`).join(", ");
  const valores: Record<string, string> = {
    lugar: l.nome, tipo: t.tipos[l.tipo] ?? l.tipo, municipio: l.municipio, uf: l.uf, nota: String(Number(l.resultado.nota)), n: String(l.resultado.avaliacoes), problemas: problemas || "—",
  };
  return t.modelo.replace(/\{(\w+)\}/g, (_, k: string) => valores[k] ?? "");
}

// ── 65. Apoio direto ─────────────────────────────────────────────────────────────────────────────────────────────────────────

/** A chave Pix aleatória (32 algarismos hexadecimais com hífens), em minúsculas; outra coisa (CPF, telefone, e-mail) vira nula. */
export function chavePixAleatoria(chave: string | null | undefined): string | null {
  const c = (chave ?? "").trim().toLowerCase();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(c) ? c : null;
}

// ── 66. Pedir checagem ao Instituto ──────────────────────────────────────────────────────────────────────────────────────────

/** O botão "Pedir checagem" só aparece para post aberto à internet (o banco confere de novo, como visitante). */
export function podePedirChecagem(post: { publico?: string | null; cifrado?: boolean | null }): boolean {
  return post.publico === "internet" && !post.cifrado;
}

// ── 67. Ata assistida ────────────────────────────────────────────────────────────────────────────────────────────────────────

/** As frases que abrem um encaminhamento na fala (o rascunho junta essas frases no fim da ata). */
const ENCAMINHAMENTO = /^(encaminhamento|encaminhamos|decidimos|ficou decidido|fica decidido|a tarefa|vamos fazer|combinamos)\b/i;

/** O texto transcrito em frases (pelo ponto, exclamação, interrogação ou quebra de linha), sem espaço sobrando. */
export function frasesDaFala(texto: string): string[] {
  return texto.replace(/\s+/g, " ").split(/(?<=[.!?])\s+|\n+/).map((f) => f.trim()).filter((f) => f.length > 1);
}

/**
 * O rascunho de ata, feito no aparelho a partir da transcrição: o título, a data, a pauta (se houver), as falas em parágrafos de até
 * 4 frases e os encaminhamentos achados na fala. Sem nome de ninguém: a ata não tem lista de presença (o campo pede só quantas
 * pessoas). Quem conduz revisa e corrige antes de usar.
 */
export function rascunhoDeAta(transcricao: string, d: { titulo: string; data: string; pauta?: string; rotulos: { data: string; pessoas: string; pauta: string; falas: string; encaminhamentos: string; nenhum: string; aviso: string } }): string {
  const frases = frasesDaFala(transcricao);
  const encaminhamentos = frases.filter((f) => ENCAMINHAMENTO.test(f));
  const paragrafos: string[] = [];
  for (let i = 0; i < frases.length; i += 4) paragrafos.push(frases.slice(i, i + 4).join(" "));
  const r = d.rotulos;
  return [
    d.titulo.trim(),
    `${r.data}: ${d.data}`,
    `${r.pessoas}: ___`,
    "",
    ...(d.pauta?.trim() ? [`${r.pauta}:`, d.pauta.trim(), ""] : []),
    `${r.falas}:`,
    ...(paragrafos.length ? paragrafos : [r.nenhum]),
    "",
    `${r.encaminhamentos}:`,
    ...(encaminhamentos.length ? encaminhamentos.map((e) => `- ${e}`) : [`- ${r.nenhum}`]),
    "",
    r.aviso,
    "",
  ].join("\n");
}
