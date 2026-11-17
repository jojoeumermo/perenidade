// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Ref } from "react";

/**
 * Os cartões da chama do lampião (desenhada como o mosaico: 3 colunas × 5 linhas, como na prancha original da marca).
 * "d" = dourado, "v" = vermelho, "." = vazio. Só as duas cores da casa: o vermelho-escuro de antes saiu.
 */
const CHAMA = [".d.", ".vv", "vvv", "vdv", ".v."];

/** A caixa do desenho (a prancha original, 745 × 1280): mais estreita que alta, cerca de 0,58. */
const CAIXA = { x: 480, y: 330, largura: 745, altura: 1280 } as const;

/**
 * O logo da Alumia: um lampião (alça e tampa grossas, vidro de moldura grossa e cantos redondos, base em pílula solta) com a chama
 * feita de cartões vermelhos e dourados, a mesma linguagem do mosaico do ato. Desenho próprio, fiel à prancha original (sem imagem
 * de fora). `tamanho` é a ALTURA em pixels; a largura sai da proporção do desenho. As cores são as variáveis da Alumia, então o
 * tema claro, o alto contraste e o e-ink valem aqui também. Decorativo por padrão (a marca escrita vem ao lado); com `rotulo`,
 * vira imagem com nome para o leitor de tela.
 */
export function Lampiao({ tamanho = 40, rotulo, ref, className = "" }: { tamanho?: number; rotulo?: string; ref?: Ref<SVGSVGElement>; className?: string }) {
  const cor = { d: "var(--al-dourado, #ffc21a)", v: "var(--al-vermelho, #e8321f)" } as const;
  const papel = "var(--al-texto, #f3efe6)";
  return (
    <svg
      ref={ref}
      viewBox={`${CAIXA.x} ${CAIXA.y} ${CAIXA.largura} ${CAIXA.altura}`}
      width={Math.round(((tamanho * CAIXA.largura) / CAIXA.altura) * 10) / 10}
      height={tamanho}
      className={`al-lampiao ${className}`.trim()}
      {...(rotulo ? { role: "img", "aria-label": rotulo } : { "aria-hidden": true })}
    >
      {/* Alça. */}
      <path d="M662 620V577A190 190 0 0 1 1042 577V620" fill="none" stroke={papel} strokeWidth={94} />
      {/* Tampa: o trapézio de abas. */}
      <path d="M548 616H1157L1106 711H598Z" fill={papel} />
      {/* Vidro: a moldura grossa e, dentro, a noite. */}
      <rect x={487} y={709} width={731} height={761} rx={150} fill={papel} />
      <rect x={573} y={794} width={558} height={578} rx={95} fill="var(--al-fundo, #0f0e0d)" />
      {/* Chama de cartões. */}
      {CHAMA.flatMap((linha, y) =>
        [...linha].map((c, x) =>
          c === "." ? null : <rect key={`${x}-${y}`} x={700 + x * 105} y={826 + y * 105} width={95} height={95} rx={13} fill={cor[c as keyof typeof cor]} />,
        ),
      )}
      {/* Base: a pílula solta. */}
      <rect x={586} y={1487} width={536} height={113} rx={56.5} fill={papel} />
    </svg>
  );
}
