// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useMemo, useState } from "react";
import { Aviso, botao, botaoClaro, campo, data, elo, useAcao, useLista } from "./comum";

// A fila de aulas a escrever (supabase/install.sql, "Fila de aulas a escrever"): cada aula prevista no roteiro de uma
// trilha é uma tarefa que alguém da equipe reserva, escreve no Escrever com o modelo da aula, manda para a revisão por
// pares e só então envia para a fila de revisão de sempre.

interface AulaPrevista {
  slug: string;
  titulo: string;
  pronta: boolean;
}
interface Disciplina {
  area: string;
  nome: string;
  trilhas: { slug: string; titulo: string; etapa: string; aulas: AulaPrevista[] }[];
}
interface Reserva {
  trilha: string;
  aula: string;
  titulo: string;
  situacao: "escrevendo" | "revisao" | "feita";
  prazo: string;
  quem: string;
  minha: boolean;
  revisor: string;
  reviso: boolean;
  vencida: boolean;
}

const ERROS: Record<string, string> = {
  "limite:tres_aulas": "Você já está escrevendo três aulas. Termine ou libere uma antes de pegar outra.",
  reservada: "Outra pessoa já está escrevendo esta aula.",
};

export function FilaDeAulas() {
  const [disciplinas, setDisciplinas] = useState<Disciplina[] | null>(null);
  const reservas = useLista<Reserva[]>("aulas_reservas_listar");
  const acao = useAcao(reservas.recarregar);
  const [area, setArea] = useState("");
  const [filtro, setFiltro] = useState<"livres" | "minhas" | "revisao" | "todas">("livres");
  useEffect(() => {
    fetch("/api/aprendizado")
      .then((r) => r.json())
      .then((d: { disciplinas: Disciplina[] }) => setDisciplinas(d.disciplinas))
      .catch(() => setDisciplinas([]));
  }, []);
  const porChave = useMemo(() => new Map((reservas.dados ?? []).map((r) => [`${r.trilha}/${r.aula}`, r])), [reservas.dados]);
  const minhas = (reservas.dados ?? []).filter((r) => r.minha && r.situacao !== "feita");
  const paraRevisar = (reservas.dados ?? []).filter((r) => r.situacao === "revisao" && !r.minha);
  const faltam = (disciplinas ?? []).reduce((n, d) => n + d.trilhas.reduce((m, t) => m + t.aulas.filter((a) => !a.pronta).length, 0), 0);

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        {[[String(faltam), "aulas previstas ainda sem texto"], [String(minhas.length), "sendo escritas por você (até 3)"], [String(paraRevisar.length), "esperando revisão por pares"]].map(([n, rotulo]) => (
          <div key={rotulo} className="border-2 border-ink bg-folha p-4">
            <p className="font-serif text-3xl font-semibold">{n}</p>
            <p className="text-sm text-ink-soft">{rotulo}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="block text-sm">
          Disciplina
          <select value={area} onChange={(e) => setArea(e.target.value)} className={campo}>
            <option value="">Todas</option>
            {(disciplinas ?? []).map((d) => (
              <option key={d.area} value={d.area}>{d.nome}</option>
            ))}
          </select>
        </label>
        <div role="group" aria-label="Filtro" className="flex flex-wrap gap-1 pb-1">
          {([["livres", "Livres para pegar"], ["minhas", "Minhas"], ["revisao", "Para revisar"], ["todas", "Todas"]] as const).map(([id, nome]) => (
            <button key={id} type="button" aria-pressed={filtro === id} onClick={() => setFiltro(id)} className={filtro === id ? botao : botaoClaro}>{nome}</button>
          ))}
        </div>
      </div>
      <Aviso texto={acao.aviso ? (ERROS[acao.aviso] ?? acao.aviso) : reservas.erro} />
      {!disciplinas && <p className="text-ink-soft">Carregando as trilhas…</p>}

      {(disciplinas ?? [])
        .filter((d) => !area || d.area === area)
        .map((d) => {
          const trilhas = d.trilhas
            .map((t) => ({
              ...t,
              aulas: t.aulas.filter((a) => {
                if (a.pronta) return false;
                const r = porChave.get(`${t.slug}/${a.slug}`);
                if (filtro === "livres") return !r || r.vencida;
                if (filtro === "minhas") return r?.minha;
                if (filtro === "revisao") return r?.situacao === "revisao" && !r.minha;
                return true;
              }),
            }))
            .filter((t) => t.aulas.length > 0);
          if (trilhas.length === 0) return null;
          return (
            <section key={d.area}>
              <h2 className="border-b-2 border-ink pb-1 font-serif text-2xl font-semibold">{d.nome}</h2>
              {trilhas.map((t) => (
                <details key={t.slug} className="mt-3 border border-rule bg-parchment" open={Boolean(area) || filtro !== "livres"}>
                  <summary className="cursor-pointer px-3 py-2 font-semibold">
                    {t.titulo} <span className="font-mono text-xs font-normal text-ink-soft">· {t.etapa} · {t.aulas.length}</span>
                  </summary>
                  <ul className="divide-y divide-rule border-t border-rule">
                    {t.aulas.map((a) => {
                      const r = porChave.get(`${t.slug}/${a.slug}`);
                      const escrever = `/pt/painel?aba=escrever&tipo=aula&trilha=${encodeURIComponent(t.slug)}&tema=${encodeURIComponent(a.titulo)}`;
                      return (
                        <li key={a.slug} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2.5 text-sm">
                          <span className="min-w-0 flex-1">
                            <span className="font-semibold">{a.titulo}</span>
                            <span className="block text-xs text-ink-soft">
                              {!r || r.vencida ? (r?.vencida ? `prazo de ${r.quem} venceu: livre para pegar` : "livre") : r.situacao === "escrevendo" ? `${r.minha ? "você está escrevendo" : `${r.quem} está escrevendo`} · prazo ${data(r.prazo)}` : r.situacao === "revisao" ? `pronta, esperando revisão${r.revisor ? `: ${r.revisor} revisa` : ""}` : `revisada por ${r.revisor || "a coordenação"}: falta enviar pelo Escrever`}
                            </span>
                          </span>
                          {(!r || r.vencida) && (
                            <button type="button" className={botao} disabled={acao.ocupado} onClick={() => void acao.agir("aula_reservar", { p_trilha: t.slug, p_aula: a.slug, p_titulo: a.titulo }, "Reservada para você. Prazo sugerido: 14 dias.")}>Eu escrevo esta</button>
                          )}
                          {r?.minha && r.situacao !== "feita" && (
                            <>
                              <a href={escrever} className={elo}>Escrever com o modelo</a>
                              {r.situacao === "escrevendo" && <button type="button" className={elo} onClick={() => void acao.agir("aula_reserva_mudar", { p_trilha: t.slug, p_aula: a.slug, p_acao: "revisao" }, "Na fila da revisão por pares.")}>Pedir revisão de um par</button>}
                              {r.situacao === "escrevendo" && <button type="button" className={elo} onClick={() => void acao.agir("aula_reserva_mudar", { p_trilha: t.slug, p_aula: a.slug, p_acao: "prazo" }, "Mais uma semana de prazo.")}>Mais 7 dias</button>}
                              <button type="button" className={elo} onClick={() => void acao.agir("aula_reserva_mudar", { p_trilha: t.slug, p_aula: a.slug, p_acao: "liberar" }, "Liberada para outra pessoa.")}>Liberar</button>
                            </>
                          )}
                          {r?.minha && r.situacao === "feita" && <a href={escrever} className={botao}>Enviar pelo Escrever</a>}
                          {r && !r.minha && r.situacao === "revisao" && !r.revisor && (
                            <button type="button" className={botao} onClick={() => void acao.agir("aula_reserva_mudar", { p_trilha: t.slug, p_aula: a.slug, p_acao: "revisar" }, "Você vai revisar. Combine com quem escreveu nas Conversas.")}>Eu reviso</button>
                          )}
                          {r?.reviso && r.situacao === "revisao" && (
                            <button type="button" className={botao} onClick={() => void acao.agir("aula_reserva_mudar", { p_trilha: t.slug, p_aula: a.slug, p_acao: "feita" }, "Revisão concluída. Quem escreveu foi avisado.")}>Revisão concluída</button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </details>
              ))}
            </section>
          );
        })}
      <p className="text-xs text-ink-soft">A revisão por pares é uma leitura de colega antes da fila de revisão oficial: conteúdo, fontes, linguagem simples e o modelo da aula (provocação, na vida real, leve para a sua comunidade).</p>
    </div>
  );
}
