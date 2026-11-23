// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Alvo: toda função de `public` que o papel `anon` executa (qualquer pessoa, pela API, sem conta), com argumentos sorteados
// (scripts/ferramentas/fuzz/banco-comum.mjs).
import { alvoDoBanco } from "../banco-comum.mjs";

export const { preparar, sementes, gerar, resumir, completar, executar, relatorio, encerrar } = alvoDoBanco("anon");
