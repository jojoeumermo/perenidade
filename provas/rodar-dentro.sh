#!/bin/sh
# Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
#
# Roda DENTRO do contêiner (chamado por provas/rodar.sh): instala o ProVerif 2.05 pelo opam (se ainda não houver), roda cada
# modelo e cada controle, e devolve na saída padrão um tar com provas/resultados/ (um .txt por modelo: o arquivo, o SHA-256 do
# modelo rodado, a versão do ProVerif, o dia e as linhas RESULT). O andamento sai na saída de erro.
set -eu
cd "$(dirname "$0")"
if ! command -v proverif >/dev/null 2>&1; then
  eval "$(opam env)"
fi
if ! command -v proverif >/dev/null 2>&1; then
  echo "instalando o ProVerif 2.05 pelo opam..." >&2
  # A lista de pacotes do sistema da imagem envelhece: atualiza antes (o opam pede os pacotes do GTK que o ProVerif usa).
  sudo apt-get update -qq >&2
  opam install -y proverif.2.05 >&2
  eval "$(opam env)"
fi
versao=$(proverif --help 2>&1 | head -n 1 | sed 's/\. .*//')
dia=$(date -u +%F)
saida=$(mktemp -d)
mkdir -p "$saida/resultados/controles"
for f in *.pv controles/*.pv; do
  echo "== $f" >&2
  nome=${f%.pv}
  resumo=$(tr -d '\r' < "$f" | sha256sum | cut -d ' ' -f 1)
  {
    echo "modelo: $f"
    echo "sha256: $resumo"
    echo "verificador: $versao"
    echo "dia: $dia"
    echo
    proverif "$f" 2>&1 | grep -E '^RESULT|^A trace has been found|^Could not find a trace' || true
  } > "$saida/resultados/$nome.txt"
  grep '^RESULT' "$saida/resultados/$nome.txt" >&2 || true
done
tar cf - -C "$saida" resultados
