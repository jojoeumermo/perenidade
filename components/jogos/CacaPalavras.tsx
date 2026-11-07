// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useRef, useState } from "react";
import { fill } from "@/i18n/config";
import { criarSorteio, palavrasParaLetras, sementeNova, sortear } from "@/lib/jogos/base";
import { celulasDe, gerarCacaPalavras, palavraNoTraco, type CacaPalavras as Jogo } from "@/lib/jogos/grades";
import { Acoes, Aviso, Botao, Opcoes, Quadro, type PropsDoJogo } from "./comum";

function montar(verbetes: PropsDoJogo["verbetes"], facil: boolean): { jogo: Jogo; termos: Record<string, string> } {
  const rnd = criarSorteio(sementeNova());
  const tamanho = facil ? 9 : 12;
  const escolhidas = sortear(palavrasParaLetras(verbetes, 4, tamanho - 1), facil ? 6 : 9, rnd);
  const jogo = gerarCacaPalavras(escolhidas.map((p) => p.palavra), tamanho, rnd, facil);
  return { jogo, termos: Object.fromEntries(escolhidas.map((p) => [p.palavra, p.termo])) };
}

/** Caça-palavras: os termos escondidos vêm do glossário. Fácil: só da esquerda para a direita e de cima para baixo. */
export function CacaPalavras({ verbetes, s }: PropsDoJogo) {
  const [facil, setFacil] = useState(true);
  const [partida, setPartida] = useState(() => montar(verbetes, true));
  const [inicio, setInicio] = useState<[number, number] | null>(null);
  const [achadas, setAchadas] = useState<string[]>([]);
  const [aviso, setAviso] = useState("");
  const [foco, setFoco] = useState<[number, number]>([0, 0]);
  const celulas = useRef(new Map<string, HTMLButtonElement>());
  const t = s.caca;
  const { jogo, termos } = partida;

  const novo = (f = facil) => {
    setPartida(montar(verbetes, f));
    setInicio(null);
    setAchadas([]);
    setAviso("");
    setFoco([0, 0]);
  };
  const marcadas = new Set(jogo.colocadas.filter((p) => achadas.includes(p.palavra)).flatMap((p) => celulasDe(p).map(([r, c]) => `${r},${c}`)));

  const escolher = (r: number, c: number) => {
    setFoco([r, c]);
    if (!inicio) {
      setInicio([r, c]);
      setAviso(fill(t.inicio, { r: r + 1, c: c + 1 }));
      return;
    }
    const p = palavraNoTraco(jogo, inicio[0], inicio[1], r, c);
    setInicio(null);
    if (p && !achadas.includes(p.palavra)) {
      const novas = [...achadas, p.palavra];
      setAchadas(novas);
      setAviso(novas.length === jogo.colocadas.length ? s.comum.terminou : fill(t.achou, { palavra: termos[p.palavra] ?? p.palavra }));
    } else if (!p) setAviso(t.tentou);
    else setAviso("");
  };
  const aoTecla = (e: React.KeyboardEvent, r: number, c: number) => {
    const mapa: Record<string, [number, number]> = { ArrowRight: [0, 1], ArrowLeft: [0, -1], ArrowDown: [1, 0], ArrowUp: [-1, 0] };
    const m = mapa[e.key];
    if (!m) return;
    e.preventDefault();
    const rr = Math.max(0, Math.min(jogo.tamanho - 1, r + m[0]));
    const cc = Math.max(0, Math.min(jogo.tamanho - 1, c + m[1]));
    setFoco([rr, cc]);
    celulas.current.get(`${rr},${cc}`)?.focus();
  };

  return (
    <Quadro>
      <Opcoes nome={s.comum.dificuldade} valor={facil ? "f" : "m"} opcoes={[["f", s.comum.facil], ["m", s.comum.medio]]} aoEscolher={(v) => { setFacil(v === "f"); novo(v === "f"); }} />
      <p className="mt-3 max-w-2xl text-sm text-ink-soft">{t.instrucao}</p>
      <div className="mt-4 flex flex-col gap-6 md:flex-row">
        <div role="group" aria-label={s.treino.jogos.caca.nome} className="grid w-max max-w-full gap-0.5 overflow-x-auto" style={{ gridTemplateColumns: `repeat(${jogo.tamanho}, minmax(1.9rem, 2.4rem))` }}>
          {jogo.grade.flatMap((linha, r) =>
            linha.map((letra, c) => {
              const k = `${r},${c}`;
              const eInicio = inicio?.[0] === r && inicio?.[1] === c;
              return (
                <button
                  key={k}
                  ref={(el) => {
                    if (el) celulas.current.set(k, el);
                    else celulas.current.delete(k);
                  }}
                  type="button"
                  tabIndex={foco[0] === r && foco[1] === c ? 0 : -1}
                  aria-label={fill(t.celula, { r: r + 1, c: c + 1, l: letra })}
                  aria-pressed={eInicio || marcadas.has(k)}
                  onClick={() => escolher(r, c)}
                  onKeyDown={(e) => aoTecla(e, r, c)}
                  className={`aspect-square cursor-pointer border-2 font-mono text-base font-bold focus:outline-2 focus:outline-offset-1 focus:outline-prelo-texto ${eInicio ? "border-[#c21f16] bg-[#fde8e6] text-ink" : marcadas.has(k) ? "border-ink bg-prelo-texto text-white" : "border-ink bg-white text-ink"}`}
                >
                  {letra}
                </button>
              );
            }),
          )}
        </div>
        <div lang="pt-BR" className="min-w-0 flex-1">
          <h4 className="font-mono text-xs font-bold uppercase tracking-[0.12em]">{t.palavras}</h4>
          <p className="mt-1 text-sm text-ink-soft">{fill(t.achadas, { n: achadas.length, total: jogo.colocadas.length })}</p>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-sm">
            {jogo.colocadas.map((p) => (
              <li key={p.palavra} className={achadas.includes(p.palavra) ? "line-through opacity-60" : ""}>{termos[p.palavra] ?? p.palavra}</li>
            ))}
          </ul>
        </div>
      </div>
      <Acoes>
        <Botao onClick={() => setAchadas(jogo.colocadas.map((p) => p.palavra))}>{s.comum.mostrar}</Botao>
        <Botao onClick={() => novo()}>{s.comum.novo}</Botao>
      </Acoes>
      <Aviso tom={inicio ? undefined : aviso === s.comum.terminou ? "fim" : aviso === t.tentou ? "erro" : aviso ? "certo" : undefined}>{aviso}</Aviso>
    </Quadro>
  );
}
