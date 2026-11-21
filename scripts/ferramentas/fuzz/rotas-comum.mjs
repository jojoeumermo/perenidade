// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O fuzzing das rotas do site que recebem dados de fora (app/api/alumia/**): cada caso é um pedido HTTP (rota, cabeçalhos, corpo)
// montado a partir de um pedido bom e mutado, entregue à função da rota sem servidor, com o banco local atrás de um PostgREST de
// mentira (ambiente.mjs). Falha: exceção sem tratamento, resposta 5xx que não seja "sem serviço"/"rede", resposta que não é JSON, ou
// a rota entregar ao banco um valor que ele recusa por TIPO ou LIMITE (validação faltando: o banco é a última barreira, não a
// primeira; a resposta vira 502 em vez de 400).
import crypto from "node:crypto";
import { montarAmbiente } from "./ambiente.mjs";
import { classeDoErro } from "./classificar.mjs";
import { b64Quase, jsonQualquer, textoEstranho } from "./gerador.mjs";

/**
 * @param {{ rotas: string[], soGet?: string[], sementes: (ctx: any) => any[], comSessao?: boolean, preparar?: (ctx: any) => Promise<void> }} c
 */
export function alvoDeRotas(c) {
  const soGet = new Set(c.soGet ?? []);
  return {
    async preparar() {
      const amb = await montarAmbiente({ contas: ["ana", "bia"] });
      const importadas = await amb.importarRotas(c.rotas.map((r) => `alumia/${r}`));
      const rotas = Object.fromEntries(Object.entries(importadas).map(([k, v]) => [k.slice("alumia/".length), v]));
      const ctx = { amb, rotas, vistos: new Map() };
      await c.preparar?.(ctx);
      return ctx;
    },
    sementes: (ctx) => c.sementes(ctx),
    gerar(r, ctx) {
      const cab = { "content-type": r.chance(0.9) ? "application/json" : textoEstranho(r) };
      if (c.comSessao && r.chance(0.8)) cab.authorization = `Bearer conta.${ctx.amb.ids.ana}`;
      else if (r.chance(0.3)) cab.authorization = r.chance(0.5) ? `PrivateToken token=${b64Quase(r, r.escolher([0, 32, 300, 2000]))}` : textoEstranho(r);
      if (r.chance(0.7)) cab["sec-fetch-site"] = r.chance(0.9) ? "same-origin" : "cross-site";
      if (r.chance(0.1)) cab.cookie = r.chance(0.5) ? "sb-x-auth-token=1" : textoEstranho(r);
      return { rota: r.escolher(c.rotas), cab, corpo: jsonQualquer(r) };
    },
    resumir: (caso) => (typeof caso?.rota === "string" ? caso.rota : "rota mutada"),
    async executar(caso, ctx) {
      const rota = typeof caso?.rota === "string" && c.rotas.includes(caso.rota) ? caso.rota : c.rotas[0];
      const modulo = ctx.rotas[rota];
      const cabecalhos = new Headers();
      for (const [k, v] of Object.entries(caso?.cab && typeof caso.cab === "object" ? caso.cab : {})) {
        try {
          cabecalhos.set(String(k), String(v));
        } catch {
          // nome ou valor de cabeçalho que o próprio fetch recusa: o pedido não chegaria assim
        }
      }
      // Uma rede diferente a cada pedido: o freio por rede (na memória) não pode virar o único caminho testado.
      cabecalhos.set("x-forwarded-for", `10.${crypto.randomInt(256)}.${crypto.randomInt(256)}.${crypto.randomInt(256)}`);
      const metodo = soGet.has(rota) ? "GET" : "POST";
      const corpo = metodo === "GET" ? undefined : typeof caso?.corpo === "string" ? caso.corpo : JSON.stringify(caso?.corpo ?? null);
      ctx.amb.errosDoBanco.length = 0;
      const resposta = await modulo[metodo](new Request(`http://alumia.test/api/alumia/${rota}`, { method: metodo, headers: cabecalhos, body: corpo }));
      const texto = await resposta.text();
      let json = null;
      try {
        json = JSON.parse(texto);
      } catch {
        return { falha: { tipo: "nao_json", assinatura: `${rota}: resposta ${resposta.status} não é JSON` } };
      }
      const erro = String(json?.erro ?? json?.motivo ?? "");
      const vistos = ctx.vistos.get(rota) ?? new Set();
      vistos.add(`${resposta.status} ${erro.slice(0, 30)}`);
      ctx.vistos.set(rota, vistos);
      if (resposta.status >= 500 && !(resposta.status === 503 || (resposta.status === 502 && /rede|servico|indispon/.test(erro)))) {
        return { falha: { tipo: "status_5xx", assinatura: `${rota}: ${resposta.status} ${erro.slice(0, 60)}` } };
      }
      for (const e of ctx.amb.errosDoBanco) {
        const classe = classeDoErro({ code: e.codigo, message: e.mensagem });
        if (classe === "grave" || classe === "tipo") {
          return { falha: { tipo: classe === "grave" ? "banco_grave" : "passou_da_rota", assinatura: `${rota} → ${e.funcao}: ${e.codigo} ${e.mensagem.replace(/\d+/g, "N").slice(0, 100)}` } };
        }
      }
      return { caminho: `${rota}:${resposta.status}:${erro.slice(0, 40)}:${ctx.amb.errosDoBanco.map((e) => e.codigo).join(",")}` };
    },
    /** As respostas diferentes que cada rota deu (status e motivo): mostra até onde o fuzzing chegou. */
    relatorio: (ctx) => Object.fromEntries([...ctx.vistos].map(([k, v]) => [k, [...v].sort()])),
    encerrar: (ctx) => ctx.amb.fechar(),
  };
}
