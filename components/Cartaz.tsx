// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { Star } from "./Masthead";

/**
 * Abertura de página no desenho dos cartazes, o mesmo do jornal: a palavra de ordem no alto, a faixa com o
 * título em letra pesada, a cunha com a estrela e o fio duplo. O tom muda conforme a página:
 * vermelho (assembleia, gráfica, debate), preto (arquivo, rádio, checagem), luto (memorial) e raios (mural).
 */
export type Tom = "vermelho" | "preto" | "luto" | "raios";

const faixa: Record<Tom, string> = {
  vermelho: "jornal-faixa",
  preto: "jornal-preto",
  luto: "jornal-preto",
  raios: "jornal-raios jornal-faixa-raios",
};
const cunha: Record<Tom, string> = {
  vermelho: "",
  preto: "jornal-cunha-vermelha",
  luto: "jornal-cunha-luto",
  raios: "",
};

export function Cartaz({ eyebrow, title, slogan, tone = "vermelho", children }: { eyebrow: string; title: string; slogan?: string; tone?: Tom; children?: React.ReactNode }) {
  // A letra encolhe para a palavra mais comprida caber inteira antes da cunha ("Trabalhadores" não pode quebrar).
  const longest = Math.max(...title.split(/\s+/).map((word) => [...word].length));
  const size = Math.min(11, 62 / (longest * 0.68));
  return (
    <header>
      <p className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 pb-1.5 font-mono text-[0.68rem] uppercase tracking-[0.2em] text-ink-soft">
        {slogan && <span>{slogan}</span>}
        <span>{eyebrow}</span>
      </p>
      <div className={`${faixa[tone]} jornal-cartaz`}>
        <h1 className="jornal-cartaz-nome font-sans font-black uppercase italic">
          <span className="jornal-cartaz-baixo jornal-cartaz-titulo" style={{ fontSize: `min(${size.toFixed(2)}cqw, 7rem)` }}>
            {title}
          </span>
        </h1>
        <span className={`jornal-cunha ${cunha[tone]}`} aria-hidden>
          <Star className="jornal-cunha-estrela" />
        </span>
      </div>
      <div className="jornal-fio" />
      {children && <div className="mt-4 max-w-3xl text-lg leading-snug text-ink-soft max-md:text-base">{children}</div>}
    </header>
  );
}
