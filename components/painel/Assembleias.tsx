// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { CircleCheck, Lock, LockOpen, Plus, Square, Vote, X } from "lucide-react";
import { useState } from "react";
import { can, type Me } from "@/lib/backend";
import { NOMES_DOS_DEPARTAMENTOS } from "./Departamentos";
import { Aviso, dataHora, useAcao, useLista } from "./comum";
import { Area, Botao, CabecalhoDeSecao, Campo, Cartao, Esqueleto, Marca, Selecao, Selo, Vazio } from "./ui";

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
    <div className="pn-tela">
      <div className="pn-tela-cabeca">
        <p className="max-w-2xl text-sm text-ink-soft">
          Decisões da equipe por voto. No voto secreto, o banco guarda que você votou separado do voto, sem nada que ligue um ao outro. O resultado só aparece no fim, para ninguém ir atrás da maioria.
        </p>
        {abre && !nova && (
          <Botao variante="principal" simbolo={Plus} onClick={() => setNova(true)}>
            Abrir uma votação
          </Botao>
        )}
      </div>
      {nova && <NovaVotacao coordena={can(me, "coordenacao")} representa={representa} fechar={() => setNova(false)} depois={lista.recarregar} />}
      <Aviso texto={lista.erro || acao.aviso} />

      <section aria-labelledby="abertas" className="space-y-3">
        <CabecalhoDeSecao id="abertas" titulo="Abertas" simbolo={Vote} />
        {!lista.dados && !lista.erro && <Esqueleto forma="cartoes" linhas={2} />}
        {lista.dados && abertas.length === 0 && <Vazio simbolo={Vote} titulo="Nenhuma votação aberta agora." />}
        <ul className="space-y-4">
          {abertas.map((v) => (
            <li key={v.id}>
              <Cartao as="article" variante="destaque" titulo={v.titulo} nivelDoTitulo={3}>
                <p className="mt-1 flex flex-wrap items-center gap-1.5">
                  <Selo tom="info">{v.departamento ? `Departamento · ${NOMES_DOS_DEPARTAMENTOS[v.departamento] ?? v.departamento}` : "Toda a equipe"}</Selo>
                  <Selo tom={v.secreta ? "bordo" : "neutro"}>
                    {v.secreta ? <Lock aria-hidden className="h-3 w-3" /> : <LockOpen aria-hidden className="h-3 w-3" />}
                    {v.secreta ? "voto secreto" : "voto aberto"}
                  </Selo>
                  <span className="pn-rotulo-mono">até {dataHora(v.encerra_em)}</span>
                </p>
                {v.descricao && (
                  <p className="mt-2 whitespace-pre-line text-sm" data-original>
                    {v.descricao}
                  </p>
                )}
                <p className="pn-ajuda mt-2 tabular-nums">
                  {v.votantes} de {v.aptos} já votaram · aberta por {v.criada_por || "a coordenação"}
                </p>
                {v.votei ? (
                  <p className="mt-3">
                    <Selo tom="ok">
                      <CircleCheck aria-hidden className="h-3.5 w-3.5" />
                      Você já votou. O resultado sai no fim.
                    </Selo>
                  </p>
                ) : v.posso_votar ? (
                  <fieldset className="mt-3">
                    <legend className="sr-only">Seu voto</legend>
                    <div className="flex flex-col gap-1.5">
                      {v.opcoes.map((opcao, i) => (
                        <label key={opcao} className="pn-marca">
                          <input type="radio" name={`voto-${v.id}`} checked={escolhas[v.id] === i} onChange={() => setEscolhas({ ...escolhas, [v.id]: i })} />
                          <span>{opcao}</span>
                        </label>
                      ))}
                    </div>
                    <Botao className="mt-3" simbolo={Vote} disabled={escolhas[v.id] === undefined} carregando={acao.ocupado} onClick={() => void acao.agir("votar", { p_id: v.id, p_opcao: escolhas[v.id] }, "Voto registrado. Obrigado por decidir junto.")}>
                      Votar
                    </Botao>
                    <p className="pn-ajuda mt-1">O voto é final: não dá para mudar depois.</p>
                  </fieldset>
                ) : (
                  <p className="pn-ajuda mt-3">Esta votação é de outro departamento.</p>
                )}
                {(v.minha || can(me, "coordenacao")) && (
                  <Botao variante="discreto" pequeno className="mt-3" simbolo={Square} disabled={acao.ocupado} onClick={() => void acao.agir("votacao_encerrar", { p_id: v.id }, "Votação encerrada. O resultado já aparece.")}>
                    Encerrar agora
                  </Botao>
                )}
              </Cartao>
            </li>
          ))}
        </ul>
      </section>

      {fechadas.length > 0 && (
        <section aria-labelledby="fechadas" className="space-y-3">
          <CabecalhoDeSecao id="fechadas" titulo="Decididas" simbolo={CircleCheck} />
          <ul className="space-y-4">
            {fechadas.map((v) => {
              const total = (v.resultado ?? []).reduce((soma, r) => soma + r.votos, 0);
              const maior = Math.max(0, ...(v.resultado ?? []).map((r) => r.votos));
              return (
                <li key={v.id}>
                  <Cartao as="article" variante="plano" titulo={v.titulo} nivelDoTitulo={3}>
                    <p className="pn-rotulo-mono mt-1">
                      {v.departamento ? (NOMES_DOS_DEPARTAMENTOS[v.departamento] ?? v.departamento) : "Toda a equipe"} · terminou em {dataHora(v.terminou_em ?? v.encerra_em)} · {v.votantes} de {v.aptos} votaram
                    </p>
                    <ul className="mt-3 space-y-2">
                      {(v.resultado ?? []).map((r) => {
                        const pct = total ? Math.round((r.votos / total) * 100) : 0;
                        const venceu = r.votos === maior && maior > 0;
                        return (
                          <li key={r.opcao}>
                            <p className="flex justify-between gap-3 text-sm">
                              <span className={venceu ? "font-bold" : ""}>{r.texto}</span>
                              <span className="font-mono tabular-nums">
                                {r.votos} · {pct}%
                              </span>
                            </p>
                            <div className="mt-1 h-2 overflow-hidden rounded-full border border-rule bg-parchment" aria-hidden>
                              <div className={`h-full rounded-full ${venceu ? "bg-oxblood" : "bg-ink-soft"}`} style={{ width: `${pct}%` }} />
                            </div>
                            {r.quem && r.quem.length > 0 && <p className="pn-ajuda mt-0.5">{r.quem.join(", ")}</p>}
                          </li>
                        );
                      })}
                    </ul>
                  </Cartao>
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
    <Cartao as="div">
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          const ok = await acao.agir("votacao_criar", { p: { titulo, descricao, opcoes, departamento, secreta, encerra_em: new Date(fim).toISOString() } }, "Votação aberta: quem vota recebeu um recado.");
          if (ok !== null) fechar();
        }}
      >
        <Campo rotulo="A pergunta" value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={160} placeholder="Mudar a reunião geral para sábado?" />
        <Area rotulo="O contexto (os argumentos dos dois lados, o que muda)" value={descricao} onChange={(e) => setDescricao(e.target.value)} maxLength={4000} rows={4} />
        <fieldset>
          <legend className="pn-rotulo">As opções (de 2 a 8)</legend>
          <ul className="mt-1 space-y-1.5">
            {opcoes.map((opcao, i) => (
              <li key={i} className="flex items-center gap-2">
                <input value={opcao} onChange={(e) => setOpcoes(opcoes.map((o, j) => (j === i ? e.target.value : o)))} maxLength={120} aria-label={`Opção ${i + 1}`} className="pn-campo min-w-0 flex-1" />
                {opcoes.length > 2 && (
                  <Botao variante="discreto" pequeno simbolo={X} aria-label={`Tirar a opção ${i + 1}`} onClick={() => setOpcoes(opcoes.filter((_, j) => j !== i))}>
                    tirar
                  </Botao>
                )}
              </li>
            ))}
          </ul>
          {opcoes.length < 8 && (
            <Botao variante="discreto" pequeno className="mt-1" simbolo={Plus} onClick={() => setOpcoes([...opcoes, ""])}>
              Mais uma opção
            </Botao>
          )}
        </fieldset>
        <div className="grid gap-3 sm:grid-cols-2">
          <Selecao rotulo="Quem vota" value={departamento} onChange={(e) => setDepartamento(e.target.value)}>
            {coordena && <option value="">Toda a equipe</option>}
            {(coordena ? Object.keys(NOMES_DOS_DEPARTAMENTOS) : representa).map((id) => (
              <option key={id} value={id}>
                Departamento: {NOMES_DOS_DEPARTAMENTOS[id] ?? id}
              </option>
            ))}
          </Selecao>
          <Campo rotulo="Termina em" type="datetime-local" value={fim} onChange={(e) => setFim(e.target.value)} />
        </div>
        <Marca rotulo="Voto secreto (recomendado). Sem marcar, o resultado mostra quem votou em quê." checked={secreta} onChange={(e) => setSecreta(e.target.checked)} />
        <Aviso texto={acao.aviso} />
        <p className="flex flex-wrap gap-2">
          <Botao type="submit" variante="principal" simbolo={Vote} disabled={titulo.trim().length < 5 || opcoes.filter((o) => o.trim()).length < 2} carregando={acao.ocupado}>
            Abrir a votação
          </Botao>
          <Botao onClick={fechar}>Cancelar</Botao>
        </p>
      </form>
    </Cartao>
  );
}
