# Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
#
# A imagem do servidor do chat separado (alumia-chat). Duas etapas, as duas com a imagem fixada pelo resumo:
#   1. monta com o Rust oficial (a mesma versão do rust-toolchain.toml), com --locked;
#   2. roda num Debian mínimo, como usuário sem privilégios, só com o binário e os certificados das autoridades (para falar HTTPS com
#      a rota pública da chave dos passes).
# Rodar assim (o roteiro de implantação diz o resto): usuário sem privilégios, sistema de arquivos só de leitura, sem nenhuma
# capacidade do kernel, sem ganhar privilégio, e numa rede interna só com o banco do chat e a borda:
#   docker run --read-only --cap-drop ALL --security-opt no-new-privileges --user 10001:10001 --network <rede interna> \
#     -e CHAT_BANCO_URL=… -e CHAT_FRANQUIA_SEGREDO=… -e CHAT_INTERFACE_TOKEN=… -e CHAT_PASSES_CHAVE_URL=… alumia-chat

FROM rust:1.99.0-bookworm@sha256:114c7a4425406451c2866b6aafe69fe29b1b298832db1277d411ac73c82d04d6 AS montagem
WORKDIR /alumia
COPY Cargo.toml Cargo.lock rust-toolchain.toml ./
COPY src ./src
ENV RUSTFLAGS="--remap-path-prefix=/alumia=/alumia --remap-path-prefix=/usr/local/cargo=/cargo" \
    CARGO_INCREMENTAL=0 \
    SOURCE_DATE_EPOCH=0
RUN cargo build --release --locked && strip target/release/alumia-chat

FROM debian:bookworm-slim@sha256:734a72b3d6142a71993b4bc580ca01d8ca687f77a2c422d96a961d3376b179bc
COPY --from=montagem /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt
COPY --from=montagem /alumia/target/release/alumia-chat /usr/local/bin/alumia-chat
USER 10001:10001
ENV SSL_CERT_FILE=/etc/ssl/certs/ca-certificates.crt
EXPOSE 8080
ENTRYPOINT ["/usr/local/bin/alumia-chat"]
