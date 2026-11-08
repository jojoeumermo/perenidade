// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { AssembleiaVotacao } from "@/components/escola/organizacao/AssembleiaVotacao";
import { RoteiroDoNucleo } from "@/components/escola/organizacao/RoteiroDoNucleo";
import type { Locale } from "@/i18n/config";
import type { TextosDaTelaDoNucleo } from "@/i18n/escola/nucleo";
import type { TextosDaOrganizacao } from "@/i18n/escola/organizacao";
import type { Pauta, SituacaoDaAssembleia } from "@/lib/escola/organizacao";

/**
 * A aba Assembleia: a votação anônima da pauta do semestre (components/escola/organizacao/AssembleiaVotacao.tsx, o servidor
 * só soma) e o roteiro para fazer a assembleia no núcleo (RoteiroDoNucleo.tsx). Os dois entram por import, sem mudança, numa
 * folha de papel (são de papel claro). Vem pronto do servidor: a pauta é pública (content/escola/assembleia.json).
 */
export function AssembleiaDoNucleo({ lang, t, org, pauta, candidatas, situacao }: { lang: Locale; t: TextosDaTelaDoNucleo["assembleia"]; org: TextosDaOrganizacao; pauta: Pauta | null; candidatas: { slug: string; titulo: string }[]; situacao: SituacaoDaAssembleia }) {
  return (
    <>
      <section aria-labelledby="en-assembleia-t" className="en-bloco">
        <h2 id="en-assembleia-t" className="ef-t en-h2">
          {t.titulo}
        </h2>
        <p className="en-nota">{t.texto}</p>
        {pauta ? (
          <div className="en-papel">
            <AssembleiaVotacao pauta={pauta} candidatas={candidatas} situacaoInicial={situacao} s={org.assembleia} lang={lang} />
          </div>
        ) : (
          <p className="en-vazio">{t.semPauta}</p>
        )}
      </section>
      <section aria-labelledby="en-roteiro-assembleia-t" className="en-bloco">
        <h2 id="en-roteiro-assembleia-t" className="ef-t en-h2">
          {t.roteiroTitulo}
        </h2>
        <div className="en-papel">
          <RoteiroDoNucleo s={org.nucleo} lang={lang} trilhas={candidatas} />
        </div>
      </section>
    </>
  );
}
