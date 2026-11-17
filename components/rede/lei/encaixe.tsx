// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import dynamic from "next/dynamic";
import type { ContextoDoEncaixe, Encaixe } from "../encaixes";
import titulos from "../../../i18n/rede/lei/titulos.json";

// O cartão de reaceite no alto do Início e a seção "Termos e privacidade" em Ajustes. Carregados só quando aparecem.
const ReaceiteNoInicio = dynamic(() => import("./Reaceite").then((m) => m.ReaceiteNoInicio), { ssr: false });
const AjustesDaLei = dynamic(() => import("./AjustesDaLei"), { ssr: false });

/**
 * Encaixe da frente 8B (lei e ajuda). Quem junta acrescenta `lei` à lista de components/rede/encaixes.tsx (import de "./lei/encaixe").
 * O reaceite só aparece para quem entrou e ainda não aceitou a versão em vigor dos termos; a seção de ajustes mostra a versão e
 * quando a pessoa aceitou, com os links.
 */
export const encaixe: Encaixe = {
  topoDaLinha: [ReaceiteNoInicio as React.ComponentType<ContextoDoEncaixe>],
  secoesDeAjustes: [{ chave: "lei", titulo: (ctx) => (titulos.ajustes as Record<string, string>)[ctx.lang] ?? titulos.ajustes.pt, Componente: AjustesDaLei as React.ComponentType<ContextoDoEncaixe> }],
};
