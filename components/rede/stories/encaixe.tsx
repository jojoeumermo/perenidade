// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import Link from "@/components/Link";
import { rotaNovaLigada } from "@/lib/rede/rotas-novas";
import { enderecosDosStories } from "@/lib/rede/stories/enderecos";
import type { Post } from "@/lib/rede/tipos";
import type { ContextoDoEncaixe, Encaixe } from "../encaixes";
import { useTextosDosStories } from "./usar";

/** "Stories" no menu, nos 6 idiomas (o menu desenha na hora; os textos completos dos stories só baixam ao abrir a tela). */
const ROTULO_DO_MENU: Record<string, string> = { pt: "Stories", en: "Stories", es: "Historias", fr: "Stories", ru: "Истории", zh: "快拍" };

const IconeStories = () => (
  <svg viewBox="0 0 24 24" width={24} height={24} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
    <rect x="3.5" y="3.5" width="17" height="17" rx="5" strokeDasharray="4 2.2" />
    <path d="M12 8.5v7M8.5 12h7" />
  </svg>
);

/** "Pôr no story" no cartão: abre o "criar" com o link do post (o story some em 24 h e não vai ao Fediverso). */
function PorNoStory({ lang, situacao, post }: ContextoDoEncaixe & { post: Post }) {
  const t = useTextosDosStories(lang);
  if (!t || !situacao.logado || !rotaNovaLigada("stories")) return null;
  return (
    <Link href={enderecosDosStories.criar(lang, post.id)} className="al-botao al-botao-fantasma al-botao-p" title={t.cartao.porNoStoryAjuda}>
      {t.cartao.porNoStory}
    </Link>
  );
}

/**
 * Encaixe da F5 (stories e mídia criativa). Tudo atrás de rede-v2 + alumia-2 + alumia-stories (lib/rede/rotas-novas.ts): com as
 * flags desligadas o item do menu não aparece (href nulo) e o "Pôr no story" não desenha nada. Os stories não deixam rastro de
 * quem viu (PLANO-ALUMIA §6.4): o "já vi" e o "silenciar" ficam em chaves "lucia:rede-stories-*" do aparelho, que o Sair rápido já
 * apaga junto com as outras chaves da rede (lib/rede/saida.ts), por isso não há limpeza extra aqui.
 *
 * A faixa no alto da linha de Início é o componente FaixaDeStories (./FaixaDeStories): a linha da F1 a põe acima das abas quando
 * rotaNovaLigada("stories"); a tela /alumia/stories já mostra a faixa com a linha embaixo.
 */
export const encaixe: Encaixe = {
  menu: [
    {
      chave: "stories",
      rotulo: ({ lang }) => ROTULO_DO_MENU[lang] ?? ROTULO_DO_MENU.pt,
      icone: <IconeStories />,
      href: ({ lang }) => (rotaNovaLigada("stories") ? enderecosDosStories.stories(lang) : null),
    },
  ],
  acoesDoCartao: [PorNoStory],
};
