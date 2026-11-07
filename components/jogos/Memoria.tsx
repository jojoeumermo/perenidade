// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useRef, useState } from "react";
import { fill } from "@/i18n/config";
import { criarSorteio, sementeNova } from "@/lib/jogos/base";
import { gerarMemoria, type CartaDeMemoria } from "@/lib/jogos/pequenos";
import { Acoes, Aviso, Botao, Opcoes, Quadro, type PropsDoJogo } from "./comum";

const montar = (verbetes: PropsDoJogo["verbetes"], pares: number) => gerarMemoria(verbetes, pares, criarSorteio(sementeNova()));

/** Jogo da memória: cada termo do glossário forma par com a sua definição curta. Sem tempo e sem contar tentativas. */
export function Memoria({ verbetes, s }: PropsDoJogo) {
  const [pares, setPares] = useState(6);
  const [cartas, setCartas] = useState<CartaDeMemoria[]>(() => montar(verbetes, 6));
  const [viradas, setViradas] = useState<number[]>([]);
  const [feitos, setFeitos] = useState<number[]>([]);
  const [aviso, setAviso] = useState("");
  const espera = useRef<number | undefined>(undefined);
  const t = s.memoria;

  useEffect(() => () => window.clearTimeout(espera.current), []);

  const novo = (p = pares) => {
    window.clearTimeout(espera.current);
    setCartas(montar(verbetes, p));
    setViradas([]);
    setFeitos([]);
    setAviso("");
  };
  const virar = (id: number) => {
    if (viradas.length >= 2 || viradas.includes(id) || feitos.includes(cartas[id].par)) return;
    const novas = [...viradas, id];
    setViradas(novas);
    if (novas.length === 2) {
      const [a, b] = novas.map((i) => cartas[i]);
      if (a.par === b.par) {
        const todos = [...feitos, a.par];
        setFeitos(todos);
        setViradas([]);
        setAviso(todos.length === pares ? t.completo : fill(t.achados, { n: todos.length, total: pares }));
      } else {
        espera.current = window.setTimeout(() => setViradas([]), 1400);
      }
    }
  };

  return (
    <Quadro>
      <Opcoes nome={t.pares} valor={pares} opcoes={[[4, "4"], [6, "6"], [8, "8"]]} aoEscolher={(v) => { setPares(v); novo(v); }} />
      <p className="mt-3 max-w-2xl text-sm text-ink-soft">{t.instrucao}</p>
      <ul lang="pt-BR" className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
        {cartas.map((c) => {
          const aberta = viradas.includes(c.id) || feitos.includes(c.par);
          return (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => virar(c.id)}
                aria-label={aberta ? `${fill(t.carta, { n: c.id + 1 })}: ${c.texto}${feitos.includes(c.par) ? `, ${t.par}` : ""}` : `${fill(t.carta, { n: c.id + 1 })}, ${t.virada}`}
                className={`flex min-h-24 w-full cursor-pointer items-center justify-center border-2 border-ink p-2 text-center leading-snug focus:outline-2 focus:outline-offset-2 focus:outline-prelo-texto ${aberta ? (feitos.includes(c.par) ? "bg-prelo-texto/20" : "bg-white") : "bg-ink text-parchment"} ${c.tipo === "termo" ? "font-serif text-base font-bold" : "text-xs"}`}
              >
                {aberta ? c.texto : <span aria-hidden className="text-2xl">★</span>}
              </button>
            </li>
          );
        })}
      </ul>
      <Acoes>
        <Botao onClick={() => novo()}>{s.comum.novo}</Botao>
      </Acoes>
      <Aviso tom={aviso === t.completo ? "fim" : aviso ? "certo" : undefined}>{aviso}</Aviso>
    </Quadro>
  );
}
