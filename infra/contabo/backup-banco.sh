#!/usr/bin/env bash
# Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
#
# Cópia do banco (pg_dump, formato custom) para o disco da VPS, dentro da imagem oficial do Postgres (nada instalado na VPS).
# Onde fica o segredo, a pasta e quantas cópias guardar vêm do ambiente (BACKUP_SEGREDO, BACKUP_PASTA, BACKUP_GUARDAR), escrito
# fora do repositório e lido pela unidade do systemd. Sem eles, a rodada falha e aparece em `systemctl --failed`.
# Erro do pg_dump ou cópia estranha: nada é guardado e a rodada falha.
set -euo pipefail
SEGREDO=${BACKUP_SEGREDO:-}
PASTA=${BACKUP_PASTA:-}
GUARDAR=${BACKUP_GUARDAR:-}
IMAGEM=postgres:17-alpine

if [ -z "$SEGREDO" ] || [ -z "$PASTA" ] || ! [[ "$GUARDAR" =~ ^[1-9][0-9]*$ ]]; then
  echo "ERRO: falta a configuração da cópia (BACKUP_SEGREDO, BACKUP_PASTA, BACKUP_GUARDAR)." >&2
  exit 1
fi
if [ ! -s "$SEGREDO" ] || ! grep -q '^BANCO_URL=postgres' "$SEGREDO"; then
  echo "ERRO: o arquivo do segredo não tem BANCO_URL=postgresql://..." >&2
  exit 1
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
