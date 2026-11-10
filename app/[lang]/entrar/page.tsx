// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import Link from "@/components/Link";
import { Star } from "@/components/Masthead";
import { SignIn } from "@/components/SignIn";
import { localePath } from "@/i18n/config";
import { loadLang } from "@/i18n";

export async function generateMetadata({ params }: PageProps<"/[lang]/entrar">): Promise<Metadata> {
  const { t } = await loadLang(params);
  return { title: t.auth.title, robots: { index: false } };
}

export default async function Entrar({ params }: PageProps<"/[lang]/entrar">) {
  const { lang, t } = await loadLang(params);
  // Duas colunas (09/11/2026): à esquerda, o cartaz preto com a estrela, no desenho das faixas da inicial ("Aqui a
  // gente estuda"), dizendo para que serve a conta; à direita, o formulário em cartão. No celular, um embaixo do outro.
  return (
    <div className="mx-auto grid max-w-[68rem] gap-8 px-4 py-10 md:grid-cols-[minmax(0,1fr)_minmax(0,28rem)] md:items-start md:gap-12 md:py-16">
      <section className="relative overflow-hidden border-2 border-ink bg-[#1f1a14] p-7 text-[#f4ecd8] shadow-[6px_6px_0_#c21f16] md:sticky md:top-24 md:p-10">
        <Star className="pointer-events-none absolute -right-10 -bottom-12 h-48 w-48 rotate-12 text-[#c21f16] opacity-90" />
        <p className="relative font-mono text-xs uppercase tracking-[0.22em] text-[#e0837a]">{t.auth.eyebrow}</p>
        <h1 className="relative mt-3 font-serif text-5xl font-medium leading-none md:text-6xl">{t.auth.title}</h1>
        <p className="relative mt-5 max-w-md text-lg leading-relaxed text-[#e9dcbc]">{t.auth.lead}</p>
        <p className="relative mt-8 font-sans">
          <Link href={localePath(lang, "/voluntarios")} className="font-bold text-[#f4ecd8] underline decoration-[#c21f16] decoration-2 underline-offset-4 hover:text-white">
            {t.auth.volunteerLink} →
          </Link>
        </p>
      </section>
      <div className="[&>form]:mt-0 [&>p]:mt-0">
        <SignIn s={t.auth} />
      </div>
    </div>
  );
}
