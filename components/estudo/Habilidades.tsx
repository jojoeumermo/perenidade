// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { fill } from "@/i18n/config";
import type { HabilidadeBncc, HabilidadeEnem, MapaDaAula } from "@/lib/mapa-curricular";
import type { TextosDoEstudo } from "@/lib/textos-estudo";

type S = TextosDoEstudo["mapa"];

const AREAS: Record<HabilidadeEnem["area"], keyof S> = { matematica: "areaMatematica", linguagens: "areaLinguagens", natureza: "areaNatureza", humanas: "areaHumanas" };

function Situacao({ situacao, s }: { situacao: HabilidadeBncc["situacao"]; s: S }) {
  return situacao === "confirmado" ? null : (
    <span className="ml-1 border border-gold px-1 font-sans text-xs uppercase tracking-wide text-ink" title={s.aConfirmarDica}>
      {s.aConfirmar}
    </span>
  );
}

/** A lista de habilidades de uma aula (BNCC e Enem), com "a confirmar" onde ninguém conferiu no documento oficial. */
export function ListaDeHabilidades({ mapa, s }: { mapa: MapaDaAula; s: S }) {
  return (
    <dl className="space-y-3 font-sans text-sm">
      {mapa.bncc.length > 0 && (
        <div>
          <dt className="font-semibold">{s.bncc}</dt>
          {mapa.bncc.map((h) => (
            <dd key={h.codigo} className="mt-1">
              <span className="font-mono text-xs">{h.codigo}</span>
              <Situacao situacao={h.situacao} s={s} />
              <span className="block text-ink-soft">{h.resumo}</span>
            </dd>
          ))}
        </div>
      )}
      {mapa.enem.length > 0 && (
        <div>
          <dt className="font-semibold">{s.enem}</dt>
          {mapa.enem.map((h) => (
            <dd key={`${h.area}-${h.competencia}-${h.habilidade}`} className="mt-1">
              <span className="font-mono text-xs">{fill(s.codigoEnem, { area: s[AREAS[h.area]] as string, c: h.competencia, h: h.habilidade })}</span>
              <Situacao situacao={h.situacao} s={s} />
              <span className="block text-ink-soft">{h.resumo}</span>
            </dd>
          ))}
        </div>
      )}
    </dl>
  );
}

/** As habilidades no fim da aula (recurso "mapa-curricular"), recolhidas: é informação para quem ensina. */
export function HabilidadesDaAula({ mapa, s }: { mapa: MapaDaAula; s: S }) {
  return (
    <details className="no-print mt-8 border border-rule p-4">
      <summary className="cursor-pointer font-sans text-sm font-semibold">{s.naAula}</summary>
      <div className="mt-3">
        <ListaDeHabilidades mapa={mapa} s={s} />
        <p className="mt-3 font-sans text-xs text-ink-soft">{s.avisoAula}</p>
      </div>
    </details>
  );
}
