// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { type CSSProperties, useEffect, useState } from "react";
import type { FiguraDaEntrada } from "@/lib/rede/entrada/figuras";
import type { TextosDaEntrada } from "@/lib/rede/entrada/textos";
import { sementeDoCodinome } from "@/lib/rede/entrada/voce";
import { PainelDeVoce, useVoce } from "./Voce";

/**
 * A parede de ladrilhos da entrada: um painel por figura (as silhuetas de public/alumia/entrada, exatamente como são: o arquivo
 * inteiro, no retrato dele, sem recorte novo) e, por último, o painel de quem chega. O "ladrilho" é só o rejunte desenhado por
 * cima (CSS) e a cor (um filtro da própria página, preto → brasa → vermelho → creme): o desenho de cada figura não muda.
 * Para o leitor de tela a parede é uma imagem só, com nome; a legenda embaixo anuncia quando o painel da pessoa se forma.
 * P5 (A1): as figuras não se arrastam, não se selecionam e não abrem o menu de "salvar imagem" (o endereço de uma delas caía no
 * campo de e-mail ao arrastar). Isso só impede o uso casual: quem abre as ferramentas do navegador ainda vê o endereço.
 * As figuras chegam de Cena.tsx já na leva da vez (a parede gira: useParede.ts); o painel novo assenta com a mesma animação.
 */
export function Parede({ t, figuras }: { t: TextosDaEntrada; figuras: FiguraDaEntrada[] }) {
  const { codinome, foto } = useVoce();
  const fileiras = Math.ceil((figuras.length + 1) / 5);
  // No celular a parede tem 3 colunas (styles/alumia-entrada.css).
  const fileirasNoCelular = Math.ceil((figuras.length + 1) / 3);
  // A legenda espera a pessoa parar de escrever: o leitor de tela anuncia o codinome inteiro, não letra por letra.
  const agora = foto ? "\u0000foto" : sementeDoCodinome(codinome) ? codinome.trim() : "";
  const [dito, setDito] = useState("");
  useEffect(() => {
    const espera = window.setTimeout(() => setDito(agora), 900);
    return () => window.clearTimeout(espera);
  }, [agora]);
  return (
    <div className="ale-parede-bloco">
      <div className="ale-parede">
        <div className="ale-parede-grade" role="img" aria-label={t.p.rotulo} style={{ "--ale-fileiras": fileiras, "--ale-fileiras-p": fileirasNoCelular } as CSSProperties}
          onDragStart={(e) => e.preventDefault()} onContextMenu={(e) => e.preventDefault()}>
          {figuras.map((f, i) => (
            <span key={f.id} className="ale-painel" data-figura={f.id} style={{ "--i": i } as CSSProperties}>
              {/* As silhuetas são pequenas (≈10 KB cada) e já saem prontas do roteiro: sem o otimizador de imagens. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/${f.src}`} alt="" width={480} height={640} decoding="async" draggable={false} />
            </span>
          ))}
          <PainelDeVoce t={t} indice={figuras.length} />
          <span aria-hidden className="ale-rejunte" />
        </div>
      </div>
      <p className="ale-parede-legenda" role="status">
        {dito === "\u0000foto" ? (
          <>
            <strong>{t.p.voceFoto}</strong> {t.p.soVoce}
          </>
        ) : dito ? (
          <>
            <strong>{t.p.voce.replace("{codinome}", dito)}</strong> {t.p.soVoce}
          </>
        ) : (
          <>
            {t.p.falta[0]} <strong>{t.p.falta[1]}</strong>
          </>
        )}
      </p>
      <p className="ale-parede-nomes">{figuras.map((f) => f.nome).join(" · ")}</p>
      {/* As cores dos ladrilhos: a luz de cada ponto da silhueta vira preto, brasa, vermelho ou creme. Só cor; nenhuma forma muda. */}
      <svg aria-hidden width="0" height="0" style={{ position: "absolute" }}>
        <filter id="ale-tritom" colorInterpolationFilters="sRGB">
          <feColorMatrix type="saturate" values="0" />
          <feComponentTransfer>
            <feFuncR type="table" tableValues="0.06 0.35 0.91 0.95" />
            <feFuncG type="table" tableValues="0.055 0.07 0.2 0.94" />
            <feFuncB type="table" tableValues="0.05 0.04 0.12 0.9" />
          </feComponentTransfer>
        </filter>
      </svg>
    </div>
  );
}
