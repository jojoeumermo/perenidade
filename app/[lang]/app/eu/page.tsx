// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { notFound } from "next/navigation";
import Link from "@/components/Link";
import { ProgressoEnem } from "@/components/enem/ProgressoEnem";
import { MeuEstudo } from "@/components/estudo/MeuEstudo";
import { MetaDaSemana } from "@/components/estudo/Metas";
import { MinhasTurmas } from "@/components/estudo/MinhasTurmas";
import { NivelamentosFeitos } from "@/components/estudo/Nivelamento";
import { RegistroDeConclusao } from "@/components/estudo/RegistroDeConclusao";
import { Untranslated } from "@/components/Untranslated";
import { loadLang } from "@/i18n";
import { localePath } from "@/i18n/config";
import { AREAS_DO_ENEM } from "@/lib/enem";
import { resumosDasHabilidades } from "@/lib/enem-camada";
import { matrizDoEnem } from "@/lib/enem-conteudo";
import { ligado } from "@/lib/recursos";
import { textosDoEstudo } from "@/lib/textos-estudo";
import { textosDoAppNovo } from "@/components/app/textos-app";
import { EuDoApp as ResumoDoEu } from "@/components/app/eu";

export const revalidate = 3600;

/**
 * A aba Eu do aplicativo instalado: o mesmo painel de estudo da página /meu-estudo (montado no aparelho da pessoa),
 * com a moldura e o respiro do aplicativo. Desligado o recurso "meu-estudo", a tela não existe, como no site.
 */
export default async function EuDoApp({ params }: PageProps<"/[lang]/app/eu">) {
  if (!ligado("meu-estudo")) notFound();
  const { lang, t } = await loadLang(params);
  const { s, traduzido } = textosDoEstudo(lang);
  const n = textosDoAppNovo(lang);
  return (
    <div className="app-hub">
      <header className="app-hub-cabeca">
        <h1>{s.meuEstudo.titulo}</h1>
        <p>{n.euLead}</p>
      </header>
      <Untranslated lang={lang} t={t} show={!traduzido} />
      <ResumoDoEu s={s.meuEstudo} />
      {ligado("enem-curso") && (
        <Link href={localePath(lang, "/enem")} className="app-cartao app-cartao-tinta app-atalho-enem">
          <span className="app-cartao-titulo app-cartao-titulo-menor">{s.enem.irParaCurso} →</span>
        </Link>
      )}
      <RegistroDeConclusao />
      <details className="app-mais">
        <summary>{n.maisDoEstudo}</summary>
      <MeuEstudo
        s={s.meuEstudo}
        caderno={t.notebook}
        praticar={ligado("exercicios")}
        extras={
          <>
            {ligado("metas") && <MetaDaSemana s={s.metas} />}
            {ligado("nivelamento") && <NivelamentosFeitos s={s.nivelamento} />}
            {ligado("turma") && <MinhasTurmas s={s.turma} />}
            {ligado("enem-curso") && <ProgressoEnem areas={Object.fromEntries(AREAS_DO_ENEM.map((a) => [a, matrizDoEnem().areas[a].nome]))} habilidades={resumosDasHabilidades()} s={s.enem.progresso} />}
          </>
        }
      />
      </details>
      {/* No aplicativo o convite ao apoio não abre sozinho na primeira tela (components/OpeningNotice.tsx): ele mora aqui. */}
      <Link href={localePath(lang, "/apoie")} className="app-cartao app-atalho-apoiar">
        <span className="app-cartao-titulo app-cartao-titulo-menor">{n.apoiar}</span>
        <span className="app-cartao-texto">{n.apoiarLead}</span>
      </Link>
    </div>
  );
}
