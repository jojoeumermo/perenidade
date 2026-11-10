// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O ato como arquivo de agenda (.ics, RFC 5545): a pessoa baixa e abre no aplicativo de agenda, que avisa 24 h e 2 h antes, mesmo
// com a Alumia fechada. O arquivo nasce NO APARELHO (nada é enviado e o servidor não fica sabendo quem pôs o ato na agenda).
// Cancelado sai com STATUS:CANCELLED e adiado com a data nova e SEQUENCE maior: baixar de novo atualiza o mesmo evento (mesmo UID).
// O mesmo padrão de lib/agenda.ts (dobra de 75 e escape), num arquivo próprio da F2. Sem "@/" de propósito.
import type { Ato } from "../tipos-atos";

const escapar = (texto: string) => texto.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\r?\n/g, "\\n");

/** Quebra as linhas longas como o formato pede (75 octetos; aqui por caractere, com a continuação começando com espaço). */
export function dobrar(linha: string): string {
  const partes: string[] = [];
  let resto = linha;
  while (resto.length > 75) {
    partes.push(resto.slice(0, 75));
    resto = ` ${resto.slice(75)}`;
  }
  partes.push(resto);
  return partes.join("\r\n");
}

/** "20261115T210000Z" (sempre em UTC: a agenda converte para o fuso de quem abre). */
export function utc(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
}

export interface OpcoesDoIcs {
  /** O endereço público do ato (vai no URL e na descrição). */
  url: string;
  /** Duração quando o ato não diz o fim (padrão: 2 h). */
  duracaoMin?: number;
  agora?: Date;
}

/** O .ics de um ato. Sem nome de pessoa nenhuma (nem de quem chamou): só o ato, o lugar e o chamado. */
export function icsDoAto(ato: Pick<Ato, "id" | "titulo" | "inicio" | "inicio_anterior" | "onde" | "cidade" | "descricao" | "situacao">, o: OpcoesDoIcs): string {
  const inicio = new Date(ato.inicio);
  if (!Number.isFinite(inicio.getTime())) throw new RangeError("data do ato inválida");
  const fim = new Date(inicio.getTime() + (o.duracaoMin ?? 120) * 60_000);
  const lugar = [ato.onde, ato.cidade].map((x) => x.trim()).filter(Boolean).join(", ");
  const id = ato.id.replace(/[^a-z0-9-]/gi, "");
  const linhas = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Instituto Lucia//Alumia atos//PT",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:ato-${id}@alumia.institutolucia.org`,
    `DTSTAMP:${utc(o.agora ?? new Date())}`,
    `DTSTART:${utc(inicio)}`,
    `DTEND:${utc(fim)}`,
    // Cada mudança (adiar, cancelar) sobe a sequência: a agenda troca o evento antigo pelo novo.
    `SEQUENCE:${ato.situacao === "cancelado" ? 2 : ato.inicio_anterior ? 1 : 0}`,
    `STATUS:${ato.situacao === "cancelado" ? "CANCELLED" : "CONFIRMED"}`,
    dobrar(`SUMMARY:${escapar(ato.titulo)}`),
    dobrar(`LOCATION:${escapar(lugar)}`),
    dobrar(`DESCRIPTION:${escapar(`${ato.descricao}\n${o.url}`.trim())}`),
    dobrar(`URL:${o.url}`),
  ];
  if (ato.situacao !== "cancelado") {
    for (const antes of ["-PT24H", "-PT2H"]) {
      linhas.push("BEGIN:VALARM", "ACTION:DISPLAY", `TRIGGER:${antes}`, dobrar(`DESCRIPTION:${escapar(ato.titulo)}`), "END:VALARM");
    }
  }
  linhas.push("END:VEVENT", "END:VCALENDAR", "");
  return linhas.join("\r\n");
}

/** O nome do arquivo baixado ("ato-passe-livre-ja.ics"). */
export function nomeDoIcs(titulo: string): string {
  const base = titulo
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `ato-${base || "alumia"}.ics`;
}
