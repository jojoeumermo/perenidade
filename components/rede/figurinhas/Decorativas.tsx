// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// As figurinhas decorativas da Alumia (A8, identidade visual): punho, lampião, megafone, faixa de passeata, os carimbos, estrela e
// flor. Desenhadas aqui em SVG (nenhuma imagem baixada de fora, nada a rastrear), nas cores da faixa tecida. O banco aceita só
// estes nomes (interno.rede5_story_decorativas). Puras: sem estado, para o visor, o "criar" e o teste desenharem igual.
import type { CSSProperties } from "react";
import type { TextosDosStories } from "@/lib/rede/textos-stories";
import { DECORATIVAS, type NomeDecorativo } from "@/lib/rede/tipos-stories";

type T = TextosDosStories["b1"]["decorativas"];

const VERMELHO = "#e8321f";
const VERMELHO_ESCURO = "#a8170f";
const DOURADO = "#ffc21a";
const PAPEL = "#f3efe6";
const NOITE = "#0f0e0d";

function Desenho({ nome, t }: { nome: NomeDecorativo; t: T }) {
  switch (nome) {
    case "punho":
      return (
        <svg viewBox="0 0 100 120" aria-hidden>
          <path d="M30 118V78c-8-4-12-12-12-22V40c0-6 4-10 9-10 2-7 7-10 12-9 3-5 9-7 14-5 4-3 10-3 14 1 6-1 12 4 12 11v28c0 14-7 24-17 28v36z" fill={NOITE} />
          <path d="M33 114V77c-7-4-11-11-11-20V41c0-4 3-7 6-7s6 3 6 7v10V34c0-4 3-7 7-7s6 3 6 7v15V30c0-4 3-7 7-7s7 3 7 7v19V35c0-4 3-7 6-7s7 3 7 7v28c0 13-7 21-17 25v26z" fill={VERMELHO} />
          <path d="M34 58c6-6 18-6 26-1" stroke={VERMELHO_ESCURO} strokeWidth="4" fill="none" strokeLinecap="round" />
          <path d="M40 34v14M53 30v18M66 35v14" stroke={VERMELHO_ESCURO} strokeWidth="3" strokeLinecap="round" />
        </svg>
      );
    case "lampiao":
      return (
        <svg viewBox="0 0 100 120" aria-hidden>
          <circle cx="50" cy="62" r="40" fill={DOURADO} opacity=".28" className="al-fg-decor-brilho" />
          <path d="M38 14h24M50 6v8" stroke={NOITE} strokeWidth="5" strokeLinecap="round" />
          <path d="M34 22h32l-4 10H38z" fill={NOITE} />
          <path d="M38 32h24l8 52H30z" fill={PAPEL} stroke={NOITE} strokeWidth="5" strokeLinejoin="round" />
          <path d="M50 46c7 9 9 15 9 20a9 9 0 0 1-18 0c0-5 2-11 9-20z" fill={DOURADO} className="al-fg-decor-chama" />
          <path d="M50 58c3 4 4 6 4 8a4 4 0 0 1-8 0c0-2 1-4 4-8z" fill={VERMELHO} />
          <path d="M26 84h48v10H26z" fill={NOITE} />
          <path d="M30 98h40l-6 12H36z" fill={VERMELHO} />
        </svg>
      );
    case "megafone":
      return (
        <svg viewBox="0 0 130 100" aria-hidden>
          <path d="M14 38h16l52-26v76L30 62H14z" fill={VERMELHO} stroke={NOITE} strokeWidth="5" strokeLinejoin="round" />
          <rect x="82" y="8" width="12" height="84" rx="6" fill={NOITE} />
          <path d="M30 62l8 26h14l-6-22" fill={NOITE} />
          <path d="M104 30c6 6 6 34 0 40M114 20c11 11 11 49 0 60" stroke={DOURADO} strokeWidth="6" fill="none" strokeLinecap="round" className="al-fg-decor-onda" />
        </svg>
      );
    case "faixa":
      return (
        <svg viewBox="0 0 220 90" aria-hidden>
          <path d="M14 8v80M206 8v80" stroke={NOITE} strokeWidth="6" strokeLinecap="round" />
          <path d="M16 16c30 10 60-6 94 2s64-8 94 0v44c-30-8-60 8-94 0s-64 8-94-2z" fill={VERMELHO} stroke={NOITE} strokeWidth="4" />
          <text x="110" y="52" textAnchor="middle" fontFamily="'Saira Extra Condensed','Arial Narrow',sans-serif" fontWeight="900" fontSize="34" fill={PAPEL} letterSpacing="2">
            {t.textos.faixa}
          </text>
        </svg>
      );
    case "carimbo-luta":
    case "carimbo-presente": {
      const texto = nome === "carimbo-luta" ? t.textos["carimbo-luta"] : t.textos["carimbo-presente"];
      const cor = nome === "carimbo-luta" ? VERMELHO : NOITE;
      const pequeno = [...texto].length > 12;
      // O texto cabe sempre dentro da moldura (170 de largura útil), qualquer que seja a fonte que o aparelho tiver: sem a
      // condensada, "A LUTA CONTINUA" passava dos dois lados. textLength aperta as letras só o que for preciso.
      const largura = Math.min(156, Math.round([...texto].length * (pequeno ? 25 : 34) * 0.5));
      return (
        <svg viewBox="0 0 200 90" aria-hidden>
          <rect x="6" y="6" width="188" height="78" rx="10" fill="none" stroke={cor} strokeWidth="6" strokeDasharray="2 0" />
          <rect x="15" y="15" width="170" height="60" rx="6" fill="none" stroke={cor} strokeWidth="2.5" />
          <text x="100" y={pequeno ? 55 : 58} textAnchor="middle" fontFamily="'Saira Extra Condensed','Arial Narrow',sans-serif" fontWeight="900" fontSize={pequeno ? 25 : 34} fill={cor} textLength={largura} lengthAdjust="spacingAndGlyphs">
            {texto}
          </text>
          {/* A tinta falhada do carimbo de borracha. */}
          <path d="M30 22h18M140 70h22M96 18h8M58 72h10" stroke={PAPEL} strokeWidth="4" strokeLinecap="round" opacity=".9" />
        </svg>
      );
    }
    case "estrela":
      return (
        <svg viewBox="0 0 100 100" aria-hidden>
          <path d="M50 6l12 30 32 2-25 20 9 32-28-18-28 18 9-32L6 38l32-2z" fill={DOURADO} stroke={NOITE} strokeWidth="5" strokeLinejoin="round" />
          <path d="M50 26l5 13 14 1-11 9 4 14-12-8" fill="none" stroke={PAPEL} strokeWidth="3" strokeLinecap="round" opacity=".8" />
        </svg>
      );
    case "flor":
      return (
        <svg viewBox="0 0 100 120" aria-hidden>
          <path d="M50 58c-2 20 0 40 4 58" stroke="#2e6b4f" strokeWidth="6" fill="none" strokeLinecap="round" />
          <path d="M52 90c10-12 22-12 30-8-8 10-20 12-30 8z" fill="#2e6b4f" />
          {[0, 72, 144, 216, 288].map((g) => (
            <ellipse key={g} cx="50" cy="30" rx="13" ry="20" fill={VERMELHO} stroke={NOITE} strokeWidth="3.5" transform={`rotate(${g} 50 50)`} />
          ))}
          <circle cx="50" cy="50" r="11" fill={DOURADO} stroke={NOITE} strokeWidth="3.5" />
        </svg>
      );
  }
}

