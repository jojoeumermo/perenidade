// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import dados from "@/content/escola/educador-do-mes.json";
import Link from "@/components/Link";
import { PageHeading } from "@/components/PageHeading";
import { loadLang } from "@/i18n";
import { localePath } from "@/i18n/config";
import { textosDaOrganizacao } from "@/i18n/escola/organizacao";
import { type EducadorDoMes, educadorDoMes, validarEducadores } from "@/lib/escola/organizacao";
import { hojeEmBrasilia } from "@/lib/escola/tempo";
import { textosDaBase } from "@/lib/escola/textos";
import { paginaMeta } from "@/lib/seo";
import "@/styles/escola-organizacao.css";

// O mês vira sozinho: a página se refaz a cada hora.
export const revalidate = 3600;

export async function generateMetadata({ params }: PageProps<"/[lang]/escola/educador-do-mes">): Promise<Metadata> {
  const { lang } = await loadLang(params);
  const s = textosDaOrganizacao(lang);
  return paginaMeta(lang, "/escola/educador-do-mes", `${s.meta.educadorTitulo} · ${textosDaBase(lang).meta.titulo}`, s.meta.educadorDescricao);
}

/**
 * Educador ou educadora do mês (E4-12, docs/escola/organizacao.md): só nomes de content/escola/educador-do-mes.json com
 * autorização (um erro na lista inteira e a página não mostra ninguém, como na monitoria). Sem foto, sem ranking e sem
 * número de indicações. A indicação sai pela ouvidoria. O JSON entra por import estático: nenhum fs.
 */
export default async function Page({ params }: PageProps<"/[lang]/escola/educador-do-mes">) {
  const { lang } = await loadLang(params);
  const s = textosDaOrganizacao(lang);
  const e = s.educador;
  const lista = (dados as { educadores?: unknown }).educadores;
  const valida = validarEducadores(lista).length === 0;
  const { atual, anteriores } = educadorDoMes(valida ? (lista as EducadorDoMes[]) : [], hojeEmBrasilia().slice(0, 7));
  const to = (p: string) => localePath(lang, p);

  const cartao = (x: EducadorDoMes) => (
    <li key={x.mes} className="org-educador" data-educador-mes={x.mes}>
      <p className="org-nota">{x.mes}</p>
      <p className="org-educador-nome" lang="pt">
        {x.apelido}
      </p>
      {x.curso && (
        <p className="org-nota">
          {e.curso}{" "}
          <Link href={to(`/cursos/${x.curso}`)} className="underline hover:text-oxblood">
            {x.curso}
          </Link>
        </p>
      )}
      <p lang="pt">{x.motivo}</p>
      <p className="org-nota">{e.motivoRevisao}</p>
    </li>
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-12" data-pagina-educador="">
      <PageHeading eyebrow={e.olho} title={e.titulo} voltar={{ href: to("/escola"), texto: s.voltar }}>
        {e.lead}
      </PageHeading>
      <p className="org-nota">{e.regras}</p>
      <p className="org-nota">{e.criterio}</p>

      <section className="org-bloco" aria-labelledby="educador-atual">
        <h2 id="educador-atual" className="org-bloco-titulo">
          {e.atual}
        </h2>
        {atual ? (
          <ul className="org-pauta">{cartao(atual)}</ul>
        ) : (
          <p className="org-nota" data-educador-vazio="">
            {e.vazio}
          </p>
        )}
      </section>

      {anteriores.length > 0 && (
        <section className="org-bloco" aria-labelledby="educador-anteriores">
          <h2 id="educador-anteriores" className="org-bloco-titulo">
            {e.anteriores}
          </h2>
          <ul className="org-pauta">{anteriores.map(cartao)}</ul>
        </section>
      )}

      <section className="org-bloco" aria-labelledby="educador-indicar">
        <h2 id="educador-indicar" className="org-bloco-titulo">
          {e.indicarTitulo}
        </h2>
        <p className="org-nota">{e.indicar}</p>
        <div className="org-botoes">
          <Link href={to("/escola/ouvidoria?sobre=educador")} className="botao" data-educador-indicar="">
            {e.indicarLink}
          </Link>
        </div>
      </section>

      <section className="org-bloco" aria-labelledby="educador-monitoria">
        <h2 id="educador-monitoria" className="org-bloco-titulo">
          {e.monitoriaTitulo}
        </h2>
        <p className="org-nota">{e.monitoria}</p>
        <div className="org-botoes">
          <Link href={to("/escola/turmas")} className="botao">
            {e.monitoriaLink}
          </Link>
        </div>
      </section>
      <p className="org-nota">{s.emRevisao}</p>
    </div>
  );
}
