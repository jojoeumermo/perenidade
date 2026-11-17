// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As regras da agenda de provas (L2-48) e da monitoria marcada (L2-47), frente 11C: as mesmas de
// supabase/migracoes/20261117-alumia-o11-turma.sql. Puro: sem React e sem chamada ao banco (scripts/testar-alumia-o11-turma.mjs
// importa daqui e confere com o SQL). Sem os atalhos "@/" de propósito.
//
// O arquivo de agenda (.ics) nasce no aparelho: nada é enviado a serviço nenhum. As datas do ENEM que a coordenação traz para a
// agenda saem de content/escola/exames.json, o mesmo arquivo do calendário da Escola (que já sai de content/enem/edicao.yml, com
// a fonte do Inep em cada data): um só lugar de verdade.

import examesDoSite from "../../../../content/escola/exames.json";

/** As disciplinas da monitoria (a mesma lista da regra da tabela e de interno.alumia_o11t_disciplinas). */
export const DISCIPLINAS = ["matematica", "linguagens", "redacao", "humanas", "natureza"] as const;
export type Disciplina = (typeof DISCIPLINAS)[number];

export const LIMITES_DA_AGENDA = {
  exameMin: 2,
  exame: 60,
  etapaMin: 3,
  etapa: 160,
  orgaoMin: 2,
  orgao: 60,
  fonte: 500,
  assinaturas: 60,
  /** Os avisos: quantos dias antes. */
  avisos: [7, 1],
} as const;

export const LIMITES_DA_MONITORIA = {
  duracaoMin: 15,
  duracao: 120,
  vagasMin: 1,
  vagas: 5,
  nota: 200,
  duvida: 200,
  /** Quantos horários marcados à frente uma pessoa pode ter. */
  marcasAFrente: 3,
  /** Quantos horários à frente um monitor pode oferecer. */
  horarios: 30,
  /** De 1 hora a 60 dias à frente. */
  horasAntesMin: 1,
  diasAFrente: 60,
  /** O lembrete sai uma hora antes. */
  lembreteMinutos: 60,
} as const;

/** As durações que a tela oferece (em minutos). */
export const DURACOES = [30, 45, 60, 90, 120] as const;

export interface DataDaAgenda {
  id: string;
  exame: string;
  etapa: string;
  /** AAAA-MM-DD */
  dia: string;
  /** "HH:MM" (horário de Brasília) ou nulo (o dia inteiro). */
  hora: string | null;
  orgao: string;
  fonte: string;
  conferido_em: string;
  assinada: boolean;
}

export interface AgendaDeProvas {
  pode_cuidar: boolean;
  hoje: string;
  itens: DataDaAgenda[];
}

export interface DadosDaData {
  exame: string;
  etapa: string;
  dia: string;
  hora: string;
  orgao: string;
  fonte: string;
  conferido_em: string;
}

export interface PessoaDaMonitoria {
  nome: string;
  handle: string | null;
}

export interface JanelaDeMonitoria {
  id: string;
  disciplina: Disciplina;
  inicio: string;
  duracao: number;
  sala: "conversa" | "aula";
  /** O id da aula ao vivo: só no horário que a pessoa já marcou (na lista dos abertos, a aula diria quem é o monitor). */
  aula: string | null;
  nota: string;
  cancelada: boolean;
}

export interface JanelaMarcada extends JanelaDeMonitoria {
  monitor: PessoaDaMonitoria;
  duvida: string;
}

export interface JanelaMinha extends JanelaDeMonitoria {
  vagas: number;
  marcas: (PessoaDaMonitoria & { duvida: string })[];
}

export interface AulaMinha {
  id: string;
  titulo: string;
  inicio: string;
}

export interface Monitoria {
  pode_nomear: boolean;
  eu: { situacao: "convidado" | "ativo"; disciplinas: Disciplina[] } | null;
  abertas: JanelaDeMonitoria[];
  marcadas: JanelaMarcada[];
  minhas: JanelaMinha[];
  aulas: AulaMinha[];
}

export interface Monitor extends PessoaDaMonitoria {
  disciplinas: Disciplina[];
  situacao: "convidado" | "ativo";
}

