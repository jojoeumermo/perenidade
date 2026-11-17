#!/usr/bin/env bash
# Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
#
# Cutuca a fila de entrega do Fediverso da Alumia: POST em /api/fediverso/entregar no contêiner do site, tentando cada porta
# de SITE_PORTAS até uma responder. O pedido não leva segredo: a rota só entrega o que já está na fila. 200 e 404 (federação
# desligada) saem em silêncio; 429 quer dizer que a fila já está andando. Falha em todas as portas: sai com erro.
set -u
HOST=alumia.institutolucia.org
SITE_PORTAS=${SITE_PORTAS:-3001 3002}
respostas=""

for porta in $SITE_PORTAS; do
  # Sem resposta, o curl escreve 000. A rota trabalha por até 60 s; damos 75.
  codigo=$(curl -s -o /dev/null -w '%{http_code}' --connect-timeout 3 --max-time 75 \
    -X POST -H "Host: $HOST" "http://127.0.0.1:$porta/api/fediverso/entregar") || true
  case "${codigo:-000}" in
    200|404) exit 0 ;;
    429) echo "porta $porta: 429, a fila já está sendo chamada"; exit 0 ;;
    000) respostas="$respostas porta $porta sem resposta;" ;;
    *) respostas="$respostas porta $porta respondeu $codigo;" ;;
  esac
done

echo "ERRO: a entrega do Fediverso falhou:$respostas" >&2
exit 1
