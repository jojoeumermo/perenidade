// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Encaixe da frente 11E (ponte com a Escola). Quem junta acrescenta `conquistas` à lista de components/rede/encaixes.tsx (import de
// "./estudo/conquistas/encaixe"). Pendura:
//   abasDoPerfil     a fileira de conquistas no perfil (só as medalhas e a faixa que a pessoa ligou; sem nada ligado, nada aparece);
//   secoesDeAjustes  "Estudo e conquistas", com os caminhos para /alumia/conquistas e /alumia/aprovados.
// As telas (/alumia/conquistas e /alumia/aprovados) entram pelo registro (components/rede/registro.tsx, nomes "conquistas" e
// "aprovados"). Tudo atrás de "alumia-2" (a casca nova); desligada, o encaixe fica vazio e nada muda.
import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import { alumia2Ligada } from "@/lib/rede/rotas-novas";
import type { ContextoDoEncaixe, Encaixe } from "../../encaixes";

const ABA: Record<string, string> = {
  pt: "Conquistas",
  en: "Achievements",
  es: "Logros",
  fr: "Réussites",
  ru: "Достижения",
  zh: "成就",
};
const AJUSTES: Record<string, string> = {
  pt: "Estudo e conquistas",
  en: "Study and achievements",
  es: "Estudio y logros",
  fr: "Études et réussites",
  ru: "Учёба и достижения",
  zh: "学习与成就",
};

const ConquistasNoPerfil = dynamic(() => import("./NoPerfil").then((m) => m.ConquistasNoPerfil), { ssr: false });
const NosAjustes = dynamic(() => import("./NosAjustes"), { ssr: false });

export const encaixe: Encaixe = !alumia2Ligada()
  ? {}
  : {
      abasDoPerfil: [{ chave: "conquistas", rotulo: ({ lang }) => ABA[lang] ?? ABA.pt, Componente: ConquistasNoPerfil }],
      secoesDeAjustes: [{ chave: "conquistas", titulo: ({ lang }) => AJUSTES[lang] ?? AJUSTES.pt, Componente: NosAjustes as ComponentType<ContextoDoEncaixe> }],
    };
