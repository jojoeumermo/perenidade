// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { CartazDaFrente } from "@/components/escola/frente/CartazDaFrente";
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
 * Maria. Página pública (a porta deixa passar: PUBLICAS_DA_ESCOLA, em lib/escola/rotas.ts), como o voluntariado.
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
    <div className="mx-auto max-w-4xl px-4 pb-12 pt-4" data-militantes="">
      <p className="mt-2 font-sans text-sm">
        <Link href={localePath(lang, "/escola")} className="text-ink-soft hover:text-oxblood">
          ← {m.voltar}
        </Link>
      </p>
      <CartazDaFrente lang={lang} s={f.cartaz} olho={base.entrada.titulo} titulo={m.titulo} linha={m.lead} chamado={false} />

      <section className="frente-secao" aria-labelledby="porque-militar">
        <h2 id="porque-militar" className="frente-secao-titulo">
          {m.porqueTitulo}
        </h2>
        <ul className="frente-lista font-serif">
          {m.porque.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="frente-secao" aria-labelledby="como-militar">
        <h2 id="como-militar" className="frente-secao-titulo">
          {m.comoTitulo}
        </h2>
        <ol className="frente-passos">
          {m.passos.map((passo) => (
            <li key={passo.titulo}>
              <span className="block font-serif text-xl font-semibold">{passo.titulo}</span>
              <span className="mt-1 block text-sm text-ink-soft">{passo.texto}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="frente-secao" aria-labelledby="frentes-de-trabalho">
        <h2 id="frentes-de-trabalho" className="frente-secao-titulo">
          {m.frentesTitulo}
        </h2>
        <p className="mt-3 max-w-2xl text-lg leading-relaxed">{m.frentesTexto}</p>
        <p className="mt-3 font-sans">
          <Link href={localePath(lang, "/escola/manifesto")} className="font-semibold underline hover:text-oxblood">
            {m.manifestoTitulo} →
          </Link>{" "}
          <span className="text-ink-soft">{m.manifestoTexto}</span>
        </p>
      </section>

      <aside className="frente-cuidado" aria-labelledby="cuidado-dados">
        <h2 id="cuidado-dados" className="font-serif text-xl font-semibold">
          {m.cuidadoTitulo}
        </h2>
        <p className="mt-2 text-sm">{m.cuidadoTexto}</p>
        <p className="mt-2 text-sm">
          <Link href={localePath(lang, "/privacidade")} className="underline hover:text-oxblood">
            {base.porta.privacidade}
          </Link>
        </p>
      </aside>

      <I18nProvider lang={lang} t={pickSections(t, ["areas"])}>
        <VolunteerForm s={s} id="inscricao-militante" militante={{ consentimento: m.consentimento, maiorIdade: m.maiorIdade, menor: m.menor, cuidado: m.cuidadoCaixa }} />
      </I18nProvider>
    </div>
  );
}
