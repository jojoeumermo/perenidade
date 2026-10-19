// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Dict } from "@/i18n/types";
import { type AreaDoEstudio, FILMES } from "@/lib/estudio";
import { CartoesDoEstudio } from "./EstudioDePratica";

/**
 * "Estúdio de prática" de uma disciplina (Edição de vídeo, Edição de foto, Modelagem 3D): os programas, os avisos de
 * sempre (alfa, download, tudo no aparelho), os limites e, no de vídeo, o material para praticar. Usada na página
 * própria e na página da disciplina.
 */
export function SecaoEstudioDePratica({ s, titulo = true, area = "edicao-de-video" }: { s: Dict["practiceStudio"]; titulo?: boolean; area?: AreaDoEstudio }) {
  const video = area === "edicao-de-video";
  const outro = video ? null : s.studios[area as Exclude<AreaDoEstudio, "edicao-de-video">];
  const lead = outro?.lead ?? s.lead;
  const limites = outro?.limits ?? s.limits;
  const creditos = outro?.credits ?? s.credits;
  const id = `estudio-de-pratica-${area}`;
  return (
    <section aria-labelledby={id} className="font-sans">
      {titulo && <h2 id={id} className="mt-12 border-b border-rule pb-3 font-serif text-3xl font-semibold">{s.title}</h2>}
      {!titulo && <h2 id={id} className="sr-only">{s.title}</h2>}
      {titulo && <p className="mt-4 max-w-3xl text-lg">{lead}</p>}
      <ul className="mt-3 max-w-3xl space-y-1 border-l-4 border-gold pl-3 text-sm">
        <li>{s.alpha}</li>
        <li>{s.local}</li>
      </ul>
      <div className="mt-6">
        <CartoesDoEstudio s={s} area={area} />
      </div>
      <h3 className="mt-8 font-serif text-xl font-semibold">{s.limitsTitle}</h3>
      <ul className="mt-2 max-w-3xl list-disc space-y-1 pl-5 text-sm text-ink-soft">
        {limites.map((x) => <li key={x}>{x}</li>)}
      </ul>
      {video && (
        <>
      <h3 className="mt-8 font-serif text-xl font-semibold">{s.materialTitle}</h3>
      <p className="mt-1 max-w-3xl text-sm text-ink-soft">{s.materialLead}</p>
      <ul className="mt-3 grid gap-3 sm:grid-cols-2">
        {FILMES.map((f) => (
          <li key={f.titulo} className="border border-rule p-3 text-sm">
            <p className="font-serif text-lg font-semibold">{f.titulo} <span className="font-sans text-xs text-ink-soft">({f.ano}, {f.licenca})</span></p>
            <p className="text-xs text-ink-soft">{s.credit}: {f.credito}</p>
            <a href={f.pagina} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block underline hover:text-oxblood">{s.page} ↗</a>
          </li>
        ))}
      </ul>
        </>
      )}
      <p className="mt-6 max-w-3xl text-xs text-ink-soft"><span className="font-semibold">{s.creditsTitle}:</span> {creditos}</p>
    </section>
  );
}
