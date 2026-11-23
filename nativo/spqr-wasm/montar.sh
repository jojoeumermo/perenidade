#!/usr/bin/env bash
# Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
#
# O build de REFERÊNCIA do SPQR em WebAssembly (o arquivo spqr-1.7.0.wasm que vai para o site e para os apps). Roda DENTRO do
# contêiner oficial do Rust, fixado pelo digest, com esta pasta montada em /alumia:
#
#   docker run --rm -v "$PWD":/alumia -w /alumia \
#     rust:1.99.0-bookworm@sha256:114c7a4425406451c2866b6aafe69fe29b1b298832db1277d411ac73c82d04d6 bash montar.sh
#
# Sem rede além do necessário: o protoc oficial (conferido pelo sha256 publicado no lançamento) e as dependências do Cargo.lock
# (--locked). O mesmo commit dá o mesmo arquivo: o sha256 sai no fim e o CI compara com o que está no repositório. Roteiro inteiro:
# nativo/spqr-wasm/MONTAR.md.
set -euo pipefail

PROTOC_VERSAO=36.2
PROTOC_SHA256=121f6c7afe1d4d0e3ea6aab9432038599250134cbf4474cb1167d2c7decd4278
PROTOC_URL="https://github.com/protocolbuffers/protobuf/releases/download/v${PROTOC_VERSAO}/protoc-${PROTOC_VERSAO}-linux-x86_64.zip"

if [ "$(pwd)" != "/alumia" ]; then
  echo "rode dentro do contêiner, com esta pasta em /alumia (veja MONTAR.md)" >&2
  exit 1
fi

trabalho="$(mktemp -d)"
curl -fsSL "$PROTOC_URL" -o "$trabalho/protoc.zip"
echo "${PROTOC_SHA256}  $trabalho/protoc.zip" | sha256sum -c -
python3 -c 'import sys, zipfile; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])' "$trabalho/protoc.zip" "$trabalho/protoc"
chmod +x "$trabalho/protoc/bin/protoc"
export PROTOC="$trabalho/protoc/bin/protoc"

rustup target add wasm32-unknown-unknown >/dev/null

# Os caminhos da máquina não entram no binário (o código vem de /alumia e de /usr/local/cargo, os dois remapeados).
export RUSTFLAGS='--cfg getrandom_backend="custom" --remap-path-prefix=/alumia=/alumia --remap-path-prefix=/usr/local/cargo=/cargo'
export SOURCE_DATE_EPOCH=0
export CARGO_TARGET_DIR=/alumia/target/referencia
cargo build --release --locked --target wasm32-unknown-unknown

cp "$CARGO_TARGET_DIR/wasm32-unknown-unknown/release/alumia_spqr_wasm.wasm" /alumia/spqr-1.7.0.wasm
sha256sum /alumia/spqr-1.7.0.wasm
