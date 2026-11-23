#!/bin/sh
# Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
#
# As regras do Semgrep da Alumia (.semgrep/*.yml): primeiro o teste das próprias regras (cada regra tem de achar o que está marcado
# "ruleid" no arquivo de teste e nada do que está marcado "ok"), depois a varredura do código, que falha com qualquer achado de
# gravidade ERROR. Roda dentro da imagem oficial do Semgrep, fixada pelo resumo, sem rede para fora além dela (--metrics=off):
#
#   docker run --rm --network none -v "$PWD:/src:ro" -w /src \
#     semgrep/semgrep:1.183.0@sha256:2e45517a85e13a9cca14a2a00df6bb48affd66b8ebfae1b0991cd57578362fb0 sh scripts/ferramentas/semgrep.sh
#
# No CI, o mesmo comando (.github/workflows/ferramentas.yml). Exceção no código só com "nosemgrep: <id>" e o motivo.
set -eu

semgrep --version
echo "== teste das regras (.semgrep)"
# O --test não entra em pasta que começa com ponto: as regras e os testes vão para uma cópia fora dela.
regras=$(mktemp -d)
cp .semgrep/* "$regras"/
semgrep --test --metrics=off --disable-version-check "$regras"
rm -rf "$regras"

echo "== varredura do código"
semgrep scan --metrics=off --disable-version-check --config .semgrep --error --severity ERROR \
  --exclude .semgrep --exclude node_modules --exclude .next --exclude public --exclude content --exclude historico \
  .
echo "== avisos (não barram)"
semgrep scan --metrics=off --disable-version-check --config .semgrep --severity WARNING \
  --exclude .semgrep --exclude node_modules --exclude .next --exclude public --exclude content --exclude historico \
  . || true
