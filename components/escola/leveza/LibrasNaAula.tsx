// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import { SelosDePrivacidade } from "@/components/SeloDePrivacidade";
import type { TextosDaLeveza } from "@/i18n/escola/leveza";
import { type AulaEmLibras, preencherTexto as preencher } from "@/lib/escola/leveza";
import { usePrefs } from "@/lib/prefs";
import { SELOS_DE_FORA } from "@/lib/selos";
import { assinarVLibras, carregarVLibras, vlibrasCarregado, vlibrasLembrado } from "@/lib/vlibras";

// "ligado": já estava ligado (nesta visita ou lembrado pelo painel); "ligado-agora": acabou de carregar.
type Estado = "fechado" | "aviso" | "carregando" | "ligado" | "ligado-agora" | "erro";

/**
 * Libras na aula. O tradutor do governo federal só carrega depois do clique e da confirmação do aviso (serviço externo);
 * nada é carregado por este componente sozinho. A tradução é automática e não substitui intérprete humano.
 */
export function LibrasNaAula({
  lang,
  libras,
  vlibrasLigado,
  hrefEmPortugues,
  s,
}: {
  lang: string;
  libras: AulaEmLibras | null;
  vlibrasLigado: boolean;
  hrefEmPortugues: string;
  s: TextosDaLeveza["libras"];
}) {
  const prefs = usePrefs();
  const [estado, setEstado] = useState<Estado>(() => (vlibrasCarregado() || vlibrasLembrado() ? "ligado" : "fechado"));

  // Desligado pelo painel de acessibilidade: o botão "Ver em Libras" volta (e ligado por lá, a nota de ligado aparece).
  useEffect(
    () =>
      assinarVLibras(() => {
        const agora = vlibrasCarregado();
        setEstado((antes) => (agora ? (antes === "fechado" ? "ligado" : antes) : antes === "ligado" || antes === "ligado-agora" ? "fechado" : antes));
      }),
    [],
  );

  if (!vlibrasLigado && !libras) return null;

  async function confirmar() {
    setEstado("carregando");
    try {
      await carregarVLibras();
      setEstado("ligado-agora");
    } catch {
      setEstado("erro");
    }
  }

  return (
    <div className="lev-libras no-print">
      {vlibrasLigado && lang !== "pt" && (
        <p className="lev-nota">
          {s.soPortugues}{" "}
          <a href={hrefEmPortugues} className="lev-link">
            {s.abrirEmPortugues}
          </a>
        </p>
      )}
      {vlibrasLigado && lang === "pt" && (
        <>
          {estado === "fechado" && (
            <button type="button" className="lev-botao" onClick={() => setEstado("aviso")}>
              {s.botao}
            </button>
          )}
          {(estado === "aviso" || estado === "erro") && (
            <section role="group" aria-label={s.titulo} className="lev-aviso">
              <h2 className="lev-titulo">{s.titulo}</h2>
              <p>{s.aviso}</p>
              {prefs.pacote && <p>{s.avisoPacote}</p>}
              <SelosDePrivacidade item={SELOS_DE_FORA.vlibras} lang={lang} />
              {estado === "erro" && (
                <p role="status" className="lev-erro">
                  {s.erro}
                </p>
              )}
              <div className="lev-botoes">
                <button type="button" className="lev-botao" onClick={confirmar}>
                  {s.carregar}
                </button>
                <button type="button" className="lev-botao" onClick={() => setEstado("fechado")}>
                  {s.cancelar}
                </button>
              </div>
            </section>
          )}
          {estado === "carregando" && (
            <p role="status" className="lev-nota">
              {s.carregando}
            </p>
          )}
          {(estado === "ligado" || estado === "ligado-agora") && (
            <p role="status" className="lev-nota">
              {estado === "ligado-agora" ? s.ligado : s.ligadoCurto}
            </p>
          )}
        </>
      )}
      {libras && (
        <p className="lev-humano">
          <a href={libras.url} rel="noopener noreferrer" target="_blank" className="lev-link">
            {s.humano}
          </a>
          <span className="lev-nota"> {preencher(s.humanoFonte, { fonte: libras.fonte, interprete: libras.interprete })}</span>
        </p>
      )}
    </div>
  );
}
