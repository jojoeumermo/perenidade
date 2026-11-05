// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { criarSorteio, mascarar, palavrasParaLetras, sementeNova } from "@/lib/jogos/base";
import { gerarQuebra, type Quebra } from "@/lib/jogos/pequenos";
import { Acoes, Aviso, Botao, Opcoes, Quadro, type PropsDoJogo } from "./comum";

/** Quebra-cabeça de palavras: ponha as letras de um termo, ou as palavras de uma definição, na ordem certa. */
export function QuebraPalavras({ verbetes, s }: PropsDoJogo) {
  const [modo, setModo] = useState<"letras" | "frase">("letras");
  const montar = (m: "letras" | "frase"): Quebra => gerarQuebra(m, palavrasParaLetras(verbetes, 4, 10), verbetes, criarSorteio(sementeNova()), mascarar);
  const [q, setQ] = useState<Quebra>(() => montar("letras"));
  const [escolhidas, setEscolhidas] = useState<number[]>([]);
  const [aviso, setAviso] = useState("");
  const t = s.quebra;

  const novo = (m = modo) => {
    setQ(montar(m));
    setEscolhidas([]);
    setAviso("");
  };
  const textoMontado = escolhidas.map((id) => q.pecas.find((p) => p.id === id)?.texto ?? "");
  const conferir = () => setAviso(textoMontado.join("\u0000") === q.certa.join("\u0000") ? t.certo : t.errado);
  const ehLetras = q.modo === "letras";

  return (
    <Quadro>
      <Opcoes nome={t.modo} valor={modo} opcoes={[["letras", t.letras], ["frase", t.frase]]} aoEscolher={(m) => { setModo(m); novo(m); }} />
      <p className="mt-3 max-w-2xl text-sm text-ink-soft">{ehLetras ? t.instrucaoLetras : t.instrucaoFrase}</p>
      <p lang="pt-BR" className="mt-3 font-serif text-lg leading-snug">
        <span className="font-mono text-xs uppercase tracking-[0.12em] text-ink-soft">{ehLetras ? t.dicaDe : t.termoDe}: </span>
        {q.dica}
      </p>
      <p className="mt-4 font-mono text-xs uppercase tracking-[0.12em] text-ink-soft">{t.montagem}</p>
      <div lang="pt-BR" aria-label={t.montagem} className="mt-1 flex min-h-12 flex-wrap gap-1.5 border-2 border-dashed border-ink p-2">
        {escolhidas.length === 0 && <span className="text-ink-soft">{t.vazia}</span>}
        {escolhidas.map((id, pos) => (
          <button key={id} type="button" onClick={() => { setEscolhidas((e) => e.filter((x) => x !== id)); setAviso(""); }} aria-label={`${textoMontado[pos]} (${pos + 1})`} className="cursor-pointer border-2 border-ink bg-white px-2.5 py-1 font-mono font-bold">
            {textoMontado[pos]}
          </button>
        ))}
      </div>
      <p className="mt-4 font-mono text-xs uppercase tracking-[0.12em] text-ink-soft">{t.pecas}</p>
      <div lang="pt-BR" className="mt-1 flex flex-wrap gap-1.5">
        {q.pecas.map((p) => (
          <button key={p.id} type="button" disabled={escolhidas.includes(p.id)} onClick={() => { setEscolhidas((e) => [...e, p.id]); setAviso(""); }} className="cursor-pointer border-2 border-ink bg-parchment-deep px-2.5 py-1 font-mono font-bold hover:bg-[#f0b323]/50 disabled:cursor-default disabled:opacity-30">
            {p.texto}
          </button>
        ))}
      </div>
      <Acoes>
        <Botao onClick={conferir} disabled={escolhidas.length === 0}>{s.comum.conferir}</Botao>
        <Botao onClick={() => { setEscolhidas((e) => e.slice(0, -1)); setAviso(""); }}>{s.comum.apagar}</Botao>
        <Botao onClick={() => { setEscolhidas([]); setAviso(""); }}>{s.comum.limpar}</Botao>
        <Botao onClick={() => { setEscolhidas(ordemCerta(q)); setAviso(""); }}>{s.comum.mostrar}</Botao>
        <Botao onClick={() => novo()}>{s.comum.novo}</Botao>
      </Acoes>
      <Aviso>{aviso}</Aviso>
    </Quadro>
  );
}

/** Os ids das peças na ordem certa (peças iguais, como duas letras A, são usadas uma vez cada). */
function ordemCerta(q: Quebra): number[] {
  const usados = new Set<number>();
  return q.certa.map((texto) => {
    const peca = q.pecas.find((p) => p.texto === texto && !usados.has(p.id))!;
    usados.add(peca.id);
    return peca.id;
  });
}
