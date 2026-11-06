// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O ano letivo da Escola Revolucionária Lúcia Maria em eventos (E4-09, D1-5, D1-6, D1-7 e R1-46; docs/escola/campus.md): começo e fim
// do semestre (lib/escola/tempo.ts), semana de provas (semanaDeProvas, sem redefinir), aulas magnas
// (content/escola/calendario.json), feriados do campus (content/escola/feriados.json) e exames externos
// (content/escola/exames.json). Nenhuma data nasce aqui: cada uma vem de um desses arquivos, e as do ano letivo são
// PROPOSTA enquanto "confirmado" for false. icsDoEvento faz o arquivo de agenda de UM evento, sem recorrência.
// Sem os atalhos "@/" de propósito: o teste roda este arquivo direto no Node.

import calendarioPadrao from "../../content/escola/calendario.json";
import examesPadrao from "../../content/escola/exames.json";
import feriadosPadrao from "../../content/escola/feriados.json";
import { ANO_LETIVO, type AnoLetivo, type Semestre, semanaDeProvas, semestreDe } from "./tempo";

export type TipoDeEvento = "inicio" | "fim" | "aula-magna" | "feriado" | "provas" | "exame";

export interface AulaMagna {
  semestre: string;
  curso?: string;
  titulo: string;
  data?: string;
  aoVivoId?: string;
}

export interface Feriado {
  /** MM-DD */
  dia: string;
  nome: string;
  fonte: string;
  origem: "neste-dia" | "festa";
  festa?: string;
  /** trilha/aula */
  aula?: string;
}

export interface Exame {
  exame: string;
  edicao: number;
  etapa: string;
  data: string;
  fonte: string;
  orgao: string;
  consultadoEm: string;
  curso?: string;
  fato?: string;
}

export interface FontesDoCalendario {
  aulasMagnas: AulaMagna[];
  feriados: Feriado[];
  exames: Exame[];
  ano?: AnoLetivo;
}

export interface Evento {
  tipo: TipoDeEvento;
  /** AAAA-MM-DD; a aula magna sem data fica sem (e vai para o fim da lista). */
  data: string;
  /** Até quando (a semana de provas). */
  ate?: string;
  titulo: string;
  /** Caminho sem idioma ("/ao-vivo", "/trilhas/x/y") ou https://. */
  link: string;
  /** De onde vem a data (url), quando é de fora. */
  fonte?: string;
  /** Quem publicou e quando foi conferido (exames). */
  orgao?: string;
  consultadoEm?: string;
  /** A data é proposta (ano letivo não confirmado). */
  proposto?: boolean;
  /** Para o identificador da agenda. */
  id: string;
}

export const CALENDARIO = calendarioPadrao as { confirmado: boolean; aulasMagnas: AulaMagna[] };
export const FERIADOS = (feriadosPadrao as { feriados: Feriado[] }).feriados;
export const EXAMES = (examesPadrao as { exames: Exame[] }).exames;
export const FONTES_PADRAO: FontesDoCalendario = { aulasMagnas: CALENDARIO.aulasMagnas, feriados: FERIADOS, exames: EXAMES };

/** O calendário (ano letivo e aulas magnas) ainda é proposta? */
export const calendarioAindaProposto = (ano: AnoLetivo = ANO_LETIVO) => !ano.confirmado || !CALENDARIO.confirmado;

const somar = (dia: string, dias: number) => new Date(Date.parse(`${dia}T00:00:00Z`) + dias * 86_400_000).toISOString().slice(0, 10);
const DATA = /^\d{4}-\d{2}-\d{2}$/;

/** O semestre de um id "AAAA.1"/"AAAA.2" (pelas datas do ano letivo). */
export function semestrePorId(id: string, ano: AnoLetivo = ANO_LETIVO): Semestre {
  const [a, s] = id.split(".");
  const c = ano.semestres[s === "2" ? "2" : "1"];
  return semestreDe(`${a}-${c.inicio}`, ano);
}

/** O semestre que vem antes deste. */
function anterior(s: Pick<Semestre, "id">, ano: AnoLetivo): Semestre {
  const [a, n] = s.id.split(".").map(Number);
  return semestrePorId(n === 1 ? `${a - 1}.2` : `${a}.1`, ano);
}

/**
 * A janela de um semestre no calendário: do dia seguinte ao fim do semestre anterior até o fim deste. Assim o que cai
 * nas férias (um exame em janeiro, um feriado em julho) aparece no semestre que vem, e nada some entre os dois.
 */
export function janelaDoSemestre(s: Pick<Semestre, "id" | "inicio" | "fim">, ano: AnoLetivo = ANO_LETIVO): { de: string; ate: string } {
  return { de: somar(anterior(s, ano).fim, 1), ate: s.fim };
}

/**
 * Os eventos de um semestre, em ordem de data (a aula magna sem data vai para o fim). Os títulos de começo, fim e provas
 * vêm em `rotulos` (a interface manda no idioma da página); feriados, aulas magnas e exames são conteúdo, em português.
 */
