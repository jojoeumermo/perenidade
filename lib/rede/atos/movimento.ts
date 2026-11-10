// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O movimento dos atos (mosaico que vira, carimbo que cai, plaquinhas que giram): uma mola de verdade escrita como `linear()` do
// CSS (a mesma curva serve ao CSS e à Web Animations API) e a pergunta "pode mexer?". Nada se mexe para quem pediu menos movimento
// (prefers-reduced-motion), no modo parado do site (:root[data-parado]) nem no e-ink (:root[data-eink]: tela que pisca a cada
// quadro). Sem "@/".

/**
 * A curva de uma mola amortecida (massa 1), amostrada em `pontos` passos, como `linear(...)`. `rigidez` e `amortecimento` no
 * jeito de sempre: 170/26 é "firme", 220/14 é "com quique" (o carimbo). Devolve também a duração em ms até a mola parar (±0,1 %).
 */
export function mola(rigidez = 170, amortecimento = 26, pontos = 48): { easing: string; duracao: number } {
  const w0 = Math.sqrt(rigidez);
  const zeta = amortecimento / (2 * w0);
  const posicao = (t: number): number => {
    if (zeta < 1) {
      const wd = w0 * Math.sqrt(1 - zeta * zeta);
      return 1 - Math.exp(-zeta * w0 * t) * (Math.cos(wd * t) + ((zeta * w0) / wd) * Math.sin(wd * t));
    }
    return 1 - Math.exp(-w0 * t) * (1 + w0 * t);
  };
  // quanto tempo até ficar a 0,1 % do fim e não sair mais
  let fim = 0;
  for (let t = 0; t < 4; t += 0.004) if (Math.abs(1 - posicao(t)) > 0.001) fim = t;
  const duracao = Math.max(0.12, fim + 0.004);
  const valores: string[] = [];
  for (let i = 0; i <= pontos; i++) valores.push(String(Math.round(posicao((duracao * i) / pontos) * 10000) / 10000));
  valores[valores.length - 1] = "1";
  return { easing: `linear(${valores.join(", ")})`, duracao: Math.round(duracao * 1000) };
}

/** As molas usadas nos atos (calculadas uma vez). */
export const MOLAS = {
  firme: mola(170, 26),
  quique: mola(240, 13),
  macia: mola(120, 20),
} as const;

/** Pode mexer? Falso no servidor, com menos movimento, no modo parado e no e-ink. */
export function podeMexer(): boolean {
  if (typeof window === "undefined" || typeof document === "undefined") return false;
  const raiz = document.documentElement;
  if (raiz.hasAttribute("data-parado") || raiz.hasAttribute("data-eink")) return false;
  try {
    return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/**
 * Vibra num padrão (só onde o aparelho deixa; nunca obrigatório). O farol usa curto-curto-longo. Não depende de "menos movimento":
 * é um aviso pelo tato, útil justamente para quem não está olhando a tela.
 */
export function vibrar(padrao: number[]): void {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") navigator.vibrate(padrao);
  } catch {
    // sem vibrar
  }
}
export const VIBRA_DO_FAROL = [90, 70, 90, 70, 380];
