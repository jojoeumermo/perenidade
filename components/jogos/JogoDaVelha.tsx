// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { fill } from "@/i18n/config";
import { criarSorteio, mascarar, sementeNova } from "@/lib/jogos/base";
import { empate, gerarPergunta, jogadaDoComputador, vencedor, type Marca, type Pergunta } from "@/lib/jogos/pequenos";
import { Acoes, Aviso, Botao, LinkDaAula, Opcoes, Quadro, type PropsDoJogo } from "./comum";

/** Jogo da velha com perguntas: para marcar uma casa, acerte que termo do glossário a definição descreve. */
export function JogoDaVelha({ verbetes, s, lang }: PropsDoJogo) {
  const [contraPc, setContraPc] = useState(true);
  const [tab, setTab] = useState<Marca[]>(() => Array<Marca>(9).fill(null));
  const [vez, setVez] = useState<"X" | "O">("X");
  const [casa, setCasa] = useState<number | null>(null);
  const [pergunta, setPergunta] = useState<Pergunta | null>(null);
  const [resposta, setResposta] = useState<number | null>(null);
  const [aviso, setAviso] = useState("");
  const t = s.velha;
  const ganhou = vencedor(tab);
  const fim = !!ganhou || empate(tab);

  const novo = (pc = contraPc) => {
    setTab(Array<Marca>(9).fill(null));
    setVez("X");
    setCasa(null);
    setPergunta(null);
    setResposta(null);
    setAviso("");
    setContraPc(pc);
  };
  const abrir = (i: number) => {
    if (fim || tab[i] || pergunta) return;
    setCasa(i);
    setResposta(null);
    setPergunta(gerarPergunta(verbetes, criarSorteio(sementeNova()), mascarar));
  };
  const terminarTurno = (tabuleiro: Marca[], quem: "X" | "O", msgExtra = "") => {
    setTab(tabuleiro);
    const v = vencedor(tabuleiro);
    if (v) setAviso(`${msgExtra} ${fill(t.ganhou, { marca: v.marca })}`.trim());
    else if (empate(tabuleiro)) setAviso(`${msgExtra} ${t.empate}`.trim());
    else setAviso(msgExtra);
    setVez(quem);
  };
  const responder = (i: number) => {
    if (!pergunta || casa === null || resposta !== null) return;
    setResposta(i);
    const certa = i === pergunta.certa;
    const novoTab = [...tab];
    if (certa) novoTab[casa] = vez;
    const msg = certa ? t.acertou : fill(t.errou, { termo: pergunta.termo });
    if (certa && !vencedor(novoTab) && !empate(novoTab) && contraPc) {
      // O computador marca a casa dele sem pergunta.
      const jc = jogadaDoComputador(novoTab, criarSorteio(sementeNova()));
      novoTab[jc] = "O";
      terminarTurno(novoTab, "X", `${msg} ${fill(t.pensando, { n: jc + 1 })}`);
    } else if (!certa && contraPc && !fim) {
      // Errou contra o computador: a vez passa, e ele marca uma casa.
      const jc = jogadaDoComputador(novoTab, criarSorteio(sementeNova()));
      novoTab[jc] = "O";
      terminarTurno(novoTab, "X", `${msg} ${fill(t.pensando, { n: jc + 1 })}`);
    } else {
      terminarTurno(novoTab, vez === "X" ? "O" : "X", msg);
    }
  };
  const seguir = () => {
    setPergunta(null);
    setCasa(null);
    setResposta(null);
  };
  const c = (i: number) => tab[i] ?? "";

  return (
    <Quadro>
      <Opcoes nome={t.modo} valor={contraPc ? "pc" : "2"} opcoes={[["pc", t.computador], ["2", t.dois]]} aoEscolher={(v) => novo(v === "pc")} />
      <p className="mt-3 max-w-2xl text-sm text-ink-soft">{t.instrucao}</p>
      <div className="mt-4 flex flex-col gap-6 md:flex-row">
        <div role="group" aria-label={s.treino.jogos.velha.nome} className="grid w-max grid-cols-3 gap-1.5">
          {tab.map((m, i) => (
            <button
              key={i}
              type="button"
              disabled={!!m || fim || !!pergunta}
              onClick={() => abrir(i)}
              aria-label={`${fill(t.casa, { n: i + 1 })}: ${m ?? t.livre}`}
              className={`h-20 w-20 cursor-pointer border-2 border-ink font-serif text-4xl font-bold disabled:cursor-default ${ganhou?.linha.includes(i) ? "bg-[#f0b323]/70" : casa === i ? "bg-[#fde8e6]" : "bg-white"} ${m === "X" ? "text-[#c21f16]" : "text-prelo-texto"}`}
            >
              {c(i)}
            </button>
          ))}
        </div>
        <div lang="pt-BR" className="min-w-0 flex-1">
          {pergunta && (
            <div className="border-2 border-ink bg-white p-4">
              <p className="font-mono text-xs uppercase tracking-[0.12em] text-ink-soft">{t.pergunta}</p>
              <p className="mt-1 font-serif text-lg leading-snug">{pergunta.enunciado}</p>
              <div className="mt-3 grid gap-2">
                {pergunta.opcoes.map((o, i) => (
                  <button
                    key={o}
                    type="button"
                    disabled={resposta !== null}
                    onClick={() => responder(i)}
                    className={`guia-opcao cursor-pointer text-left ${resposta !== null && i === pergunta.certa ? "border-prelo-texto! bg-prelo-texto/20!" : resposta === i ? "bg-[#fde8e6]!" : ""}`}
                  >
                    {o}
                  </button>
                ))}
              </div>
              {resposta !== null && (
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  {!fim && <Botao onClick={seguir}>{s.comum.proxima}</Botao>}
                  <LinkDaAula aula={pergunta.aula} lang={lang} rotulo={s.comum.aula} />
                </div>
              )}
              {resposta === null && <Botao className="mt-3" onClick={seguir}>{t.cancelar}</Botao>}
            </div>
          )}
          {!pergunta && !fim && <p className="font-bold">{fill(t.vezDe, { marca: vez })}</p>}
        </div>
      </div>
      <Acoes>
        <Botao onClick={() => novo()}>{s.comum.novo}</Botao>
      </Acoes>
      <Aviso>{aviso}</Aviso>
    </Quadro>
  );
}
