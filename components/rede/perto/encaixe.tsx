// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import dynamic from "next/dynamic";
import { rotaNovaLigada } from "@/lib/rede/rotas-novas";
import type { ContextoDoEncaixe, Encaixe } from "../encaixes";

/**
 * Encaixe do "Perto" (Prompt 4, lote perto: itens 2, 7 e 8). Com a rota "perto" ligada (lib/rede/rotas-novas.ts, flag
 * "alumia-p4-perto"), o item "Perto" entra no painel do botão Segurança de quem tem conta, e a vigia (o último aviso da volta para
 * casa e o pedido de ajuda que chegou) fica em toda tela pela coluna da direita. Desligada, o encaixe fica vazio e nada aparece.
 * As posições recebidas ficam só na memória da aba e somem no Sair rápido (lib/rede/perto/guarda.ts); a volta para casa fica numa
 * chave "lucia-…" do aparelho, que o Sair rápido apaga.
 */
const NOME: Record<string, string> = { pt: "Perto", en: "Nearby", es: "Cerca", fr: "Près", ru: "Рядом", zh: "附近" };

const VigiaDoPerto = dynamic<ContextoDoEncaixe>(() => import("./VigiaDoPerto").then((m) => m.VigiaDoPerto), { ssr: false });

export const encaixe: Encaixe = !rotaNovaLigada("perto") ? {} : {
  menu: [
    {
      chave: "perto",
      lugar: "seguranca",
      rotulo: ({ lang }) => NOME[lang] ?? NOME.pt,
      icone: (
        <svg aria-hidden viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z" />
          <circle cx="12" cy="10" r="2.4" />
        </svg>
      ),
      href: ({ lang, situacao }) => (situacao.logado ? `/${lang}/alumia/perto` : null),
    },
  ],
  colunaDireita: [VigiaDoPerto],
};
