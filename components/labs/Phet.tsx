// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import sims from "@/content/phet.json";
import { useI18n } from "../I18n";

interface Sim {
  id: string;
  titulo: string;
  areas: string[];
  temas: string;
  licenca: string;
  conferida_em: string;
  url: string;
  pagina: string;
}

const ATRIBUICAO = "PhET Interactive Simulations, University of Colorado Boulder, phet.colorado.edu";
const TEXTOS: Record<string, { abrir: string; fechar: string; nota: string; licenca: string; nenhuma: string; pagina: string }> = {
  pt: { abrir: "Abrir a simulação", fechar: "Fechar", nota: "A simulação vem do próprio PhET (phet.colorado.edu), carregada só quando você abre; o instituto não guarda cópia nem a altera. Ao abrir, o seu navegador fala com o servidor do PhET.", licenca: "Simulação do", nenhuma: "Nenhuma simulação ligada a esta disciplina ainda.", pagina: "Página da simulação no PhET" },
  en: { abrir: "Open the simulation", fechar: "Close", nota: "The simulation comes from PhET itself (phet.colorado.edu), loaded only when you open it; the institute keeps no copy and changes nothing. Opening it makes your browser talk to PhET's server.", licenca: "Simulation by", nenhuma: "No simulation linked to this discipline yet.", pagina: "Simulation page at PhET" },
  es: { abrir: "Abrir la simulación", fechar: "Cerrar", nota: "La simulación viene del propio PhET (phet.colorado.edu), cargada solo cuando la abres; el instituto no guarda copia ni la altera.", licenca: "Simulación de", nenhuma: "Todavía no hay simulación ligada a esta disciplina.", pagina: "Página de la simulación en PhET" },
  ru: { abrir: "Открыть симуляцию", fechar: "Закрыть", nota: "Симуляция загружается с сайта PhET (phet.colorado.edu) только когда вы её открываете; институт не хранит копий и ничего не меняет.", licenca: "Симуляция", nenhuma: "Пока нет симуляций для этой дисциплины.", pagina: "Страница симуляции на PhET" },
  fr: { abrir: "Ouvrir la simulation", fechar: "Fermer", nota: "La simulation vient de PhET lui-même (phet.colorado.edu), chargée seulement quand vous l'ouvrez ; l'institut n'en garde pas de copie et ne la modifie pas. En l'ouvrant, votre navigateur parle au serveur de PhET.", licenca: "Simulation de", nenhuma: "Aucune simulation liée à cette discipline pour l'instant.", pagina: "Page de la simulation sur PhET" },
  zh: { abrir: "打开模拟", fechar: "关闭", nota: "模拟来自 PhET 官网（phet.colorado.edu），仅在你打开时加载；学院不保存副本也不做修改。", licenca: "模拟由", nenhuma: "这门学科还没有关联的模拟。", pagina: "PhET 上的模拟页面" },
};

/**
 * Simulações do PhET (Universidade do Colorado), embutidas pelo iframe oficial, sem cópia nem modificação, com a
 * atribuição exigida pela licença e o logotipo do PhET intacto dentro da própria simulação.
 */
export function PhetLista({ area, compacto = false, ids }: { area?: string; compacto?: boolean; /** Só estas, nesta ordem (a aula mostra as mais ligadas ao assunto dela). */ ids?: string[] }) {
  const { lang } = useI18n();
  const s = TEXTOS[lang] ?? TEXTOS.pt;
  const [aberta, setAberta] = useState<string | null>(null);
  const lista = ids ? ids.flatMap((id) => (sims as Sim[]).filter((sim) => sim.id === id)) : (sims as Sim[]).filter((sim) => !area || sim.areas.includes(area));
  if (lista.length === 0) return <p className="mt-6 text-ink-soft">{s.nenhuma}</p>;
  return (
    <div className={compacto ? "mt-4 space-y-3" : "mt-8 grid gap-4 md:grid-cols-2"}>
      {lista.map((sim) => (
        <article key={sim.id} className={`border border-rule bg-parchment-deep p-4 font-sans text-sm ${aberta === sim.id ? "md:col-span-2" : ""}`}>
          <h3 className="font-serif text-lg font-semibold">{sim.titulo}</h3>
          <p className="text-ink-soft">{sim.temas}</p>
          {aberta === sim.id ? (
            <>
              <iframe src={sim.url} title={sim.titulo} allowFullScreen className="mt-3 aspect-[4/3] w-full border-2 border-ink bg-white" />
              <button type="button" className="mt-2 cursor-pointer border-2 border-ink px-3 py-1 font-semibold hover:border-oxblood hover:text-oxblood" onClick={() => setAberta(null)}>{s.fechar}</button>
            </>
          ) : (
            <button type="button" className="mt-3 cursor-pointer bg-ink px-4 py-2 font-semibold text-parchment hover:bg-oxblood" onClick={() => setAberta(sim.id)}>{s.abrir}</button>
          )}
          <p className="mt-3 text-xs text-ink-soft">
            {s.licenca} <a href={sim.pagina} target="_blank" rel="noopener noreferrer" className="underline hover:text-oxblood">{ATRIBUICAO}</a> · {sim.licenca} ({sim.conferida_em}) · <a href={sim.pagina} target="_blank" rel="noopener noreferrer" className="underline hover:text-oxblood">{s.pagina} ↗</a>
          </p>
        </article>
      ))}
      <p className="text-xs text-ink-soft md:col-span-2">{s.nota}</p>
    </div>
  );
}
