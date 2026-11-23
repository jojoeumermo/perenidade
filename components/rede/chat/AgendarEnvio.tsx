// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// O envio agendado (Prompt 4, item 18, atrás de "alumia-p4-conversa"): escolher a hora em que o texto do campo sai. A mensagem fica
// SÓ neste aparelho (cifrada, na loja do chat) e sai pelo caminho de sempre na hora, se o aparelho estiver ligado com a Alumia
// aberta (a tela do chat confere a cada 30 s: lib/rede/chat-chaveiro.ts, enviarAgendadas). O servidor não sabe que ela existe antes
// de sair. A tela avisa disso com todas as letras. Alvos de toque de 44 px; sem animação.
import { useId, useState } from "react";
import { AGENDAR_ATE, AGENDAR_DE, horaValida } from "@/lib/rede/chat/agendar";
import type { TextosDaConversaP4 } from "@/lib/rede/textos-p4-conversa";
import { botaoForte, botaoLeve } from "./comum";

type T = TextosDaConversaP4["agendar"];

/** A data e hora local no formato do campo datetime-local (AAAA-MM-DDTHH:MM). */
export function paraCampo(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function AgendarEnvio({ t, desligado, aoAgendar, aoFechar }: {
  t: T;
  desligado: boolean;
  /** Agenda o texto do campo para esta hora (ms). */
  aoAgendar: (quando: number) => Promise<void>;
  aoFechar: () => void;
}) {
  const id = useId();
  // A hora de abrir a janela (fixa enquanto ela está aberta): daqui a uma hora, e os limites do campo.
  const [aberta] = useState(() => Date.now());
  const [valor, setValor] = useState(() => paraCampo(aberta + 3_600_000));
  const [ocupado, setOcupado] = useState(false);
  const [recado, setRecado] = useState("");

  async function agendar() {
    if (ocupado || desligado) return;
    const quando = new Date(valor).getTime();
    if (!horaValida(quando, Date.now())) {
      setRecado(t.hora);
      return;
    }
    setOcupado(true);
    setRecado("");
    try {
      await aoAgendar(quando);
      aoFechar();
    } catch {
      setRecado(t.erro);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <section aria-labelledby={`${id}-titulo`} className="mt-2 rounded-xl border border-rule bg-parchment-deep px-3 py-3 text-sm" data-agendar>
      <h2 id={`${id}-titulo`} className="font-semibold">{t.titulo}</h2>
      <p className="mt-1 text-xs font-semibold" role="note">{t.aviso}</p>
      <label className="mt-2 flex flex-col gap-1 text-xs" htmlFor={`${id}-quando`}>
        <span>{t.quando}</span>
        <input
          id={`${id}-quando`}
          type="datetime-local"
          value={valor}
          min={paraCampo(aberta + AGENDAR_DE)}
          max={paraCampo(aberta + AGENDAR_ATE)}
          onChange={(e) => setValor(e.target.value)}
          className="min-h-11 rounded-md border border-rule bg-parchment px-2"
        />
      </label>
      {recado && <p role="alert" className="mt-2 font-semibold text-oxblood">{recado}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className={botaoForte} disabled={ocupado || desligado} onClick={() => void agendar()}>{t.confirmar}</button>
        <button type="button" className={botaoLeve} onClick={aoFechar}>{t.cancelar}</button>
      </div>
    </section>
  );
}
