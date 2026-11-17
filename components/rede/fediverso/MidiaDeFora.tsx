// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useRef, useState } from "react";
import { midiaSegura, type MidiaDeFora as Midia } from "@/lib/rede/fediverso/tela/tipos";
import type { TextosDoFediverso } from "@/lib/rede/fediverso/tela/textos";

/** No máximo quatro imagens por post, como na grade das outras redes. */
export const MAXIMO_DE_IMAGENS = 4;

/**
 * As imagens que a tela pode mostrar: só as que vêm pela NOSSA rota-proxy (midiaSegura). Vídeo e áudio ficam de fora (a rota-proxy
 * só serve imagem): para eles o cartão oferece "abrir no original".
 */
export function imagensDeFora(midia: readonly Midia[] | null | undefined): (Midia & { url: string })[] {
  const saida: (Midia & { url: string })[] = [];
  for (const m of Array.isArray(midia) ? midia : []) {
    if (!m || typeof m !== "object") continue;
    if (/^(video|audio)\//i.test(String(m.tipo ?? ""))) continue;
    const url = midiaSegura(m.url);
    if (url) saida.push({ ...m, url });
    if (saida.length >= MAXIMO_DE_IMAGENS) break;
  }
  return saida;
}

const medida = (n: unknown): number | undefined => (typeof n === "number" && Number.isFinite(n) && n > 0 && n < 20_000 ? Math.round(n) : undefined);

/**
 * A grade de imagens de um post de fora. Nenhuma imagem é buscada direto em outro servidor: o endereço é sempre o da rota-proxy
 * daqui. Largura e altura vão no elemento para o cartão não pular quando a imagem chega. Mídia sensível fica coberta (e nem é
 * baixada) até a pessoa tocar. Imagem sem descrição ganha o aviso só para o leitor de tela.
 */
export function MidiaDeFora({ midia, sensivel = false, t, className = "" }: { midia: readonly Midia[] | null | undefined; sensivel?: boolean; t: Pick<TextosDoFediverso["cartao"], "mostrar" | "midiaSensivel" | "semAlt">; className?: string }) {
  const [coberta, setCoberta] = useState(sensivel);
  const caixa = useRef<HTMLDivElement>(null);
  const acabouDeMostrar = useRef(false);
  // Ao descobrir, o botão some: o foco vai para a grade, em vez de cair no começo da página.
  useEffect(() => {
    if (coberta || !acabouDeMostrar.current) return;
    acabouDeMostrar.current = false;
    caixa.current?.focus();
  }, [coberta]);
  const imagens = imagensDeFora(midia);
  if (!imagens.length) return null;
  const uma = imagens.length === 1;

  if (coberta) {
    return (
      <button
        type="button"
        className={`mt-3 flex min-h-[7.5rem] w-full flex-col items-center justify-center gap-1 rounded-xl border border-[var(--al-superficie-2)] bg-[var(--al-superficie)] px-4 py-6 text-sm font-semibold text-[var(--al-texto-2)] ${className}`.trim()}
        onClick={() => {
          acabouDeMostrar.current = true;
          setCoberta(false);
        }}
      >
        <span>{t.midiaSensivel}</span>
        <span className="rounded-full border border-[var(--al-superficie-2)] px-3 py-1 text-[0.8125rem] font-bold text-[var(--al-texto)]">{t.mostrar}</span>
      </button>
    );
  }

  return (
    <div ref={caixa} tabIndex={-1} className={`mt-3 grid gap-1 overflow-hidden rounded-xl outline-none ${uma ? "grid-cols-1" : "grid-cols-2"} ${className}`.trim()}>
      {imagens.map((m, i) => {
        const largura = medida(m.largura);
        const altura = medida(m.altura);
        const alt = typeof m.alt === "string" ? m.alt.trim() : "";
        // Uma imagem só guarda a proporção dela (limitada, para um retrato comprido não tomar a tela); na grade, todas iguais.
        const proporcao = uma ? (largura && altura ? `${largura} / ${Math.min(altura, Math.round(largura * 1.25))}` : "16 / 9") : imagens.length === 3 && i === 0 ? "2 / 1" : "4 / 3";
        return (
          <div key={`${i}-${m.url}`} className={`relative overflow-hidden bg-[var(--al-superficie)] ${imagens.length === 3 && i === 0 ? "col-span-2" : ""}`} style={{ aspectRatio: proporcao }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- a imagem vem da rota-proxy daqui, já no tamanho certo */}
            <img src={m.url} alt={alt || t.semAlt} title={alt || undefined} width={largura} height={altura} loading="lazy" decoding="async" referrerPolicy="no-referrer" draggable={false} className="absolute inset-0 h-full w-full object-cover" />
          </div>
        );
      })}
    </div>
  );
}

export default MidiaDeFora;
