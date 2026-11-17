// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// O pacote da casa de figurinhas para post e resposta (onda 12, 12A). Desenhadas aqui em SVG, no jeito do Mosaico da Arquibancada:
// cada figurinha é um ladrilho com a borda de tinta e a sombra deslocada de carimbo, nas cores da faixa tecida. Nenhuma imagem
// baixada de fora, nenhuma fonte de fora (o texto dos carimbos usa a Archivo da própria Alumia), nada a rastrear. As cores são as
// da arte (fixas, como as figurinhas decorativas do story): o ladrilho tem fundo próprio, então a figurinha se lê igual no escuro
// e no claro. O banco aceita só estes nomes (lib/rede/publicar/figurinhas.ts).
import { useEffect, useRef } from "react";
import { FIGURINHAS, type NomeDaFigurinha } from "@/lib/rede/publicar/figurinhas";

const NOITE = "#0f0e0d";
const PAPEL = "#f3efe6";
const VERMELHO = "#e8321f";
const VERMELHO_FUNDO = "#c21f16";
const OURO = "#ffc21a";
const AZUL = "#23408e";
const VERDE = "#2e6b4f";
const ROSA = "#e4577f";
const LARANJA = "#ea7a24";
const TURQUESA = "#1f8a85";

export interface TextosDasFigurinhas {
  nomes: Record<NomeDaFigurinha, string>;
  carimbos: { presente: string; "na-luta": string; valeu: string };
}

/** O ladrilho de fundo: a sombra de tinta deslocada e o quadrado com borda. */
function Ladrilho({ cor, children }: { cor: string; children: React.ReactNode }) {
  return (
    <>
      <rect x="12" y="12" width="102" height="102" rx="16" fill={NOITE} />
      <rect x="6" y="6" width="102" height="102" rx="16" fill={cor} stroke={NOITE} strokeWidth="5" />
      {children}
    </>
  );
}

/** O carimbo de borracha: moldura dupla, um pouco torto, a tinta falhada e a palavra em caixa alta condensada. */
function Carimbo({ texto, cor, fundo }: { texto: string; cor: string; fundo: string }) {
  const n = [...texto].length;
  const tamanho = n > 9 ? 17 : n > 7 ? 20 : 24;
  return (
    <Ladrilho cor={fundo}>
      <g transform="rotate(-8 57 57)">
        <rect x="14" y="34" width="86" height="46" rx="7" fill="none" stroke={cor} strokeWidth="5" />
        <rect x="20" y="40" width="74" height="34" rx="4" fill="none" stroke={cor} strokeWidth="2" />
        <text
          x="57"
          y={57 + tamanho * 0.36}
          textAnchor="middle"
          fill={cor}
          fontSize={tamanho}
          fontWeight={900}
          textLength={Math.min(66, n * tamanho * 0.52)}
          lengthAdjust="spacingAndGlyphs"
          style={{ fontFamily: "var(--al-fonte, sans-serif)", fontStretch: "62%", fontVariationSettings: '"wdth" 62', letterSpacing: "0.02em" }}
        >
          {texto}
        </text>
        <path d="M24 36h10M80 78h12M50 34h6M60 80h6" stroke={fundo} strokeWidth="3" strokeLinecap="round" />
      </g>
    </Ladrilho>
  );
}

