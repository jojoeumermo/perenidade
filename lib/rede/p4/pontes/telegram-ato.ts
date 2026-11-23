// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prompt 4, item 86 (atrás de "alumia-p4-pontes" e "alumia-telegram"): o aviso de ato no canal do Telegram da organização. Só de
// saída e só o ponto público que o banco manda (título, quando, onde, cidade, situação e o motivo de adiar ou cancelar) mais o
// endereço do ato na Alumia: nenhum dado de conta, nem quem confirmou, nem quantos. A hora sai no horário de Brasília. Lógica pura,
// sem "@/" de propósito (roda nos testes).
import type { PostParaOTelegram } from "../../pontes/telegram";

export interface AtoParaOTelegram {
  titulo: string;
  inicio: string;
  onde: string;
  cidade: string;
  situacao: string;
  motivo?: string | null;
}

export type PostOuAtoParaOTelegram = PostParaOTelegram & { ato?: AtoParaOTelegram | null };

/** "sábado, 1 de dezembro, 15:00" no horário de Brasília. */
export function quandoDoAto(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(d);
}

const limpo = (v: unknown, n: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, n) : "");

/** O texto do aviso de ato (até 4096 letras, o teto do Telegram). Nulo se o ato não tem o mínimo (aí sai como post comum). */
export function mensagemDoAto(p: PostOuAtoParaOTelegram, site: string): string | null {
  const a = p.ato;
  if (!a || !limpo(a.onde, 140) || !quandoDoAto(a.inicio)) return null;
  const endereco = `${site.replace(/\/+$/, "")}/pt/alumia/p/${p.post}`;
  const titulo = limpo(a.titulo, 120) || limpo(p.titulo, 120) || "Ato";
  const cabeca = a.situacao === "cancelado" ? "CANCELADO" : a.situacao === "adiado" ? "ADIADO" : "ATO";
  const linhas = [`${cabeca}: ${titulo}`, `Quando: ${quandoDoAto(a.inicio)}`, `Onde: ${limpo(a.onde, 140)}${limpo(a.cidade, 80) ? `, ${limpo(a.cidade, 80)}` : ""}`];
  const motivo = limpo(a.motivo, 200);
  if (motivo && a.situacao !== "confirmado") linhas.push(`Motivo: ${motivo}`);
  const texto = a.situacao === "confirmado" ? limpo(p.texto, 3000) : "";
  const corpo = [linhas.join("\n"), texto].filter(Boolean).join("\n\n");
  const espaco = 4096 - endereco.length - 2;
  return `${corpo.length > espaco ? `${corpo.slice(0, Math.max(0, espaco - 1))}…` : corpo}\n\n${endereco}`;
}