/** A fonte serve? Só endereço https completo, como a regra do banco. */
export function fonteValida(url: string): boolean {
  const u = url.trim();
  return u.length <= LIMITES_DA_AGENDA.fonte && /^https:\/\/[^\s<>"]{3,}$/.test(u);
}

/** Quantos dias faltam (negativo: já passou). Datas AAAA-MM-DD. */
export function diasEntre(hoje: string, dia: string): number {
  const ms = (d: string) => {
    const [a, m, x] = d.split("-").map(Number);
    return Date.UTC(a, m - 1, x);
  };
  return Math.round((ms(dia) - ms(hoje)) / 86_400_000);
}

/** As datas agrupadas por prova, na ordem do dia. */
export function porExame(datas: readonly DataDaAgenda[]): { exame: string; datas: DataDaAgenda[] }[] {
  const grupos = new Map<string, DataDaAgenda[]>();
  for (const d of [...datas].sort((a, b) => a.dia.localeCompare(b.dia) || (a.hora ?? "").localeCompare(b.hora ?? ""))) {
    const lista = grupos.get(d.exame) ?? [];
    lista.push(d);
    grupos.set(d.exame, lista);
  }
  return [...grupos].map(([exame, lista]) => ({ exame, datas: lista }));
}

interface ExameDoSite {
  exame: string;
  edicao: number;
  etapa: string;
  data: string;
  fonte: string;
  orgao: string;
  consultadoEm: string;
}

/**
 * As datas do ENEM do site (content/escola/exames.json) no formato da agenda, de hoje em diante. A coordenação as traz com um
 * botão; escrever de novo a mesma prova, etapa e dia só atualiza a fonte (o banco não duplica).
 */
export function datasDoSite(hoje: string, exames: readonly ExameDoSite[] = (examesDoSite as { exames: ExameDoSite[] }).exames): DadosDaData[] {
  return exames
    .filter((e) => e.data >= hoje && fonteValida(e.fonte))
    .map((e) => ({ exame: `${e.exame} ${e.edicao}`, etapa: e.etapa, dia: e.data, hora: "", orgao: e.orgao, fonte: e.fonte, conferido_em: e.consultadoEm }));
}

// ───────────────────────── O arquivo de agenda (.ics) ─────────────────────────

const dois = (n: number) => String(n).padStart(2, "0");
const escapar = (texto: string) => texto.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\r?\n/g, "\\n");
function dobrar(linha: string): string {
  const partes: string[] = [];
  let resto = linha;
  while (resto.length > 75) {
    partes.push(resto.slice(0, 75));
    resto = ` ${resto.slice(75)}`;
  }
  partes.push(resto);
  return partes.join("\r\n");
}
const utc = (d: Date) => `${d.getUTCFullYear()}${dois(d.getUTCMonth() + 1)}${dois(d.getUTCDate())}T${dois(d.getUTCHours())}${dois(d.getUTCMinutes())}00Z`;
const compacta = (dia: string) => dia.replace(/-/g, "");
const uid = (texto: string) => texto.replace(/[^a-z0-9-]/gi, "-");

/** Dia e hora de Brasília (UTC−3, sem horário de verão desde 2019) como instante. */
export function instanteDeBrasilia(dia: string, hora: string): Date {
  const [a, m, d] = dia.split("-").map(Number);
  const [h, min] = hora.split(":").map(Number);
  return new Date(Date.UTC(a, m - 1, d, h + 3, min));
}

function eventoDaData(d: DataDaAgenda, carimbo: string, url: string): string[] {
  const titulo = `${d.exame} · ${d.etapa}`;
  const descricao = `Fonte oficial (${d.orgao}): ${d.fonte}\nConferida em ${d.conferido_em.split("-").reverse().join("/")}.\n${url}`;
  const quando = d.hora
    ? (() => {
        const inicio = instanteDeBrasilia(d.dia, d.hora);
        return [`DTSTART:${utc(inicio)}`, `DTEND:${utc(new Date(inicio.getTime() + 60 * 60_000))}`];
      })()
    : (() => {
        const [a, m, x] = d.dia.split("-").map(Number);
        const fim = new Date(Date.UTC(a, m - 1, x + 1));
        return [`DTSTART;VALUE=DATE:${compacta(d.dia)}`, `DTEND;VALUE=DATE:${fim.getUTCFullYear()}${dois(fim.getUTCMonth() + 1)}${dois(fim.getUTCDate())}`];
      })();
  return [
    "BEGIN:VEVENT",
    `UID:alumia-agenda-${uid(d.id)}@institutolucia.org`,
    `DTSTAMP:${carimbo}`,
    ...quando,
    dobrar(`SUMMARY:${escapar(titulo)}`),
    dobrar(`DESCRIPTION:${escapar(descricao)}`),
    dobrar(`URL:${d.fonte}`),
    "TRANSP:TRANSPARENT",
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    dobrar(`DESCRIPTION:${escapar(titulo)}`),
    "TRIGGER:-P1D",
    "END:VALARM",
    "END:VEVENT",
  ];
}

