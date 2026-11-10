#!/usr/bin/env bash
# Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
#
# Cutuca a fila de entrega do Fediverso da Alumia. Vai para /usr/local/sbin/lucia-fediverso (infra/contabo/instalar.sh copia)
# e roda a cada 30 segundos (lucia-fediverso.timer). Passo a passo: docs/rede/FEDIVERSO-OPERACAO.md.
#
# Faz POST em /api/fediverso/entregar direto no contêiner do site, sem passar pelo Cloudflare nem pelo Caddy: primeiro na
# porta 3001 (site-a) e, se ela não responder ou der erro, na 3002 (site-b). O pedido não leva segredo: a rota só entrega o
# que já está na fila.
#
# - 200: entregou (ou não havia nada). Sai em silêncio.
# - 404: a federação está desligada no site (falta o segredo ou o recurso). Não é erro: sai em silêncio.
# - 429: alguém já chamou a rota 6 vezes neste minuto. A fila está andando: avisa no registro e não conta como falha.
# - Qualquer outra coisa nas DUAS portas (sem resposta, 500, 503...): escreve o que cada porta respondeu e sai com erro,
#   para aparecer em `journalctl -u lucia-fediverso` e em `systemctl --failed`.
set -u
HOST=alumia.institutolucia.org
respostas=""

for porta in 3001 3002; do
  # Sem resposta, o curl escreve 000. A rota trabalha por até 60 s; damos 75.
  codigo=$(curl -s -o /dev/null -w '%{http_code}' --connect-timeout 3 --max-time 75 \
    -X POST -H "Host: $HOST" "http://127.0.0.1:$porta/api/fediverso/entregar") || true
  case "${codigo:-000}" in
    200|404) exit 0 ;;
    429) echo "porta $porta: muitos pedidos neste minuto (429); a fila já está sendo chamada por outro lado"; exit 0 ;;
    000) respostas="$respostas porta $porta sem resposta;" ;;
    *) respostas="$respostas porta $porta respondeu $codigo;" ;;
  esac
done

echo "ERRO: a entrega do Fediverso falhou:$respostas" >&2
exit 1
