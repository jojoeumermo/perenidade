#!/usr/bin/env bash
# Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
#
# A cópia do banco da instância própria da Alumia, cifrada antes de tocar o disco. Instalado por preparar.sh como
# /usr/local/sbin/alumia-copia (e alumia-copia.timer, toda madrugada). Passo a passo em docs/rede/servidor-proprio/LEIA.md.
#
# Cifra com o age (age-encryption.org), para uma chave PÚBLICA: a chave privada que abre a cópia fica fora desta máquina (com a
# coordenação da organização). Quem invadir o servidor leva cópias que não consegue abrir. Os mesmos esquemas e as mesmas
# exclusões da cópia do Instituto (.github/workflows/backup.yml): o segredo e o sal das origens ficam de fora.
#
# /opt/alumia/copia.env (permissão 600):
#   BANCO_URL=postgresql://...        a conexão direta do banco (Supabase: Project Settings > Database > Connection string)
#   COPIA_DESTINATARIO=age1...        a chave pública do age (a privada nunca vem para cá)
#   COPIAS_GUARDADAS=14               quantas cópias manter (padrão: 14)
set -euo pipefail
BASE=/opt/alumia
[ -f "$BASE/copia.env" ] || { echo "Sem $BASE/copia.env: a cópia não está configurada (LEIA.md, Cópia do banco)."; exit 0; }
# shellcheck disable=SC1091
. "$BASE/copia.env"
: "${BANCO_URL:?BANCO_URL em $BASE/copia.env}"
: "${COPIA_DESTINATARIO:?COPIA_DESTINATARIO em $BASE/copia.env}"
GUARDAR=${COPIAS_GUARDADAS:-14}
DESTINO=/var/backups/alumia
mkdir -p "$DESTINO" && chmod 700 "$DESTINO"
arquivo="$DESTINO/alumia-banco-$(date -u +%F-%H%M).dump.age"

docker run --rm -e BANCO_URL postgres:17 sh -c 'pg_dump "$BANCO_URL" --schema=interno --schema=auth --schema=storage \
  --exclude-table-data=interno.origem_segredo --exclude-table-data=interno.origem_sal --no-owner --no-privileges --format=custom' \
  | age -r "$COPIA_DESTINATARIO" -o "$arquivo.parcial"
mv "$arquivo.parcial" "$arquivo"
chmod 600 "$arquivo"
ls -1t "$DESTINO"/alumia-banco-*.dump.age | awk -v n="$GUARDAR" 'NR>n' | xargs -r rm -f
echo "$(date -Is) cópia: $(basename "$arquivo") ($(du -h "$arquivo" | cut -f1))"
