// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { rotaNovaLigada } from "@/lib/rede/rotas-novas";
import type { Encaixe } from "../encaixes";

/**
 * Encaixe da criação coletiva (Prompt 4, itens 33, 34, 36 e 37). Com a rota "criacao-coletiva" ligada (lib/rede/rotas-novas.ts, flag
 * "alumia-p4-criacao-coletiva"), o item "Criação coletiva" entra no menu Mais de quem tem conta. Desligada, o encaixe fica vazio e
 * nada aparece.
 */
const NOME: Record<string, string> = { pt: "Criação coletiva", en: "Making together", es: "Creación colectiva", fr: "Création collective", ru: "Совместное творчество", zh: "共同创作" };

export const encaixe: Encaixe = !rotaNovaLigada("criacao-coletiva") ? {} : {
  menu: [
    {
      chave: "criacao-coletiva",
      lugar: "mais",
      rotulo: ({ lang }) => NOME[lang] ?? NOME.pt,
      icone: (
        <svg aria-hidden viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z" />
          <path d="m13.5 6.5 4 4" />
          <path d="M14 20h6" />
        </svg>
      ),
      href: ({ lang, situacao }) => (situacao.logado ? `/${lang}/alumia/criacao` : null),
    },
  ],
};
