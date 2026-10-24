// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Book } from "@/lib/content";

const TONS = ["#17130e", "#6e1f1a", "#c21f16", "#4a4032", "#8a5a16", "#1f3a2d", "#2b3a55"];
/** A cor da coleção de cada área: a mesma em todo o site (capa desenhada, etiqueta das estantes). */
export const tomDe = (s: string) => TONS[[...s].reduce((n, c) => n + c.charCodeAt(0), 0) % TONS.length];

/**
 * A capa: a da própria edição, quando a fonte publica uma aberta (guardada no site por scripts/capas.mjs); senão, uma
 * capa desenhada aqui, como livro de coleção: o autor no alto, o título grande, o fio dourado com a estrela e a faixa
 * da coleção embaixo, na cor da área. Nenhuma imagem de terceiros é carregada do endereço deles, e as imagens só
 * carregam quando chegam perto da tela.
 */
export function CapaDoLivro({ book, pequena = false, grande = false }: { book: Book; pequena?: boolean; grande?: boolean }) {
  const tamanho = pequena ? "h-20 w-14" : grande ? "h-80 w-52 max-md:h-64 max-md:w-44" : "h-48 w-32";
  const sombra = pequena ? "shadow-[3px_3px_0_var(--sombra)]" : "shadow-[5px_5px_0_var(--sombra)]";
  if (book.cover) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={book.cover} alt="" loading={grande ? "eager" : "lazy"} decoding="async" width={grande ? 208 : pequena ? 56 : 128} height={grande ? 320 : pequena ? 80 : 192} className={`${tamanho} ${sombra} shrink-0 border-2 border-[#1f1a14] bg-parchment-deep object-cover`} />
    );
  }
  const cor = tomDe(book.area);
  return (
    <div aria-hidden className={`relative flex shrink-0 flex-col overflow-hidden border-2 border-[#1f1a14] text-[#f4ecd8] ${sombra} ${tamanho}`} style={{ background: cor }}>
      {/* A lombada: uma sombra à esquerda, como livro de verdade. */}
      <span className="absolute inset-y-0 left-0 w-2 bg-black/25" />
      <div className={`flex min-h-0 flex-1 flex-col ${pequena ? "p-1.5 pl-2.5" : grande ? "p-5 pl-7" : "p-3 pl-4"}`}>
        <span className={`truncate font-mono uppercase tracking-[0.18em] opacity-85 ${pequena ? "text-[0.38rem]" : grande ? "text-[0.7rem]" : "text-[0.5rem]"}`}>{book.author}</span>
        <span className={`mt-auto font-serif font-semibold leading-[1.05] ${pequena ? "line-clamp-3 text-[0.55rem]" : grande ? "line-clamp-6 text-[1.7rem]" : "line-clamp-5 text-[0.95rem]"}`}>{book.title}</span>
        <span className={`flex items-center gap-1.5 ${pequena ? "mt-1" : "mt-3"}`}>
          <span className={`${pequena ? "h-px" : "h-0.5"} flex-1 bg-[#d4a24c]`} />
          <svg viewBox="33 9 54 53" className={pequena ? "h-2 w-2" : "h-3.5 w-3.5"} fill="#d4a24c"><polygon points="60,10 66.29,29.35 86.63,29.35 70.17,41.31 76.46,60.65 60,48.7 43.54,60.65 49.83,41.31 33.37,29.35 53.71,29.35" /></svg>
          <span className={`${pequena ? "h-px" : "h-0.5"} flex-1 bg-[#d4a24c]`} />
        </span>
      </div>
      {!pequena && (
        <span className={`block bg-[#17130e]/80 text-center font-mono uppercase tracking-[0.2em] text-[#d4a24c] ${grande ? "py-2 text-[0.6rem]" : "py-1 text-[0.42rem]"}`}>Instituto Lúcia · Acervo</span>
      )}
    </div>
  );
}