/**
 * Uma decorativa na tela do story. É enfeite: para o leitor de tela vira uma imagem com o nome ("Punho erguido"), sem botão.
 * Nome desconhecido (um story antigo, ou um pedido inventado) não desenha nada.
 */
export function DecorativaVer({ nome, t, style }: { nome: string; t: T; style?: CSSProperties }) {
  if (!(DECORATIVAS as readonly string[]).includes(nome)) return null;
  const n = nome as NomeDecorativo;
  return (
    <span className="al-fg-decor" data-nome={n} role="img" aria-label={t.nomes[n]} style={style}>
      <Desenho nome={n} t={t} />
    </span>
  );
}

/** O seletor das decorativas no "criar": a grade de enfeites, até 3 no story (o banco confere de novo). */
export function SeletorDeDecorativas({ t, usadas, limite, aoEscolher }: { t: T; usadas: number; limite: number; aoEscolher: (nome: NomeDecorativo) => void }) {
  const cheio = usadas >= limite;
  return (
    <ul className="al-fg-decor-grade" aria-label={t.titulo}>
      {DECORATIVAS.map((n) => (
        <li key={n}>
          <button type="button" className="al-fg-decor-botao" aria-disabled={cheio || undefined} title={t.nomes[n]} onClick={() => !cheio && aoEscolher(n)}>
            <span className="al-fg-decor" data-nome={n} aria-hidden>
              <Desenho nome={n} t={t} />
            </span>
            <span className="sr-only">{t.nomes[n]}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
