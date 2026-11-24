#!/usr/bin/env bash
# Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
#
# A cópia de fora: manda para um balde do Cloudflare R2 (outra empresa que não a Contabo nem o Supabase) a cópia do banco mais
# nova e um pacote das configurações da VPS, os dois SEMPRE cifrados para a chave pública das cópias. Roda logo depois de cada
# cópia do banco que deu certo (OnSuccess= em lucia-backup-banco.service) e também à mão: `lucia-copia-externa`.
#
# - Nada sai sem cifra: sem a chave pública (BACKUP_CHAVE) a rodada falha. A chave privada que abre as cópias NÃO fica na VPS.
# - As credenciais do R2 ficam em /etc/lucia/copia-externa.env, só do root, gravadas por infra/contabo/segredo-copia-externa.ps1.
#   Elas chegam ao rclone por arquivo de ambiente: não aparecem na lista de processos.
# - Só acrescenta: o rclone nunca apaga nada no balde. Quanto tempo cada cópia fica e a trava contra apagar são regras do próprio
#   balde (no painel da Cloudflare), para que quem invadir a VPS não consiga apagar as cópias de fora.
# - Confere depois de enviar: o tamanho no balde tem de ser o do arquivo daqui. Diferença ou erro: a rodada falha e aparece em
#   `systemctl --failed`.
# - A mídia (os arquivos do Supabase Storage) ainda não vai: fica para a próxima etapa, depois de saber o tamanho.
set -euo pipefail
CONF=${COPIA_EXTERNA_CONF:-/etc/lucia/copia-externa.env}
PASTA=${BACKUP_PASTA:-/var/backups/lucia/banco}
CHAVE=${BACKUP_CHAVE:-}
# O que entra no pacote das configurações (o que precisa para remontar a VPS). Pode ser trocado só para teste.
CONFIGURACOES=${COPIA_CONFIGURACOES:-"/opt/lucia/site.env /opt/lucia/backup.env /etc/caddy /etc/lucia /etc/systemd/system/lucia-*.service /etc/systemd/system/lucia-*.timer /usr/local/sbin/lucia-*"}
# A imagem pelo resumo: o programa de envio não muda sozinho.
IMAGEM=rclone/rclone:1.68.2@sha256:74c51b8817e5431bd6d7ed27cb2a50d8ee78d77f6807b72a41ef6f898845942b

if [ ! -s "$CONF" ]; then
  echo "ERRO: falta $CONF (rode infra/contabo/segredo-copia-externa.ps1 no computador da coordenação)." >&2
  exit 1
fi
# shellcheck disable=SC1090
. "$CONF"
for v in R2_CONTA R2_CHAVE_ID R2_CHAVE_SECRETA R2_BALDE; do
  if [ -z "${!v:-}" ]; then echo "ERRO: falta $v em $CONF." >&2; exit 1; fi
done
if [ -z "$CHAVE" ] || [ ! -s "$CHAVE" ]; then
  echo "ERRO: sem a chave pública das cópias (BACKUP_CHAVE). Nada sai da VPS sem cifra." >&2
  exit 1
fi
ENDERECO=${R2_ENDERECO:-https://$R2_CONTA.r2.cloudflarestorage.com}
REDE=${COPIA_EXTERNA_REDE:-host}

umask 077
trabalho=$(mktemp -d)
trap 'rm -rf "$trabalho"' EXIT
# O rclone lê o destino de variáveis de ambiente (remoto "r2"), por arquivo: nenhuma credencial na linha de comando.
cat > "$trabalho/rclone.env" <<EOF
RCLONE_CONFIG_R2_TYPE=s3
RCLONE_CONFIG_R2_PROVIDER=${R2_PROVEDOR:-Cloudflare}
RCLONE_CONFIG_R2_ACCESS_KEY_ID=$R2_CHAVE_ID
RCLONE_CONFIG_R2_SECRET_ACCESS_KEY=$R2_CHAVE_SECRETA
RCLONE_CONFIG_R2_ENDPOINT=$ENDERECO
RCLONE_CONFIG_R2_NO_CHECK_BUCKET=true
EOF
rclone() { docker run --rm --network "$REDE" --env-file "$trabalho/rclone.env" -v "$PASTA:/banco:ro" -v "$trabalho:/trabalho:ro" "$IMAGEM" -q "$@"; }

# Envia um arquivo e confere o tamanho no balde.
enviar() {
  local origem=$1 destino=$2 tamanho remoto
  tamanho=$(stat -c %s "$3")
  rclone copyto --s3-no-check-bucket --retries 5 --low-level-retries 10 "$origem" "r2:$R2_BALDE/$destino"
  remoto=$(rclone size --json "r2:$R2_BALDE/$destino" | sed -n 's/.*"bytes":\([0-9]*\).*/\1/p')
  if [ "$remoto" != "$tamanho" ]; then
    echo "ERRO: $destino chegou com $remoto bytes no balde (aqui tem $tamanho)." >&2
    return 1
  fi
  echo "Enviada: $destino ($tamanho bytes, conferido no balde)."
}

# 1. A cópia do banco mais nova, já cifrada pela rodada da cópia. Uma sem cifra nunca sai.
nova=$(ls -1t "$PASTA"/banco-*.dump.gpg 2>/dev/null | head -n 1 || true)
if [ -z "$nova" ]; then
  echo "ERRO: não há cópia cifrada (banco-*.dump.gpg) em $PASTA. A cópia do banco está sem cifra? Nada foi enviado." >&2
  exit 1
fi
enviar "/banco/$(basename "$nova")" "banco/$(basename "$nova")" "$nova"

# 2. As configurações da VPS num pacote cifrado (o pacote aberto só existe na pasta temporária, que sai no fim).
dia=$(date -u +%Y-%m-%dT%H%MZ)
existentes=()
for c in $CONFIGURACOES; do [ -e "$c" ] && existentes+=("$c"); done
tar -czf "$trabalho/configuracoes.tar.gz" --absolute-names "${existentes[@]}" 2> /dev/null
gpg --batch --yes --quiet --no-tty --trust-model always --recipient-file "$CHAVE" \
  --output "$trabalho/configuracoes-$dia.tar.gz.gpg" --encrypt "$trabalho/configuracoes.tar.gz"
rm -f "$trabalho/configuracoes.tar.gz"
enviar "/trabalho/configuracoes-$dia.tar.gz.gpg" "configuracoes/configuracoes-$dia.tar.gz.gpg" "$trabalho/configuracoes-$dia.tar.gz.gpg"
echo "Cópia de fora em dia: $(date -Is)."
