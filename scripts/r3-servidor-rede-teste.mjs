// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A "rede de teste" da prova em contêiner do servidor do chat separado (scripts/r3-servidor-conteiner.mjs): só a rota PÚBLICA da chave
// dos passes da semana (GET /api/alumia/passes/chave?semana=<n> → {semana, id, publica}, o mesmo JSON da rota do site), que é a única
// coisa que o servidor do chat pede à rede social. As chaves públicas vêm de R3_CHAVES ({"<semana>": {"id": …, "publica": …}}), sorteadas
// pelo teste a cada rodada. Sem dependência nenhuma: roda no node oficial, só leitura, sem privilégios. Não é usado fora do teste.
import http from "node:http";

const chaves = JSON.parse(process.env.R3_CHAVES ?? "{}");
const responder = (res, status, corpo) => {
  res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  res.end(JSON.stringify(corpo));
};

http
  .createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://rede-teste");
    if (req.method !== "GET" || url.pathname !== "/api/alumia/passes/chave") return responder(res, 404, { ok: false });
    const semana = url.searchParams.get("semana") ?? "";
    const c = /^\d{1,7}$/.test(semana) ? chaves[semana] : undefined;
    if (!c) return responder(res, 404, { ok: false, erro: "nao_encontrada" });
    return responder(res, 200, { semana: Number(semana), id: c.id, publica: c.publica, seq: 1 });
  })
  .listen(8080, "0.0.0.0");
