// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useId, useState } from "react";
import { fill } from "@/i18n/config";
import type { TextosDosAgentes } from "@/i18n/escola/agentes";
import { type AchadoDaTraducao, conferirTraducao, copiarComMarca, IDIOMAS_DE_DESTINO, podeCopiarTraducao } from "@/lib/escola/revisao-de-texto";

const MAX = 20_000;
const CHAVE_DA_REGRA = (regra: AchadoDaTraducao["regra"]) => (regra === "universidade" ? "naoUniversidade" : regra === "diploma" ? "naoDiploma" : regra);

/**
 * Tradutor supervisionado. Esta ferramenta NÃO traduz: quem traduz é a pessoa, e o aparelho confere se a tradução manteve
 * parágrafos, números, endereços e termos protegidos do original. "Copiar com a marca em revisão" só é liberado depois
 * que a pessoa marca, à mão, que um falante do idioma revisou. Nada sai da memória da página.
 */
export function TraducaoSupervisionada({ s }: { s: TextosDosAgentes["traducao"] }) {
  const id = useId();
  const [origem, setOrigem] = useState("");
  const [traducao, setTraducao] = useState("");
  const [destino, setDestino] = useState<(typeof IDIOMAS_DE_DESTINO)[number]>("en");
  const [termos, setTermos] = useState("");
  const [naEscola, setNaEscola] = useState(false);
  const [revisou, setRevisou] = useState(false);
  const [achados, setAchados] = useState<AchadoDaTraducao[] | null>(null);
  const [copiado, setCopiado] = useState(false);
  const liberado = podeCopiarTraducao({ revisadoPorFalante: revisou, traducao });
  const campo = "acompanhante-campo mt-2 w-full border-2 border-ink bg-parchment px-3 py-2 font-serif text-base";

  async function copiar() {
    if (!liberado) return;
    try {
      await navigator.clipboard.writeText(copiarComMarca(traducao, destino));
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2500);
    } catch {
      setCopiado(false);
    }
  }

  return (
    <div data-traducao-supervisionada>
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <label htmlFor={`${id}-origem`} className="block font-semibold">
            {s.origem}
          </label>
          <textarea id={`${id}-origem`} value={origem} rows={10} maxLength={MAX} onChange={(e) => { setOrigem(e.target.value.slice(0, MAX)); setAchados(null); }} className={campo} data-origem />
        </div>
        <div>
          <label htmlFor={`${id}-traducao`} className="block font-semibold">
            {s.traducao}
          </label>
          <textarea id={`${id}-traducao`} value={traducao} rows={10} maxLength={MAX} onChange={(e) => { setTraducao(e.target.value.slice(0, MAX)); setAchados(null); }} className={campo} data-traducao />
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <label htmlFor={`${id}-destino`} className="block font-semibold">
            {s.destino}
          </label>
          <select id={`${id}-destino`} value={destino} onChange={(e) => { setDestino(e.target.value as typeof destino); setAchados(null); }} className="acompanhante-campo mt-2 w-full border-2 border-ink bg-parchment px-3 py-2 font-serif text-base">
            {IDIOMAS_DE_DESTINO.map((l) => (
              <option key={l} value={l}>
                {s.idiomas[l]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`${id}-termos`} className="block font-semibold">
            {s.termos}
          </label>
          <p className="text-sm text-ink-soft">{s.termosDica}</p>
          <input id={`${id}-termos`} type="text" value={termos} maxLength={300} onChange={(e) => { setTermos(e.target.value.slice(0, 300)); setAchados(null); }} className="acompanhante-campo mt-1 w-full border-2 border-ink bg-parchment px-3 py-2 font-serif text-base" />
        </div>
      </div>

      <label className="mt-3 flex min-h-11 cursor-pointer items-center gap-3">
        <input type="checkbox" checked={naEscola} onChange={(e) => { setNaEscola(e.target.checked); setAchados(null); }} className="h-5 w-5 shrink-0" data-na-escola />
        <span>{s.naEscola}</span>
      </label>

      <p className="mt-3">
        <button
          type="button"
          className="acompanhante-botao"
          disabled={!origem.trim()}
          onClick={() => setAchados(conferirTraducao(origem, traducao, destino, { termosProtegidos: termos.split(",").map((t) => t.trim()).filter(Boolean), naEscola }))}
          data-conferir-traducao
        >
          {s.botao}
        </button>
      </p>

      <div role="status" aria-live="polite" data-resultado-da-traducao>
        {achados && (
          <section className="mt-4">
            <h2 className="font-serif text-2xl font-semibold">{s.oQueConferir}</h2>
            {achados.length === 0 ? (
              <p className="mt-2 border-l-4 border-gold pl-3">{s.tudoCerto}</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {achados.map((x, i) => (
                  <li key={`${x.regra}-${x.detalhe}-${i}`} className={`border-l-4 pl-3 text-sm ${x.gravidade === "corrigir" ? "border-oxblood" : "border-rule"}`} data-regra={x.regra}>
                    {fill((s.regras as Record<string, string>)[CHAVE_DA_REGRA(x.regra)], { detalhe: x.detalhe })}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>

      <section className="mt-8 border-2 border-ink p-4">
        <label className="flex min-h-11 cursor-pointer items-center gap-3">
          <input type="checkbox" checked={revisou} onChange={(e) => setRevisou(e.target.checked)} className="h-5 w-5 shrink-0" data-revisado-por-falante />
          <span className="font-semibold">{s.revisou}</span>
        </label>
        <p className="mt-1 text-sm text-ink-soft">{s.revisouDica}</p>
        <p className="mt-3">
          <button type="button" className="acompanhante-botao" disabled={!liberado} onClick={() => void copiar()} data-copiar-com-marca>
            {copiado ? s.copiado : s.copiar}
          </button>
        </p>
      </section>
    </div>
  );
}
