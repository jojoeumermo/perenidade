// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Dados de EXEMPLO da prévia de desenvolvimento das aulas ao vivo da Escola (lib/escola/aovivo.ts carrega este arquivo
// por import dinâmico SÓ com NODE_ENV "development" e ?previa=militante). Codinomes e aula inventados, como os da
// prancha: nada aqui é pessoa de verdade. O vídeo não existe: a prévia mostra o tocador só até o clique.
// Na sala: ?estado=marcada | aovivo (o padrão) | gravada, e ?conduzo=1 para ver a moderação de quem conduz.

import type { AulaDaEscolaNaSala, FalaDaEscola } from "../../../lib/escola/aovivo";
import type { AulaAoVivoDaEscola } from "../../../lib/escola/contratos";

const parametro = (nome: string) => {
  try {
    return new URLSearchParams(location.search).get(nome);
  } catch {
    return null;
  }
};

const VIDEO = "AbCdEfGhIjK";
const CADERNO_AULA = "conversar-com-quem-pensa-diferente/discordar-sem-humilhar";

export function aulaDeExemplo(id: string): AulaDaEscolaNaSala {
  const estado = parametro("estado");
  const agora = Date.now();
  const status = estado === "marcada" ? "agendada" : estado === "gravada" ? "encerrada" : "ao_vivo";
  const inicio = new Date(status === "agendada" ? agora + 3 * 3600_000 : agora - 25 * 60_000);
  inicio.setMinutes(0, 0, 0);
  return {
    id,
    titulo: "Discordar sem humilhar: a conversa com quem pensa diferente",
    descricao: "Roda ao vivo do caderno 03. Traga uma conversa difícil que você teve esta semana.",
    inicio: inicio.toISOString(),
    duracao: 90,
    status,
    iniciada_em: status === "agendada" ? null : inicio.toISOString(),
    encerrada_em: status === "encerrada" ? new Date(agora - 3600_000).toISOString() : null,
    youtube: VIDEO,
    publico: "escola",
    caderno_aula: CADERNO_AULA,
    educador: { id: null, nome: "Jurema" },
    co_educadores: [{ id: null, nome: "Mandacaru" }],
    inscritos: 12,
    inscrito: false,
    conduzo: parametro("conduzo") === "1",
    mensagens: 4,
  };
}

const base = Date.now() - 20 * 60_000;
const quando = (min: number) => new Date(base + min * 60_000).toISOString();
let falas: FalaDaEscola[] = [
  { id: "f0", minha: false, nome: "", corpo: "A aula começou.", tipo: "sistema", oculta: false, esperando: false, criado_em: quando(0) },
  { id: "f1", minha: false, nome: "Mandacaru", corpo: "Boa noite, turma! Lembrem do cuidado nº 1: falar da ideia, não da pessoa.", tipo: "fala", oculta: false, esperando: false, criado_em: quando(2) },
  { id: "f2", minha: false, nome: "Carcará", corpo: "E quando a pessoa começa com ironia? Eu travo e respondo do mesmo jeito.", tipo: "pergunta", oculta: false, esperando: false, criado_em: quando(6) },
  { id: "f3", minha: true, nome: "Faísca", corpo: "Comigo foi no grupo da família. Tentei perguntar antes de discordar e funcionou melhor.", tipo: "fala", oculta: false, esperando: false, criado_em: quando(9) },
  { id: "f4", minha: false, nome: "Ipê", corpo: "Fala que ficou em dúvida nas regras e espera quem conduz.", tipo: "fala", oculta: true, esperando: true, criado_em: quando(11) },
];

export function falasDeExemplo(depois: string | null): FalaDaEscola[] {
  const conduzo = parametro("conduzo") === "1";
  const vistas = falas.filter((f) => !f.oculta || conduzo || (f.minha && f.esperando));
  return depois ? vistas.filter((f) => f.criado_em > depois) : vistas;
}

export function falarNoExemplo(corpo: string, tipo: "fala" | "pergunta"): FalaDaEscola {
  const fala: FalaDaEscola = { id: `f${falas.length}`, minha: true, nome: "Faísca", corpo, tipo, oculta: false, esperando: false, criado_em: new Date().toISOString() };
  falas = [...falas, fala];
  return fala;
}

export function moderarNoExemplo(id: string, ocultar: boolean) {
  falas = falas.map((f) => (f.id === id ? { ...f, oculta: ocultar, esperando: ocultar ? f.esperando : false } : f));
}

export function gravacoesDeExemplo(cadernoAula: string): AulaAoVivoDaEscola[] {
  if (cadernoAula !== CADERNO_AULA && !CADERNO_AULA.startsWith(`${cadernoAula}/`)) return [];
  return [{ id: "00000000-0000-4000-8000-0000000000a1", titulo: "Discordar sem humilhar: a conversa com quem pensa diferente", inicio: new Date(Date.now() - 6 * 86400_000).toISOString(), status: "encerrada", caderno_aula: CADERNO_AULA, youtube: VIDEO }];
}
