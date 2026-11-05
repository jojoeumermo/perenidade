#!/usr/bin/env bash
# Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
#
# Lista as gravações que o Galène guardou (pasta dados/recordings), da mais nova para a mais velha, com o tamanho.
# Depois de cada aula: baixe o arquivo (scp), suba no PeerTube ou no YouTube do instituto e cole o link no campo
# "Gravação" da aula, no painel. Para apagar as que já subiram: rm dados/recordings/<arquivo>.
set -euo pipefail
cd "$(dirname "$0")"
if [ -z "$(find dados/recordings -type f 2>/dev/null | head -1)" ]; then
  echo "Nenhuma gravação ainda."
  exit 0
fi
find dados/recordings -type f -printf '%TY-%Tm-%Td %TH:%TM  %10s bytes  %p\n' | sort -r
df -h dados/recordings | tail -1 | awk '{print "Disco: " $3 " usados de " $2 " (" $5 ")"}'
