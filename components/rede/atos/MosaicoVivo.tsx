// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// O mosaico do ato, VIVO (ALUMIA-FUNCOES-E-IDEIAS §2.1 ideia 3): a mesma grade de components/rede/mosaico/Mosaico.tsx (montada
// por lib/rede/mosaico.ts, a regra de privacidade fica lá), mas cada cartão é uma peça que vira:
//   - quando o mosaico aparece na tela, os cartões acesos viram um a um, em onda, a partir do centro (ou do seu cartão);
//   - quando a proporção muda (alguém confirmou e o servidor mandou o novo passo de 10 %), só os cartões que mudaram viram, como
//     cartas virando na mesa, em onda a partir do seu cartão dourado;
//   - o seu cartão dourado cai com mola e solta um anel;
//   - no computador, o painel inclina de leve seguindo o ponteiro.
// Nada disso acontece com "menos movimento", no modo parado ou no e-ink (lib/rede/atos/movimento.ts): aí o mosaico é o desenho
// parado de sempre. O leitor de tela ouve só o rótulo (proporção, nunca número de pessoas).
import { useEffect, useLayoutEffect, useMemo, useRef, type PointerEvent } from "react";
import { montarMosaico, type TipoDoCartao } from "@/lib/rede/mosaico";
import { MOLAS, podeMexer } from "@/lib/rede/atos/movimento";

const PASSO = 22;
const CARTAO = 19;
const RAIO = 4;

// As cores vêm de atos.css (.al-mosaico-vivo): o fundo aceso fica mais baixo que a palavra, para a palavra ler de longe; no alto
// contraste e no e-ink valem os tokens de sempre.
const COR: Record<TipoDoCartao, string> = {
  aceso: "var(--al-mv-aceso, #f3efe6)",
  apagado: "var(--al-mv-apagado, #2a2622)",
  "letra-acesa": "var(--al-mv-letra, #e8321f)",
  "letra-apagada": "var(--al-mv-letra-apagada, #7a281d)",
  voce: "var(--al-voce, #ffc21a)",
};
const daPalavra = (t: TipoDoCartao) => t === "letra-acesa" || t === "letra-apagada";
// Os cartões da palavra crescem até quase encostar no vizinho: a letra vira traço cheio, não pontilhado.
const CRESCE = 2;
const aceso = (t: TipoDoCartao | undefined) => t === "aceso" || t === "letra-acesa" || t === "voce";

export interface PropsDoMosaicoVivo {
  palavra: string;
  semente: string;
  proporcao: number | null;
  quebrar?: number;
  voce?: boolean;
  sementeLocal?: string;
  rotulo: string;
  className?: string;
  /** Inclinar com o ponteiro (só o mosaico grande da tela do ato). */
  inclinar?: boolean;
}

