// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { CSSProperties } from "react";
import { plural } from "@/i18n/config";
import type { Dict } from "@/i18n/types";
import type { Peca } from "@/components/GaleriaGrade";

/**
 * Os cartazes do alto, na ordem em que ficam no varal: de lugares e tempos diferentes, alternando deitado e em pé. As
 * miniaturas (public/imagens/galeria/varal) têm 300 px de altura; o cartaz inteiro abre na grade logo abaixo.
 * No celular ficam os três marcados com "celular".
 */
const NO_VARAL: { slug: string; celular?: true }[] = [
  { slug: "lissitzky-cunha-vermelha", celular: true },
  { slug: "piramide-do-capitalismo", celular: true },
  { slug: "greve-geral-1917" },
  { slug: "kollwitz-nunca-mais-guerra" },
  { slug: "posada-catrina", celular: true },
];

// O barbante é uma curva de 40 unidades de altura (2,5rem): y(u) = 4 + 80·u·(1 − u), com u de 0 a 1 na largura.
const caida = (u: number) => (4 + 80 * u * (1 - u)) / 16;

/** O meio de cada cartaz na largura do varal (de 0 a 1), pela proporção de cada um: todos têm a mesma altura. */
function meios(proporcoes: number[]): number[] {
  const total = proporcoes.reduce((a, b) => a + b, 0);
  let antes = 0;
  return proporcoes.map((p) => {
    const meio = (antes + p / 2) / total;
    antes += p;
    return meio;
  });
}

/** O primeiro e o último ano que aparecem nas datas ("c. 1830", "1872–1875", "17 de maio de 1888"). */
function periodo(pecas: Peca[]): [number, number] | null {
  const anos = pecas.flatMap((p) => (p.ano.match(/\d{4}/g) ?? []).map(Number));
  return anos.length ? [Math.min(...anos), Math.max(...anos)] : null;
}

/**
 * A abertura da galeria como varal de cordel na feira: um barbante atravessa a página e os cartazes do acervo ficam
 * pendurados nele por pregadores, balançando de leve (parados no modo leve e para quem pede menos movimento). Embaixo,
 * o título em letra de cartaz e a etiqueta de museu com as contas do acervo, tiradas da própria lista.
 */
export function VaralDaGaleria({ lang, s, slogan, pecas }: { lang: string; s: Dict["gallery"]; slogan: string; pecas: Peca[] }) {
  const porSlug = new Map(pecas.map((p) => [p.slug, p]));
  const varal = NO_VARAL.flatMap(({ slug, celular }) => {
    const peca = porSlug.get(slug);
    return peca ? [{ peca, celular: Boolean(celular), proporcao: peca.largura / peca.altura }] : [];
  });
  const noDesktop = meios(varal.map((v) => v.proporcao));
  const noCelular = meios(varal.filter((v) => v.celular).map((v) => v.proporcao));
  let celulares = 0;
  const anos = periodo(pecas);
  const [primeira, ...resto] = s.title.split(" ");
  return (
    <header className="pb-2">
      <p className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 pb-1.5 font-mono text-[0.68rem] uppercase tracking-[0.2em] text-ink-soft">
        <span>{slogan}</span>
        <span>{s.eyebrow}</span>
      </p>
      {varal.length > 0 && (
        <div aria-hidden className="varal relative mt-3">
          <svg viewBox="0 0 1000 40" preserveAspectRatio="none" className="varal-barbante absolute inset-x-0 top-0 h-10 w-full" fill="none">
            <path d="M0 4 Q500 44 1000 4" strokeWidth="2.2" vectorEffect="non-scaling-stroke" />
          </svg>
          <ul className="relative flex items-start gap-[clamp(0.6rem,2.2vw,1.5rem)] px-[2%]">
            {varal.map(({ peca, celular, proporcao }, i) => {
              const noCel = celular ? noCelular[celulares++] : 0;
              const estilo = {
                flex: `${proporcao} 1 0`,
                "--cai": `${caida(noDesktop[i]).toFixed(3)}rem`,
                "--cai-cel": `${caida(noCel).toFixed(3)}rem`,
                "--giro": `${[-2.4, 1.8, -1.2, 2.6, -1.9][i % 5]}deg`,
                "--tempo": `${[6.2, 7.4, 5.6, 6.8, 7.9][i % 5]}s`,
              } as CSSProperties;
              return (
                <li key={peca.slug} className={`varal-cartaz relative ${celular ? "" : "max-sm:hidden"}`} style={estilo}>
                  <a href={`#${peca.slug}`} tabIndex={-1} className="varal-folha block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/imagens/galeria/varal/${peca.slug}.webp`} alt="" width={Math.round(300 * proporcao)} height={300} decoding="async" className="block h-auto w-full" />
                  </a>
                  <span className="varal-pregador" />
                </li>
              );
            })}
          </ul>
        </div>
      )}
      <div className="mt-9 flex flex-wrap items-end justify-between gap-x-8 gap-y-6 max-sm:mt-7">
        <h1 className="lambe min-w-0 text-[clamp(2.9rem,10.5vw,6.9rem)] leading-[0.86] text-ink">
          {primeira}
          {resto.length > 0 && (
            <>
              <br />
              <span className="text-prelo-texto">{resto.join(" ")}</span>
            </>
          )}
        </h1>
        <dl className="etiqueta-museu mb-2 shrink-0 rotate-[1.5deg] font-mono text-[0.7rem] uppercase tracking-[0.16em]">
          <dt className="text-ink-soft">{s.labelCollection}</dt>
          <dd className="lambe mt-1 text-[1.65rem] normal-case not-italic tracking-normal">{plural(lang, pecas.length, s.labelCount)}</dd>
          {anos && (
            <dd className="mt-1.5">
              {anos[0]} – {anos[1]}
            </dd>
          )}
          <dd className="mt-0.5 text-ink-soft">{s.labelPd}</dd>
        </dl>
      </div>
      <div className="jornal-fio mt-5" />
      <div className="mt-4 max-w-3xl text-lg leading-snug text-ink-soft max-md:text-base">{s.lead}</div>
    </header>
  );
}
