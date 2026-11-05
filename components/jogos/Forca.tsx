// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useRef, useState } from "react";
import { fill } from "@/i18n/config";
import { criarSorteio, mascarar, palavrasParaLetras, primeiraFrase, sementeNova, type PalavraDeJogo } from "@/lib/jogos/base";
import { acertou, erros, forcaAcabou, PETALAS, perdeu, tentarLetra, type Forca as Estado } from "@/lib/jogos/pequenos";
import { Acoes, Aviso, Botao, LinkDaAula, Quadro, type PropsDoJogo } from "./comum";

const LETRAS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

function sortearPalavra(verbetes: PropsDoJogo["verbetes"]): PalavraDeJogo {
  const rnd = criarSorteio(sementeNova());
  const lista = palavrasParaLetras(verbetes, 5, 11);
  return lista[Math.floor(rnd() * lista.length)];
}

/** A flor tem 6 pétalas; cada erro derruba uma. Desenho simples, sem violência. */
function Flor({ erradas, texto }: { erradas: number; texto: string }) {
  return (
    <svg viewBox="0 0 120 140" role="img" aria-label={texto} className="h-40 w-36 shrink-0">
      <path d="M60 70 C58 100 62 120 60 138" stroke="#2f7a3e" strokeWidth="5" fill="none" strokeLinecap="round" />
      <path d="M60 112 C75 100 88 104 94 96 C86 112 74 116 60 112Z" fill="#3f9a50" />
      {Array.from({ length: PETALAS }, (_, i) => {
        const caiu = i < erradas;
        const ang = (i * 360) / PETALAS;
        return (
          <ellipse
            key={i}
            cx="60"
            cy="36"
            rx="12"
            ry="22"
            fill={["#e5484d", "#f2994a", "#f2c94c", "#8b5cf6", "#3b82c4", "#e56fa0"][i]}
            stroke="#221c17"
            strokeWidth="1.5"
            transform={caiu ? `translate(${i % 2 ? 26 : -26} 86) rotate(${ang + 70} 60 36)` : `rotate(${ang} 60 70)`}
            opacity={caiu ? 0.35 : 1}
          />
        );
      })}
      <circle cx="60" cy="70" r="11" fill="#f0b323" stroke="#221c17" strokeWidth="1.5" />
    </svg>
  );
}

/** Forca da flor: adivinhe o termo do glossário; a dica é a definição com o termo escondido. */
export function Forca({ verbetes, s, lang }: PropsDoJogo) {
  const [alvo, setAlvo] = useState(() => sortearPalavra(verbetes));
  const [jogo, setJogo] = useState<Estado>(() => ({ palavra: alvo.palavra, tentadas: [] }));
  const raiz = useRef<HTMLDivElement>(null);
  const t = s.forca;
  const fim = forcaAcabou(jogo);

  useEffect(() => {
    // Quem tem teclado pode digitar as letras direto, desde que o foco esteja dentro do jogo.
    const aoDigitar = (e: KeyboardEvent) => {
      if (!raiz.current?.contains(document.activeElement) || e.ctrlKey || e.metaKey || e.altKey) return;
      if (/^[a-zA-ZÀ-ÿ]$/.test(e.key)) setJogo((j) => tentarLetra(j, e.key));
    };
    window.addEventListener("keydown", aoDigitar);
    return () => window.removeEventListener("keydown", aoDigitar);
  }, []);

  const novo = () => {
    const p = sortearPalavra(verbetes);
    setAlvo(p);
    setJogo({ palavra: p.palavra, tentadas: [] });
  };
  const mostrada = [...jogo.palavra].map((l) => (jogo.tentadas.includes(l) || perdeu(jogo) ? l : "_")).join(" ");
  const estado = [...jogo.palavra].map((l) => (jogo.tentadas.includes(l) ? l : "?")).join(" ");
  const aviso = acertou(jogo) ? fill(t.ganhou, { termo: alvo.termo }) : perdeu(jogo) ? fill(t.perdeu, { termo: alvo.termo }) : "";

  return (
    <Quadro>
      <div ref={raiz}>
        <p className="max-w-2xl text-sm text-ink-soft">{t.instrucao}</p>
        <div className="mt-4 flex flex-wrap items-center gap-6">
          <Flor erradas={erros(jogo)} texto={fill(t.erros, { n: erros(jogo), max: PETALAS })} />
          <div className="min-w-0 flex-1">
            <p className="font-mono text-xs uppercase tracking-[0.12em] text-ink-soft">{t.dicaTitulo}</p>
            <p lang="pt-BR" className="mt-1 font-serif text-lg leading-snug">{mascarar(primeiraFrase(alvo.resumo, 200), alvo.termo)}</p>
            <p aria-label={fill(t.palavra, { estado })} className="mt-4 break-all font-mono text-3xl font-bold tracking-[0.15em]">{mostrada}</p>
            <p className="mt-2 text-sm">{fill(t.erros, { n: erros(jogo), max: PETALAS })}</p>
          </div>
        </div>
        <div role="group" aria-label={t.instrucao} className="mt-4 flex flex-wrap gap-1.5">
          {LETRAS.map((l) => {
            const usada = jogo.tentadas.includes(l);
            const certa = usada && jogo.palavra.includes(l);
            return (
              <button
                key={l}
                type="button"
                disabled={usada || fim}
                aria-label={`${fill(t.letra, { l })}${usada ? `, ${t.usada}` : ""}`}
                onClick={() => setJogo((j) => tentarLetra(j, l))}
                className={`h-10 w-10 cursor-pointer border-2 border-ink font-mono font-bold disabled:cursor-default ${usada ? (certa ? "bg-prelo-texto text-white" : "bg-parchment-deep text-ink-soft line-through") : "bg-white hover:bg-[#f0b323]/50"}`}
              >
                {l}
              </button>
            );
          })}
        </div>
        <Acoes>
          <Botao onClick={novo}>{s.comum.novo}</Botao>
          {fim && <LinkDaAula aula={alvo.aula} lang={lang} rotulo={s.comum.aula} />}
        </Acoes>
        <Aviso>{aviso}</Aviso>
      </div>
    </Quadro>
  );
}
