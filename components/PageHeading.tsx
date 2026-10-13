// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
export function PageHeading({ eyebrow, title, children }: { eyebrow: string; title: string; children?: React.ReactNode }) {
  return (
    <header>
      <p className="font-mono text-xs uppercase tracking-[0.3em] text-gold">{eyebrow}</p>
      <h1 className="mt-2 text-4xl font-semibold app:max-md:text-3xl sm:text-5xl">{title}</h1>
      {children && <div className="mt-3 max-w-2xl text-lg text-ink-soft app:max-md:text-base">{children}</div>}
    </header>
  );
}
