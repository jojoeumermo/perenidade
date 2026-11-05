#!/usr/bin/env bash
# Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
#
# Prepara a sala de aula ao vivo (Galène) nesta máquina: Ubuntu 24.04 (ARM ou x86) com endereço público. Roda como root
# dentro da pasta infra/aula-ao-vivo. Pode rodar de novo sem estragar nada (não troca a chave nem apaga gravações).
# Passo a passo e conferências em LEIA-ME.md.
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -f .env ]; then
  cp .env.exemplo .env
  echo "Criei o .env. Preencha DOMINIO e IP_PUBLICO nele e rode este script de novo." >&2
  exit 1
fi
set -a; . ./.env; set +a
[ -n "${DOMINIO:-}" ] && [ -n "${IP_PUBLICO:-}" ] || { echo "Faltam DOMINIO e IP_PUBLICO no .env." >&2; exit 1; }

# Docker, pelo repositório oficial, se ainda não existir (na máquina do Coolify ele já está).
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi

# A chave dos tokens: 32 bytes ao acaso, em base64url. Só é criada uma vez e guardada no .env.
if [ -z "${GALENE_JWT_KEY:-}" ]; then
  GALENE_JWT_KEY=$(head -c 32 /dev/urandom | base64 | tr '+/' '-_' | tr -d '=\n')
  sed -i "s|^GALENE_JWT_KEY=.*|GALENE_JWT_KEY=${GALENE_JWT_KEY}|" .env
  echo "Chave nova gerada e guardada no .env (copie para a Vercel como GALENE_JWT_KEY)."
fi

mkdir -p dados/data dados/groups dados/recordings
# O Galène roda como o usuário 1000 dentro do contêiner.
chown -R 1000:1000 dados

# Atrás do Caddy: o Galène precisa saber o endereço público (documentação "galene-install", proxyURL).
cat > dados/data/config.json <<EOF
{
    "proxyURL": "https://${DOMINIO}/"
}
EOF

# Uma sala (grupo) por nome da lista. Entra só quem tem token assinado com a chave acima (authKeys, HS256); não há senha
# nem usuário. A gravação é permitida (só quem recebe a permissão "record" no token, ou seja, quem conduz, grava).
IFS=',' read -ra lista <<< "${GRUPOS:-aula-a,aula-b,aula-c,aula-d}"
for g in "${lista[@]}"; do
  g=$(echo "$g" | tr -d ' ')
  cat > "dados/groups/${g}.json" <<EOF
{
    "public": false,
    "description": "Sala de aula do Instituto Lúcia",
    "allow-recording": true,
    "max-clients": 120,
    "authKeys": [
        {"kty": "oct", "alg": "HS256", "k": "${GALENE_JWT_KEY}"}
    ]
}
EOF
done
chown -R 1000:1000 dados
chmod 600 dados/groups/*.json

# Portas: 80 e 443 (TCP, o site e o certificado), 10000 (UDP, vídeo) e 1194 (UDP e TCP, retransmissor embutido).
# A Oracle também bloqueia na rede dela: abra as mesmas portas na "Lista de segurança" da sub-rede (LEIA-ME, passo 3).
if command -v ufw >/dev/null 2>&1 && ufw status | grep -q "Status: active"; then
  ufw allow 80/tcp; ufw allow 443/tcp; ufw allow 10000/udp; ufw allow 1194/udp; ufw allow 1194/tcp
else
  for regra in "-p tcp --dport 80" "-p tcp --dport 443" "-p udp --dport 10000" "-p udp --dport 1194" "-p tcp --dport 1194"; do
    # shellcheck disable=SC2086
    iptables -C INPUT $regra -j ACCEPT 2>/dev/null || iptables -I INPUT 1 $regra -j ACCEPT
  done
  echo "Regras do iptables abertas (valem até reiniciar; para guardar: apt install iptables-persistent)." >&2
fi

docker compose up -d --build
docker compose ps
echo "Pronto. Confira: https://${DOMINIO}/ deve abrir a página do Galène. Siga o LEIA-ME, passo 5."
