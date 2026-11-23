// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O que conta como falha num alvo de fuzzing do banco ou das rotas.
//   - grave: erro interno do Postgres (classe XX), falta de recurso (53), pilha estourada (54001), erro do sistema (58),
//     o WebAssembly do banco local caindo (RuntimeError) e qualquer erro sem código SQLSTATE vindo do banco;
//   - passou da rota: a rota entregou ao banco um valor que ele recusou por TIPO ou LIMITE (classe 22, 42804) em vez de recusar antes
//     com 400. Não derruba nada, mas é validação faltando na rota (e responde 502 em vez de 400).
// As recusas de propósito (raise da função: P0001; permissão: 42501; dado que não existe: 23xxx de chave) não são falha.

/** A classe de um erro do banco: "grave", "tipo" (dado malformado recusado pelo Postgres) ou "recusa" (de propósito). */
export function classeDoErro(erro) {
  const codigo = typeof erro?.code === "string" ? erro.code : null;
  if (!codigo) return /RuntimeError|unreachable|memory access out of bounds|Aborted/i.test(String(erro?.message ?? erro)) ? "grave" : "desconhecido";
  const c = codigo.slice(0, 2);
  if (["XX", "53", "58"].includes(c) || codigo === "54001") return "grave";
  // 54000 é o Postgres recusando uma lista com limites fora do inteiro ao LER o valor (antes de a função rodar): tipo, não queda.
  if (c === "22" || c === "54" || codigo === "42804" || codigo === "2202E") return "tipo";
  return "recusa";
}

/** Assinatura curta de um erro (código + começo da mensagem sem números nem ids), para juntar as repetidas. */
export function assinaturaDoErro(onde, erro) {
  const msg = String(erro?.message ?? erro)
    .split("\n")[0]
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "<uuid>")
    .replace(/"[^"]{0,200}"/g, "\"…\"")
    .replace(/\d+/g, "N")
    .slice(0, 140);
  return `${onde}: ${erro?.code ?? "?"} ${msg}`;
}
