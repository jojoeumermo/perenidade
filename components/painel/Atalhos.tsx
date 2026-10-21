// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useCallback, useEffect, useState } from "react";

// Os atalhos do painel: as seções que a pessoa fixou (no alto do menu e na Mesa) e as que usou por último. Ficam só
// neste aparelho, como as outras preferências do painel (menu recolhido, modo foco).

const CHAVE = "lucia:painel-atalhos";
const EVENTO = "lucia:painel-atalhos-mudou";
interface Guardado {
  fixadas: string[];
  recentes: string[];
}
function ler(): Guardado {
  try {
    const d = JSON.parse(window.localStorage.getItem(CHAVE) ?? "{}") as Partial<Guardado>;
    const limpa = (l: unknown, n: number) => (Array.isArray(l) ? l.filter((x): x is string => typeof x === "string" && /^[a-z-]{2,30}$/.test(x)).slice(0, n) : []);
    return { fixadas: limpa(d.fixadas, 12), recentes: limpa(d.recentes, 6) };
  } catch {
    return { fixadas: [], recentes: [] };
  }
}
function gravar(g: Guardado) {
  try {
    window.localStorage.setItem(CHAVE, JSON.stringify(g));
  } catch {
    // Sem espaço: os atalhos valem até fechar o painel.
  }
  window.dispatchEvent(new Event(EVENTO));
}

export function useAtalhos() {
  const [g, setG] = useState<Guardado>({ fixadas: [], recentes: [] });
  useEffect(() => {
    const recarregar = () => setG(ler());
    void Promise.resolve().then(recarregar);
    window.addEventListener(EVENTO, recarregar);
    return () => window.removeEventListener(EVENTO, recarregar);
  }, []);
  const fixar = useCallback((id: string) => {
    const atual = ler();
    gravar({ ...atual, fixadas: atual.fixadas.includes(id) ? atual.fixadas.filter((x) => x !== id) : [...atual.fixadas, id].slice(0, 12) });
  }, []);
  const lembrar = useCallback((id: string) => {
    if (id === "mesa") return;
    const atual = ler();
    gravar({ ...atual, recentes: [id, ...atual.recentes.filter((x) => x !== id)].slice(0, 6) });
  }, []);
  return { ...g, fixar, lembrar };
}

interface SecaoCurta {
  id: string;
  nome: string;
  sobre: string;
  grupo: string;
  conta?: number;
}

/** Na Mesa: os atalhos fixados (com o número de pendências), as seções usadas por último e o jeito de escolher. */
export function Atalhos({ secoes, ir, icone }: { secoes: SecaoCurta[]; ir: (id: string) => void; icone: (id: string) => React.ReactNode }) {
  const { fixadas, recentes, fixar } = useAtalhos();
  const [editando, setEditando] = useState(false);
  const porId = new Map(secoes.map((s) => [s.id, s]));
  const fixas = fixadas.map((id) => porId.get(id)).filter((x): x is SecaoCurta => !!x);
  const ultimas = recentes.filter((id) => !fixadas.includes(id)).map((id) => porId.get(id)).filter((x): x is SecaoCurta => !!x);
  const grupos = [...new Set(secoes.map((s) => s.grupo))];
  return (
    <section aria-labelledby="atalhos-titulo">
      <div className="flex flex-wrap items-center gap-3">
        <h2 id="atalhos-titulo" className="jornal-secao flex-1">
          <span className="jornal-editoria">Seus atalhos</span>
        </h2>
        <button type="button" onClick={() => setEditando(!editando)} aria-expanded={editando} className="cursor-pointer border-2 border-ink px-3 py-1 text-xs font-semibold hover:border-oxblood">{editando ? "Pronto" : "Escolher atalhos"}</button>
      </div>
      {fixas.length === 0 && !editando && <p className="mt-3 text-ink-soft">Fixe as seções que você mais usa: elas aparecem aqui e no alto do menu. <button type="button" className="cursor-pointer underline hover:text-oxblood" onClick={() => setEditando(true)}>Escolher agora</button></p>}
      {fixas.length > 0 && (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {fixas.map((s) => (
            <button key={s.id} type="button" onClick={() => ir(s.id)} className="painel-quadro group relative flex cursor-pointer flex-col items-start gap-2 p-4 text-left">
              <span className="text-oxblood">{icone(s.id)}</span>
              <span className="font-semibold leading-tight">{s.nome}</span>
              {Boolean(s.conta) && <span className="absolute top-3 right-3 min-w-6 bg-[#c21f16] px-1.5 py-0.5 text-center font-mono text-[0.7rem] font-semibold text-white">{s.conta}</span>}
            </button>
          ))}
        </div>
      )}
      {ultimas.length > 0 && (
        <p className="mt-4 flex flex-wrap items-center gap-2 text-sm">
          <span className="font-mono text-[0.65rem] uppercase tracking-widest text-ink-soft">Usadas por último</span>
          {ultimas.map((s) => <button key={s.id} type="button" onClick={() => ir(s.id)} className="flex cursor-pointer items-center gap-1.5 border border-rule px-2.5 py-1 hover:border-ink"><span className="text-ink-soft">{icone(s.id)}</span>{s.nome}</button>)}
        </p>
      )}
      {editando && (
        <div className="mt-4 grid gap-4 border-2 border-dashed border-ink/40 p-4 sm:grid-cols-2 lg:grid-cols-3">
          {grupos.map((grupo) => (
            <fieldset key={grupo || "inicio"}>
              <legend className="font-mono text-[0.65rem] uppercase tracking-widest text-oxblood">{grupo || "Início"}</legend>
              {secoes.filter((s) => s.grupo === grupo && s.id !== "mesa").map((s) => (
                <label key={s.id} className="mt-1 flex cursor-pointer items-center gap-2">
                  <input type="checkbox" checked={fixadas.includes(s.id)} onChange={() => fixar(s.id)} className="h-4 w-4" />
                  {s.nome}
                </label>
              ))}
            </fieldset>
          ))}
        </div>
      )}
    </section>
  );
}
