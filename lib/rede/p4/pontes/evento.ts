// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prompt 4, item 81 (atrás de "alumia-p4-pontes"): o post de um ato sai no Fediverso como Event, que o Mobilizon e o Gancio mostram
// na agenda deles. Só vai o PONTO PÚBLICO que o banco manda (interno.rede_p4_ato_publico: título, começo, fim, ponto, cidade,
// situação e tipo); quem confirmou, quantos e a meta nunca chegam aqui. A participação é "externa": quem quiser ir confirma na
// Alumia (o Event não aceita Join de fora, e nenhuma confirmação sai). O resto da Note (texto, menções, imagens, público) fica
// igual. Lógica pura, sem "@/" de propósito (roda nos testes).

/** O ponto público do ato, como o banco manda no campo "ato" do post (só com o lote ligado). */
export interface AtoFederado {
  titulo: string;
  inicio: string;
  fim?: string | null;
  onde: string;
  cidade: string;
  situacao: string;
  tipo?: string | null;
}

/** Os termos de fora do vocabulário do ActivityStreams que o Event usa (iCalendar e Mobilizon), para quem lê JSON-LD. */
export const TERMOS_DO_EVENTO = {
  ical: "http://www.w3.org/2002/12/cal/ical#",
  mz: "https://joinmobilizon.org/ns#",
  joinMode: "mz:joinMode",
  externalParticipationUrl: "mz:externalParticipationUrl",
  anonymousParticipationEnabled: "mz:anonymousParticipationEnabled",
  PostalAddress: "http://schema.org/PostalAddress",
  addressLocality: "http://schema.org/addressLocality",
  address: { "@id": "http://schema.org/address", "@type": "@id" },
} as const;

const SITUACAO_ICAL: Record<string, string> = { confirmado: "CONFIRMED", adiado: "TENTATIVE", cancelado: "CANCELLED" };

/** As chaves que NUNCA podem sair num Event de ato (a regra de privacidade do item; o teste confere). */
export const CHAVES_PROIBIDAS_NO_EVENTO = ["participantCount", "maximumAttendeeCapacity", "remainingAttendeeCapacity", "attendees", "participants", "vou", "total", "meta", "acesos"] as const;

const dataOk = (v: unknown): v is string => typeof v === "string" && Number.isFinite(Date.parse(v));
const curto = (v: unknown, n: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, n) : "");

/** O ato do banco tem o mínimo para virar evento? (Título ou ponto e um começo válido.) */
export function atoValido(a: unknown): a is AtoFederado {
  if (!a || typeof a !== "object") return false;
  const x = a as Record<string, unknown>;
  return dataOk(x.inicio) && curto(x.onde, 140).length >= 3 && curto(x.cidade, 80).length >= 2;
}

/**
 * A Note de um ato como Event. `nota` é o documento que documentoDoPost já montou; `link` é a página do ato na Alumia (onde se
 * confirma). O contexto ganha os termos do iCalendar e do Mobilizon. Devolve um objeto novo; a Note não muda.
 */
export function comoEvento<T extends Record<string, unknown>>(nota: T, ato: AtoFederado, link: string): T & Record<string, unknown> {
  const contexto = nota["@context"];
  const comTermos = Array.isArray(contexto) ? [...contexto, TERMOS_DO_EVENTO] : contexto ? [contexto, TERMOS_DO_EVENTO] : undefined;
  const nome = curto(ato.titulo, 200) || curto(ato.onde, 200);
  const fim = dataOk(ato.fim) ? new Date(ato.fim).toISOString() : null;
  const status = SITUACAO_ICAL[ato.situacao] ?? "CONFIRMED";
  const evento: Record<string, unknown> = {
    ...nota,
    ...(comTermos ? { "@context": comTermos } : {}),
    type: "Event",
    name: nome,
    startTime: new Date(ato.inicio).toISOString(),
    ...(fim ? { endTime: fim } : {}),
    location: {
      type: "Place",
      name: curto(ato.onde, 140),
      address: { type: "PostalAddress", addressLocality: curto(ato.cidade, 80) },
    },
    "ical:status": status,
    joinMode: "external",
    externalParticipationUrl: link,
    anonymousParticipationEnabled: false,
  };
  for (const c of CHAVES_PROIBIDAS_NO_EVENTO) delete evento[c];
  return evento as T & Record<string, unknown>;
}
