// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { BancaPopular } from "@/components/escola/turma/BancaPopular";
import { CirculoDeCultura } from "@/components/escola/turma/CirculoDeCultura";
import type { Locale } from "@/i18n/config";
import type { TextosDaTelaDoNucleo } from "@/i18n/escola/nucleo";
import type { TextosDaTurma } from "@/i18n/escola/turma";

const ETAPAS = ["misticaAbertura", "ver", "julgar", "agir", "misticaFechamento"] as const;

/**
 * O kit de quem facilita (aba Círculo; botão "Roteiro da roda"). Vem pronto do servidor: é texto público de interface,
 * nada de militante. Na ordem da roda: mística de abertura, ver, julgar, agir, mística de fechamento (PLANO-ESCOLA.md,
 * seção 3: mística na ENFF e na alternância; ver-julgar-agir dos grupos de base), depois "sistematizar" (o balanço sem
 * nomes), o círculo de cultura no aparelho (components/escola/turma/CirculoDeCultura.tsx, sem mudança) e a banca de
 * passagem com balanço coletivo, sem nota (com a ficha de devolutiva de components/escola/turma/BancaPopular.tsx).
 * As duas ferramentas antigas são de papel claro: entram numa folha (.en-papel) dentro da Escola escura.
 */
export function KitDeQuemFacilita({ lang, t, turma, cursos }: { lang: Locale; t: TextosDaTelaDoNucleo["kit"]; turma: TextosDaTurma; cursos: { slug: string; titulo: string }[] }) {
  return (
    <div className="en-kit">
      <section id="roteiro" aria-labelledby="en-kit-t" className="en-bloco" tabIndex={-1}>
        <h2 id="en-kit-t" className="ef-t en-h2">
          {t.titulo}
        </h2>
        <p className="en-nota">{t.lead}</p>
        <ol className="en-roda">
          {ETAPAS.map((etapa, i) => {
            const e = t[etapa];
            return (
              <li key={etapa} className="en-etapa" data-etapa={etapa}>
                <span aria-hidden className="ef-t en-etapa-n">
                  {i + 1}
                </span>
                <div>
                  <h3 className="ef-t en-h3">
                    {e.titulo} <span className="en-etapa-tempo">· {e.tempo}</span>
                  </h3>
                  <p>{e.texto}</p>
                  <p className="en-dica">{e.dica}</p>
                </div>
              </li>
            );
          })}
        </ol>
        <div className="en-sistematizar">
          <h3 className="ef-t en-h3">{t.sistematizar.titulo}</h3>
          <p>{t.sistematizar.texto}</p>
        </div>
      </section>

      <section aria-labelledby="en-circulo-t" className="en-bloco">
        <h2 id="en-circulo-t" className="ef-t en-h2">
          {t.circuloTitulo}
        </h2>
        <p className="en-nota">{t.circuloTexto}</p>
        <details className="en-detalhe">
          <summary>{turma.circulo.titulo}</summary>
          <div className="en-papel">
            <CirculoDeCultura s={turma.circulo} lang={lang} />
          </div>
        </details>
      </section>

      <section id="banca" aria-labelledby="en-banca-kit-t" className="en-bloco">
        <h2 id="en-banca-kit-t" className="ef-t en-h2">
          {t.banca.titulo}
        </h2>
        <p>{t.banca.texto}</p>
        <ol className="en-passos">
          {t.banca.passos.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ol>
        <details className="en-detalhe">
          <summary>{t.banca.fichaTitulo}</summary>
          <div className="en-papel">
            <BancaPopular cursos={cursos} s={turma.banca} lang={lang} />
          </div>
        </details>
      </section>
    </div>
  );
}
