// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CascaSeLogado } from "@/components/rede/org/CascaSeLogado";
import { PerfilDeExemplo } from "@/components/rede/org/PerfilDeExemplo";
import { loadLang } from "@/i18n";
import { rotaNovaLigada } from "@/lib/rede/rotas-novas";
import { textosDaRede } from "@/lib/rede/textos";
import { carregarTextosDaOrg } from "@/lib/rede/textos-org";

export async function generateMetadata({ params }: PageProps<"/[lang]/alumia/organizacoes/exemplo">): Promise<Metadata> {
  if (!rotaNovaLigada("organizacoes")) return {};
  const { lang } = await loadLang(params);
  const t = await carregarTextosDaOrg(lang);
  // Dados ilustrativos: não entra na busca.
  return { title: `${t.exemplo.aviso} · ${t.marca.alumia}`, robots: { index: false, follow: false } };
}

/** O perfil de exemplo de organização (dados ilustrativos), aberto por "Ver um perfil de exemplo"; com sessão, dentro da casca. Frente F4, flag "alumia-org". */
export default async function Pagina({ params, searchParams }: PageProps<"/[lang]/alumia/organizacoes/exemplo">) {
  if (!rotaNovaLigada("organizacoes")) notFound();
  const { lang } = await loadLang(params);
  const bruta = (await searchParams).aba;
  const aba = typeof bruta === "string" ? bruta : null;
  return (
    <CascaSeLogado lang={lang} s={textosDaRede(lang)} nome="organizacoes-exemplo" params={aba ? { aba } : undefined}>
      <PerfilDeExemplo lang={lang} aba={aba} />
    </CascaSeLogado>
  );
}
