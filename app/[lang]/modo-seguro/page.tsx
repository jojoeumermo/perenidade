// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import Link from "@/components/Link";
import { PageHeading } from "@/components/PageHeading";
import { PainelDoModoSeguro } from "@/components/SaidaRapida";
import { loadLang } from "@/i18n";
import { localePath } from "@/i18n/config";
import { textosDaBusca } from "@/lib/escola/indice";
import { paginaMeta } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[lang]/modo-seguro">): Promise<Metadata> {
  const { lang } = await loadLang(params);
  const s = textosDaBusca(lang).seguro;
  return paginaMeta(lang, "/modo-seguro", s.titulo, s.descricao);
}

/**
 * Modo seguro (Etapa 4, R1-94): explica com honestidade o que a saída rápida faz e o que o site não consegue fazer (o
 * histórico do navegador só some na janela anônima), oferece baixar a cópia do estudo antes e liga o modo nesta aba.
 * Sempre disponível, com ou sem a Escola: é uma página de segurança.
 */
export default async function Page({ params }: PageProps<"/[lang]/modo-seguro">) {
  const { lang } = await loadLang(params);
  const s = textosDaBusca(lang).seguro;
  const faz = [s.faz1, s.faz2, s.faz3, s.faz4, s.faz5];
  const naoFaz = [s.naoFaz1, s.naoFaz2, s.naoFaz3, s.naoFaz4];
  const anonima = [s.anonima1, s.anonima2, s.anonima3, s.anonima4, s.anonima5];
  const bloco = "border-t border-rule pt-6";
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <PageHeading eyebrow={s.olho} title={s.titulo}>
        {s.lead}
      </PageHeading>

      <div className="mt-8">
        <PainelDoModoSeguro />
      </div>

      <div className="mt-10 space-y-8 font-sans text-sm">
        <section aria-labelledby="ms-faz" className={bloco}>
          <h2 id="ms-faz" className="font-serif text-2xl font-semibold">
            {s.fazTitulo}
          </h2>
          <ul className="mt-3 list-disc space-y-1.5 pl-5">
            {faz.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="ms-nao" className={bloco}>
          <h2 id="ms-nao" className="font-serif text-2xl font-semibold">
            {s.naoFazTitulo}
          </h2>
          <ul className="mt-3 list-disc space-y-1.5 pl-5">
            {naoFaz.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="ms-anonima" className={`${bloco} border-l-2 border-l-gold pl-4`}>
          <h2 id="ms-anonima" className="font-serif text-2xl font-semibold">
            {s.anonimaTitulo}
          </h2>
          <p className="mt-2">{s.anonimaLead}</p>
          <ul className="mt-3 space-y-1.5">
            {anonima.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="ms-ajuda" className={bloco}>
          <h2 id="ms-ajuda" className="font-serif text-2xl font-semibold">
            {s.ajudaTitulo}
          </h2>
          <p className="mt-2">{s.ajuda}</p>
          <Link href={localePath(lang, "/direitos")} className="mt-2 inline-flex min-h-11 items-center underline hover:text-oxblood">
            {s.ajudaLink} →
          </Link>
        </section>
      </div>
    </div>
  );
}
