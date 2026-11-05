// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useMemo, useState } from "react";
import { executarPassoAPasso, type Linguagem, MAX_CODIGO, MAX_PASSOS } from "@/lib/execucao-passo-a-passo";
import type { Simulador } from "@/lib/simuladores-aula";

// O visualizador de execução: o programa roda UM PASSO por vez, e a pessoa vê a linha, as variáveis, a pilha de chamadas e
// a saída. O código é lido por um interpretador pequeno do próprio site (lib/execucao-passo-a-passo.ts): não vai para
// servidor nenhum, não é executado pelo navegador (sem eval) e não precisa de internet depois de carregado.

const botao = "cursor-pointer border-2 border-ink px-3 py-1.5 font-bold hover:border-oxblood hover:text-oxblood disabled:cursor-not-allowed disabled:opacity-40";

export function VisualizadorDeExecucao({ simulador }: { simulador: Simulador }) {
  const [linguagem, setLinguagem] = useState<Linguagem>(simulador.tipo === "execucao-js" ? "js" : "python");
  const [codigo, setCodigo] = useState(simulador.codigo);
  const [editando, setEditando] = useState(false);
  const [passo, setPasso] = useState(0);
  const exec = useMemo(() => executarPassoAPasso(codigo, linguagem), [codigo, linguagem]);
  const n = exec.passos.length;
  const atual = n ? exec.passos[Math.min(passo, n - 1)] : null;
  const linhas = codigo.replace(/\r\n?/g, "\n").split("\n");
  const noFim = n > 0 && passo >= n - 1;

  const mudarCodigo = (c: string) => {
    setCodigo(c.slice(0, MAX_CODIGO));
    setPasso(0);
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2">
          Linguagem
          <select
            value={linguagem}
            onChange={(e) => {
              setLinguagem(e.target.value as Linguagem);
              setPasso(0);
            }}
            className="border-2 border-ink/30 bg-parchment px-2 py-1"
          >
            <option value="python">Python</option>
            <option value="js">JavaScript</option>
          </select>
        </label>
        <button type="button" className={botao} aria-pressed={editando} onClick={() => setEditando((v) => !v)}>
          {editando ? "Ver o passo a passo" : "Editar o código"}
        </button>
      </div>

      {editando ? (
        <label className="mt-3 block">
          Seu programa (até {MAX_CODIGO} letras). Ele só é lido aqui no seu aparelho; nada é enviado.
          <textarea value={codigo} onChange={(e) => mudarCodigo(e.target.value)} rows={10} spellCheck={false} maxLength={MAX_CODIGO} className="mt-1 w-full border-2 border-ink/30 bg-parchment p-2 font-mono text-xs" />
        </label>
      ) : (
        <ol className="mt-3 overflow-x-auto border-2 border-ink/30 bg-parchment font-mono text-xs" aria-label="Código do programa">
          {linhas.map((l, i) => {
            const ativa = atual?.linha === i + 1;
            const erro = exec.erro?.linha === i + 1 && noFim;
            return (
              <li key={i} aria-current={ativa ? "step" : undefined} className={`flex gap-2 px-2 py-0.5 ${ativa ? "bg-gold/40 font-bold" : ""} ${erro ? "bg-[#f6d4cf]" : ""}`}>
                <span className="w-6 shrink-0 select-none text-right text-ink-soft">{i + 1}</span>
                <span className="whitespace-pre">{l || " "}</span>
              </li>
            );
          })}
        </ol>
      )}

      {exec.erro && n === 0 && (
        <p role="alert" className="mt-3 border-l-4 border-oxblood bg-[#f6d4cf] p-2">
          Linha {exec.erro.linha}: {exec.erro.mensagem}
        </p>
      )}

      {n > 0 && !editando && (
        <>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" className={botao} disabled={passo === 0} onClick={() => setPasso(0)} aria-label="Voltar ao primeiro passo">
              ⏮
            </button>
            <button type="button" className={botao} disabled={passo === 0} onClick={() => setPasso((p) => Math.max(0, p - 1))}>
              ◀ Voltar
            </button>
            <button type="button" className={botao} disabled={noFim} onClick={() => setPasso((p) => Math.min(n - 1, p + 1))}>
              Avançar ▶
            </button>
            <button type="button" className={botao} disabled={noFim} onClick={() => setPasso(n - 1)} aria-label="Ir ao último passo">
              ⏭
            </button>
            <label className="ml-1 flex items-center gap-2">
              <span>
                Passo <strong className="font-mono">{passo + 1}</strong> de <strong className="font-mono">{n}</strong>
              </span>
              <input type="range" min={0} max={n - 1} value={Math.min(passo, n - 1)} onChange={(e) => setPasso(Number(e.target.value))} aria-label="Escolher o passo" />
            </label>
          </div>

          <p role="status" aria-live="polite" className="mt-3 border-l-4 border-gold bg-parchment-deep p-2">
            <strong>Linha {atual?.linha}:</strong> {atual?.nota}.
          </p>
          {noFim && exec.erro && (
            <p role="alert" className="mt-2 border-l-4 border-oxblood bg-[#f6d4cf] p-2">
              Depois deste passo o programa parou na linha {exec.erro.linha}: {exec.erro.mensagem}
            </p>
          )}
          {noFim && exec.truncado && (
            <p role="status" className="mt-2 border-l-4 border-oxblood bg-parchment-deep p-2">
              Parei em {MAX_PASSOS} passos para não travar o aparelho. Um laço que nunca termina (a condição nunca fica falsa) é um erro comum: confira se a variável do laço muda.
            </p>
          )}

          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
            <section className="border-2 border-ink/20 bg-parchment-deep p-3" aria-label="Variáveis">
              <h4 className="font-mono text-[0.65rem] uppercase tracking-widest text-oxblood">Variáveis</h4>
              {atual && atual.vars.length > 0 ? (
                <table className="mt-1 w-full font-mono text-xs">
                  <tbody>
                    {atual.vars.map((v) => (
                      <tr key={v.nome}>
                        <th scope="row" className="pr-2 text-left font-bold">
                          {v.nome}
                        </th>
                        <td className="break-all">{v.valor}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="mt-1 text-ink-soft">Ainda nenhuma.</p>
              )}
            </section>
            <section className="border-2 border-ink/20 bg-parchment-deep p-3" aria-label="Pilha de chamadas">
              <h4 className="font-mono text-[0.65rem] uppercase tracking-widest text-oxblood">Pilha de chamadas</h4>
              <ol className="mt-1 flex flex-col-reverse gap-1 font-mono text-xs">
                {atual?.pilha.map((q, i) => (
                  <li key={i} className={`border-2 px-2 py-1 ${i === (atual.pilha.length - 1) ? "border-ink bg-parchment" : "border-ink/30"}`}>
                    <strong>{q.nome}</strong>
                    {q.vars.length > 0 && <span className="block text-ink-soft">{q.vars.map((v) => `${v.nome}=${v.valor}`).join("  ")}</span>}
                  </li>
                ))}
              </ol>
              <p className="mt-1 text-ink-soft">O quadro de cima é o que está rodando agora.</p>
            </section>
            <section className="border-2 border-ink/20 bg-parchment-deep p-3" aria-label="Saída do programa">
              <h4 className="font-mono text-[0.65rem] uppercase tracking-widest text-oxblood">Saída</h4>
              {atual && atual.saida.length > 0 ? <pre className="mt-1 whitespace-pre-wrap font-mono text-xs">{atual.saida.join("\n")}</pre> : <p className="mt-1 text-ink-soft">Ainda nada escrito.</p>}
            </section>
          </div>
        </>
      )}
      <p className="mt-3 text-ink-soft">
        É um interpretador pequeno: entende variáveis, contas, if, while, for, listas e funções, mas não classes, importações nem leitura do teclado. Se algo não for entendido, ele diz qual linha e por quê.
      </p>
    </div>
  );
}
