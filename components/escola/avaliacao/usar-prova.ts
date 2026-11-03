// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useCallback, useState } from "react";
import { gravarProva, type ModoDeProva, porTemaDe, type RegistroDeCompetencia, registrosDaProva } from "@/lib/escola/avaliacao";
import { ligado } from "@/lib/recursos";

/** Embaralha (Fisher–Yates) e corta em `n` (sem `n`, todas). Cada sorteio é uma prova diferente. */
export function sortear<T>(lista: readonly T[], n?: number): T[] {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return n === undefined ? copia : copia.slice(0, n);
}

/**
 * Guardar a prova terminada (E4-13): vai para "lucia:escola:provas" com o modo e o resultado por tema; fora da dupla
 * (que é de duas pessoas), cada aula também vai para o desempenho do "Meu estudo" (registrarTeste), quando ele está
 * ligado. Devolve os registros do retorno por competência desta prova. Nada sai do aparelho.
 */
export function useProva(trilha: string, modo: ModoDeProva) {
  const [registros, setRegistros] = useState<RegistroDeCompetencia[] | null>(null);
  const terminar = useCallback(
    (respostas: { tema: string; certo: boolean }[]) => {
      gravarProva(trilha, respostas, modo);
      const porTema = porTemaDe(respostas);
      if (modo !== "dupla" && ligado("meu-estudo"))
        void import("@/lib/meu-estudo")
          .then((m) => {
            for (const [aula, v] of Object.entries(porTema)) m.registrarTeste(aula, v.acertos, v.total);
          })
          .catch(() => undefined);
      setRegistros(registrosDaProva(porTema));
    },
    [trilha, modo],
  );
  const limpar = useCallback(() => setRegistros(null), []);
  return { registros, terminar, limpar };
}
