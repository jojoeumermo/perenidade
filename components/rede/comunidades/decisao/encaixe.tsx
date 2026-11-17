// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Encaixe da frente 10E (decisão e números da comunidade). Quem junta acrescenta `decisao` à lista de components/rede/encaixes.tsx
// (import { encaixe as decisao } from "./comunidades/decisao/encaixe") e a página da comunidade mostra as abas de
// ENCAIXES.abasDaComunidade. Pendura:
//   abasDaComunidade   a aba "Decisões": as votações internas com quórum e prazo (secretas ou abertas) e, só para quem modera,
//                      abrir votação e os números da comunidade por semana.
// Só com a Alumia nova ligada ("rede-v2" e "alumia-2"); desligada, o encaixe fica vazio. O banco confere tudo de novo
// (supabase/migracoes/20261116-alumia-o10-decisao.sql).
import dynamic from "next/dynamic";
import { alumia2Ligada } from "@/lib/rede/rotas-novas";
import type { Encaixe } from "../../encaixes";

// Só o nome da aba, nos 6 idiomas (o resto dos textos vem sob demanda de i18n/rede/decisao/).
const NOME: Record<string, string> = { pt: "Decisões", en: "Decisions", es: "Decisiones", fr: "Décisions", ru: "Решения", zh: "决定" };

const AbaDasDecisoes = dynamic(() => import("./AbaDasDecisoes").then((m) => m.AbaDasDecisoes), { ssr: false });

export const encaixe: Encaixe = !alumia2Ligada() ? {} : {
  abasDaComunidade: [{ chave: "decisoes", rotulo: ({ lang }) => NOME[lang] ?? NOME.pt, Componente: AbaDasDecisoes }],
};
