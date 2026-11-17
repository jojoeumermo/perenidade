#!/usr/bin/env bash
# Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
#
# Monta e põe no ar a versão do código na instância própria da Alumia, sem tirar o site do ar. Instalado por preparar.sh como
# /usr/local/sbin/alumia-atualizar. Uso: `alumia-atualizar` (a versão de /opt/alumia/instancia.env) ou `alumia-atualizar <ramo ou
# etiqueta>` (voltar a uma versão anterior, por exemplo). Feito a partir do atualizar dos scripts de infra/, com uma diferença: aqui a
# imagem é MONTADA nesta máquina, com os endereços e o banco da organização (os NEXT_PUBLIC_* entram na montagem), em vez de
# baixar a imagem pronta do Instituto.
#
# 1. Baixa a versão do código (cópia rasa) e escreve .env.production.local só com os NEXT_PUBLIC_* de /opt/alumia/site.env.
# 2. Monta a imagem (precisa de ~8 GB de memória, contando a reserva em disco). Se nada mudou (mesmo código e mesmas variáveis
#    públicas), não monta de novo.
# 3. Sobe um contêiner novo na porta livre (3001 ou 3002), espera ele responder e só então desliga o antigo. Se o novo não
#    responder em 3 minutos, ele é desligado e o antigo continua.
# 4. Guarda as 3 últimas imagens (dá para voltar) e apaga o resto.
set -euo pipefail
BASE=/opt/alumia
ENV=$BASE/site.env
CODIGO=$BASE/codigo
# shellcheck disable=SC1091
. "$BASE/instancia.env"
ALVO=${1:-$VERSAO}
IMAGEM=alumia-local
exec 9> /run/alumia-atualizar.lock
flock -n 9 || { echo "Outra atualização em andamento."; exit 0; }

grep -q '^NEXT_PUBLIC_SUPABASE_URL=.\+' "$ENV" || { echo "Preencha NEXT_PUBLIC_SUPABASE_URL em $ENV antes (LEIA.md, passo 1)."; exit 1; }

timeout 600 git -C "$CODIGO" fetch --quiet --depth 1 origin "$ALVO"
git -C "$CODIGO" checkout --quiet --force FETCH_HEAD
commit=$(git -C "$CODIGO" rev-parse --short=12 HEAD)

# Só as variáveis públicas vão para a montagem; as secretas o contêiner lê na hora em que roda (--env-file).
grep -E '^NEXT_PUBLIC_[A-Z0-9_]+=' "$ENV" > "$CODIGO/.env.production.local" || true
publicas=$(sha256sum "$CODIGO/.env.production.local" | cut -c1-12)
etiqueta="$commit-$publicas"

if ! docker image inspect "$IMAGEM:$etiqueta" > /dev/null 2>&1; then
  echo "$(date -Is) montando $etiqueta (demora)"
  timeout 5400 docker build -q -t "$IMAGEM:$etiqueta" "$CODIGO" > /dev/null
fi
nova=$(docker image inspect -f '{{.Id}}' "$IMAGEM:$etiqueta")

ativo=""
for cor in a b; do
  if [ "$(docker inspect -f '{{.State.Running}}' "alumia-$cor" 2>/dev/null || true)" = "true" ]; then ativo=$cor; fi
done
if [ -n "$ativo" ] && [ "$(docker inspect -f '{{.Image}}' "alumia-$ativo")" = "$nova" ]; then
  # Mesma imagem: só troca se as chaves (site.env) mudaram depois que o contêiner subiu.
  subiu=$(date -d "$(docker inspect -f '{{.State.StartedAt}}' "alumia-$ativo")" +%s)
  [ "$(stat -c %Y "$ENV")" -gt "$subiu" ] || { echo "Nada mudou."; exit 0; }
fi

if [ "$ativo" = "a" ]; then novo=b; porta=3002; else novo=a; porta=3001; fi
echo "$(date -Is) publicando $etiqueta em alumia-$novo (porta $porta); no ar: ${ativo:-nenhum}"
docker rm -f "alumia-$novo" > /dev/null 2>&1 || true
docker run -d --name "alumia-$novo" --restart unless-stopped \
  --env-file "$ENV" -p "127.0.0.1:$porta:3000" \
  --memory 3g --log-opt max-size=20m --log-opt max-file=3 \
  "$IMAGEM:$etiqueta" > /dev/null

for _ in $(seq 1 90); do
  if curl -fsS -o /dev/null --max-time 3 "http://127.0.0.1:$porta/robots.txt" \
     && curl -fsS -o /dev/null --max-time 20 "http://127.0.0.1:$porta/pt"; then
    # Os arquivos estáticos desta versão juntam-se aos das anteriores (quem está com a página antiga aberta continua achando os dela).
    mkdir -p "$BASE/estatico/_next/static"
    docker cp "alumia-$novo:/app/.next/static/." "$BASE/estatico/_next/static/" > /dev/null 2>&1 || true
    find "$BASE/estatico" -type f -mtime +30 -delete 2>/dev/null || true
    if [ -n "$ativo" ]; then
      sleep 12   # o Caddy confere a saúde a cada 5 s
      docker stop -t 20 "alumia-$ativo" > /dev/null || true
      docker rm "alumia-$ativo" > /dev/null || true
    fi
    echo "$etiqueta" > "$BASE/versao-no-ar"
    echo "$(date -Is) no ar: $etiqueta (alumia-$novo)"
    docker images "$IMAGEM" --format '{{.ID}} {{.CreatedAt}}' | sort -k2 -r | awk 'NR>3 {print $1}' | xargs -r docker rmi -f > /dev/null 2>&1 || true
    docker image prune -f > /dev/null 2>&1 || true
    exit 0
  fi
  sleep 2
done

echo "$(date -Is) ERRO: a versão $etiqueta não respondeu em 3 minutos; continua a anterior." >&2
docker logs --tail 40 "alumia-$novo" >&2 || true
docker rm -f "alumia-$novo" > /dev/null 2>&1 || true
exit 1
