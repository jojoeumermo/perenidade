// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Encaixe da frente 11D (redação entre pares), na lista de components/rede/encaixes.tsx. Pendura só o item "Redação" no menu do
// computador, para quem tem conta, levando a /alumia/redacao. A rota e a tela ficam atrás de "alumia-estudo"
// (lib/rede/rotas-novas.ts, a rota "redacao"); desligada, o encaixe fica vazio.
import { rotaNovaLigada } from "@/lib/rede/rotas-novas";
import type { Encaixe } from "../../encaixes";

const NOME: Record<string, string> = { pt: "Redação", en: "Essays", es: "Redacción", fr: "Rédaction", ru: "Сочинения", zh: "作文" };

export const encaixe: Encaixe = !rotaNovaLigada("redacao")
  ? {}
  : {
      menu: [
        {
          chave: "redacao",
          rotulo: ({ lang }) => NOME[lang] ?? NOME.pt,
          icone: (
            <svg aria-hidden viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 3.5h9l3 3v14H6z" />
              <path d="M9 9h6M9 12.5h6M9 16h3.5" />
              <path d="M16.5 14.5l2.5-2.5 1.5 1.5-2.5 2.5h-1.5z" />
            </svg>
          ),
          href: ({ lang, situacao }) => (situacao.logado ? `/${lang}/alumia/redacao` : null),
        },
      ],
    };
