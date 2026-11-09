// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { CSSProperties, Ref } from "react";
import Link from "@/components/Link";
import { sementeDe } from "@/lib/rede/mosaico";

/** As cinco cores de comunidade das pranchas (tokens --al-com-1 … --al-com-5). */
export type CorDaComunidade = 1 | 2 | 3 | 4 | 5;

/** A cor de uma comunidade a partir do slug: a mesma comunidade tem sempre a mesma cor, em qualquer tela. */
export function corDaComunidade(slug: string): CorDaComunidade {
  return ((sementeDe(slug) % 5) + 1) as CorDaComunidade;
}

export interface PropsDaPilula {
  /** O nome que aparece ("Passe Livre SP"). */
  texto: string;
  /** A cor (1–5) ou o slug da comunidade, de onde a cor sai. */
  cor?: CorDaComunidade;
  slug?: string;
  /** Com endereço, a pílula leva à comunidade. */
  href?: string;
  tamanho?: "p" | "m";
  ref?: Ref<HTMLElement>;
  className?: string;
}

/**
 * A pílula da comunidade (pranchas: "■ Passe Livre SP" em cima do ato e de cada post): bolinha quadrada e nome na cor da
 * comunidade, fundo da mesma cor bem apagado. Com `href` vira link para a comunidade (a função dela: dizer de onde é o post e
 * levar até lá). No e-ink e no alto contraste a cor some e fica a borda.
 */
export function Pilula({ texto, cor, slug, href, tamanho = "p", ref, className = "" }: PropsDaPilula) {
  const n = cor ?? (slug ? corDaComunidade(slug) : 1);
  const estilo = { "--al-cor": `var(--al-com-${n})` } as CSSProperties;
  const classes = `al-pilula al-pilula-${tamanho} ${className}`.trim();
  const miolo = (
    <>
      <span aria-hidden className="al-pilula-ponto" />
      <span>{texto}</span>
    </>
  );
  if (href) {
    return (
      <Link href={href} ref={ref as Ref<HTMLAnchorElement>} className={classes} style={estilo}>
        {miolo}
      </Link>
    );
  }
  return (
    <span ref={ref as Ref<HTMLSpanElement>} className={classes} style={estilo}>
      {miolo}
    </span>
  );
}