function calendario(eventos: string[][], nome: string): string {
  return ["BEGIN:VCALENDAR", "VERSION:2.0", `PRODID:-//Instituto Lucia//${nome}//PT`, "CALSCALE:GREGORIAN", ...eventos.flat(), "END:VCALENDAR", ""].join("\r\n");
}

/** O arquivo de agenda de uma ou mais datas (o mesmo arquivo baixado de novo substitui o anterior na agenda: o UID é fixo). */
export function icsDasDatas(datas: readonly DataDaAgenda[], url: string, agora: Date = new Date()): string {
  if (datas.length === 0) throw new RangeError("nenhuma data para a agenda");
  const carimbo = utc(agora);
  return calendario(datas.map((d) => eventoDaData(d, carimbo, url)), "Agenda de provas da Alumia");
}

/** O arquivo de agenda de um horário de monitoria, com lembrete uma hora antes. Leva só a disciplina: nada de quem. */
export function icsDaMonitoria(j: Pick<JanelaDeMonitoria, "id" | "inicio" | "duracao">, titulo: string, url: string, agora: Date = new Date()): string {
  const inicio = new Date(j.inicio);
  const fim = new Date(inicio.getTime() + j.duracao * 60_000);
  return calendario([[
    "BEGIN:VEVENT",
    `UID:alumia-monitoria-${uid(j.id)}@institutolucia.org`,
    `DTSTAMP:${utc(agora)}`,
    `DTSTART:${utc(inicio)}`,
    `DTEND:${utc(fim)}`,
    dobrar(`SUMMARY:${escapar(titulo)}`),
    dobrar(`DESCRIPTION:${escapar(url)}`),
    dobrar(`URL:${url}`),
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    dobrar(`DESCRIPTION:${escapar(titulo)}`),
    `TRIGGER:-PT${LIMITES_DA_MONITORIA.lembreteMinutos}M`,
    "END:VALARM",
    "END:VEVENT",
  ]], "Monitoria da Alumia");
}

// ───────────────────────── A sala ─────────────────────────

/**
 * Para onde a sala leva: a Aula ao vivo do site (a aula do próprio monitor) ou a conversa da Alumia com a outra pessoa (o chat
 * cifrado já existente). Nenhuma sala de vídeo nova. Sem o @ da outra pessoa (conta invisível), a conversa abre a lista.
 */
export function enderecoDaSala(lang: string, sala: JanelaDeMonitoria["sala"], aula: string | null, outraPessoa: string | null): string {
  if (sala === "aula" && aula && /^[0-9a-f-]{36}$/i.test(aula)) return `/${lang}/ao-vivo/sala?aula=${aula}`;
  return outraPessoa ? `/${lang}/alumia/conversas?com=${encodeURIComponent(outraPessoa)}` : `/${lang}/alumia/conversas`;
}

/** A sala pode abrir? De 15 minutos antes até o fim do horário. */
export function salaAberta(j: Pick<JanelaDeMonitoria, "inicio" | "duracao">, agora: number = Date.now()): boolean {
  const inicio = new Date(j.inicio).getTime();
  return agora >= inicio - 15 * 60_000 && agora <= inicio + j.duracao * 60_000;
}

/** O valor de um campo datetime-local ("2026-11-20T19:00", no fuso do aparelho) como instante ISO. Vazio ou inválido: "". */
export function instanteDoCampo(valor: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(valor)) return "";
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}
