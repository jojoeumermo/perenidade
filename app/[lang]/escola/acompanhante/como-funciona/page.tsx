// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import Link from "@/components/Link";
import { LimiteDoDia } from "@/components/escola/acompanhante/LimiteDoDia";
import { PageHeading } from "@/components/PageHeading";
import { SelosDePrivacidade } from "@/components/SeloDePrivacidade";
import { loadLang } from "@/i18n";
import { localePath } from "@/i18n/config";
import { textosDoAcompanhante } from "@/i18n/escola/acompanhante";
import { PROVEDORES_PUBLICOS } from "@/lib/escola/provedores-publicos";
import { SELOS_DE_FORA } from "@/lib/selos";
import { paginaMeta } from "@/lib/seo";
import "@/styles/escola-acompanhante.css";

export async function generateMetadata({ params }: PageProps<"/[lang]/escola/acompanhante/como-funciona">): Promise<Metadata> {
  const { lang } = await loadLang(params);
  const s = textosDoAcompanhante(lang);
  return paginaMeta(lang, "/escola/acompanhante/como-funciona", `${s.como.titulo} · ${s.meta.titulo}`, s.como.lead);
}

/**
 * Transparência do acompanhante (R1-64): quem pode responder (a lista de lib/escola/provedores-publicos.ts, conferida
 * contra a Edge Function pelo teste), o que sai do aparelho, o que fica nele, o que o Instituto guarda, o limite do dia
 * e por que não há modelo no aparelho (R1-63, parte 2), com os números.
 */
export default async function ComoFunciona({ params }: PageProps<"/[lang]/escola/acompanhante/como-funciona">) {
  const { lang } = await loadLang(params);
  const s = textosDoAcompanhante(lang);
  const c = s.como;
  const titulo = "mt-10 font-serif text-2xl font-semibold";
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 font-sans" data-acompanhante="como-funciona">
      <PageHeading eyebrow={s.meta.titulo} title={c.titulo} voltar={{ href: localePath(lang, "/escola/acompanhante"), texto: s.hub.titulo }} />
      <p className="mt-6 text-lg">{c.lead}</p>
      <SelosDePrivacidade item={SELOS_DE_FORA.assistente} lang={lang} className="mt-4" />

      <h2 className={titulo}>{c.provedoresTitulo}</h2>
      <p className="mt-2">{c.provedoresTexto}</p>
      <ul className="mt-3 list-disc space-y-1 pl-6" data-provedores>
        {PROVEDORES_PUBLICOS.map((p) => (
          <li key={p.id}>
            <strong>{p.nome}</strong> <span className="text-ink-soft">({p.visao ? c.visao : c.semVisao})</span>
          </li>
        ))}
      </ul>
      <p className="mt-3">{c.ordem}</p>

      <h2 className={titulo}>{c.oQueVaiTitulo}</h2>
      <ul className="mt-2 list-disc space-y-1 pl-6">
        {c.oQueVai.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <p className="mt-3">{c.oQueVaiFim}</p>
      <p className="mt-3">{c.lei}</p>
      <p className="mt-3 text-ink-soft">{c.provedorGuarda}</p>

      <h2 className={titulo}>{c.oQueFicaTitulo}</h2>
      <p className="mt-2">{c.oQueFica}</p>

      <h2 className={titulo}>{c.guardaTitulo}</h2>
      <p className="mt-2">{c.guarda}</p>

      <h2 className={titulo}>{c.limiteTitulo}</h2>
      <LimiteDoDia banco={c.limiteBanco} padrao={c.limitePadrao} />

      <h2 className={titulo}>{c.contaTitulo}</h2>
      <p className="mt-2">{c.conta}</p>

      <h2 className={titulo} id="modelo-no-aparelho">
        {c.modeloTitulo}
      </h2>
      <p className="mt-2">{c.modelo}</p>
      <ul className="mt-3 list-disc space-y-1 pl-6" data-modelos-medidos>
        {c.modeloNumeros.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <p className="mt-2 text-sm text-ink-soft">{c.modeloFonte}</p>
      <p className="mt-3">{c.modeloDecisao}</p>

      <p className="mt-10 border-l-4 border-gold pl-3">{c.papel}</p>
      <p className="mt-6 text-sm">
        <Link href={localePath(lang, "/privacidade")} className="underline hover:text-oxblood">
          /privacidade
        </Link>
      </p>
    </div>
  );
}
