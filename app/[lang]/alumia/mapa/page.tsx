// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import TelaDoMapa from "@/components/rede/mapa/TelaDoMapa";
import { carregarTextosDoMapa } from "@/components/rede/mapa/textos";
import { CascaSeLogado } from "@/components/rede/org/CascaSeLogado";
import { loadLang } from "@/i18n";
import { mapaLigado } from "@/lib/rede/mapa/ligado";
import { textosDaRede } from "@/lib/rede/textos";

/** O que o mapa mostra depende de quem olha (cada um vê o que pode ver): a página não é indexada. */
export async function generateMetadata({ params }: PageProps<"/[lang]/alumia/mapa">): Promise<Metadata> {
  if (!mapaLigado()) return {};
  const { lang } = await loadLang(params);
  const t = await carregarTextosDoMapa(lang);
  return { title: `${t.titulo} · ${textosDaRede(lang).marca}`, robots: { index: false, follow: false } };
}

/**
 * O mapa de chamados, eventos e núcleos por cidade (/alumia/mapa). Frente 13B. Atrás de "rede-v2" + "alumia-2" + "alumia-mapa"
 * (lib/rede/mapa/ligado.ts): desligado, 404. Quem tem sessão vê a tela dentro da casca (registro "mapa"); sem sessão, a mesma tela
 * sem a casca.
 */
export default async function Pagina({ params }: PageProps<"/[lang]/alumia/mapa">) {
  if (!mapaLigado()) notFound();
  const { lang } = await loadLang(params);
  return (
    <CascaSeLogado lang={lang} s={textosDaRede(lang)} nome="mapa">
      <TelaDoMapa lang={lang} />
    </CascaSeLogado>
  );
}
