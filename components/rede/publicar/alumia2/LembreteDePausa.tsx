// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useRef, useState } from "react";
import { preencher } from "@/lib/rede/preencher";
import { criarRelogioDaPausa, guardarMinutosDaPausa, MINUTOS_DA_PAUSA, minutosDaPausa } from "@/lib/rede/publicar/b1";
import { useAlumia2 } from "./contexto";
import { Icone } from "./icones";

/** Avisa o lembrete (na mesma aba) que a pessoa mudou os minutos no menu da conta. */
const EVENTO = "alumia:pausa";

function mudarMinutos(n: number) {
  guardarMinutosDaPausa(n);
  window.dispatchEvent(new CustomEvent(EVENTO, { detail: n }));
}

/** O ajuste do lembrete no menu da conta (computador) e no "Mais" (celular): de 15 em 15 minutos, ou desligado. */
export function AjusteDaPausa() {
  const al2 = useAlumia2();
  const [minutos, setMinutos] = useState<number | null>(null);
  useEffect(() => {
    const id = window.setTimeout(() => setMinutos(minutosDaPausa()), 0);
    const ouvir = (e: Event) => setMinutos(Number((e as CustomEvent).detail));
    window.addEventListener(EVENTO, ouvir);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener(EVENTO, ouvir);
    };
  }, []);
  if (!al2 || minutos === null) return null;
  const { t } = al2;
  return (
    <label className="flex min-h-11 flex-wrap items-center gap-2 px-2 text-sm">
      <Icone nome="relogio" className="h-5 w-5 shrink-0 text-[var(--al-texto-3)]" />
      <span className="min-w-0 flex-1 font-bold">{t.b1.pausaAjustar}</span>
      <select className="al2-chip al2-chip-select" value={minutos} onChange={(e) => mudarMinutos(Number(e.target.value))} aria-describedby="al2-pausa-sobre">
        {MINUTOS_DA_PAUSA.map((n) => (
          <option key={n} value={n}>
            {n === 0 ? t.b1.pausaDesligado : preencher(t.b1.pausaMinutos, { n })}
          </option>
        ))}
      </select>
      <span id="al2-pausa-sobre" className="block w-full text-xs font-normal text-[var(--al-texto-3)]">
        {t.b1.pausaSobre}
      </span>
    </label>
  );
}

/**
 * O lembrete de pausa (PLANO-ALUMIA §8 F1): depois de X minutos rolando de verdade (a página à vista e um gesto de rolar nos
 * últimos 90 s), uma folha discreta sobe do pé da tela. Sem placar, sem contagem do dia, sem "você passou 3 h aqui": o relógio é
 * só deste aparelho, zera a cada lembrete e nada é enviado (LGPD art. 6º, III). A pessoa ajusta os minutos ou desliga ali mesmo.
 * Não rouba o foco (é uma região viva, não um modal); Esc fecha. Sem movimento com "reduzir movimento" e no e-ink (alumia.css).
 */
export function LembreteDePausa() {
  const al2 = useAlumia2();
  const [minutos, setMinutos] = useState<number | null>(null);
  const [aberto, setAberto] = useState(false);
  const relogio = useRef<ReturnType<typeof criarRelogioDaPausa> | null>(null);

  // Lido depois de montar (o servidor não sabe o que este aparelho guardou).
  useEffect(() => {
    const id = window.setTimeout(() => setMinutos(minutosDaPausa()), 0);
    const ouvir = (e: Event) => setMinutos(Number((e as CustomEvent).detail));
    window.addEventListener(EVENTO, ouvir);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener(EVENTO, ouvir);
    };
  }, []);

  useEffect(() => {
    if (minutos === null || minutos === 0 || !al2) return;
    const r = criarRelogioDaPausa(minutos);
    relogio.current = r;
    const gesto = () => r.gesto(Date.now());
    const opcoes = { passive: true } as const;
    window.addEventListener("scroll", gesto, opcoes);
    window.addEventListener("wheel", gesto, opcoes);
    window.addEventListener("touchmove", gesto, opcoes);
    window.addEventListener("keydown", gesto, opcoes);
    const id = window.setInterval(() => {
      if (r.tique(Date.now(), document.visibilityState === "visible")) {
        r.zerar();
        setAberto(true);
      }
    }, 5_000);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("scroll", gesto);
      window.removeEventListener("wheel", gesto);
      window.removeEventListener("touchmove", gesto);
      window.removeEventListener("keydown", gesto);
    };
  }, [minutos, al2]);

  useEffect(() => {
    if (!aberto) return;
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented) setAberto(false);
    };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [aberto]);

  if (!al2) return null;
  const { t } = al2;
  return (
    <div aria-live="polite">
      {aberto && minutos ? (
        <section className="al2-pausa" aria-labelledby="al2-pausa-titulo">
          <div className="flex items-start gap-3">
            <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[color-mix(in_srgb,var(--al-dourado)_18%,transparent)] text-[var(--al-dourado)]">
              <Icone nome="relogio" className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 id="al2-pausa-titulo" className="text-base font-extrabold">
                {t.b1.pausaTitulo}
              </h2>
              <p className="mt-0.5 text-sm text-[var(--al-texto-2)]">{preencher(t.b1.pausaTexto, { n: minutos })}</p>
            </div>
            <button type="button" className="al2-acao" aria-label={t.b1.pausaFechar} title={t.b1.pausaFechar} onClick={() => setAberto(false)}>
              <Icone nome="fechar" className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" className="al-botao al-botao-primario al-botao-p" onClick={() => setAberto(false)}>
              {t.b1.pausaContinuar}
            </button>
            <label className="al2-chip">
              <span>{t.b1.pausaAjustar}</span>
              <select
                className="al2-chip-select"
                value={minutos}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  mudarMinutos(n);
                  if (n === 0) setAberto(false);
                }}
              >
                {MINUTOS_DA_PAUSA.map((n) => (
                  <option key={n} value={n}>
                    {n === 0 ? t.b1.pausaDesligado : preencher(t.b1.pausaMinutos, { n })}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="mt-2 text-xs text-[var(--al-texto-3)]">{t.b1.pausaSobre}</p>
        </section>
      ) : null}
    </div>
  );
}
