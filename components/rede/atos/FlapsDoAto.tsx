// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// As plaquinhas do "PRÓXIMO ATO" como um painel de aeroporto (split-flap): cada plaquinha é dividida ao meio; quando o número
// muda, a metade de cima cai e mostra o número novo. Quando a faixa aparece, as plaquinhas giram por alguns números antes de parar
// no certo, uma depois da outra. A conta é a mesma das plaquinhas da F0 (components/rede/ui/Flaps.tsx: quantoFalta e
// gruposDosFlaps); o relógio acerta o passo na virada do minuto. Antes de montar no navegador não mostra número (o servidor não
// sabe a hora da pessoa). O leitor de tela ouve só a frase ("faltam 2 dias e 4 horas"), nunca as plaquinhas. Sem movimento
// ("menos movimento", modo parado, e-ink), o número só troca.
import { useEffect, useRef, useState } from "react";
import { gruposDosFlaps, quantoFalta, type Falta } from "../ui/Flaps";
import { podeMexer } from "@/lib/rede/atos/movimento";

const GIRO = "0123456789";

/** Uma plaquinha. `giro` > 0: gira por esse número de caracteres antes de parar (a entrada do painel). */
function Plaquinha({ c, giro, atraso }: { c: string; giro: number; atraso: number }) {
  // Com movimento, a plaquinha nasce alguns números antes (o giro de entrada termina no certo); sem movimento, já no certo.
  const [inicial] = useState(() => (giro > 0 && /\d/.test(c) && podeMexer() ? GIRO[(Number(c) - giro - 1 + 100) % 10] : c));
  const [mostra, setMostra] = useState(inicial);
  const [antes, setAntes] = useState<string | null>(null);
  const [volta, setVolta] = useState(0);
  const atual = useRef(inicial);
  const primeira = useRef(true);

  useEffect(() => {
    const mexe = podeMexer();
    const fila: string[] = [];
    if (primeira.current && giro > 0 && mexe && /\d/.test(c)) {
      const n = Number(c);
      for (let k = giro; k >= 1; k--) fila.push(GIRO[(n - k + 100) % 10]);
    }
    primeira.current = false;
    if (c !== atual.current || fila.length) fila.push(c);
    if (!fila.length) return;
    if (!mexe) {
      atual.current = c;
      queueMicrotask(() => setMostra(c));
      return;
    }
    let i = 0;
    let relogio: number | undefined;
    const passo = () => {
      const prox = fila[i++];
      setAntes(atual.current);
      atual.current = prox;
      setMostra(prox);
      setVolta((v) => v + 1);
      if (i < fila.length) relogio = window.setTimeout(passo, 90);
      else relogio = window.setTimeout(() => setAntes(null), 340);
    };
    relogio = window.setTimeout(passo, atraso);
    return () => window.clearTimeout(relogio);
  }, [c, giro, atraso]);

  return (
    <span className="al-flap al-cond al-flap-vivo" data-virando={antes !== null ? "" : undefined}>
      <span className="al-flap-fixo al-flap-cima">{mostra}</span>
      <span className="al-flap-fixo al-flap-baixo">{antes ?? mostra}</span>
      {antes !== null ? (
        <>
          <span key={`c${volta}`} className="al-flap-folha al-flap-folha-cima">{antes}</span>
          <span key={`b${volta}`} className="al-flap-folha al-flap-folha-baixo">{mostra}</span>
        </>
      ) : null}
      <span className="al-flap-medida" aria-hidden>{mostra}</span>
    </span>
  );
}

export interface PropsDosFlapsDoAto {
  ate: string;
  rotulo: (f: Falta) => string;
  agoraTexto: string;
  className?: string;
}

export function FlapsDoAto({ ate, rotulo, agoraTexto, className = "" }: PropsDosFlapsDoAto) {
  const alvo = new Date(ate).getTime();
  const [agora, setAgora] = useState<number | null>(null);
  useEffect(() => {
    let relogio: number | undefined;
    const tique = () => {
      setAgora(Date.now());
      // o próximo tique cai logo depois da virada do minuto (o número muda quando deve)
      relogio = window.setTimeout(tique, 60_000 - (Date.now() % 60_000) + 50);
    };
    relogio = window.setTimeout(tique, 0);
    return () => window.clearTimeout(relogio);
  }, []);
  const falta = agora === null ? null : quantoFalta(alvo, agora);
  const frase = falta ? (falta.passou ? agoraTexto : rotulo(falta)) : "";
  if (!falta) {
    return (
      <span className={`al-flaps ${className}`.trim()} aria-hidden>
        <span className="al-flaps-grupo">
          <span className="al-flap al-cond">–</span>
        </span>
      </span>
    );
  }
  if (falta.passou) {
    return (
      <span className={`al-flaps ${className}`.trim()} role="timer" aria-live="off" aria-label={frase}>
        <span className="al-flap al-flap-texto al-cond al-flap-agora" aria-hidden>
          {agoraTexto}
        </span>
      </span>
    );
  }
  const grupos = gruposDosFlaps(falta);
  let n = 0;
  return (
    <span className={`al-flaps ${className}`.trim()} role="timer" aria-live="off" aria-label={frase}>
      {grupos.map((g, i) => (
        <span key={i} className="al-flaps-grupo" aria-hidden>
          {[...g].map((c, j) => {
            const k = n++;
            return <Plaquinha key={j} c={c} giro={/\d/.test(c) ? 6 + k * 2 : 0} atraso={120 + k * 70} />;
          })}
        </span>
      ))}
    </span>
  );
}
