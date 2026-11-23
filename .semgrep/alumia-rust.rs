// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Arquivo de TESTE das regras de alumia-rust.yml (semgrep --test .semgrep). Não é código de nenhum crate.

fn sorteio() -> u64 {
    // ruleid: alumia-rust-sorteio-com-semente
    let mut r = StdRng::seed_from_u64(7);
    r.next_u64()
}

fn atender(corpo: &[u8]) {
    // ruleid: alumia-rust-sem-log-de-corpo
    println!("corpo {:?}", corpo);
}

fn conferir(recebido: &str, esperado_token: &str) -> bool {
    let token = recebido;
    // ruleid: alumia-rust-comparacao-de-segredo
    token == esperado_token
}

fn rota(acao: &str, n: usize) -> bool {
    // ok: alumia-rust-comparacao-de-segredo
    let curto = n == 0;
    // ok: alumia-rust-comparacao-de-segredo
    curto || acao == "pedido"
}

fn conferir_marca(recebida: &[u8], marca: &str) -> bool {
    // ruleid: alumia-rust-comparacao-de-segredo
    recebida == marca.as_bytes()
}
