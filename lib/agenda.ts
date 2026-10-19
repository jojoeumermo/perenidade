// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O lembrete da meta semanal como arquivo de agenda (.ics): a pessoa baixa e abre no aplicativo de agenda do celular
// ou do computador, que avisa no dia e na hora, mesmo com o site fechado. Nada é enviado; o arquivo nasce no aparelho.
// (O plano de estudos de cada trilha, em components/PlanoDeEstudos.tsx, continua sendo o lembrete aula por aula.)
// Sem os atalhos "@/" de propósito: `npm run testar:meu-estudo` roda este arquivo direto no Node.

const DIAS_ICS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

const dois = (n: number) => String(n).padStart(2, "0");
const escapar = (texto: string) => texto.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\r?\n/g, "\\n");

/** Quebra as linhas longas como o formato pede (75 caracteres, continuação começando com espaço). */
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

export interface LembreteSemanal {
  /** Dias da semana (0 = domingo … 6 = sábado). */
  dias: number[];
  /** "19:00". */
  hora: string;
  titulo: string;
  descricao: string;
  url: string;
  /** Primeiro dia possível do lembrete. */
  inicio: Date;
  /** Para o identificador do evento (o mesmo arquivo baixado de novo substitui o anterior na agenda). */
  id: string;
}

/** Um evento que se repete toda semana nos dias escolhidos, com aviso na hora, durando 30 minutos. */
export function icsSemanal(l: LembreteSemanal, agora = new Date()): string {
  const dias = [...new Set(l.dias.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort();
  if (dias.length === 0) throw new RangeError("escolha ao menos um dia");
  const [h, m] = (/^(\d{2}):(\d{2})$/.exec(l.hora) ?? ["", "19", "00"]).slice(1).map(Number);
  // O primeiro evento cai no primeiro dia escolhido a partir do início.
  const comeco = new Date(l.inicio);
  comeco.setHours(h, m, 0, 0);
  for (let i = 0; i < 7 && !dias.includes(comeco.getDay()); i++) comeco.setDate(comeco.getDate() + 1);
  const fim = new Date(comeco.getTime() + 30 * 60_000);
  const local = (d: Date) => `${d.getFullYear()}${dois(d.getMonth() + 1)}${dois(d.getDate())}T${dois(d.getHours())}${dois(d.getMinutes())}00`;
  const carimbo = agora.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Instituto Lucia//Meta de estudo//PT",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:meta-${l.id.replace(/[^a-z0-9-]/gi, "")}@institutolucia.org`,
    `DTSTAMP:${carimbo}`,
    `DTSTART:${local(comeco)}`,
    `DTEND:${local(fim)}`,
    `RRULE:FREQ=WEEKLY;BYDAY=${dias.map((d) => DIAS_ICS[d]).join(",")}`,
    dobrar(`SUMMARY:${escapar(l.titulo)}`),
    dobrar(`DESCRIPTION:${escapar(`${l.descricao}\n${l.url}`)}`),
    dobrar(`URL:${l.url}`),
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    "TRIGGER:PT0M",
    dobrar(`DESCRIPTION:${escapar(l.titulo)}`),
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}
