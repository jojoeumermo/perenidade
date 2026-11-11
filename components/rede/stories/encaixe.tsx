// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import dynamic from "next/dynamic";
import Link from "@/components/Link";
import { rotaNovaLigada } from "@/lib/rede/rotas-novas";
import { enderecosDosStories } from "@/lib/rede/stories/enderecos";
import type { Post } from "@/lib/rede/tipos";
import type { ContextoDoEncaixe, Encaixe } from "../encaixes";
import { useTextosDosStories } from "./usar";

// A faixa (com o visor e o "criar") só chega ao navegador quando a flag está ligada e a linha de Início a desenha.
const StoriesNoAlto = dynamic(() => import("./NoAlto"), { ssr: false });
// Os destaques do perfil: só baixam quando a área de perfil os desenha (encaixe abasDoPerfil, ou <DestaquesNoPerfil> acima das abas).
const DestaquesDoPerfil = dynamic(() => import("./Destaques").then((m) => m.DestaquesDoPerfil), { ssr: false });

/** O nome da aba "Destaques" nos 6 idiomas (curto, sem baixar os textos dos stories só para o rótulo). */
const ROTULO_DOS_DESTAQUES: Record<string, string> = { pt: "Destaques", en: "Highlights", es: "Destacadas", fr: "À la une", ru: "Актуальное", zh: "精选" };

/**
 * Os destaques de stories no perfil de @handle (encaixe para a área de perfil, F4): a fileira de bolinhas que abrem o visor. Com as
 * flags desligadas, não desenha nada nem baixa nada.
 */
export function DestaquesNoPerfil({ lang, situacao, handle }: ContextoDoEncaixe & { handle: string }) {
  if (!rotaNovaLigada("stories")) return null;
  return <DestaquesDoPerfil lang={lang} situacao={situacao} handle={handle} />;
}

/** "Pôr no story" ligado: só aqui os textos dos stories são baixados (com as flags desligadas, nada é pedido à rede). */
function PorNoStoryLigado({ lang, post }: { lang: string; post: Post }) {
  const t = useTextosDosStories(lang);
  if (!t) return null;
  return (
    <Link href={enderecosDosStories.criar(lang, post.id)} className="al-botao al-botao-fantasma al-botao-p" title={t.cartao.porNoStoryAjuda}>
      {t.cartao.porNoStory}
    </Link>
  );
}

/** "Pôr no story" no cartão: abre o "criar" com o link do post (o story some em 24 h e não vai ao Fediverso). */
function PorNoStory({ lang, situacao, post }: ContextoDoEncaixe & { post: Post }) {
  if (!situacao.logado || !rotaNovaLigada("stories")) return null;
  return <PorNoStoryLigado lang={lang} post={post} />;
}

/** "Pôr no story" ligado na página do ato: o story leva o cartão do ato (nome, data e cidade; nunca o ponto nem quem vai). */
function PorNoStoryDoAtoLigado({ lang, id }: { lang: string; id: string }) {
  const t = useTextosDosStories(lang);
  if (!t) return null;
  return (
    <Link href={enderecosDosStories.criar(lang, id)} className="al-botao al-botao-m al-botao-contorno" title={t.b1.ato.ajuda}>
      {t.b1.ato.porNoStory}
    </Link>
  );
}

/**
 * "Pôr no story" para as telas de ato (components/rede/atos/**): a convocação é o uso central da rede, e o story é o jeito mais
 * rápido de espalhar. Atrás da flag dos stories e só com conta.
 */
export function PorNoStoryDoAto({ lang, logado, id }: { lang: string; logado: boolean; id: string }) {
  if (!logado || !rotaNovaLigada("stories")) return null;
  return <PorNoStoryDoAtoLigado lang={lang} id={id} />;
}

/** A faixa de stories no alto da linha de Início, acima das abas (prancha celular-stories-na-linha). */
function NoAltoDaLinha({ lang, situacao }: ContextoDoEncaixe) {
  if (!rotaNovaLigada("stories")) return null;
  return <StoriesNoAlto lang={lang} situacao={situacao} />;
}

/**
 * Encaixe da F5 (stories e mídia criativa). Tudo atrás de rede-v2 + alumia-2 + alumia-stories (lib/rede/rotas-novas.ts): com as
 * flags desligadas a faixa e o "Pôr no story" não desenham nada nem baixam nada. Os stories não deixam rastro de quem viu
 * (PLANO-ALUMIA §6.4): o "já vi" e o "silenciar" ficam em chaves "lucia:rede-stories-*" do aparelho, que o Sair rápido já
 * apaga junto com as outras chaves da rede (lib/rede/saida.ts), por isso não há limpeza extra aqui.
 *
 * Sem item próprio no menu: a faixa vive no alto da linha de Início (topoDaLinha, desenhado em components/rede/Rede.tsx acima
 * das abas), como na prancha. A tela /alumia/stories continua existindo (destino do "Pôr no story") e marca "Início" no menu.
 */
export const encaixe: Encaixe = {
  topoDaLinha: [NoAltoDaLinha],
  acoesDoCartao: [PorNoStory],
  abasDoPerfil: [{ chave: "destaques", rotulo: ({ lang }) => ROTULO_DOS_DESTAQUES[lang] ?? ROTULO_DOS_DESTAQUES.pt, Componente: DestaquesNoPerfil }],
};
