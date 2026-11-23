// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import dynamic from "next/dynamic";
import type { ContextoDoEncaixe, Encaixe } from "../encaixes";
import titulos from "../../../i18n/rede/lei/titulos.json";

// A seção "Termos e privacidade" em Ajustes. Carregada só quando aparece. O aceite dos termos deixou de ser um cartão no alto do
// Início (que dava para pular): é a janela que bloqueia o uso (P5, A6; JanelaDosTermos.tsx, montada pela casca em Rede.tsx).
const AjustesDaLei = dynamic(() => import("./AjustesDaLei"), { ssr: false });
// A primeira vez na Alumia (P5, A12): o passeio de quatro passos e a lista de primeiros passos, no alto do Início.
const PrimeiraVez = dynamic(() => import("./PrimeiraVez"), { ssr: false });
// O aviso da troca do chat do beta (onda R2): a data antes, e a limpeza deste aparelho na primeira abertura do site novo. Fica aqui,
// com o reaceite, porque vale para todo mundo, com ou sem a flag do chat.
const AvisoDaTrocaNoInicio = dynamic(() => import("../avisos/AvisoDaTroca").then((m) => m.AvisoDaTrocaNoInicio), { ssr: false });

/**
 * Encaixe da frente 8B (lei e ajuda). Quem junta acrescenta `lei` à lista de components/rede/encaixes.tsx (import de "./lei/encaixe").
 * A seção de ajustes mostra a versão e quando a pessoa aceitou, com os links e o botão de rever os termos na janela.
 */
export const encaixe: Encaixe = {
  topoDaLinha: [AvisoDaTrocaNoInicio as React.ComponentType<ContextoDoEncaixe>, PrimeiraVez as React.ComponentType<ContextoDoEncaixe>],
  secoesDeAjustes: [{ chave: "lei", titulo: (ctx) => (titulos.ajustes as Record<string, string>)[ctx.lang] ?? titulos.ajustes.pt, Componente: AjustesDaLei as React.ComponentType<ContextoDoEncaixe> }],
};
