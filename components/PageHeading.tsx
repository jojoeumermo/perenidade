// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
/** O alto de cada página: o rótulo de arquivo em vermelho, o título grande e a linha fina embaixo. */
export function PageHeading({ eyebrow, title, children }: { eyebrow: string; title: string; children?: React.ReactNode }) {
  return (
    <header className="cabeca-da-pagina">
      <p className="rotulo">{eyebrow}</p>
      <h1 className="mt-2.5 text-[2.5rem] font-medium leading-[1.02] tracking-[-0.01em] text-balance app:max-md:text-3xl sm:text-6xl">{title}</h1>
      {children && <div className="mt-4 max-w-2xl text-xl leading-relaxed text-ink-soft app:max-md:text-base">{children}</div>}
    </header>
  );
}
