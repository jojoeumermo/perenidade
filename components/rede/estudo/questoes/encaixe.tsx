// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Encaixe da frente 11A (banco de questões), na lista de components/rede/encaixes.tsx. A tela está no registro
// (components/rede/registro.tsx, nome "questoes") e a rota em app/[lang]/alumia/questoes/page.tsx, atrás de "alumia-estudo"
// (lib/rede/rotas-novas.ts). Pendura:
//   menu  "Questões" no menu do computador, levando a /alumia/questoes.
// Os acertos ficam no armazenamento do aparelho com o prefixo da Alumia ("lucia:rede:"): o "Sair rápido" já apaga, sem limpeza a mais.
import { rotaNovaLigada } from "@/lib/rede/rotas-novas";
import type { Encaixe } from "../../encaixes";

const NOME: Record<string, string> = { pt: "Questões", en: "Questions", es: "Preguntas", fr: "Questions", ru: "Задачи", zh: "题库" };

export const encaixe: Encaixe = !rotaNovaLigada("questoes")
  ? {}
  : {
      menu: [
        {
          chave: "questoes",
          rotulo: ({ lang }) => NOME[lang] ?? NOME.pt,
          icone: (
            <svg aria-hidden viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <rect x="4" y="3" width="16" height="18" rx="1.5" />
              <path d="M8 8h1M8 12h1M8 16h1M12 8h4M12 12h4M12 16h4" />
            </svg>
          ),
          href: ({ lang }) => `/${lang}/alumia/questoes`,
        },
      ],
    };
