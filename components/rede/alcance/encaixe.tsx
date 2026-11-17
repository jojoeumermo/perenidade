// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import dynamic from "next/dynamic";
import { alcanceLigado } from "@/lib/rede/alcance/ligado";
import { rotaNovaLigada } from "@/lib/rede/rotas-novas";
import type { ContextoDoEncaixe, Encaixe } from "../encaixes";

/**
 * Encaixe da frente 13C (sair da Alumia). Tudo atrás de "rede-v2" + "alumia-2" + "alumia-alcance" (lib/rede/alcance/ligado.ts);
 * desligado, o encaixe fica vazio e as rotas do RSS e do cartão respondem 404.
 *
 *   acoesDoCartao     "Levar para fora" no menu "mais" do cartão: a arte em PNG, o QR do ato (ou do post) e o código do cartão para
 *                     colar em outro site (só quando o banco deixa o post sair);
 *   abasDaComunidade  a aba "Levar": o QR da comunidade e o RSS dela (só comunidade aberta);
 *   secoesDeAjustes   "Levar e trazer": o caminho para /alumia/listas (quem eu sigo, o QR e o RSS do perfil), quando a rota abre.
 *
 * A tela /alumia/listas é o TelaDasListas desta pasta (já no registro). Nenhuma peça mostra lista de pessoas de outra conta nem
 * número de quem seguiu, viu ou curtiu.
 */
const LIGADO = alcanceLigado();
const ROTULO_DA_ABA: Record<string, string> = { pt: "Levar", en: "Share", es: "Llevar", fr: "Emporter", ru: "Наружу", zh: "外带" };
const TITULO_DOS_AJUSTES: Record<string, string> = { pt: "Levar e trazer", en: "Take and bring", es: "Llevar y traer", fr: "Emporter et ramener", ru: "Унести и принести", zh: "带走与带来" };

const LevarParaFora = dynamic(() => import("./LevarParaFora").then((m) => m.LevarParaFora), { ssr: false });
const AbaLevar = dynamic(() => import("./AbaLevar"), { ssr: false });
const SecaoNosAjustes = dynamic(() => import("./SecaoNosAjustes"), { ssr: false });

export const encaixe: Encaixe = !LIGADO ? {} : {
  acoesDoCartao: [LevarParaFora],
  abasDaComunidade: [{ chave: "levar", rotulo: ({ lang }) => ROTULO_DA_ABA[lang] ?? ROTULO_DA_ABA.pt, Componente: AbaLevar }],
  secoesDeAjustes: rotaNovaLigada("listas")
    ? [{ chave: "levar-e-trazer", titulo: ({ lang }) => TITULO_DOS_AJUSTES[lang] ?? TITULO_DOS_AJUSTES.pt, Componente: SecaoNosAjustes as React.ComponentType<ContextoDoEncaixe> }]
    : [],
};
