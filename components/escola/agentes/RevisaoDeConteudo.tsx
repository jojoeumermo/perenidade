// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useId, useState } from "react";
import { fill } from "@/i18n/config";
import type { TextosDosAgentes } from "@/i18n/escola/agentes";
import { achaDadoPessoal, pegarRascunho } from "@/lib/escola/agentes";
import { type Achado, revisarConteudo } from "@/lib/escola/revisao-de-texto";

const MAX = 20_000;
/** As regras de interface têm chave "nao…" no dicionário (as chaves com "nao" ficam liberadas no testar-textos-escola). */
const CHAVE_DA_REGRA = (regra: Achado["regra"]) => (regra === "universidade" ? "naoUniversidade" : regra === "diploma" ? "naoDiploma" : regra);

/**
 * Revisão de conteúdo: links, fontes e modelo de aula, 100% no aparelho (sem servidor e sem IA). Não abre nenhum link: a
 * coordenação roda `npm run conferir:links` para saber se os endereços ainda abrem.
 */
export function RevisaoDeConteudo({ s }: { s: TextosDosAgentes["revisao"] }) {
  const id = useId();
  const [texto, setTexto] = useState("");
  const [naEscola, setNaEscola] = useState(false);
  const [achados, setAchados] = useState<Achado[] | null>(null);
  const [doEducador, setDoEducador] = useState(false);

  // O rascunho do agente do educador, lido uma vez (sessionStorage da aba), depois da hidratação.
  useEffect(() => {
    const id0 = window.setTimeout(() => {
      const rascunho = pegarRascunho();
      if (rascunho) {
        setTexto(rascunho.slice(0, MAX));
        setDoEducador(true);
      }
    }, 0);
    return () => window.clearTimeout(id0);
  }, []);

  const pessoais = achaDadoPessoal(texto);
  const grupos: { chave: "corrigir" | "conferir"; titulo: string }[] = [
    { chave: "corrigir", titulo: s.corrigir },
    { chave: "conferir", titulo: s.conferir },
  ];

  return (
    <div data-revisao-de-conteudo>
      {doEducador && <p className="mb-3 text-sm font-semibold">{s.doEducador}</p>}
      <label htmlFor={`${id}-texto`} className="block font-semibold">
        {s.texto}
      </label>
      <p className="text-sm text-ink-soft">{s.textoDica}</p>
      <textarea
        id={`${id}-texto`}
        value={texto}
        rows={12}
        maxLength={MAX}
        onChange={(e) => {
          setTexto(e.target.value.slice(0, MAX));
          setAchados(null);
        }}
        className="acompanhante-campo mt-2 w-full border-2 border-ink bg-parchment px-3 py-2 font-mono text-sm"
        data-texto-para-revisar
      />
      {pessoais.length > 0 && (
        <p role="status" className="mt-1 text-sm font-semibold text-oxblood" data-dado-pessoal-na-revisao>
          {fill(s.dadoPessoal, { tipos: pessoais.map((t) => s.tipos[t]).join(", ") })}
        </p>
      )}
      <label className="mt-3 flex min-h-11 cursor-pointer items-center gap-3">
        <input type="checkbox" checked={naEscola} onChange={(e) => setNaEscola(e.target.checked)} className="h-5 w-5 shrink-0" data-na-escola />
        <span>{s.naEscola}</span>
      </label>
      <p className="mt-3">
        <button type="button" className="acompanhante-botao" disabled={!texto.trim()} onClick={() => setAchados(revisarConteudo(texto, { naEscola }))} data-revisar>
          {s.botao}
        </button>
      </p>

      <div role="status" aria-live="polite" data-resultado-da-revisao>
        {achados && achados.length === 0 && <p className="mt-4 border-l-4 border-gold pl-3">{s.nenhum}</p>}
        {achados &&
          achados.length > 0 &&
          grupos.map(({ chave, titulo }) => {
            const lista = achados.filter((x) => x.gravidade === chave);
            if (!lista.length) return null;
            return (
              <section key={chave} className="mt-6" data-grupo={chave}>
                <h2 className={`font-serif text-2xl font-semibold ${chave === "corrigir" ? "text-oxblood" : ""}`}>
                  {titulo} ({lista.length})
                </h2>
                <ul className="mt-2 space-y-3">
                  {lista.map((x, i) => (
                    <li key={`${x.linha}-${x.regra}-${i}`} className="border-l-4 border-rule pl-3 text-sm" data-regra={x.regra}>
                      <span className="block font-mono text-xs uppercase tracking-widest text-ink-soft">{fill(s.linha, { n: x.linha })}</span>
                      <span className="block">{(s.regras as Record<string, string>)[CHAVE_DA_REGRA(x.regra)]}</span>
                      {x.trecho && <code className="mt-1 block break-words text-xs text-ink-soft">{x.trecho}</code>}
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
      </div>
      <p className="mt-8 border-l-4 border-gold pl-3 text-sm">{s.links}</p>
    </div>
  );
}
