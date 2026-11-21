#!/bin/sh
# Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
#
# Roda as provas formais da Alumia (ProVerif 2.05) num contêiner descartável e grava a saída em provas/resultados/.
# Precisa só do Docker. A imagem é a oficial do OCaml com o opam, fixada pelo resumo; o ProVerif vem do repositório oficial do
# opam, na versão exata. Nada fica rodando: o contêiner some no fim.
# Uso (na raiz do repositório):  sh provas/rodar.sh
# Depois: npm run testar:r3-provas  (confere que os resultados são do modelo de agora e batem com provas/esperado.json).
set -eu
IMAGEM="ocaml/opam:debian-12-ocaml-5.3@sha256:bbaac53e502f6602013d8967c3a54cfcb898b556f453ab72e8e23966c3c681df"
AQUI=$(cd "$(dirname "$0")" && pwd)
# Os modelos vão para dentro por um tar (sem montar pasta: nada de permissão de arquivo entre o contêiner e esta máquina), e os
# resultados voltam do mesmo jeito.
tar cf - -C "$AQUI" rodar-dentro.sh $(cd "$AQUI" && ls *.pv controles/*.pv) \
  | docker run --rm -i "$IMAGEM" sh -c 'mkdir -p /tmp/provas && tar xf - -C /tmp/provas && sh /tmp/provas/rodar-dentro.sh' \
  | tar xf - -C "$AQUI"
echo "pronto: $AQUI/resultados"