function Desenho({ nome, t }: { nome: NomeDaFigurinha; t: TextosDasFigurinhas }) {
  switch (nome) {
    case "punho":
      return (
        <Ladrilho cor={VERMELHO_FUNDO}>
          <g transform="translate(19 10) scale(0.78)">
            <path d="M30 118V78c-8-4-12-12-12-22V40c0-6 4-10 9-10 2-7 7-10 12-9 3-5 9-7 14-5 4-3 10-3 14 1 6-1 12 4 12 11v28c0 14-7 24-17 28v36z" fill={NOITE} />
            <path d="M33 114V77c-7-4-11-11-11-20V41c0-4 3-7 6-7s6 3 6 7v10V34c0-4 3-7 7-7s6 3 6 7v15V30c0-4 3-7 7-7s7 3 7 7v19V35c0-4 3-7 6-7s7 3 7 7v28c0 13-7 21-17 25v26z" fill={PAPEL} />
            <path d="M34 58c6-6 18-6 26-1" stroke={NOITE} strokeWidth="4" fill="none" strokeLinecap="round" />
            <path d="M40 34v14M53 30v18M66 35v14" stroke={NOITE} strokeWidth="3" strokeLinecap="round" />
          </g>
        </Ladrilho>
      );
    case "lampiao":
      return (
        <Ladrilho cor={NOITE}>
          <circle cx="57" cy="62" r="34" fill={OURO} opacity=".22" />
          <path d="M47 20h20M57 14v6" stroke={PAPEL} strokeWidth="4" strokeLinecap="round" />
          <path d="M43 26h28l-4 8H47z" fill={PAPEL} />
          <path d="M46 34h22l7 44H39z" fill={NOITE} stroke={PAPEL} strokeWidth="4" strokeLinejoin="round" />
          <path d="M57 44c6 8 8 13 8 17a8 8 0 0 1-16 0c0-4 2-9 8-17z" fill={OURO} />
          <path d="M57 54c3 3 4 5 4 7a4 4 0 0 1-8 0c0-2 1-4 4-7z" fill={VERMELHO} />
          <path d="M36 78h42v8H36z" fill={PAPEL} />
          <path d="M40 90h34l-5 9H45z" fill={VERMELHO} />
        </Ladrilho>
      );
    case "megafone":
      return (
        <Ladrilho cor={OURO}>
          <path d="M18 50h12l40-20v56L30 66H18z" fill={VERMELHO} stroke={NOITE} strokeWidth="4" strokeLinejoin="round" />
          <rect x="70" y="26" width="9" height="64" rx="4.5" fill={NOITE} />
          <path d="M30 66l6 20h10l-4-18" fill={NOITE} />
          <path d="M86 46c4 4 4 20 0 24M94 38c8 8 8 32 0 40" stroke={NOITE} strokeWidth="4.5" fill="none" strokeLinecap="round" />
        </Ladrilho>
      );
    case "estrela":
      return (
        <Ladrilho cor={VERMELHO_FUNDO}>
          <path d="M57.0 22.0 L65.8 45.9 L91.2 46.9 L71.3 62.6 L78.2 87.1 L57.0 73.0 L35.8 87.1 L42.7 62.6 L22.8 46.9 L48.2 45.9Z" fill={OURO} stroke={NOITE} strokeWidth="4.5" strokeLinejoin="round" />
        </Ladrilho>
      );
    case "cravo":
      return (
        <Ladrilho cor={PAPEL}>
          <path d="M57 58c2 14 0 28-6 40" stroke={VERDE} strokeWidth="5" fill="none" strokeLinecap="round" />
          <path d="M54 80c-10-2-18-8-20-16 9 0 16 5 20 12" fill={VERDE} />
          <path d="M57 60c-4 0-8-3-8-7l-4 2c-4-4-4-10 0-14l-3-4c3-5 9-7 14-5 2-4 6-6 10-5 4 0 7 3 8 6 5 0 9 4 9 9l-2 4c3 4 2 10-2 13l-4-2c-2 3-6 4-10 3z" fill={VERMELHO} stroke={NOITE} strokeWidth="4" strokeLinejoin="round" />
          <path d="M50 46c4 2 9 2 14-1M54 38c2 3 6 4 10 2" stroke={VERMELHO_FUNDO} strokeWidth="2.5" fill="none" strokeLinecap="round" />
        </Ladrilho>
      );
    case "coracao": {
      // O coração de ladrilhos: uma grade 7×6, cada casa acesa numa cor da faixa.
      const forma = ["0110110", "1111111", "1111111", "0111110", "0011100", "0001000"];
      const cores = [VERMELHO, ROSA, LARANJA, VERMELHO_FUNDO];
      return (
        <Ladrilho cor={PAPEL}>
          {forma.flatMap((linha, y) =>
            [...linha].map((c, x) =>
              c === "1" ? <rect key={`${x}-${y}`} x={20 + x * 11} y={26 + y * 11} width="10" height="10" rx="2" fill={cores[(x * 3 + y) % cores.length]} stroke={NOITE} strokeWidth="1.5" /> : null,
            ),
          )}
        </Ladrilho>
      );
    }
    case "livro":
      return (
        <Ladrilho cor={AZUL}>
          <path d="M57 38c-10-6-24-8-36-6v48c12-2 26 0 36 6 10-6 24-8 36-6V32c-12-2-26 0-36 6z" fill={PAPEL} stroke={NOITE} strokeWidth="4" strokeLinejoin="round" />
          <path d="M57 38v48" stroke={NOITE} strokeWidth="3.5" />
          <path d="M29 44c7-1 15 0 21 3M29 54c7-1 15 0 21 3M29 64c7-1 15 0 21 3M64 47c6-3 14-4 21-3M64 57c6-3 14-4 21-3" stroke={AZUL} strokeWidth="2.5" fill="none" strokeLinecap="round" />
          <path d="M80 30v18l5-4 5 4V31" fill={VERMELHO} />
        </Ladrilho>
      );
    case "sol":
      return (
        <Ladrilho cor={LARANJA}>
          <path d="M27 72a30 30 0 0 1 60 0z" fill={OURO} stroke={NOITE} strokeWidth="4" strokeLinejoin="round" />
          <path d="M57 22v12M28 36l8 8M86 36l-8 8M16 62h10M88 62h10" stroke={NOITE} strokeWidth="4.5" strokeLinecap="round" />
          <path d="M14 76h86M24 86h66M36 96h42" stroke={NOITE} strokeWidth="4.5" strokeLinecap="round" />
        </Ladrilho>
      );
    case "cafe":
      return (
        <Ladrilho cor={TURQUESA}>
          <path d="M44 22c-4 5 4 8 0 13M57 18c-4 5 4 9 0 15M70 22c-4 5 4 8 0 13" stroke={PAPEL} strokeWidth="3.5" fill="none" strokeLinecap="round" />
          <path d="M28 44h58v14c0 17-12 30-29 30S28 75 28 58z" fill={PAPEL} stroke={NOITE} strokeWidth="4.5" strokeLinejoin="round" />
          <path d="M86 50h4a10 10 0 0 1 0 20h-6" fill="none" stroke={NOITE} strokeWidth="4.5" />
          <path d="M22 96h70" stroke={NOITE} strokeWidth="5" strokeLinecap="round" />
          <path d="M36 54h42" stroke={VERMELHO} strokeWidth="5" />
        </Ladrilho>
      );
    case "presente":
      return <Carimbo texto={t.carimbos.presente} cor={VERMELHO_FUNDO} fundo={PAPEL} />;
    case "na-luta":
      return <Carimbo texto={t.carimbos["na-luta"]} cor={PAPEL} fundo={VERMELHO_FUNDO} />;
    case "valeu":
      return <Carimbo texto={t.carimbos.valeu} cor={NOITE} fundo={OURO} />;
  }
}

