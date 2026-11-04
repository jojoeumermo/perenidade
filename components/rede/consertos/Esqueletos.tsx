// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).

function Barra({ largura, altura = "h-3" }: { largura: string; altura?: string }) {
  return <div className={`${altura} ${largura} rounded bg-parchment-deep motion-safe:animate-pulse`} />;
}

/** O esqueleto do Fórum: o formato do que vem (busca, salas e alguns tópicos) enquanto o código do fórum baixa. */
export function EsqueletoDoForum({ rotulo }: { rotulo: string }) {
  return (
    <div role="status" aria-live="polite" className="mt-4 space-y-4">
      <span className="sr-only">{rotulo}</span>
      <Barra largura="w-1/2" altura="h-8" />
      <div className="flex gap-2" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <Barra key={i} largura="w-24" altura="h-8" />
        ))}
      </div>
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="space-y-2 border-b border-rule pb-4" aria-hidden>
          <Barra largura="w-3/4" altura="h-4" />
          <Barra largura="w-full" />
          <Barra largura="w-2/5" />
        </div>
      ))}
    </div>
  );
}