export function MosaicoVivo({ palavra, semente, proporcao, quebrar, voce, sementeLocal, rotulo, className = "", inclinar = false }: PropsDoMosaicoVivo) {
  const m = useMemo(() => montarMosaico(palavra, semente, proporcao, { quebrar, voce, sementeLocal }), [palavra, semente, proporcao, quebrar, voce, sementeLocal]);
  const svg = useRef<SVGSVGElement>(null);
  const caixa = useRef<HTMLDivElement>(null);
  const antes = useRef<TipoDoCartao[] | null>(null);
  const acordou = useRef(false);

  const largura = m.colunas * PASSO - (PASSO - CARTAO);
  const altura = m.linhas * PASSO - (PASSO - CARTAO);
  const margem = 4;

  /** Vira os cartões `indices` (de `de` para o tipo atual), em onda a partir de `origem`. */
  const virar = (indices: number[], de: (i: number) => TipoDoCartao, origem: number, atrasoBase = 0, passo = 14) => {
    const raiz = svg.current;
    if (!raiz) return;
    const ox = origem % m.colunas;
    const oy = Math.floor(origem / m.colunas);
    for (const i of indices) {
      const el = raiz.querySelector<SVGRectElement>(`[data-i="${i}"] rect:last-child`);
      if (!el) continue;
      const d = Math.hypot((i % m.colunas) - ox, Math.floor(i / m.colunas) - oy);
      const velho = COR[de(i)];
      const novo = COR[m.cartoes[i]];
      el.animate(
        [
          { transform: "perspective(60px) rotateY(0deg)", fill: velho },
          { transform: "perspective(60px) rotateY(90deg)", fill: velho, offset: 0.45 },
          { transform: "perspective(60px) rotateY(-90deg)", fill: novo, offset: 0.4501 },
          { transform: "perspective(60px) rotateY(0deg)", fill: novo },
        ],
        { duration: 520, delay: atrasoBase + d * passo, easing: "cubic-bezier(.3,.7,.35,1)", fill: "backwards" },
      );
    }
  };

  // A primeira vez que o mosaico aparece na tela: os acesos viram em onda (de apagado para aceso).
  useEffect(() => {
    const el = caixa.current;
    if (!el || acordou.current || !podeMexer() || typeof IntersectionObserver === "undefined") {
      acordou.current = true;
      return;
    }
    const olho = new IntersectionObserver(
      (entradas) => {
        if (!entradas.some((e) => e.isIntersecting) || acordou.current) return;
        acordou.current = true;
        olho.disconnect();
        const idx = m.cartoes.map((t, i) => (aceso(t) ? i : -1)).filter((i) => i >= 0);
        const voceI = m.cartoes.indexOf("voce");
        const centro = Math.floor(m.linhas / 2) * m.colunas + Math.floor(m.colunas / 2);
        // logo depois de trocar de ato (a tela dos atos marca :root[data-al-ir]) a onda espera o ato novo assentar, para não virar
        // no meio da entrada
        const espera = document.documentElement.hasAttribute("data-al-ir") ? 380 : 0;
        virar(idx, (i) => (m.cartoes[i] === "letra-acesa" ? "letra-apagada" : "apagado"), voceI >= 0 ? voceI : centro, 80 + espera, 9);
      },
      { threshold: 0.35 },
    );
    olho.observe(el);
    return () => olho.disconnect();
    // só na montagem: as trocas depois são do efeito de baixo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A proporção (ou o seu cartão) mudou: só os cartões que mudaram viram, em onda a partir do seu cartão.
  useLayoutEffect(() => {
    const velho = antes.current;
    antes.current = m.cartoes;
    if (!velho || velho.length !== m.cartoes.length || !podeMexer() || !acordou.current) return;
    const mudaram = m.cartoes.map((t, i) => (t !== velho[i] ? i : -1)).filter((i) => i >= 0);
    if (!mudaram.length) return;
    const voceI = m.cartoes.indexOf("voce");
    const voceAntes = velho.indexOf("voce");
    const origem = voceI >= 0 ? voceI : voceAntes >= 0 ? voceAntes : mudaram[0];
    virar(mudaram.filter((i) => i !== voceI), (i) => velho[i], origem, voceI >= 0 ? 140 : 0, 22);
    // o seu cartão cai com mola e solta um anel; se o mosaico está fora da tela (no celular a coluna fica embaixo dele), o cartão
    // espera a tela chegar nele (a coluna sobe até o mosaico) para cair à vista
    if (voceI >= 0 && voceAntes < 0 && svg.current) {
      const raiz = svg.current;
      const g = raiz.querySelector<SVGGElement>(`[data-i="${voceI}"]`);
      const cartao = g?.querySelector<SVGRectElement>("rect:last-child");
      const cair = (atraso: number) => {
        cartao?.animate([{ transform: "scale(2.2)", opacity: 0 }, { transform: "scale(1)", opacity: 1 }], {
          duration: MOLAS.quique.duracao,
          easing: MOLAS.quique.easing,
          delay: atraso,
          fill: "backwards",
        });
        g?.querySelector(".al-mv-anel")?.animate(
          [{ transform: "scale(1)", opacity: 0.9, strokeWidth: 3 }, { transform: "scale(3.2)", opacity: 0, strokeWidth: 0.5 }],
          { duration: 900, easing: "cubic-bezier(.2,.7,.3,1)", delay: atraso + 120 },
        );
      };
      const r = raiz.getBoundingClientRect();
      if ((r.bottom > 0 && r.top < window.innerHeight) || typeof IntersectionObserver === "undefined") cair(0);
      else {
        const esconder = cartao?.animate([{ opacity: 0 }, { opacity: 0 }], { duration: 4000 });
        const olho = new IntersectionObserver(
          (entradas) => {
            if (!entradas.some((e) => e.isIntersecting)) return;
            olho.disconnect();
            esconder?.cancel();
            cair(80);
          },
          { threshold: 0.5 },
        );
        olho.observe(raiz);
        window.setTimeout(() => olho.disconnect(), 4000);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m]);

  const mover = (e: PointerEvent<HTMLDivElement>) => {
    if (!inclinar || e.pointerType !== "mouse" || !podeMexer()) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    e.currentTarget.style.setProperty("--al-mv-rx", `${(-y * 5).toFixed(2)}deg`);
    e.currentTarget.style.setProperty("--al-mv-ry", `${(x * 7).toFixed(2)}deg`);
    e.currentTarget.style.setProperty("--al-mv-luz-x", `${((x + 0.5) * 100).toFixed(1)}%`);
    e.currentTarget.style.setProperty("--al-mv-luz-y", `${((y + 0.5) * 100).toFixed(1)}%`);
  };
  const soltar = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.style.removeProperty("--al-mv-rx");
    e.currentTarget.style.removeProperty("--al-mv-ry");
  };

  return (
    <div
      ref={caixa}
      className={`al-mosaico al-mosaico-vivo${inclinar ? " al-mosaico-inclina" : ""} ${className}`.trim()}
      onPointerMove={inclinar ? mover : undefined}
      onPointerLeave={inclinar ? soltar : undefined}
    >
      <svg
        ref={svg}
        role="img"
        aria-label={rotulo}
        viewBox={`${-margem} ${-margem} ${largura + 2 * margem} ${altura + 2 * margem}`}
        width="100%"
        className="al-mosaico-vivo-svg"
        data-colunas={m.colunas}
        data-linhas={m.linhas}
      >
        {m.cartoes.map((tipo, i) => {
          const x = (i % m.colunas) * PASSO;
          const y = Math.floor(i / m.colunas) * PASSO;
          return (
            <g key={i} data-i={i} data-tipo={tipo}>
              {tipo === "voce" ? (
                <rect className="al-mv-anel" x={x - 3} y={y - 3} width={CARTAO + 6} height={CARTAO + 6} rx={RAIO + 2} fill="none" stroke="var(--al-voce, #ffc21a)" strokeWidth={2} />
              ) : null}
              {daPalavra(tipo) ? (
                <rect className="al-mv-cartao al-mv-letra" x={x - CRESCE / 2} y={y - CRESCE / 2} width={CARTAO + CRESCE} height={CARTAO + CRESCE} rx={RAIO - 1} fill={COR[tipo]} stroke="var(--al-cartao-borda, transparent)" strokeWidth={1} />
              ) : (
                <rect className="al-mv-cartao" x={x} y={y} width={CARTAO} height={CARTAO} rx={RAIO} fill={COR[tipo]} stroke={tipo === "voce" ? undefined : "var(--al-cartao-borda, transparent)"} strokeWidth={1} />
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
