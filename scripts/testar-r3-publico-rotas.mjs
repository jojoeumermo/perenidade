// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os casos que o fuzzing das rotas achou (onda R3, parte 4), refeitos um a um pelo mesmo caminho do fuzzing
// (scripts/ferramentas/fuzz/alvos/*): cada um falhava antes da correção e tem de passar agora. Os cinco achados:
//   1. caixa/buscar e caixa/confirmar: cursor/ate acima do integer do Postgres (2^53, 1e21, 1e308) chegavam ao banco (erro de tipo, 502);
//   2. diretorio/ler: codinome com o byte zero chegava ao banco (erro de codificação, 502);
//   3. conta (código de uso único): código com o byte zero chegava ao banco;
//   4. redacao/corrigir: ficha com \u0000 num texto chegava ao jsonb;
//   5. redacao/afastar: denúncia que não existe respondia 502 em vez de 404.
// Uso: node --import ./scripts/carregar-ts.mjs scripts/testar-r3-publico-rotas.mjs
// As rotas leem o endereço do banco ao carregar: cada grupo (anônimas, com sessão) roda num processo seu, com um ambiente só.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import * as anonimas from "./ferramentas/fuzz/alvos/rotas-anonimas.mjs";
import * as comSessao from "./ferramentas/fuzz/alvos/rotas-com-sessao.mjs";

let falhas = 0;
const ok = (nome, cond, detalhe = "") => {
  if (cond) console.log(`  ok    ${nome}`);
  else {
    falhas++;
    console.log(`  FALHA ${nome}${detalhe ? `\n        ${detalhe}` : ""}`);
  }
};

const ID = "xcRxdPXk7BGoI2DoYTQK4i-bb7HZFYDf9MXo9FNgXWc"; // gitleaks:allow (valor de teste)
const PL = "mwD9rTW0FIpz7GqIUbx4HfH6hAaoOiTXvP13OhK8g1s"; // gitleaks:allow (valor de teste)
const json = { "content-type": "application/json" };

// Cada item: [caso, status esperado].
async function refazer(alvo, nome, casos) {
  const ctx = await alvo.preparar();
  try {
    for (const [caso, esperado] of casos(ctx)) {
      const r = await alvo.executar(caso, ctx);
      const [, status] = String(r?.caminho ?? "").split(":");
      ok(`${nome}: ${caso.rota} ${JSON.stringify(caso.corpo).slice(-60)} → ${esperado}`, !r?.falha && status === esperado, r?.falha ? `${r.falha.tipo}: ${r.falha.assinatura}` : `status ${status}`);
    }
  } finally {
    await alvo.encerrar(ctx);
  }
}

const grupo = process.argv[2];
if (grupo === "anonimas") {
  console.log("1-2. rotas anônimas (recusa antes do banco; o maior integer ainda passa)");
  await refazer(anonimas, "anônima", () => [
    [{ rota: "caixa/buscar", cab: json, corpo: { id: ID, pl: PL, cursor: 1e21 } }, "400"],
    [{ rota: "caixa/buscar", cab: json, corpo: { id: ID, pl: PL, cursor: 9007199254740994 } }, "400"],
    [{ rota: "caixa/buscar", cab: json, corpo: { id: ID, pl: PL, cursor: 2147483648 } }, "400"],
    [{ rota: "caixa/confirmar", cab: json, corpo: { id: ID, pl: PL, ate: 9007199254740994 } }, "400"],
    [{ rota: "caixa/confirmar", cab: json, corpo: { id: ID, pl: PL, ate: 1e308 } }, "400"],
    [{ rota: "caixa/confirmar", cab: json, corpo: { id: ID, pl: PL, ate: 2147483648 } }, "400"],
    [{ rota: "diretorio/ler", cab: {}, corpo: { codinome: "a\u0000b" } }, "400"],
    [{ rota: "diretorio/ler", cab: json, corpo: { codinome: "Codinome\u0000ana" } }, "400"],
    // O limite não pode ter apertado o caso bom: o maior integer passa (caixa que não existe responde lista vazia, 200).
    [{ rota: "caixa/buscar", cab: json, corpo: { id: ID, pl: PL, cursor: 2147483647 } }, "200"],
    [{ rota: "caixa/confirmar", cab: json, corpo: { id: ID, pl: PL, ate: 2147483647 } }, "200"],
  ]);
} else if (grupo === "com-sessao") {
  console.log("3-5. rotas com sessão");
  const comConta = (ctx) => ({ "content-type": "application/json", "sec-fetch-site": "same-origin", authorization: `Bearer conta.${ctx.amb.ids.ana}` });
  await refazer(comSessao, "com sessão", (ctx) => [
    [{ rota: "conta", cab: comConta(ctx), corpo: { acao: "codigo", codigo: "abcd\u0000efgh" } }, "400"],
    [{ rota: "redacao/corrigir", cab: comConta(ctx), corpo: { leitura: "7a5f59a3-114a-4218-b129-131d95afd217", ficha: { nota: "a\u0000b" } } }, "400"],
    [{ rota: "redacao/afastar", cab: comConta(ctx), corpo: { denuncia: "2ef560aa-05e8-4113-8bd1-f611862af758" } }, "404"],
    // Falso positivo do próprio fuzzing (o PostgREST de mentira lia "\x00ff" como bytes num parâmetro text): agora chega como texto,
    // o banco diz que o código não serve (resposta 200 com ok: false, como qualquer código errado) e não há erro de codificação.
    [{ rota: "conta", cab: comConta(ctx), corpo: { acao: "codigo", codigo: String.raw`\x00ff` } }, "200"],
  ]);
} else {
  for (const g of ["anonimas", "com-sessao"]) {
    const r = spawnSync(process.execPath, [...process.execArgv, fileURLToPath(import.meta.url), g], { stdio: "inherit" });
    if (r.status !== 0) falhas++;
  }
  console.log(`\n${falhas ? `${falhas} grupo(s) com falha` : "tudo ok"}`);
  process.exit(falhas ? 1 : 0);
}
process.exit(falhas ? 1 : 0);
