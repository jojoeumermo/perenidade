// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).

/** Uma barra cinza que pulsa (some com "reduzir movimento"): o formato do que vem, enquanto não vem. */
function Barra({ largura, altura = "h-3" }: { largura: string; altura?: string }) {
  return <div className={`${altura} ${largura} rounded bg-parchment-deep motion-safe:animate-pulse`} />;
}

/** O esqueleto de um cartão de post (rosto, nome, duas linhas de texto). */
export function EsqueletoDoPost() {
  return (
    <div className="flex gap-3 border-b border-rule px-[18px] py-4" aria-hidden>
      <div className="h-10 w-10 shrink-0 rounded-full bg-parchment-deep motion-safe:animate-pulse" />
      <div className="min-w-0 flex-1 space-y-2.5">
        <Barra largura="w-1/3" />
        <Barra largura="w-full" />
        <Barra largura="w-4/5" />
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
        <EsqueletoDoPost key={i} />
      ))}
    </div>
  );
}

/** O esqueleto da casca inteira (três colunas no computador, uma no celular), para a Rede abrir sem pular. */
export function EsqueletoDaCasca({ rotulo }: { rotulo: string }) {
  return (
    <div className="mx-auto grid max-w-[1280px] grid-cols-[minmax(0,1fr)] xl:grid-cols-[250px_minmax(0,640px)_300px] xl:justify-center">
      <div className="hidden space-y-3 px-5 py-6 xl:block" aria-hidden>
        <Barra largura="w-2/3" altura="h-6" />
        <Barra largura="w-full" />
        <Barra largura="w-full" />
        <Barra largura="w-3/4" />
      </div>
      <div className="border-rule xl:border-x">
        <EsqueletoDaLinha rotulo={rotulo} />
      </div>
      <div className="hidden space-y-3 px-5 py-6 xl:block" aria-hidden>
        <Barra largura="w-full" altura="h-9" />
        <Barra largura="w-3/4" />
        <Barra largura="w-2/3" />
      </div>
    </div>
  );
}