export function eventosDoSemestre(
  semestre: Pick<Semestre, "id" | "inicio" | "fim">,
  fontes: FontesDoCalendario = FONTES_PADRAO,
  rotulos: { inicio: string; fim: string; provas: string } = { inicio: "Começo do semestre", fim: "Fim do semestre", provas: "Semana de provas" },
): Evento[] {
  const ano = fontes.ano ?? ANO_LETIVO;
  const proposto = !ano.confirmado;
  const { de, ate } = janelaDoSemestre(semestre, ano);
  const dentro = (dia: string) => DATA.test(dia) && de <= dia && dia <= ate;
  const eventos: Evento[] = [
    { tipo: "inicio", data: semestre.inicio, titulo: rotulos.inicio, link: "/escola/calendario", proposto, id: `inicio-${semestre.id}` },
  ];
  const provas = semanaDeProvas(semestre, ano);
  eventos.push({ tipo: "provas", data: provas.inicio, ate: provas.fim, titulo: rotulos.provas, link: "/escola/provas", proposto, id: `provas-${semestre.id}` });
  eventos.push({ tipo: "fim", data: semestre.fim, titulo: rotulos.fim, link: "/escola/calendario", proposto, id: `fim-${semestre.id}` });

  for (const f of fontes.feriados) {
    for (let a = Number(de.slice(0, 4)); a <= Number(ate.slice(0, 4)); a++) {
      const dia = `${a}-${f.dia}`;
      if (dentro(dia)) eventos.push({ tipo: "feriado", data: dia, titulo: f.nome, link: f.aula ? `/trilhas/${f.aula}` : f.fonte, fonte: f.fonte, id: `feriado-${dia}` });
    }
  }
  for (const e of fontes.exames) {
    if (dentro(e.data))
      eventos.push({ tipo: "exame", data: e.data, titulo: `${e.exame} ${e.edicao}: ${e.etapa}`, link: e.curso === "enem" ? "/enem" : e.curso ? `/escola/cursos/${e.curso}` : e.fonte, fonte: e.fonte, orgao: e.orgao, consultadoEm: e.consultadoEm, id: `exame-${e.fato ?? e.data}` });
  }
  for (const m of fontes.aulasMagnas) {
    if (m.semestre !== semestre.id) continue;
    if (m.data && !DATA.test(m.data)) continue;
    eventos.push({ tipo: "aula-magna", data: m.data ?? "", titulo: m.titulo, link: m.curso ? `/escola/cursos/${m.curso}` : "/ao-vivo", proposto: !CALENDARIO.confirmado, id: `magna-${m.aoVivoId ?? `${m.semestre}-${m.titulo}`}` });
  }
  return eventos.sort((x, y) => (x.data || "9999").localeCompare(y.data || "9999") || x.tipo.localeCompare(y.tipo));
}

/**
 * Os dois semestres que o calendário mostra num dia: o atual e o próximo. Nas férias depois do fim, o "atual" já é o
 * que vem (o que acabou não interessa mais) e o "próximo" é o seguinte.
 */
export function semestresDoCalendario(dia: string, ano: AnoLetivo = ANO_LETIVO): [Semestre, Semestre] {
  const s = semestreDe(dia, ano);
  const atual = dia > s.fim ? semestrePorId(s.proximo.id, ano) : s;
  return [atual, semestrePorId(atual.proximo.id, ano)];
}

/** O próximo evento a partir de um dia (inclusive), entre os dos semestres do calendário. Aula magna sem data não conta. */
export function proximoEvento(dia: string, eventos: readonly Evento[]): Evento | null {
  return eventos.filter((e) => e.data && (e.ate ?? e.data) >= dia).sort((a, b) => a.data.localeCompare(b.data))[0] ?? null;
}

/** A estação do ano letivo num dia: "1" ou "2" (tempo de aula do semestre) ou "ferias" (entre semestres ou em recesso). */
export function estacaoDe(dia: string, ano: AnoLetivo = ANO_LETIVO): "1" | "2" | "ferias" {
  const s = semestreDe(dia, ano);
  return s.situacao === "ferias" ? "ferias" : s.id.endsWith(".2") ? "2" : "1";
}

/** O feriado do campus de um dia (AAAA-MM-DD), ou null. */
export const feriadoDoDia = (dia: string, feriados: readonly Feriado[] = FERIADOS): Feriado | null => feriados.find((f) => f.dia === dia.slice(5)) ?? null;

/** A aula ao vivo vira aula magna quando o título começa com "Aula magna" (sem diferença de maiúscula e acento). */
export const ehAulaMagna = (titulo: string) =>
  titulo
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase()
    .startsWith("aula magna");

// ───────────── Arquivo de agenda (.ics) de um evento ─────────────

const escapar = (texto: string) => texto.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\r?\n/g, "\\n");

/** Quebra as linhas longas como o formato pede (75 caracteres, continuação começando com espaço), como lib/agenda.ts. */
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

/**
 * Um evento de dia inteiro (DTSTART;VALUE=DATE), sem recorrência e sem alarme: a pessoa baixa e abre na agenda do
 * aparelho. A semana de provas vai do primeiro ao último dia. `url` já vem completo (com o domínio e o idioma).
 */
export function icsDoEvento(evento: Evento, url: string, agora: Date = new Date()): string {
  if (!DATA.test(evento.data)) throw new RangeError("evento sem data não vai para a agenda");
  const compacta = (dia: string) => dia.replace(/-/g, "");
  const fimExclusivo = somar(evento.ate && DATA.test(evento.ate) ? evento.ate : evento.data, 1);
  const carimbo = agora.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const descricao = [evento.proposto ? "Data proposta, a confirmar pela coordenação da Escola Revolucionária Lúcia Maria." : "", evento.fonte ? `Fonte: ${evento.fonte}` : "", url].filter(Boolean).join("\n");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Instituto Lucia//Calendario da Escola//PT",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:escola-${evento.id.replace(/[^a-z0-9.-]/gi, "-")}@institutolucia.org`,
    `DTSTAMP:${carimbo}`,
    `DTSTART;VALUE=DATE:${compacta(evento.data)}`,
    `DTEND;VALUE=DATE:${compacta(fimExclusivo)}`,
    dobrar(`SUMMARY:${escapar(evento.titulo)}`),
    dobrar(`DESCRIPTION:${escapar(descricao)}`),
    dobrar(`URL:${url}`),
    "TRANSP:TRANSPARENT",
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}
