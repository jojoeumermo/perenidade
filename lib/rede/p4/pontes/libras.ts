// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prompt 4, item 87 (atrás de "alumia-p4-pontes"): a janela de Libras na aula ao vivo. Quem assiste escolhe qual vídeo é o da
// intérprete; ele fica fixo num canto, sempre à vista, por cima do resto da página, e não some ao rolar. A escolha é SÓ do aparelho
// (memória da tela; nada vai ao banco, à rede ou ao armazenamento do navegador). Regras puras do tamanho e do lado, sem "@/".

export type TamanhoDaJanela = "p" | "m" | "g";
export type LadoDaJanela = "direita" | "esquerda";

/**
 * A largura da janela em cada tamanho. Mesmo o menor não fica minúsculo: a intérprete precisa ser vista com as mãos e o rosto, e
 * no celular a janela ocupa uma boa parte da largura.
 */
export const LARGURA_DA_JANELA: Record<TamanhoDaJanela, string> = {
  p: "min(45vw, 260px)",
  m: "min(60vw, 360px)",
  g: "min(90vw, 520px)",
};

/** A largura mínima, em px, que nenhum tamanho passa para baixo (o teste confere). */
export const LARGURA_MINIMA_PX = 160;

const ORDEM: readonly TamanhoDaJanela[] = ["p", "m", "g"];

/** O próximo tamanho para cima ou para baixo (para nas pontas). */
export function outroTamanho(atual: TamanhoDaJanela, maior: boolean): TamanhoDaJanela {
  const i = ORDEM.indexOf(atual);
  return ORDEM[Math.max(0, Math.min(ORDEM.length - 1, i + (maior ? 1 : -1)))];
}

/** O estilo da janela fixa: canto de baixo, longe das bordas (o gutter de 16 px), por cima de tudo, sem animação. */
export function estiloDaJanela(tamanho: TamanhoDaJanela, lado: LadoDaJanela): Record<string, string | number> {
  return {
    position: "fixed",
    bottom: "16px",
    [lado === "direita" ? "right" : "left"]: "16px",
    width: LARGURA_DA_JANELA[tamanho],
    minWidth: `${LARGURA_MINIMA_PX}px`,
    zIndex: 60,
  };
}
