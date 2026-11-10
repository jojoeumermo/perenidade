// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// As peças do perfil livre: o rosto em mosaico de pixels, a capa em mosaico gerada, a faixa tecida própria e a bio formatada. Todas
// desenham SÓ a partir de valores conferidos (lib/rede/aparencia.ts): cores de listas fechadas ou "#rrggbb" conferido, palavras
// A–Z, índices. Nada de CSS, HTML ou URL livre: a bio vira pedaços de texto do React (nunca dangerouslySetInnerHTML).
import { useMemo } from "react";
import Link from "@/components/Link";
import { CORES_DO_ROSTO, gradienteDaFaixa, hexDoAcento, pedacosDaBio, rostoValido, type CapaEmMosaico } from "@/lib/rede/aparencia";
import { gerador, gradeDaPalavra } from "@/lib/rede/mosaico";
import { enderecos } from "@/lib/rede/tipos";

/** O rosto de pixels (8 × 8), num círculo (ou quadrado). Decorativo: o codinome está sempre ao lado. */
export function RostoDePixels({ px, tamanho = 72, redondo = true, className = "" }: { px: string; tamanho?: number; redondo?: boolean; className?: string }) {
  if (!rostoValido(px)) return null;
  return (
    <svg aria-hidden viewBox="0 0 8 8" width={tamanho} height={tamanho} className={`pf-rosto ${redondo ? "pf-rosto-redondo" : ""} ${className}`.trim()} shapeRendering="crispEdges">
      <rect width="8" height="8" className="pf-rosto-fundo" />
      {[...px].map((d, i) =>
        d === "0" ? null : <rect key={i} x={i % 8} y={Math.floor(i / 8)} width="1.02" height="1.02" fill={CORES_DO_ROSTO[Number(d)]} className="pf-rosto-px" style={{ ["--i" as string]: i }} />,
      )}
    </svg>
  );
}

/**
 * A capa em mosaico: a palavra da pessoa acesa em ladrilhos na cor do perfil, num campo de ladrilhos apagados em que alguns
 * brilham (sorteio pela semente, sempre o mesmo para a mesma capa). Os ladrilhos acendem em onda ao abrir (some com
 * prefers-reduced-motion e no e-ink, pelos tokens da casa).
 */
export function CapaDeMosaico({ capa, acento, className = "" }: { capa: CapaEmMosaico; acento: string; className?: string }) {
  const desenho = useMemo(() => {
    const grade = gradeDaPalavra(capa.palavra || " ");
    const linhas = Math.max(grade.linhas, 9, Math.ceil(grade.colunas / 3));
    const colunas = Math.max(grade.colunas, linhas * 3);
    const deslocX = Math.floor((colunas - grade.colunas) / 2);
    const deslocY = Math.floor((linhas - grade.linhas) / 2);
    const sorte = gerador(capa.semente * 7919 + 17);
    const ladrilhos: { x: number; y: number; tipo: "letra" | "brilho" | "apagado"; atraso: number }[] = [];
    for (let y = 0; y < linhas; y++) {
      for (let x = 0; x < colunas; x++) {
        const gx = x - deslocX;
        const gy = y - deslocY;
        const letra = gx >= 0 && gy >= 0 && gx < grade.colunas && gy < grade.linhas && grade.letra[gy * grade.colunas + gx];
        const r = sorte();
        ladrilhos.push({ x, y, tipo: letra ? "letra" : r < 0.07 ? "brilho" : "apagado", atraso: Math.round((x + y * 0.6) * 14) });
      }
    }
    return { colunas, linhas, ladrilhos };
  }, [capa.palavra, capa.semente]);
  const cor = hexDoAcento(acento);
  return (
    <svg aria-hidden viewBox={`0 0 ${desenho.colunas} ${desenho.linhas}`} preserveAspectRatio="xMidYMid meet" className={`pf-capa-mosaico ${className}`.trim()} style={{ ["--pf-cor-capa" as string]: cor }}>
      <rect width={desenho.colunas} height={desenho.linhas} className="pf-capa-fundo" />
      {desenho.ladrilhos.map((l) => (
        <rect key={`${l.x}-${l.y}`} x={l.x + 0.08} y={l.y + 0.08} width="0.84" height="0.84" rx="0.14" className={`pf-ladrilho pf-ladrilho-${l.tipo}`} style={{ ["--atraso" as string]: `${l.atraso}ms` }} />
      ))}
    </svg>
  );
}

/** A faixa tecida própria: 11 fios nas proporções da casa, só com as cores da lista. */
export function FaixaPropria({ faixa, altura = 8, className = "" }: { faixa: readonly number[]; altura?: number; className?: string }) {
  return <div aria-hidden className={`pf-faixa ${className}`.trim()} style={{ height: altura, backgroundImage: gradienteDaFaixa(faixa) }} />;
}

/** A bio com **negrito**, _itálico_, links limpos (com o domínio à vista), #temas e @pessoas. Tudo como texto do React. */
export function BioFormatada({ bio, lang, className = "" }: { bio: string; lang: string; className?: string }) {
  const pedacos = useMemo(() => pedacosDaBio(bio), [bio]);
  if (!bio.trim()) return null;
  return (
    <p className={`pf-bio ${className}`.trim()}>
      {pedacos.map((p, i) => {
        switch (p.t) {
          case "texto":
            return <span key={i}>{p.v}</span>;
          case "negrito":
            return <strong key={i}>{p.v}</strong>;
          case "italico":
            return <em key={i}>{p.v}</em>;
          case "quebra":
            return <br key={i} />;
          case "link":
            return (
              <a key={i} href={p.href} target="_blank" rel="noopener noreferrer nofollow ugc" className="pf-bio-link">
                {p.v}
              </a>
            );
          case "tema":
            return (
              <Link key={i} href={`${enderecos.linha(lang)}/tag/${encodeURIComponent(p.v.toLowerCase())}`} className="pf-bio-tema">
                #{p.v}
              </Link>
            );
          case "pessoa":
            return (
              <Link key={i} href={enderecos.perfil(lang, p.v)} className="pf-bio-tema">
                @{p.v}
              </Link>
            );
        }
      })}
    </p>
  );
}
