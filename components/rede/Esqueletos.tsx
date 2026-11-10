// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).

/**
 * Uma barra que pulsa (some com "reduzir movimento"): o formato do que vem, enquanto não vem. Na Alumia nova ([data-al="2"]) a
 * classe `al-esq` troca o pulso por um brilho que atravessa a barra (styles/alumia.css).
 */
function Barra({ largura, altura = "h-3" }: { largura: string; altura?: string }) {
  return <div className={`al-esq ${altura} ${largura} rounded bg-parchment-deep motion-safe:animate-pulse`} />;
}

/** O esqueleto de um cartão de post (rosto, nome, a comunidade, duas linhas de texto e as ações). */
export function EsqueletoDoPost({ i = 0 }: { i?: number }) {
  // Larguras que variam de um cartão para outro: o esqueleto parece uma linha de verdade, não uma grade.
  const linha2 = ["w-4/5", "w-2/3", "w-11/12", "w-3/5"][i % 4];
  return (
    <div className="al-esq-post flex gap-3 border-b border-rule px-[18px] py-4" aria-hidden style={{ ["--i" as string]: i }}>
      <div className="al-esq h-10 w-10 shrink-0 rounded-[10px] bg-parchment-deep motion-safe:animate-pulse" />
      <div className="min-w-0 flex-1 space-y-2.5">
        <Barra largura="w-1/3" />
        <Barra largura="w-24" altura="h-4" />
        <Barra largura="w-full" />
        <Barra largura={linha2} />
        <div className="flex gap-6 pt-1">
          <Barra largura="w-8" />
          <Barra largura="w-14" />
          <Barra largura="w-14" />
          <Barra largura="w-6" />
        </div>
      </div>
    </div>
  );
}

/** O esqueleto da linha: alguns cartões. `rotulo` (o texto de "carregando") fica para o leitor de tela. */
export function EsqueletoDaLinha({ rotulo, quantos = 4 }: { rotulo: string; quantos?: number }) {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">{rotulo}</span>
      {Array.from({ length: quantos }, (_, i) => (
        <EsqueletoDoPost key={i} i={i} />
      ))}
    </div>
  );
}

/**
 * O esqueleto da casca inteira, com a MESMA grade da casca nova (CascaDaAlumia2: uma coluna no celular, menu + meio de 1024 a
 * 1279, três colunas fluidas de 1280 em diante), para a Rede abrir sem pular quando chega.
 */
export function EsqueletoDaCasca({ rotulo }: { rotulo: string }) {
  return (
    <div className="al-esq-casca grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[clamp(220px,21vw,260px)_minmax(0,1fr)] xl:grid-cols-[clamp(240px,16.5vw,320px)_minmax(0,1fr)_clamp(320px,22vw,440px)]">
      <div className="hidden space-y-4 border-r border-rule px-5 py-7 lg:block" aria-hidden>
        <Barra largura="w-2/3" altura="h-9" />
        <div className="space-y-5 pt-4">
          {Array.from({ length: 9 }, (_, i) => (
            <Barra key={i} largura={i % 3 === 0 ? "w-3/5" : "w-1/2"} altura="h-4" />
          ))}
        </div>
        <Barra largura="w-full" altura="h-12" />
      </div>
      <div className="min-w-0 border-rule xl:border-r">
        <div className="space-y-3 px-5 pb-3 pt-6" aria-hidden>
          <Barra largura="w-32" altura="h-7" />
          <div className="flex gap-6 pt-2">
            <Barra largura="w-20" altura="h-4" />
            <Barra largura="w-28" altura="h-4" />
            <Barra largura="w-12" altura="h-4" />
          </div>
        </div>
        <EsqueletoDaLinha rotulo={rotulo} />
      </div>
      <div className="hidden space-y-4 px-5 py-6 xl:block" aria-hidden>
        <Barra largura="w-full" altura="h-12" />
        <Barra largura="w-full" altura="h-40" />
        <Barra largura="w-3/4" altura="h-6" />
        <Barra largura="w-full" altura="h-14" />
        <Barra largura="w-full" altura="h-14" />
      </div>
    </div>
  );
}
