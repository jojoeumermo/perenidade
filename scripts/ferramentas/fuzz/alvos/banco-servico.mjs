// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Alvo: toda função de `public` que só o papel `service_role` executa (as rotas do site chamam com a chave de serviço e repassam o
// que chegou de fora: caixas, pedidos, passes, franquia, porta), com argumentos sorteados (scripts/ferramentas/fuzz/banco-comum.mjs).
// Aqui a lista é só a das funções que anon e authenticated NÃO executam (as outras já estão nos dois alvos de cima).
import { alvoDoBanco } from "../banco-comum.mjs";

export const { preparar, sementes, gerar, resumir, completar, executar, relatorio, encerrar } = alvoDoBanco("service_role", { soServico: true });