/** Uma figurinha do pacote. Com `rotulo`, o leitor de tela lê o nome (no cartão); sem, é enfeite (o botão do seletor tem o nome). */
export function FigurinhaDaCasa({ nome, t, rotulo = false, className = "" }: { nome: NomeDaFigurinha; t: TextosDasFigurinhas; rotulo?: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 120 120" className={`cp-figurinha ${className}`} role={rotulo ? "img" : undefined} aria-label={rotulo ? t.nomes[nome] : undefined} aria-hidden={rotulo ? undefined : true}>
      <Desenho nome={nome} t={t} />
    </svg>
  );
}

/**
 * A gaveta do pacote: os 12 ladrilhos numa grade (4 por linha no computador, 3 no celular). As setas andam entre eles (o foco
 * começa na escolhida), Enter ou clique escolhe, Esc fecha. Tocar na escolhida tira.
 */
export function SeletorDeFigurinhas({
  t,
  titulo,
  escolhida,
  aoEscolher,
  aoFechar,
}: {
  t: TextosDasFigurinhas;
  titulo: string;
  escolhida: NomeDaFigurinha | null;
  aoEscolher: (n: NomeDaFigurinha | null) => void;
  aoFechar: () => void;
}) {
  const grade = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const alvo = grade.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]') ?? grade.current?.querySelector<HTMLButtonElement>("button");
    alvo?.focus();
  }, []);
  const andar = (e: React.KeyboardEvent) => {
    const botoes = Array.from(grade.current?.querySelectorAll<HTMLButtonElement>("button") ?? []);
    const i = botoes.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === "Escape") {
      e.stopPropagation();
      aoFechar();
      return;
    }
    const colunas = window.matchMedia("(min-width: 640px)").matches ? 4 : 3;
    const passo = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: colunas, ArrowUp: -colunas }[e.key];
    if (passo === undefined || i < 0) return;
    e.preventDefault();
    botoes[Math.min(botoes.length - 1, Math.max(0, i + passo))]?.focus();
  };
  return (
    <div className="cp-pacote" role="group" aria-label={titulo} onKeyDown={andar}>
      <div ref={grade} className="cp-pacote-grade">
        {FIGURINHAS.map((n) => (
          <button
            key={n}
            type="button"
            className="cp-pacote-item"
            aria-pressed={escolhida === n}
            aria-label={t.nomes[n]}
            title={t.nomes[n]}
            onClick={() => aoEscolher(escolhida === n ? null : n)}
          >
            <FigurinhaDaCasa nome={n} t={t} />
          </button>
        ))}
      </div>
    </div>
  );
}
