// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Alvo: as rotas da Alumia que recebem dados de fora SEM sessão (caixas anônimas, pedido de conversa, diretório, passes, voz e a
// porta de entrada). O que conta como falha está em scripts/ferramentas/fuzz/rotas-comum.mjs.
import crypto from "node:crypto";
import { alvoDeRotas } from "../rotas-comum.mjs";

const b64u = (b) => Buffer.from(b).toString("base64url");
const env = (n) => b64u(crypto.randomBytes(n));

export const { preparar, sementes, gerar, resumir, executar, relatorio, encerrar } = alvoDeRotas({
  rotas: [
    "caixa/lote", "caixa/buscar", "caixa/confirmar", "caixa/trocar", "caixa/apagar", "pedido", "pedido/desafio", "diretorio/ler",
    "diretorio/reivindicar", "passes/chave", "voz/retransmissao", "porta/desafio", "porta/convite", "porta/conta", "porta/entrar",
    "porta/aviso",
  ],
  soGet: ["pedido/desafio", "passes/chave"],
  // Uma caixa de verdade (criada pelo banco, com os resumos que a rota calcula), para os depósitos e as buscas irem ao fundo.
  async preparar(ctx) {
    const { resumo, ROTULOS } = await import("../../../../lib/rede/caixas/base.ts");
    const id = crypto.randomBytes(32), pd = crypto.randomBytes(32), pl = crypto.randomBytes(32);
    const b64 = (b) => Buffer.from(b).toString("base64");
    await ctx.amb.rpcComo("chave-de-servico-de-teste", "rede_caixa_lote", {
      p_itens: [{ acao: "criar", id_h: b64(resumo(ROTULOS.caixa, id)), pd_h: b64(resumo(ROTULOS.passeDeposito, pd)), pl_h: b64(resumo(ROTULOS.passeLeitura, pl)), multi: true, gastos: [b64(crypto.randomBytes(32))] }],
      p_dia: new Date().toISOString().slice(0, 10),
    });
    ctx.caixa = { id: b64u(id), pd: b64u(pd), pl: b64u(pl) };
  },
  sementes({ caixa }) {
    const cab = { "content-type": "application/json" };
    const passe = { ...cab, authorization: "PrivateToken token=AAAA" };
    return [
      { rota: "caixa/lote", cab, corpo: { itens: [{ acao: "depositar", id: caixa.id, pd: caixa.pd, envelope: env(3184) }] } },
      { rota: "caixa/lote", cab, corpo: { itens: [{ acao: "depositar", id: caixa.id, pd: caixa.pd, envelope: env(2098), franquia: env(32), unico: true }] } },
      { rota: "caixa/lote", cab: passe, corpo: { itens: [{ acao: "criar", id: env(32), pd_h: env(32), pl_h: env(32), multi: false }] } },
      { rota: "caixa/buscar", cab, corpo: { id: caixa.id, pl: caixa.pl, cursor: 0 } },
      { rota: "caixa/confirmar", cab, corpo: { id: caixa.id, pl: caixa.pl, ate: 1 } },
      { rota: "caixa/trocar", cab, corpo: { id: caixa.id, pl: caixa.pl, pd_h: env(32), bloqueio: false } },
      { rota: "caixa/apagar", cab, corpo: { id: env(32), pl: env(32) } },
      { rota: "pedido", cab: passe, corpo: { codinome: "Codinome ana", desafio: env(52), nonce: env(8), envelope: env(5232) } },
      { rota: "pedido/desafio", cab: {}, corpo: null },
      { rota: "passes/chave", cab: {}, corpo: null },
      { rota: "diretorio/ler", cab, corpo: { codinome: "Codinome ana" } },
      { rota: "diretorio/reivindicar", cab: passe, corpo: { codinome: "Codinome ana", tipo: "proteus" } },
      { rota: "voz/retransmissao", cab: passe, corpo: {} },
      { rota: "porta/desafio", cab, corpo: { momento: "conta" } },
      { rota: "porta/convite", cab, corpo: { codigo: env(16) } },
      { rota: "porta/conta", cab, corpo: { desafio: "conta.20.1767225600000.AAAAAAAAAAAAAAAAAAAAAA.x", resposta: "0", email: "a@b.c", senha: "senha-de-teste-longa", codinome: "Fulana", volta: "/alumia" } }, // gitleaks:allow (valor de teste)
      { rota: "porta/entrar", cab, corpo: { desafio: "entrar.20.1767225600000.AAAAAAAAAAAAAAAAAAAAAA.x", resposta: "0", email: "a@b.c", senha: "senha-de-teste-longa" } }, // gitleaks:allow (valor de teste)
      { rota: "porta/aviso", cab, corpo: { desafio: "aviso.20.1767225600000.AAAAAAAAAAAAAAAAAAAAAA.x", resposta: "0", tipo: "senha", email: "a@b.c", volta: "/alumia" } },
    ];
  },
});
