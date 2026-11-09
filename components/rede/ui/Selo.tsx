// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Ref } from "react";
import Link from "@/components/Link";

export interface PropsDoSelo {
  /** "Organização verificada" no idioma da tela. */
  texto: string;
  /**
   * A regra do selo, sempre junto (pranchas Org-Perfil e Traga sua organização): "o selo diz que a conta é de quem diz ser, não é
   * apoio do Instituto Lúcia". Vai como descrição acessível e como dica ao passar o mouse.
   */
  regra: string;
  /** Desde quando (já formatado: "desde 03/11/2026"). */
  desde?: string;
  /** Leva à explicação do selo (/alumia/organizacoes). */
  href?: string;
  ref?: Ref<HTMLElement>;
  className?: string;
}

function Visto() {
  return (
    <svg aria-hidden viewBox="0 0 16 16" className="al-selo-visto">
      <rect x={0.5} y={0.5} width={15} height={15} rx={3.5} fill="var(--al-sobre-vermelho, #fff)" />
      <path d="M4 8.3 6.7 11 12 5.2" fill="none" stroke="var(--al-vermelho, #e8321f)" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * O selo de organização verificada (prancha computador-inicio: "☑ Organização verificada" vermelho ao lado do nome). Diz uma
 * coisa só: a conta é de quem diz ser, conferida por documento público (CNPJ, registro de partido, diploma). Não dá alcance a mais
 * e não é apoio do Instituto: a regra vai junto, para o leitor de tela e para quem passa o mouse (PLANO-ALUMIA §6.5).
 */
export function Selo({ texto, regra, desde, href, ref, className = "" }: PropsDoSelo) {
  const classes = `al-selo ${className}`.trim();
  const miolo = (
    <>
      <Visto />
      <span>{texto}</span>
      {desde ? <span className="al-selo-desde">{desde}</span> : null}
      <span className="sr-only">. {regra}</span>
    </>
  );
  if (href) {
    return (
      <Link href={href} ref={ref as Ref<HTMLAnchorElement>} className={classes} title={regra}>
        {miolo}
      </Link>
    );
  }
  return (
    <span ref={ref as Ref<HTMLSpanElement>} className={classes} title={regra}>
      {miolo}
    </span>
  );
}
