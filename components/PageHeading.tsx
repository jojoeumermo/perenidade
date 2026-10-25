// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import Link from "next/link";

/**
 * O alto das páginas que ainda não usam a <Capa> (components/pagina/Capa.tsx): o mesmo desenho da capa de papel do
 * Caderno do Povo, com o rótulo de arquivo, o título grande em letra de livro e a linha fina. A faixa vai de ponta a
 * ponta com o fio de tinta embaixo, mesmo dentro da coluna estreita da página (o CSS de .cabeca-da-pagina, em
 * app/globals.css, estica a faixa e mantém o texto alinhado à coluna).
 */
export function PageHeading({ eyebrow, title, children, voltar }: { eyebrow: string; title: string; children?: React.ReactNode; /** O link de volta à página de cima ("← Ferramentas"), dentro da faixa. */ voltar?: { href: string; texto: string } }) {
  return (
    <header className="cabeca-da-pagina pont">
      {voltar && (
        <p className="no-print mb-6 font-sans text-sm">
          <Link href={voltar.href} className="text-ink-soft hover:text-oxblood">← {voltar.texto}</Link>
        </p>
      )}
      <p className="rotulo">{eyebrow}</p>
      <h1 className="mt-3 text-[2.6rem] font-medium leading-[1.0] tracking-[-0.01em] text-balance app:max-md:text-3xl sm:text-6xl lg:text-[4.2rem]">{title}</h1>
      {children && <div className="mt-5 max-w-[40rem] text-[1.3rem] leading-[1.45] text-ink-soft app:max-md:text-base max-md:text-lg">{children}</div>}
    </header>
  );
}
