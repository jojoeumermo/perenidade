// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Alvo: as rotas da Alumia que recebem dados de fora COM a sessão de uma conta aprovada (passes, denúncia com prova, votos sem marca,
// impressão de rede, passe da porta, conta segura, redação). O que conta como falha está em scripts/ferramentas/fuzz/rotas-comum.mjs.
import crypto from "node:crypto";
import { alvoDeRotas } from "../rotas-comum.mjs";

const env = (n) => Buffer.from(crypto.randomBytes(n)).toString("base64url");

export const { preparar, sementes, gerar, resumir, executar, relatorio, encerrar } = alvoDeRotas({
  comSessao: true,
  rotas: ["passes/emitir", "franquia/denunciar", "voto/marca", "impressao", "porta/pedido", "conta", "redacao/afastar", "redacao/corrigir"],
  sementes({ amb }) {
    const cab = { "content-type": "application/json", "sec-fetch-site": "same-origin", authorization: `Bearer conta.${amb.ids.ana}` };
    const uuid = () => crypto.randomUUID();
    return [
      { rota: "passes/emitir", cab, corpo: { lote: env(30 * 97) } },
      { rota: "franquia/denunciar", cab, corpo: { categoria: "assedio", autor: "fz_bia", trechos: [{ texto: "um trecho", prova: env(200) }] } },
      { rota: "voto/marca", cab, corpo: { tipo: "enquete", post: uuid(), opcoes: [uuid()] } },
      { rota: "voto/marca", cab, corpo: { tipo: "bem_estar", nivel: 3 } },
      { rota: "voto/marca", cab, corpo: { tipo: "critica", texto: "uma crítica", para: "coordenacao" } },
      { rota: "voto/marca", cab, corpo: { tipo: "equipe", votacao: uuid(), cedula: `v2.${env(1672)}` } },
      { rota: "voto/marca", cab, corpo: { tipo: "equipe_ver", votacoes: [uuid()] } },
      { rota: "voto/marca", cab, corpo: { tipo: "story", story: uuid(), opcao: 0 } },
      { rota: "impressao", cab, corpo: { momento: "entrada" } },
      { rota: "porta/pedido", cab, corpo: { desafio: "pedido.20.1767225600000.AAAAAAAAAAAAAAAAAAAAAA.x", resposta: "0" } },
      { rota: "conta", cab, corpo: { acao: "outros" } },
      { rota: "conta", cab, corpo: { acao: "codigo", codigo: "abcd-efgh" } },
      { rota: "redacao/afastar", cab, corpo: { denuncia: uuid() } },
      { rota: "redacao/corrigir", cab, corpo: { leitura: uuid(), ficha: { nota: 3 } } },
    ];
  },
});
