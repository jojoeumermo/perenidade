// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import Link from "@/components/Link";

/**
 * "Como funciona" em passos numerados, com o convite para quem quer ensinar ao lado. Serve às páginas que dependem do
 * que a equipe publica (aulas ao vivo, aulas em vídeo): mesmo vazias, elas explicam o que a pessoa vai encontrar.
 */
export function ComoFunciona({ s, href }: { s: { title: string; steps: string[][]; teachTitle: string; teachText: string; teachLink: string }; href: string }) {
  return (
    <section aria-labelledby="como-funciona" className="mt-14 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <div>
        <h2 id="como-funciona" className="border-b-[3px] border-double border-ink pb-2 font-serif text-[1.8rem] font-semibold leading-tight">
          {s.title}
        </h2>
        <ol className="mt-6 grid gap-5 sm:grid-cols-2">
          {s.steps.map(([titulo, texto], i) => (
            <li key={titulo} className="flex gap-4">
              <span aria-hidden className="guia-capitulo-numero">{i + 1}</span>
              <span className="min-w-0">
                <strong className="block font-serif text-xl leading-tight">{titulo}</strong>
                <span className="mt-1 block font-sans text-sm leading-relaxed text-ink-soft">{texto}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>
      <aside className="cartao-preto flex flex-col p-6">
        <p className="font-serif text-2xl leading-tight">{s.teachTitle}</p>
        <p className="mt-2 font-sans text-sm leading-relaxed text-[#e9dcbc]">{s.teachText}</p>
        <p className="mt-auto pt-5">
          <Link href={href} className="botao botao-prelo">
            {s.teachLink} →
          </Link>
        </p>
      </aside>
    </section>
  );
}
