// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { metadadosDaRotaNova, PaginaNova } from "@/components/rede/onda5/PaginaNova";
import { ChatSoNoApp } from "@/components/rede/transparencia-apps/ChatSoNoApp";
import { carregarTextosDoApp } from "@/components/rede/transparencia-apps/textos";
import { loadLang } from "@/i18n";
import { rotaNovaLigada } from "@/lib/rede/rotas-novas";
import { chatSoApp } from "@/lib/rede/transparencia-apps/recurso";

export function generateMetadata({ params }: PageProps<"/[lang]/alumia/aparelhos">): Promise<Metadata> {
  return metadadosDaRotaNova("aparelhos", params);
}

/**
 * Os aparelhos conectados (/alumia/aparelhos), sem endereço de rede. Frente F6. Atrás das flags (lib/rede/rotas-novas.ts): desligadas,
 * 404. Os aparelhos são os do chat (as chaves de cada um): com "alumia-chat-so-app" ligado, a lista mora nos apps e aqui fica só o
 * aviso "Para conversar, use o app".
 */
export default async function Pagina({ params }: PageProps<"/[lang]/alumia/aparelhos">) {
  if (rotaNovaLigada("aparelhos") && chatSoApp()) {
    const { lang } = await loadLang(params);
    return <ChatSoNoApp lang={lang} t={await carregarTextosDoApp(lang)} />;
  }
  return <PaginaNova nome="aparelhos" params={params} />;
}
