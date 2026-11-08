// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import type { TextosDoPercurso } from "@/i18n/escola/percurso";
import { barrasDosDegraus, mesEAno } from "@/lib/escola/conquistas";
import type { EscolaEuDentro } from "@/lib/escola/contratos";
import { preencher } from "@/lib/escola/textos";

/** "Degrau 1 concluído · Degrau 2 em curso" (ou "Degraus 1 e 2 concluídos · Degrau 3 em curso"), no idioma. */
function linhaDosDegraus(degrau: EscolaEuDentro["degrau"], t: TextosDoPercurso["carteirinha"], lang: string): string {
  const feitos = [1, 2, 3].filter((d) => d < degrau).map(String);
  const agora = preencher(t.emCurso, { n: degrau });
  if (feitos.length === 0) return agora;
  let lista = feitos.join(", ");
  try {
    lista = new Intl.ListFormat(lang, { type: "conjunction" }).format(feitos);
  } catch {
    // Navegador sem ListFormat: fica a vírgula.
  }
  return `${feitos.length === 1 ? preencher(t.concluido, { n: feitos[0] }) : preencher(t.concluidos, { lista })} · ${agora}`;
}

/**
 * A carteirinha vermelha (prancha Cel-Percurso): faixa vermelha com a estrela e o nome da Escola; no papel, o codinome
 * da Alumia (nunca o nome civil), desde quando milita e o núcleo, as três barras dos degraus e o aviso de que não é
 * documento oficial. Tudo vem de escola_eu (conferido no banco); nada daqui fica no aparelho.
 */
export function CarteirinhaVermelha({ eu, t, lang }: { eu: EscolaEuDentro; t: TextosDoPercurso["carteirinha"]; lang: string }) {
  const mes = mesEAno(eu.desde, lang);
  const linha = [mes ? preencher(t.desde, { mes }) : null, eu.nucleo?.nome ?? t.semNucleo].filter(Boolean).join(" · ");
  return (
    <section aria-label={t.rotulo} className="ep-carteirinha">
      <div className="ep-carteirinha-faixa">
        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 56 56">
          <path d="M28 6l6.2 14.6 15.8 1.3-12 10.4 3.7 15.5L28 39.6l-13.7 8.2 3.7-15.5-12-10.4 15.8-1.3z" fill="#F2C94C" />
        </svg>
        <span className="ef-t">{t.escola}</span>
      </div>
      <div className="ep-carteirinha-corpo">
        <p className="ef-t ep-carteirinha-nome">{eu.codinome ?? t.semCodinome}</p>
        <p className="ep-carteirinha-linha">{linha}</p>
        <ul className="ep-barras">
          {barrasDosDegraus(eu.degrau).map((situacao, i) => (
            <li key={i} className="ep-barra" data-situacao={situacao}>
              <span className="sr-only">{preencher(t.barra, { n: i + 1, situacao: t.situacoes[situacao] })}</span>
            </li>
          ))}
        </ul>
        <p className="ep-carteirinha-degraus">{linhaDosDegraus(eu.degrau, t, lang)}</p>
        <p className="ep-carteirinha-aviso">{t.aviso}</p>
      </div>
    </section>
  );
}
