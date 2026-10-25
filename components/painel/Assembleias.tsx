// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { can, type Me } from "@/lib/backend";
import { NOMES_DOS_DEPARTAMENTOS } from "./Departamentos";
import { Aviso, botao, botaoClaro, campo, dataHora, elo, useAcao, useLista } from "./comum";

// Assembleias e votações (supabase/install.sql, "Assembleias e votações"): a coordenação abre para a equipe toda; o
// representante, para o departamento dele. Voto secreto de verdade e resultado só depois do fim.

interface Votacao {
  id: string;
  titulo: string;
  descricao: string;
  opcoes: string[];
  departamento: string | null;
  secreta: boolean;
  encerra_em: string;
  terminou_em: string;
  encerrada: boolean;
  criada_por: string;
  minha: boolean;
  posso_votar: boolean;
  votei: boolean;
  votantes: number;
  aptos: number;
  resultado: { opcao: number; texto: string; votos: number; quem: string[] | null }[] | null;
}

const emUmaSemana = () => {
  const d = new Date(Date.now() + 7 * 86_400_000);
  d.setMinutes(0, 0, 0);
  const dois = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}T${dois(d.getHours())}:00`;
};

export function Assembleias({ me }: { me: Me }) {
  const lista = useLista<Votacao[]>("votacoes_listar");
  const acao = useAcao(lista.recarregar);
  const [escolhas, setEscolhas] = useState<Record<string, number>>({});
  const [nova, setNova] = useState(false);
  const representa = me.papeis.filter((p) => p.papel === "representante" && p.disciplina && NOMES_DOS_DEPARTAMENTOS[p.disciplina]).map((p) => p.disciplina as string);
  const abre = can(me, "coordenacao") || representa.length > 0;
  const abertas = (lista.dados ?? []).filter((v) => !v.encerrada);
  const fechadas = (lista.dados ?? []).filter((v) => v.encerrada);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-ink-soft">
          Decisões da equipe por voto. No voto secreto, o banco guarda que você votou separado do voto, sem nada que ligue um ao outro. O resultado só aparece no fim, para ninguém ir atrás da maioria.
        </p>
        {abre && !nova && <button type="button" className={botao} onClick={() => setNova(true)}>＋ Abrir uma votação</button>}
      </div>
      {nova && <NovaVotacao coordena={can(me, "coordenacao")} representa={representa} fechar={() => setNova(false)} depois={lista.recarregar} />}
      <Aviso texto={lista.erro || acao.aviso} />

      <section aria-labelledby="abertas">
        <h2 id="abertas" className="font-serif text-2xl font-semibold">Abertas</h2>
        {abertas.length === 0 && <p className="mt-2 text-ink-soft">Nenhuma votação aberta agora.</p>}
        <ul className="mt-3 space-y-4">
          {abertas.map((v) => (
            <li key={v.id} className="border-2 border-ink bg-folha p-5 shadow-[4px_4px_0_var(--sombra)]">
              <p className="font-mono text-[0.66rem] uppercase tracking-[0.18em] text-prelo-texto">
                {v.departamento ? `Departamento · ${NOMES_DOS_DEPARTAMENTOS[v.departamento] ?? v.departamento}` : "Toda a equipe"} · {v.secreta ? "voto secreto" : "voto aberto"} · até {dataHora(v.encerra_em)}
              </p>
              <h3 className="mt-1 font-serif text-xl font-semibold leading-snug">{v.titulo}</h3>
              {v.descricao && <p className="mt-1 whitespace-pre-line text-sm" data-original>{v.descricao}</p>}
              <p className="mt-2 text-xs text-ink-soft">
                {v.votantes} de {v.aptos} já votaram · aberta por {v.criada_por || "a coordenação"}
              </p>
              {v.votei ? (
                <p className="mt-3 font-semibold text-ok">✓ Você já votou. O resultado sai no fim.</p>
              ) : v.posso_votar ? (
                <fieldset className="mt-3">
                  <legend className="sr-only">Seu voto</legend>
                  <div className="flex flex-col gap-1.5">
                    {v.opcoes.map((opcao, i) => (
                      <label key={opcao} className="flex cursor-pointer items-center gap-2">
                        <input type="radio" name={`voto-${v.id}`} checked={escolhas[v.id] === i} onChange={() => setEscolhas({ ...escolhas, [v.id]: i })} />
                        {opcao}
                      </label>
                    ))}
                  </div>
                  <button type="button" className={`${botao} mt-3`} disabled={acao.ocupado || escolhas[v.id] === undefined} onClick={() => void acao.agir("votar", { p_id: v.id, p_opcao: escolhas[v.id] }, "Voto registrado. Obrigado por decidir junto.")}>
                    Votar
                  </button>
                  <p className="mt-1 text-xs text-ink-soft">O voto é final: não dá para mudar depois.</p>
                </fieldset>
              ) : (
                <p className="mt-3 text-sm text-ink-soft">Esta votação é de outro departamento.</p>
              )}
              {(v.minha || can(me, "coordenacao")) && (
                <button type="button" className={`${elo} mt-3 text-sm`} disabled={acao.ocupado} onClick={() => void acao.agir("votacao_encerrar", { p_id: v.id }, "Votação encerrada. O resultado já aparece.")}>
                  Encerrar agora
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>

      {fechadas.length > 0 && (
        <section aria-labelledby="fechadas">
          <h2 id="fechadas" className="font-serif text-2xl font-semibold">Decididas</h2>
          <ul className="mt-3 space-y-4">
            {fechadas.map((v) => {
              const total = (v.resultado ?? []).reduce((soma, r) => soma + r.votos, 0);
              const maior = Math.max(0, ...(v.resultado ?? []).map((r) => r.votos));
              return (
                <li key={v.id} className="border-2 border-ink bg-parchment-deep p-5">
                  <p className="font-mono text-[0.66rem] uppercase tracking-[0.18em] text-ink-soft">
                    {v.departamento ? NOMES_DOS_DEPARTAMENTOS[v.departamento] ?? v.departamento : "Toda a equipe"} · terminou em {dataHora(v.terminou_em ?? v.encerra_em)} · {v.votantes} de {v.aptos} votaram
                  </p>
                  <h3 className="mt-1 font-serif text-xl font-semibold leading-snug">{v.titulo}</h3>
                  <ul className="mt-3 space-y-2">
                    {(v.resultado ?? []).map((r) => {
                      const pct = total ? Math.round((r.votos / total) * 100) : 0;
                      return (
                        <li key={r.opcao}>
                          <p className="flex justify-between gap-3 text-sm">
                            <span className={r.votos === maior && maior > 0 ? "font-bold" : ""}>{r.texto}</span>
                            <span className="font-mono">{r.votos} · {pct}%</span>
                          </p>
                          <div className="mt-1 h-2 border border-ink bg-parchment" aria-hidden>
                            <div className={`h-full ${r.votos === maior && maior > 0 ? "bg-[#c21f16]" : "bg-ink-soft"}`} style={{ width: `${pct}%` }} />
                          </div>
                          {r.quem && r.quem.length > 0 && <p className="mt-0.5 text-xs text-ink-soft">{r.quem.join(", ")}</p>}
                        </li>
                      );
                    })}
                  </ul>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

function NovaVotacao({ coordena, representa, fechar, depois }: { coordena: boolean; representa: string[]; fechar: () => void; depois: () => void }) {
  const acao = useAcao(depois);
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [opcoes, setOpcoes] = useState(["Sim", "Não", "Abstenção"]);
  const [departamento, setDepartamento] = useState(coordena ? "" : (representa[0] ?? ""));
  const [secreta, setSecreta] = useState(true);
  const [fim, setFim] = useState(emUmaSemana);
  return (
    <form
      className="space-y-3 border-2 border-ink bg-folha p-5"
      onSubmit={async (e) => {
        e.preventDefault();
        const ok = await acao.agir("votacao_criar", { p: { titulo, descricao, opcoes, departamento, secreta, encerra_em: new Date(fim).toISOString() } }, "Votação aberta: quem vota recebeu um recado.");
        if (ok !== null) fechar();
      }}
    >
      <label className="block text-sm">
        A pergunta
        <input value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={160} className={campo} placeholder="Mudar a reunião geral para sábado?" />
      </label>
      <label className="block text-sm">
        O contexto (os argumentos dos dois lados, o que muda)
        <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} maxLength={4000} rows={4} className={campo} />
      </label>
      <fieldset>
        <legend className="text-sm">As opções (de 2 a 8)</legend>
        <ul className="mt-1 space-y-1.5">
          {opcoes.map((opcao, i) => (
            <li key={i} className="flex items-center gap-2">
              <input value={opcao} onChange={(e) => setOpcoes(opcoes.map((o, j) => (j === i ? e.target.value : o)))} maxLength={120} aria-label={`Opção ${i + 1}`} className="painel-campo min-w-0 flex-1 border-2 border-ink bg-parchment-deep px-2 py-1" />
              {opcoes.length > 2 && <button type="button" className={`${elo} text-xs`} onClick={() => setOpcoes(opcoes.filter((_, j) => j !== i))}>tirar</button>}
            </li>
          ))}
        </ul>
        {opcoes.length < 8 && <button type="button" className={`${elo} mt-1 text-sm`} onClick={() => setOpcoes([...opcoes, ""])}>+ opção</button>}
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          Quem vota
          <select value={departamento} onChange={(e) => setDepartamento(e.target.value)} className={campo}>
            {coordena && <option value="">Toda a equipe</option>}
            {(coordena ? Object.keys(NOMES_DOS_DEPARTAMENTOS) : representa).map((id) => (
              <option key={id} value={id}>Departamento: {NOMES_DOS_DEPARTAMENTOS[id] ?? id}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          Termina em
          <input type="datetime-local" value={fim} onChange={(e) => setFim(e.target.value)} className={campo} />
        </label>
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={secreta} onChange={(e) => setSecreta(e.target.checked)} className="mt-1" />
        <span>Voto secreto (recomendado). Sem marcar, o resultado mostra quem votou em quê.</span>
      </label>
      <Aviso texto={acao.aviso} />
      <p className="flex flex-wrap gap-2">
        <button type="submit" className={botao} disabled={acao.ocupado || titulo.trim().length < 5 || opcoes.filter((o) => o.trim()).length < 2}>Abrir a votação</button>
        <button type="button" className={botaoClaro} onClick={fechar}>Cancelar</button>
      </p>
    </form>
  );
}
