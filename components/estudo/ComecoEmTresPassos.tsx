// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { ligado } from "@/lib/recursos";
import { useTextosDaBusca } from "../busca/TextosDaBusca";
import { L } from "../I18n";
import "@/styles/escola-busca.css";

export type CasoDoComeco = "meuEstudo" | "praticar" | "turmas" | "caderno" | "erros";

/**
 * O estado vazio que ensina (Etapa 4, R1-22): no lugar da tela em branco, três passos para começar. 1) descobrir por
 * onde começar (o nivelamento, ou o "Comece aqui" quando o nivelamento está desligado); 2) abrir a primeira aula do
 * "Comece aqui" (content/comecar.json); 3) voltar para ver o progresso. Cada lugar traz a sua frase de abertura.
 * Só com a Escola ligada; sem ela, devolve null e quem chama mostra o vazio de antes.
 */
export function ComecoEmTresPassos({ caso, comPassos = true }: { caso: CasoDoComeco; comPassos?: boolean }) {
  const contexto = useTextosDaBusca();
  if (!ligado("escola") || !contexto) return null;
  const p = contexto.textos.passos;
  const nivelamento = ligado("nivelamento");
  const passos = [
    { titulo: p.p1, texto: nivelamento ? p.p1Nivelamento : p.p1Comecar, href: nivelamento ? "/nivelamento" : "/comecar" },
    { titulo: p.p2, texto: p.p2Texto, href: contexto.primeiraAula ? `/trilhas/${contexto.primeiraAula}` : "/comecar" },
    // O passo 3 só vira link quando o Meu estudo existe e a pessoa não está nele.
    { titulo: p.p3, texto: p.p3Texto, href: ligado("meu-estudo") && caso !== "meuEstudo" ? "/meu-estudo" : null },
  ];
  return (
    <div className="comeco-tres-passos font-sans text-sm" data-comeco={caso}>
      <p className="text-ink-soft">{p[caso]}</p>
      {comPassos && (
        <>
          <p className="mt-4 font-mono text-[0.68rem] uppercase tracking-[0.14em] text-oxblood">{p.titulo}</p>
          <ol className="comeco-lista mt-2 grid gap-2 sm:grid-cols-3">
            {passos.map((passo, i) => {
              const miolo = (
                <>
                  <span aria-hidden className="comeco-numero font-serif text-2xl font-semibold leading-none text-gold">
                    {i + 1}
                  </span>
                  <span>
                    <span className="block font-semibold">{passo.titulo}</span>
                    <span className="mt-0.5 block text-xs text-ink-soft">{passo.texto}</span>
                  </span>
                </>
              );
              const classe = "comeco-passo flex h-full gap-3 border border-rule bg-parchment p-3 text-ink";
              return (
                <li key={passo.titulo}>
                  {passo.href ? (
                    <L href={passo.href} className={`${classe} hover:border-ink`}>
                      {miolo}
                    </L>
                  ) : (
                    <div className={classe}>{miolo}</div>
                  )}
                </li>
              );
            })}
          </ol>
        </>
      )}
    </div>
  );
}
