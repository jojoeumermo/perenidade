#!/usr/bin/env bash
# Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
#
# Põe no ar a versão nova do site na VPS da Contabo, sem tirar o site do ar. Roda a cada 2 minutos (lucia-atualizar.timer)
# e também à mão: `lucia-atualizar` (ou `lucia-atualizar <commit>` para voltar a uma versão anterior).
#
# 1. Baixa ghcr.io/jojoeumermo/perenidade:producao (a rotina "Publicar no servidor" do GitHub monta e envia a imagem).
# 2. Se a imagem mudou, sobe um contêiner novo na porta livre (3001 ou 3002), espera ele responder /robots.txt e só
#    então desliga o antigo. O Caddy manda os pedidos para o que estiver de pé. Se o novo não responder em 3 minutos,
#    ele é desligado e o antigo continua.
# 3. Guarda as 3 últimas imagens (dá para voltar) e apaga o resto.
set -euo pipefail
IMAGEM=ghcr.io/jojoeumermo/perenidade
ALVO=${1:-producao}
ENV=/opt/lucia/site.env
exec 9> /run/lucia-atualizar.lock
flock -n 9 || { echo "Outra atualização em andamento."; exit 0; }

docker pull -q "$IMAGEM:$ALVO" > /dev/null
nova=$(docker image inspect -f '{{.Id}}' "$IMAGEM:$ALVO")

ativo=""
for cor in a b; do
  if [ "$(docker inspect -f '{{.State.Running}}' "site-$cor" 2>/dev/null || true)" = "true" ]; then ativo=$cor; fi
done
if [ -n "$ativo" ] && [ "$(docker inspect -f '{{.Image}}' "site-$ativo")" = "$nova" ]; then
  # Mesma imagem: só troca se as chaves (site.env) mudaram depois que o contêiner subiu.
  subiu=$(date -d "$(docker inspect -f '{{.State.StartedAt}}' "site-$ativo")" +%s)
  [ "$(stat -c %Y "$ENV")" -gt "$subiu" ] || exit 0
  echo "$(date -Is) as chaves do site mudaram: trocando o contêiner"
fi

if [ "$ativo" = "a" ]; then novo=b; porta=3002; else novo=a; porta=3001; fi
commit=$(docker image inspect -f '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$IMAGEM:$ALVO" 2>/dev/null || echo "?")
echo "$(date -Is) publicando $commit em site-$novo (porta $porta); no ar: ${ativo:-nenhum}"

docker rm -f "site-$novo" > /dev/null 2>&1 || true
docker run -d --name "site-$novo" --restart unless-stopped \
  --env-file "$ENV" -p "127.0.0.1:$porta:3000" \
  --memory 3g --log-opt max-size=20m --log-opt max-file=3 \
  "$IMAGEM:$ALVO" > /dev/null

for _ in $(seq 1 90); do
  if curl -fsS -o /dev/null --max-time 3 "http://127.0.0.1:$porta/robots.txt" \
     && curl -fsS -o /dev/null --max-time 20 "http://127.0.0.1:$porta/pt"; then
    if [ -n "$ativo" ]; then
      sleep 12   # o Caddy confere a saúde a cada 5 s: dá tempo de ele ver o novo antes de o antigo sair
      docker stop -t 20 "site-$ativo" > /dev/null || true
      docker rm "site-$ativo" > /dev/null || true
    fi
    echo "$(date -Is) no ar: $commit (site-$novo)"
    echo "$commit" > /opt/lucia/versao-no-ar
    # Guarda as 3 imagens mais novas do site; apaga as outras.
    docker images "$IMAGEM" --format '{{.ID}} {{.CreatedAt}}' | sort -k2 -r | awk 'NR>3 {print $1}' | xargs -r docker rmi -f > /dev/null 2>&1 || true
    docker image prune -f > /dev/null 2>&1 || true
    exit 0
  fi
  sleep 2
done

echo "$(date -Is) ERRO: a versão $commit não respondeu em 3 minutos; continua a anterior." >&2
docker logs --tail 40 "site-$novo" >&2 || true
docker rm -f "site-$novo" > /dev/null 2>&1 || true
exit 1
