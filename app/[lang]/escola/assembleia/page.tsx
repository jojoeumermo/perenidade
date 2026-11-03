// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import pautaBruta from "@/content/escola/assembleia.json";
import { AssembleiaVotacao } from "@/components/escola/organizacao/AssembleiaVotacao";
import { ResultadoDaAssembleia } from "@/components/escola/organizacao/ResultadoDaAssembleia";
import { RodaDoSemestre } from "@/components/escola/organizacao/RodaDoSemestre";
import { RoteiroDoNucleo } from "@/components/escola/organizacao/RoteiroDoNucleo";
import { PageHeading } from "@/components/PageHeading";
import { loadLang } from "@/i18n";
import { fill, localePath } from "@/i18n/config";
import { textosDaOrganizacao } from "@/i18n/escola/organizacao";
import { getTracks } from "@/lib/content";
import { assembleiaAberta, validarPauta, VOTOS_POR_PESSOA } from "@/lib/escola/organizacao";
import { textosDaBase } from "@/lib/escola/textos";
import { hojeEmBrasilia } from "@/lib/escola/tempo";
import { paginaMeta } from "@/lib/seo";
import "@/styles/escola-organizacao.css";

// O dia muda a situação da votação (abre, fecha): a página se refaz a cada hora.
export const revalidate = 3600;

export async function generateMetadata({ params }: PageProps<"/[lang]/escola/assembleia">): Promise<Metadata> {
  const { lang } = await loadLang(params);
  const s = textosDaOrganizacao(lang);
  return paginaMeta(lang, "/escola/assembleia", `${s.meta.assembleiaTitulo} · ${textosDaBase(lang).meta.titulo}`, s.meta.assembleiaDescricao);
}

/**
 * Assembleia estudantil (E4-12, docs/escola/organizacao.md): a pauta do semestre (content/escola/assembleia.json), o voto
 * anônimo em até 3 trilhas, o resultado somado (na ordem da pauta), a Roda do semestre e o roteiro para fazer a assembleia
 * no núcleo. Pauta inválida ou vazia vale como "sem pauta": a página nunca quebra.
 */
export default async function Page({ params }: PageProps<"/[lang]/escola/assembleia">) {
  const { lang } = await loadLang(params);
  const s = textosDaOrganizacao(lang);
  const { pauta } = validarPauta(pautaBruta);
  const situacao = assembleiaAberta(pauta, hojeEmBrasilia());
  const com = pauta && pauta.candidatas.length > 0 ? pauta : null;
  const nomes = new Map(com ? getTracks(lang).map((t) => [t.slug, t.title]) : []);
  const candidatas = (com?.candidatas ?? []).map((slug) => ({ slug, titulo: nomes.get(slug) ?? slug }));
  const titulos = Object.fromEntries(candidatas.map((c) => [c.slug, c.titulo]));

  return (
    <div className="mx-auto max-w-3xl px-4 py-12" data-pagina-assembleia="">
      <PageHeading eyebrow={s.assembleia.olho} title={s.assembleia.titulo} voltar={{ href: localePath(lang, "/escola"), texto: s.voltar }}>
        {fill(s.assembleia.lead, { n: VOTOS_POR_PESSOA })}
      </PageHeading>

      <section className="org-bloco" aria-labelledby="assembleia-pauta">
        <h2 id="assembleia-pauta" className="org-bloco-titulo">
          {com ? fill(s.assembleia.pautaTitulo, { n: VOTOS_POR_PESSOA }) : s.assembleia.titulo}
        </h2>
        {com && <p className="org-estado">{fill(s.assembleia.semestre, { semestre: com.semestre })}</p>}
        {com && !com.confirmado && (
          <p className="org-aviso" data-pauta-proposta="">
            {s.assembleia.proposta}
          </p>
        )}
        {com ? (
          <AssembleiaVotacao pauta={com} candidatas={candidatas} situacaoInicial={situacao} s={s.assembleia} lang={lang} />
        ) : (
          <p className="org-estado" role="status" data-assembleia-estado="sem-pauta">
            {s.assembleia.estadoSemPauta}
          </p>
        )}
      </section>

      {com && (
        <section className="org-bloco" aria-labelledby="assembleia-resultado">
          <h2 id="assembleia-resultado" className="org-bloco-titulo">
            {s.resultado.titulo}
          </h2>
          <ResultadoDaAssembleia pauta={com} titulos={titulos} s={s.resultado} />
        </section>
      )}

      <section className="org-bloco" aria-labelledby="assembleia-roda">
        <h2 id="assembleia-roda" className="org-bloco-titulo">
          {s.roda.titulo}
        </h2>
        <p className="org-nota">{s.roda.lead}</p>
        <RodaDoSemestre s={s.roda} lang={lang} />
      </section>

      <section className="org-bloco" aria-labelledby="assembleia-nucleo">
        <h2 id="assembleia-nucleo" className="org-bloco-titulo">
          {s.nucleo.titulo}
        </h2>
        <RoteiroDoNucleo s={s.nucleo} lang={lang} trilhas={candidatas} />
      </section>
      <p className="org-nota">{s.emRevisao}</p>
    </div>
  );
}
