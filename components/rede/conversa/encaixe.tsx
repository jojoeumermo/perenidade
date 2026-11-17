// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import dynamic from "next/dynamic";
import type { ContextoDoEncaixe, Encaixe } from "../encaixes";
import { ComunidadesAtivas } from "../comunidades/ComunidadesAtivas";

/**
 * Encaixe da F3 (conversa, comunidades, descoberta e avisos): o que esta frente pendura nas telas comuns. Daqui em diante o
 * arquivo é da F3 (PLANO-ALUMIA §9). Tudo o que entra aqui só aparece na casca da Alumia nova (flag "alumia-2") e segue as regras
 * de privacidade do PLANO-ALUMIA §6.
 *
 * Coluna da direita (prancha computador-inicio): "Comunidades ativas" (depois de "Atos perto de você", da F2). A busca do alto da
 * coluna é da casca (ela já põe uma): a daqui saiu para a coluna não ter duas buscas iguais (ALUMIA-ATE-O-FIM, A4). O componente
 * BuscaDaColuna continua exportado em ../comunidades/ComunidadesAtivas para quem precisar dele numa tela. As telas da comunidade e
 * da conversa não precisam de encaixe: trocam sozinhas quando o layout põe [data-al="2"] (components/rede/conversa/base3.tsx).
 *
 * Onda 10 (10A): a aba "Fórum" da comunidade (components/rede/forum/AbaDoForum.tsx), só pelo ponto abasDaComunidade. O alto do
 * tópico, "virar tópico" e "pular para a primeira nova" ficam dentro da tela da conversa (TelaDaConversaAlumia.tsx).
 */

// Só o nome da aba, nos 6 idiomas (o resto dos textos vem sob demanda de i18n/rede/forum/).
const NOME_DA_ABA: Record<string, string> = { pt: "Fórum", en: "Forum", es: "Foro", fr: "Forum", ru: "Форум", zh: "论坛" };

const AbaDoForum = dynamic(() => import("../forum/AbaDoForum").then((m) => m.AbaDoForum), { ssr: false }) as React.ComponentType<ContextoDoEncaixe & { slug: string }>;

export const encaixe: Encaixe = {
  colunaDireita: [ComunidadesAtivas],
  abasDaComunidade: [{ chave: "forum", rotulo: ({ lang }) => NOME_DA_ABA[lang] ?? NOME_DA_ABA.pt, Componente: AbaDoForum }],
};
