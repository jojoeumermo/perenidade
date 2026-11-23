// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import type { Post } from "@/lib/rede/tipos";
import { rotaNovaLigada } from "@/lib/rede/rotas-novas";
import type { ContextoDoEncaixe, Encaixe } from "../encaixes";

/**
 * Encaixe da ação coletiva (Prompt 4, Parte F: itens 89 a 100 e 122 a 126). Com a rota "acao-coletiva" ligada
 * (lib/rede/rotas-novas.ts, flag "alumia-p4-coletiva"): o item "Ação coletiva" no grupo "Mais" do menu de quem tem conta e o aviso
 * de Pix no cartão do post (./AvisoDePix, item 100, só quando o post fala em Pix), sem mexer no cartão. Desligada, o encaixe fica
 * vazio e nada aparece.
 */
const NOME: Record<string, string> = { pt: "Ação coletiva", en: "Collective action", es: "Acción colectiva", fr: "Action collective", ru: "Коллективные действия", zh: "集体行动" };

const AvisoDePix = dynamic(() => import("./AvisoDePix"), { ssr: false });

export const encaixe: Encaixe = !rotaNovaLigada("acao-coletiva") ? {} : {
  anexosDoCartao: [AvisoDePix as ComponentType<ContextoDoEncaixe & { post: Post }>],
  menu: [
    {
      chave: "acao-coletiva",
      lugar: "mais",
      rotulo: ({ lang }) => NOME[lang] ?? NOME.pt,
      icone: (
        <svg aria-hidden viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 11V6.5a1.5 1.5 0 0 1 3 0V11" />
          <path d="M10 10V5a1.5 1.5 0 0 1 3 0v5" />
          <path d="M13 10V6a1.5 1.5 0 0 1 3 0v6" />
          <path d="M16 11.5a1.5 1.5 0 0 1 3 0V14a7 7 0 0 1-7 7h-.5A6.5 6.5 0 0 1 5 14.5V12a1.5 1.5 0 0 1 2-1.4" />
        </svg>
      ),
      href: ({ lang, situacao }) => (situacao.logado ? `/${lang}/alumia/acao-coletiva` : null),
    },
  ],
};
