#!/usr/bin/env bash
# Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
#
# Cópia diária do banco (Supabase) para o disco da VPS. O plano gratuito do Supabase não faz backup automático: sem isto, um
# erro numa migração ou um apagar errado não tem volta. Vai para /usr/local/sbin/lucia-backup-banco e roda uma vez por dia
# (lucia-backup-banco.timer). Passo a passo: docs/rede/BACKUP-DO-BANCO.md.
#
# - O endereço do banco (com a senha) fica em /opt/lucia/backup.env, só para o root, SEPARADO de /opt/lucia/site.env: o site
#   nunca recebe a senha do banco. Quem grava é infra/contabo/segredo-backup.ps1 (a senha não aparece na tela).
# - O pg_dump roda dentro da imagem oficial do Postgres (postgres:17-alpine, que lê bancos 15, 16 e 17): nada é instalado na VPS.
# - Formato "custom" (-Fc), já comprimido; restaura com pg_restore. Fica em /var/backups/lucia/banco/, só para o root, e
#   ficam as 14 cópias mais novas.
# - Sem /opt/lucia/backup.env: avisa no registro e sai sem erro (o timer pode ficar instalado antes de o segredo existir).
# - Erro do pg_dump: apaga a cópia pela metade, escreve o motivo e sai com erro (aparece em `systemctl --failed`).
set -euo pipefail
SEGREDO=/opt/lucia/backup.env
PASTA=/var/backups/lucia/banco
GUARDAR=14
IMAGEM=postgres:17-alpine

if [ ! -s "$SEGREDO" ] || ! grep -q '^BANCO_URL=postgres' "$SEGREDO"; then
  echo "AVISO: sem $SEGREDO (BANCO_URL=postgresql://...). Rode infra/contabo/segredo-backup.ps1 no computador da coordenação."
  exit 0
fi

umask 077
mkdir -p "$PASTA"
chmod 700 "$PASTA"
dia=$(date -u +%Y-%m-%dT%H%MZ)
destino="$PASTA/banco-$dia.dump"
parcial="$destino.parcial"
trap 'rm -f "$parcial"' EXIT

# A senha vai para o contêiner por arquivo de ambiente: não aparece na lista de processos da VPS.
if ! docker run --rm --network host --env-file "$SEGREDO" "$IMAGEM" \
     sh -c 'exec pg_dump --dbname="$BANCO_URL" --format=custom --compress=6 --no-owner --no-privileges' > "$parcial"; then
  echo "ERRO: o pg_dump falhou (veja as linhas acima). Nenhuma cópia nova foi guardada."
  exit 1
fi
# Uma cópia de verdade tem o cabeçalho do formato custom ("PGDMP") e não é minúscula.
if [ "$(head -c 5 "$parcial")" != "PGDMP" ] || [ "$(stat -c %s "$parcial")" -lt 100000 ]; then
  echo "ERRO: a cópia saiu estranha ($(stat -c %s "$parcial") bytes, sem o cabeçalho PGDMP). Nada foi guardado."
  exit 1
fi
mv "$parcial" "$destino"
trap - EXIT
echo "Cópia guardada: $destino ($(du -h "$destino" | cut -f1))."

# As mais velhas saem: ficam as $GUARDAR mais novas.
ls -1t "$PASTA"/banco-*.dump 2>/dev/null | tail -n +$((GUARDAR + 1)) | while read -r velha; do
  rm -f -- "$velha" && echo "Apagada a cópia antiga: $velha"
done
