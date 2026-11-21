// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Arquivo de TESTE das regras de alumia-ts.yml (semgrep --test .semgrep): cada "ruleid" marca a linha seguinte que a regra tem de
// achar; cada "ok", a que ela não pode achar. Não é código do site (não é importado por nada).

// ruleid: alumia-sem-math-random-na-rede
export const sorteioRuim = Math.random();
// ok: alumia-sem-math-random-na-rede
export const sorteioBom = crypto.getRandomValues(new Uint8Array(8));

export async function caixas() {
  // ruleid: alumia-caixas-sem-credenciais
  await fetch("/api/alumia/caixa/buscar", { method: "POST", credentials: "include", body: "{}" });
  // ruleid: alumia-caixas-sem-credenciais
  await fetch("/api/alumia/caixa/buscar", { method: "POST", credentials: "same-origin" });
  // ok: alumia-caixas-sem-credenciais
  await fetch("/api/alumia/caixa/buscar", { method: "POST", credentials: "omit", body: "{}" });
}

export function rota(corpo: unknown) {
  // ruleid: alumia-rota-anonima-sem-log
  console.log("pedido", corpo);
  // ruleid: alumia-rota-anonima-sem-log
  console.error(corpo);
  return corpo;
}

export function guardar(par: { privada: Uint8Array; publica: Uint8Array }, s: { segredo: string }) {
  // ruleid: alumia-sem-token-no-armazenamento-aberto
  localStorage.setItem("chave", JSON.stringify(par.privada));
  // ruleid: alumia-sem-token-no-armazenamento-aberto
  sessionStorage.setItem("s", s.segredo);
  // ok: alumia-sem-token-no-armazenamento-aberto
  localStorage.setItem("publica", JSON.stringify(par.publica));
}
