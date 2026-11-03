// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { fill } from "@/i18n/config";
import { gravarEscolha } from "@/lib/vozes/catalogo";
import { alternarPausa, anterior, definirVelocidade, parar, proxima, useLeitor } from "@/lib/vozes/leitor";
import { useI18n } from "../I18n";

const VELOCIDADES = [0.75, 1, 1.25, 1.5, 1.75, 2];

/**
 * Os controles da leitura em voz alta, presos no pé da tela enquanto ela dura: voltar e avançar frase, pausar,
 * velocidade e parar. A frase lida fica destacada no texto e aqui aparece em que trecho e frase a leitura está
 * (veja lib/vozes/leitor.ts). Enquanto a voz natural carrega, a do aparelho lê e o tocador avisa. Some quando a
 * leitura para.
 */
export function TocadorDaVoz({ avisoTelaApagada }: { avisoTelaApagada?: string } = {}) {
  const { lang, t } = useI18n();
  const s = t.lesson.leitor;
  const e = useLeitor();
  if (!e.ativo) return null;
  const pct = e.aBaixar > 0 ? Math.round((100 * e.baixado) / e.aBaixar) : 0;
  const numero = (n: number) => new Intl.NumberFormat(lang).format(n);
  const onde = `${fill(s.trecho, { n: numero(e.trecho + 1), total: numero(e.trechos) })} · ${fill(s.frase, { n: numero(e.frase + 1), total: numero(e.total) })}`;
  const situacao = e.esperando && e.tocando ? (e.carregando ? `${s.preparando}${pct ? ` ${pct}%` : ""}` : s.preparandoProxima) : onde;
  // A voz natural escolhida ainda não entrou: o aparelho lê por enquanto.
  // Com a voz do aparelho, a leitura pode parar quando a tela apaga (o aviso vem da página, com o recurso "escola").
  const aviso = e.vozAgora === "aparelho" && e.carregando ? fill(s.vozProvisoria, { pct: pct ? ` (${pct}%)` : "" }) : e.vozAgora === "aparelho" && e.naturalPronta ? s.naturalNoProximo : e.vozAgora === "aparelho" && avisoTelaApagada ? avisoTelaApagada : "";
  const botao = "min-h-11 min-w-11 cursor-pointer border-2 border-ink px-2 font-sans text-base disabled:opacity-50";
  const claro = `${botao} bg-parchment text-ink hover:bg-parchment-deep`;
  return (
    <section role="region" aria-label={s.regiao} className="tocador-da-voz no-print no-leitor z-40 flex flex-wrap items-center gap-2 border-2 border-ink bg-parchment p-2 font-sans text-ink shadow-[4px_4px_0_0_var(--color-ink,#1f1a14)]">
      <div className="min-w-0 flex-1 px-1">
        <p className="text-sm" aria-live="polite">
          {situacao}
        </p>
        {aviso && <p className="text-xs text-ink-soft">{aviso}</p>}
      </div>
      <button type="button" className={claro} aria-label={s.anterior} title={s.anterior} disabled={e.frase === 0} onClick={anterior}>
        <svg aria-hidden viewBox="0 0 24 24" className="mx-auto h-5 w-5" fill="currentColor"><path d="M6 5h2v14H6zM20 5v14L9 12z" /></svg>
      </button>
      <button type="button" className={`${botao} bg-ink text-parchment hover:bg-oxblood`} aria-label={e.tocando ? s.pausar : s.continuar} title={e.tocando ? s.pausar : s.continuar} onClick={alternarPausa}>
        {e.tocando ? <svg aria-hidden viewBox="0 0 24 24" className="mx-auto h-5 w-5" fill="currentColor"><path d="M7 5h4v14H7zM13 5h4v14h-4z" /></svg> : <svg aria-hidden viewBox="0 0 24 24" className="mx-auto h-5 w-5" fill="currentColor"><path d="M7 5v14l12-7z" /></svg>}
      </button>
      <button type="button" className={claro} aria-label={s.proxima} title={s.proxima} onClick={proxima}>
        <svg aria-hidden viewBox="0 0 24 24" className="mx-auto h-5 w-5" fill="currentColor"><path d="M16 5h2v14h-2zM4 5v14l11-7z" /></svg>
      </button>
      <label className="flex items-center gap-1 text-sm">
        <span className="sr-only">{s.velocidade}</span>
        <select
          className="min-h-11 cursor-pointer border-2 border-ink bg-parchment px-1 text-ink"
          value={e.velocidade}
          aria-label={s.velocidade}
          onChange={(ev) => {
            const v = Number(ev.target.value);
            definirVelocidade(v);
            gravarEscolha({ velocidade: v });
          }}
        >
          {VELOCIDADES.map((v) => (
            <option key={v} value={v}>
              {new Intl.NumberFormat(lang).format(v)}×
            </option>
          ))}
        </select>
      </label>
      <button type="button" className={claro} aria-label={s.parar} title={s.parar} onClick={() => parar()}>
        <svg aria-hidden viewBox="0 0 24 24" className="mx-auto h-5 w-5" fill="currentColor"><path d="M6.4 5 5 6.4 10.6 12 5 17.6 6.4 19l5.6-5.6 5.6 5.6 1.4-1.4-5.6-5.6L19 6.4 17.6 5 12 10.6z" /></svg>
      </button>
    </section>
  );
}
