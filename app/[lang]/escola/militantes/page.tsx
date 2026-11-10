// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import "@/components/escola/biblioteca/escola-f6.css";
import { I18nProvider } from "@/components/I18n";
import Link from "@/components/Link";
import { VolunteerForm } from "@/components/VolunteerForm";
import { loadLang } from "@/i18n";
import { localePath } from "@/i18n/config";
import { pickSections } from "@/i18n/core";
import { textosDaFrente } from "@/i18n/escola/frente";
import { textosDaBase } from "@/lib/escola/textos";
import { paginaMeta } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[lang]/escola/militantes">): Promise<Metadata> {
  const { lang } = await loadLang(params);
  const m = textosDaFrente(lang).militantes;
  return paginaMeta(lang, "/escola/militantes", m.metaTitulo, m.metaDescricao);
}

/**
 * O chamado de voluntários militantes da Frente Revolucionária Lúcia (T15), dentro da Escola Revolucionária Lúcia
 * Maria, no desenho das telas da Escola (09/11/2026: o cartaz quadrado com a estrela saiu). Página pública (a porta deixa passar: PUBLICAS_DA_ESCOLA, em lib/escola/rotas.ts), como o voluntariado.
 *
 * O formulário é o MESMO do voluntariado (components/VolunteerForm.tsx), no modo militante: vai para a mesma fila
 * (public.voluntariar, tabela interno.inscricoes) com o tipo "militante", e chega no mesmo lugar do painel interno
 * (Pessoas, "Candidaturas"), com a marca "Militante". Diferenças, por cuidado com a lei:
 *  - consentimento específico e destacado, numa caixa só dele, nunca marcada de antemão: a inscrição revela opinião
 *    política e filiação a organização política, dado pessoal sensível (LGPD, art. 5º, II, e art. 11, I);
 *  - só para quem declara ter 18 anos ou mais (LGPD, art. 14; ECA, Lei 8.069/1990, arts. 17 e 18; ECA Digital,
 *    Lei 15.211/2025): sem vínculo com a conta de um responsável, o site não recebe dado sensível de adolescente;
 *  - o banco recusa a inscrição militante sem as duas caixas, e guarda o momento do consentimento (art. 8º, § 2º).
 * Decisões e migração: docs/escola-revolucionaria/LEIA-ME.md e supabase/migracoes/20261106-t15-frente-militantes.sql.
 */
export default async function Militantes({ params }: PageProps<"/[lang]/escola/militantes">) {
  const { lang, t } = await loadLang(params);
  const f = textosDaFrente(lang);
  const m = f.militantes;
  const base = textosDaBase(lang);
  // Os textos do formulário: os do voluntariado, com o que muda no chamado militante.
  const s = { ...t.volunteer, title: m.formTitulo, lead: m.formLead, role: m.formFuncao, message: m.formMensagem, send: m.formEnviar, sent: m.formEnviado, privacy: m.formPrivacidade };
  return (
    <div className="ef6-tela ef-manifesto" data-escola-escura="" data-militantes="">
      <section aria-labelledby="ef-militantes-titulo" className="ef6-cartaz">
        <div className="ef6-cartaz-texto">
          <span className="ef-t ef6-cartaz-olho">{base.entrada.titulo}</span>
          <h1 id="ef-militantes-titulo" className="ef-t">
            {m.titulo}
          </h1>
          <p className="ef-manifesto-lema">{m.lead}</p>
        </div>
        <div className="ef6-cartaz-acoes">
          <a href="#inscricao-militante" className="ef6-cheio">
            {m.formTitulo}
          </a>
          <Link href={localePath(lang, "/escola/manifesto")} className="ef6-vazado">
            {m.manifestoTitulo}
          </Link>
        </div>
      </section>

      <div className="ef-manifesto-texto">
        <h2 id="porque-militar">{m.porqueTitulo}</h2>
        <ul>
          {m.porque.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>

        <h2 id="como-militar">{m.comoTitulo}</h2>
        <ol className="ef-passos-militantes">
          {m.passos.map((passo) => (
            <li key={passo.titulo}>
              <strong>{passo.titulo}</strong>
              <span>{passo.texto}</span>
            </li>
          ))}
        </ol>

        <h2 id="frentes-de-trabalho">{m.frentesTitulo}</h2>
        <p>{m.frentesTexto}</p>
        <p>
          <Link href={localePath(lang, "/escola/manifesto")}>{m.manifestoTitulo} →</Link> {m.manifestoTexto}
        </p>
      </div>

      <aside className="ef6-cartao ef6-cartao-borda ef-militantes-cuidado" aria-labelledby="cuidado-dados">
        <h2 id="cuidado-dados" className="ef-t">
          {m.cuidadoTitulo}
        </h2>
        <p>{m.cuidadoTexto}</p>
        <p>
          <Link href={localePath(lang, "/privacidade")}>{base.porta.privacidade}</Link>
        </p>
      </aside>

      {/* O formulário é o do voluntariado (desenho do site): as cores do site trocadas pelas da Escola só aqui dentro. */}
      <div className="ef-tons-escuros ef-militantes-form">
        <I18nProvider lang={lang} t={pickSections(t, ["areas"])}>
          <VolunteerForm s={s} id="inscricao-militante" militante={{ consentimento: m.consentimento, maiorIdade: m.maiorIdade, menor: m.menor, cuidado: m.cuidadoCaixa }} />
        </I18nProvider>
      </div>
    </div>
  );
}
