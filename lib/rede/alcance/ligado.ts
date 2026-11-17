// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O interruptor da frente 13C (sair da Alumia: arte em PNG, QR, RSS, cartão para colar em outro site, levar e trazer quem eu
// sigo). Tudo atrás de "rede-v2" + "alumia-2" + "alumia-alcance". O nome fica só pelo nome: enquanto a junção não o põe em
// lib/recursos.ts (RECURSOS e SO_PELO_NOME), ele só liga com o nome escrito na variável de montagem, nunca por "todos". Depois
// dela, vale a regra de todos os recursos (variável e painel). Sem "@/" de propósito (roda nos testes).
import { lerRecursos, ligado, SO_PELO_NOME, type Recurso } from "../../recursos";
import { alumia2Ligada } from "../rotas-novas";

export const RECURSO_DO_ALCANCE = "alumia-alcance";

/**
 * O que sai da Alumia aparece nesta montagem? `lista` e `conhecidos` existem para o teste (com `lista`, a Alumia nova não é
 * conferida). Desligado: o encaixe fica vazio e as rotas do RSS e do cartão respondem 404.
 */
export function alcanceLigado(lista?: Set<string>, conhecidos: readonly string[] = SO_PELO_NOME): boolean {
  if (!lista && !alumia2Ligada()) return false;
  if (conhecidos.includes(RECURSO_DO_ALCANCE)) return ligado(RECURSO_DO_ALCANCE as Recurso, lista);
  const base = lista ?? lerRecursos(process.env.NEXT_PUBLIC_RECURSOS);
  return base.has(RECURSO_DO_ALCANCE) && !base.has(`-${RECURSO_DO_ALCANCE}`);
}
