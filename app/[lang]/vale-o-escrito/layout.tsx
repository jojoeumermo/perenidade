// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { notFound } from "next/navigation";
import { MolduraDoVale } from "@/components/vale-o-escrito/Moldura";
import { localePath } from "@/i18n/config";
import { loadLang } from "@/i18n";
import { ligado } from "@/lib/recursos";
import { classesDasLetras } from "@/lib/vale-o-escrito/fontes";
import { textosDoObservatorio } from "@/lib/vale-o-escrito/textos";

/**
 * A moldura de todas as páginas do Vale o Escrito (/vale-o-escrito e abaixo). Desligado (recurso "vale-o-escrito", que
 * só liga pelo nome), nenhuma página daqui existe: a rota responde 404, como a Escola. Ligado, o Vale abre como página
 * independente, como a Comunidade (Alumia): tela cheia, sem a casca do site nem a do aplicativo do celular, com a rede viva
 * ao fundo, a navegação própria, o botão de som e um único botão "Voltar ao site" (components/vale-o-escrito/Moldura.tsx).
 * As letras (lib/vale-o-escrito/fontes.ts) só carregam nestas rotas. Este layout NÃO lê disco e não importa
 * lib/vale-o-escrito/dados.ts: quem lê é a página, para o layout raiz continuar leve. O peso (D3, MapLibre, o canvas do
 * fundo) chega ao navegador só por import() dinâmico.
 */
export default async function ValeOEscritoLayout({ children, params }: LayoutProps<"/[lang]/vale-o-escrito">) {
  if (!ligado("vale-o-escrito")) notFound();
  const { lang } = await loadLang(params);
  const s = textosDoObservatorio(lang);
  const raiz = localePath(lang, "/vale-o-escrito");
  return (
    <MolduraDoVale
      lang={lang}
      classesDasLetras={classesDasLetras}
      s={{
        ...s.casca,
        nav: [
          { href: raiz, texto: s.navegacao.inicio },
          { href: `${raiz}/sobre`, texto: s.navegacao.sobre },
          { href: `${raiz}/enviar`, texto: s.navegacao.enviar },
          { href: `${raiz}/correcao`, texto: s.navegacao.corrigir },
        ],
      }}
    >
      {children}
    </MolduraDoVale>
  );
}
