// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useCompleted, useLastLesson } from "@/lib/progress";
import { KEYS, useHydrated, useStored } from "@/lib/storage";
import { enderecoDeContinuar } from "../inicio/Janelas";
import { L, useI18n } from "../I18n";
import { textosDoAppNovo } from "./textos-app";

/**
 * O alto do Início do aplicativo instalado: a data e o cumprimento com o nome da pessoa, e o cartão de continuar de onde
 * parou (ou de começar). A página é servida pronta e revalidada de tempos em tempos, então a data, a hora, o nome e o
 * progresso vêm do aparelho, depois de montada — como no InicioDoCelular do site.
 */
export function SaudacaoDoApp() {
  const { t } = useI18n();
  const c = t.celular;
  const hydrated = useHydrated();
  const nome = useStored(KEYS.name);
  const agora = hydrated ? new Date() : null;
  const data = agora ? new Intl.DateTimeFormat(document.documentElement.lang || undefined, { weekday: "long", day: "numeric", month: "long" }).format(agora) : " ";
  const hora = agora?.getHours() ?? 12;
  const cumprimento = hora < 12 ? c.bomDia : hora < 18 ? c.boaTarde : c.boaNoite;

  return (
    <div className="app-saudacao">
      <p className="app-saudacao-data">{data}</p>
      <h1 className="app-saudacao-ola">
        {cumprimento}
        {hydrated && nome ? (
          <>
            , <em>{nome}</em>
          </>
        ) : null}
        .
      </h1>
    </div>
  );
}

/** O cartão de continuar de onde parou; sem aula aberta neste aparelho, o cartão de começar. */
export function ContinuarDoApp({ textos }: { textos: { continuar: string; retomar: string; comecar: string; comecarTexto: string } }) {
  const n = textosDoAppNovo(useI18n().lang);
  const hydrated = useHydrated();
  const ultima = useLastLesson();
  const feitas = useCompleted();
  const tem = hydrated && ultima?.path;

  return (
    <div className="app-continuar">
      {tem ? (
        <L href={enderecoDeContinuar(ultima)} className="app-cartao app-cartao-tinta">
          <span className="app-cartao-rotulo">{textos.continuar}</span>
          <span className="app-cartao-titulo">{ultima.title}</span>
          <span className="app-cartao-aux">{ultima.track}</span>
          <span className="app-cartao-pe">
            <span aria-hidden className="app-pontos">
              {Array.from({ length: Math.min(feitas.size, 12) }, (_, i) => (
                <span key={i} />
              ))}
            </span>
            <span className="app-botao">{textos.retomar}</span>
          </span>
        </L>
      ) : (
        <L href="/comecar" className="app-cartao app-cartao-tinta">
          <span className="app-cartao-rotulo">{textos.comecar}</span>
          <span className="app-cartao-titulo app-cartao-titulo-menor">{textos.comecarTexto}</span>
          <span className="app-cartao-pe">
            <span className="app-botao">{textos.comecar} →</span>
          </span>
        </L>
      )}
      {hydrated && <p className="app-resumo">{feitas.size > 0 ? n.aulasFeitas(feitas.size) : n.nenhumaAulaAinda}</p>}
    </div>
  );
}
