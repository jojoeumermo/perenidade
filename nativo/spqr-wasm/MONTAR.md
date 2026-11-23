# O SPQR em WebAssembly: como montar e conferir

Este crate expõe o **SPQR do Signal** (Sparse Post-Quantum Ratchet, o "triple ratchet"; crate `spqr` **v1.7.0**, commit
`3a69df8f01179fce970693f072b710a8ab8dc6c2`, AGPL-3.0-only) em funções C para WebAssembly. É a camada pós-quântica da conversa a
dois da Alumia (documento: `docs/rede/CHAT-PRIVADO.md`, "A camada pós-quântica"). Nada de cifra própria: só a cola de bytes.

O arquivo que o site e os apps carregam é `spqr-1.7.0.wasm`, nesta pasta. O código que o carrega (`lib/rede/chat/r3/spqr.ts`)
confere o sha256 dele antes de usar; o build de referência dá:

```
f09b59f4060ef17ffbd81668b3e1f992c82239ceea140410097bca444b1a04c9  spqr-1.7.0.wasm
```

## Refazer o build de referência (qualquer pessoa)

Precisa só de Docker. Na raiz desta pasta:

```sh
docker run --rm -v "$PWD":/alumia -w /alumia \
  rust:1.99.0-bookworm@sha256:114c7a4425406451c2866b6aafe69fe29b1b298832db1277d411ac73c82d04d6 bash montar.sh
```

O `montar.sh` baixa o `protoc` 36.2 do lançamento oficial (sha256 conferido contra o publicado no GitHub), monta com `--locked`
(as versões do `Cargo.lock`), com os caminhos da máquina remapeados, e imprime o sha256. Duas montagens em pastas diferentes dão o
mesmo arquivo. O resultado tem de ser igual ao número acima; se não for, o arquivo do repositório não é o deste código.

**Limite conhecido:** o build no Windows (mesmo Rust, mesmo `protoc`) dá outro binário (o ligador e os caminhos diferem). Por isso o
binário de referência é o do contêiner Linux, fixado pelo digest da imagem.

## Testes

- `cargo test --locked` (ida e volta de 200 mensagens; mensagem repetida não dá a chave de novo);
- `cargo clippy --locked --all-targets -- -D warnings`;
- o build de TESTE (`--features teste`) exporta também o ML-KEM-768 do `libcrux` com sorteio dado, só para conferir os vetores do
  FIPS 203 contra outra implementação (`scripts/testar-r3-pq-vetores.mjs`). Ele nunca vai para o site:

```sh
cargo build --release --locked --target wasm32-unknown-unknown --features teste --target-dir target/teste
```

(O `--cfg getrandom_backend="custom"` vem de `.cargo/config.toml`; o sorteio do módulo é o `crypto.getRandomValues` do JavaScript.)

## Contrato com o JavaScript

| Função | Entrada | Saída |
|---|---|---|
| `reservar(n)` / `soltar(p, n)` | memória para a entrada (o JS zera antes de soltar) | |
| `inicial(direcao, chave, n)` | 0 = A2B (quem começa), 1 = B2A; auth_key de 32 bytes | o estado |
| `enviar(estado, n, semente32)` | estado e 32 bytes sorteados pelo JS (para o `ChaCha20Rng` do `spqr::send`) | `[estado][mensagem][chave]` |
| `receber(estado, n, msg, m)` | | `[estado][chave]` |
| `saida_ptr()`, `saida_len()`, `limpar()` | | a última saída; `limpar` zera e solta |

Cada campo da saída é `u32` (little-endian) + bytes. Retorno 0 = certo; -1 = o `spqr` recusou (estado ou mensagem inválida, versão
abaixo da mínima, chave já pedida, salto grande demais). Versão V1 com mínima V1: uma mensagem sem a parte pós-quântica é recusada pelo
próprio `spqr`.
