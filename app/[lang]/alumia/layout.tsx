// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { MolduraDaAlumia } from "@/components/rede/MolduraDaAlumia";
import { loadLang } from "@/i18n";
import { textosDaRede } from "@/lib/rede/textos";

/**
 * Todas as telas da Comunidade são a Alumia, a rede social do instituto (a de hoje e a v2): a moldura tira a casca do site de
 * cena e põe no alto o botão "Voltar ao site". No endereço próprio (alumia.institutolucia.org) o proxy.ts reescreve para estas
 * rotas. Sem leitura de disco e sem cabeçalhos do pedido: a página continua podendo sair pronta do cache.
 */
export default async function LayoutDaAlumia({ children, params }: LayoutProps<"/[lang]/alumia">) {
  const { lang } = await loadLang(params);
  return (
    <MolduraDaAlumia lang={lang} s={textosDaRede(lang)}>
      {children}
    </MolduraDaAlumia>
  );
}
