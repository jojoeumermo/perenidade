// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import TelaAoVivo from "@/components/rede/aovivo/TelaAoVivo";
import { carregarTextosDoAoVivo } from "@/components/rede/aovivo/textos";
import { CascaSeLogado } from "@/components/rede/org/CascaSeLogado";
import { loadLang } from "@/i18n";
import { aoVivoLigado } from "@/lib/rede/mapa/ligado";
import { textosDaRede } from "@/lib/rede/textos";

export async function generateMetadata({ params }: PageProps<"/[lang]/alumia/mapa/ao-vivo">): Promise<Metadata> {
  if (!aoVivoLigado()) return {};
  const { lang } = await loadLang(params);
  const t = await carregarTextosDoAoVivo(lang);
  return { title: `${t.titulo} · ${textosDaRede(lang).marca}`, robots: { index: false, follow: false } };
}

/**
 * As perguntas ao vivo (/alumia/mapa/ao-vivo; ?s=<id> abre uma sessão). Frente 13B. Atrás de "rede-v2" + "alumia-2" +
 * "alumia-ao-vivo" (lib/rede/mapa/ligado.ts): desligado, 404. Quem tem sessão vê a tela dentro da casca (registro "ao-vivo").
 */
export default async function Pagina({ params, searchParams }: PageProps<"/[lang]/alumia/mapa/ao-vivo">) {
  if (!aoVivoLigado()) notFound();
  const { lang } = await loadLang(params);
  const busca = await searchParams;
  const s = typeof busca.s === "string" && /^[0-9a-z-]{1,40}$/i.test(busca.s) ? busca.s : "";
  const rede = textosDaRede(lang);
  return (
    <CascaSeLogado lang={lang} s={rede} nome="ao-vivo" params={s ? { s } : {}}>
      <TelaAoVivo lang={lang} s={rede} params={s ? { s } : {}} situacao={{ logado: false, membro: false, regras_versao: 0 }} />
    </CascaSeLogado>
  );
}
