// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import { fill } from "@/i18n/config";
import type { TextosDaOrganizacao } from "@/i18n/escola/organizacao";
import { hasBackend } from "@/lib/backend";
import { lerContagensEscola } from "@/lib/escola/banco";
import { type Pauta, type ResultadoDaPauta, resultadoDaPauta } from "@/lib/escola/organizacao";

type S = TextosDaOrganizacao["resultado"];

/**
 * O resultado somado da assembleia (E4-12): uma linha por trilha, NA ORDEM DA PAUTA (nunca por total) e sem ranking de
 * pessoas. Com menos de 10 votos no total não mostra números. Sem serviço, "resultado indisponível" (sem erro no console).
 * As barras trazem o número escrito: nada depende só de cor.
 */
export function ResultadoDaAssembleia({ pauta, titulos, s }: { pauta: Pauta; titulos: Record<string, string>; s: S }) {
  const [estado, setEstado] = useState<"carregando" | "pronto" | "indisponivel">("carregando");
  const [resultado, setResultado] = useState<ResultadoDaPauta | null>(null);

  useEffect(() => {
    let vivo = true;
    if (!hasBackend) {
      const id = window.setTimeout(() => vivo && setEstado("indisponivel"), 0);
      return () => {
        vivo = false;
        window.clearTimeout(id);
      };
    }
    void lerContagensEscola("assembleia_voto", 200, `${pauta.semestre}/`).then((lista) => {
      if (!vivo) return;
      setResultado(resultadoDaPauta(lista, pauta));
      setEstado("pronto");
    });
    return () => {
      vivo = false;
    };
  }, [pauta]);

  return (
    <div data-assembleia-resultado={estado}>
      {estado === "carregando" && <p className="org-nota">{s.carregando}</p>}
      {estado === "indisponivel" && <p className="org-nota">{s.indisponivel}</p>}
      {estado === "pronto" && resultado && !resultado.mostrar && <p className="org-nota" data-resultado-poucos="">{s.poucos}</p>}
      {estado === "pronto" && resultado?.mostrar && (
        <>
          <ol className="org-barras">
            {resultado.linhas.map((l) => (
              <li key={l.trilha} data-resultado-trilha={l.trilha}>
                <span className="org-barra-nome" lang="pt">
                  {titulos[l.trilha] ?? l.trilha}
                </span>
                <span className="org-barra" aria-hidden="true">
                  <span className="org-barra-cheia" style={{ width: `${l.percentual}%` }} />
                </span>
                <span className="org-barra-numero">{fill(s.votos, { n: l.total })}</span>
              </li>
            ))}
          </ol>
          <p className="org-nota">{s.ordem}</p>
        </>
      )}
    </div>
  );
}
