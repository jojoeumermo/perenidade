// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { L } from "@/components/I18n";
import { textosDoAppNovo } from "@/components/app/textos-app";
import { loadLang } from "@/i18n";
import { textosDosJogos } from "@/i18n/jogos";
import { PaginaDosJogosServidor } from "@/lib/jogos/pagina-servidor";

export const revalidate = 3600;

/**
 * A aba Jogos do aplicativo instalado: os jogos e a formação na tela de jogos do próprio projeto (reaproveitada inteira,
 * sem copiar código), com a entrada de Laboratórios que faltava no hub — no aplicativo ela existe (o site não muda).
 */
export default async function JogosDoApp({ params }: PageProps<"/[lang]/app/jogos">) {
  const { lang, t } = await loadLang(params);
  const n = textosDoAppNovo(lang);
  const j = textosDosJogos(lang);
  return (
    <div className="app-hub app-hub-jogos">
      <header className="app-hub-cabeca">
        <h1>{j.meta.titulo}</h1>
        <p>{j.pagina.lead}</p>
      </header>
      <L href="/laboratorios" className="app-cartao app-cartao-tinta app-atalho-labs">
        <span className="app-cartao-titulo app-cartao-titulo-menor">{t.nav.labs} →</span>
        <span className="app-cartao-aux">{n.jogosLead}</span>
      </L>
      <PaginaDosJogosServidor params={params} app />
    </div>
  );
}
