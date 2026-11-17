// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os interruptores da frente 13E (pontes). O resumo das comunidades, os robôs e o Mural dos Trabalhadores vêm com as organizações
// ("rede-v2" + "alumia-2" + "alumia-org"). A tradução fica atrás de "alumia-traducao" e o Telegram atrás de "alumia-telegram",
// os dois só pelo nome e desligados: enquanto a junção não põe os nomes em lib/recursos.ts (RECURSOS e SO_PELO_NOME), eles só
// ligam com o nome escrito na variável de montagem, nunca por "todos". No banco, os dois também precisam estar ligados no painel
// (interno.alumia_pontes_ligado). Sem "@/" de propósito.
import { lerRecursos, ligado, SO_PELO_NOME, type Recurso } from "../../recursos";
import { alumia2Ligada } from "../rotas-novas";

export const RECURSO_DA_TRADUCAO = "alumia-traducao";
export const RECURSO_DO_TELEGRAM = "alumia-telegram";

/** Um recurso só pelo nome: depois da junção, a regra de todos (variável e painel); antes, só o nome escrito na variável. */
export function soPeloNomeLigado(nome: string, lista?: Set<string>, conhecidos: readonly string[] = SO_PELO_NOME): boolean {
  if (conhecidos.includes(nome)) return ligado(nome as Recurso, lista);
  const base = lista ?? lerRecursos(process.env.NEXT_PUBLIC_RECURSOS);
  return base.has(nome) && !base.has(`-${nome}`);
}

/** Robôs, resumo das comunidades e mural: com as organizações da Alumia nova. */
export function pontesLigadas(): boolean {
  return alumia2Ligada() && ligado("alumia-org");
}

/** O botão "Traduzir" pode existir nesta montagem (o servidor ainda precisa ter o endereço do tradutor). */
export function traducaoLigada(lista?: Set<string>): boolean {
  if (!lista && !alumia2Ligada()) return false;
  return soPeloNomeLigado(RECURSO_DA_TRADUCAO, lista);
}

/** A parte do Telegram aparece nesta montagem (o servidor ainda precisa ter o token). */
export function telegramLigado(lista?: Set<string>): boolean {
  if (!lista && !pontesLigadas()) return false;
  return soPeloNomeLigado(RECURSO_DO_TELEGRAM, lista);
}
