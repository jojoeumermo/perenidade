// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { rotaNovaLigada } from "@/lib/rede/rotas-novas";
import type { Encaixe } from "../encaixes";

/**
 * Encaixe da cultura (Prompt 4, itens 38 a 42). Com a rota "cultura" ligada (lib/rede/rotas-novas.ts, flag "alumia-p4-cultura"), o
 * item "Cultura" entra no grupo Mais do menu de quem tem conta. Desligada, o encaixe fica vazio e nada aparece.
 */
const NOME: Record<string, string> = { pt: "Cultura", en: "Culture", es: "Cultura", fr: "Culture", ru: "Культура", zh: "文化" };

export const encaixe: Encaixe = !rotaNovaLigada("cultura") ? {} : {
  menu: [
    {
      chave: "cultura",
      lugar: "mais",
      rotulo: ({ lang }) => NOME[lang] ?? NOME.pt,
      icone: (
        <svg aria-hidden viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v15H5.5A1.5 1.5 0 0 1 4 17.5v-12Z" />
          <path d="M13 4h5.5A1.5 1.5 0 0 1 20 5.5v12a1.5 1.5 0 0 1-1.5 1.5H13V4Z" />
          <path d="M15.5 8.5v4.2a1.3 1.3 0 1 1-1-1.27" />
          <path d="M6.5 8h2M6.5 11h2" />
        </svg>
      ),
      href: ({ lang, situacao }) => (situacao.logado ? `/${lang}/alumia/cultura` : null),
    },
  ],
};
