#!/usr/bin/env bash
# Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
#
# Cópia do banco (pg_dump, formato custom) para o disco da VPS, dentro da imagem oficial do Postgres (nada instalado na VPS).
# Onde fica o segredo, a pasta e quantas cópias guardar vêm do ambiente (BACKUP_SEGREDO, BACKUP_PASTA, BACKUP_GUARDAR), escrito
# fora do repositório e lido pela unidade do systemd. Sem eles, a rodada falha e aparece em `systemctl --failed`.
# Erro do pg_dump ou cópia estranha: nada é guardado e a rodada falha.
#
# Cifra: com BACKUP_CHAVE (o caminho de uma chave PÚBLICA do GnuPG, exportada com `gpg --export`), a cópia é guardada só
# cifrada (banco-<dia>.dump.gpg). A chave privada que abre a cópia NÃO fica na VPS: quem invadir a máquina não lê as cópias
# antigas. A cópia sem cifra existe só no instante de conferir o cabeçalho e é apagada em seguida. Sem BACKUP_CHAVE, a cópia
# fica sem cifra, como antes, e a rodada avisa no registro.
set -euo pipefail
SEGREDO=${BACKUP_SEGREDO:-}
PASTA=${BACKUP_PASTA:-}
GUARDAR=${BACKUP_GUARDAR:-}
CHAVE=${BACKUP_CHAVE:-}
# A imagem pelo resumo (digest): a cópia não muda de programa sozinha. Ao trocar a versão, troque o resumo junto.
IMAGEM=postgres:17-alpine@sha256:e5d2edd28b1f8d40a0a6c0c9cdc545b19b56a0d5d88f94bc11a97d970d4700d0

if [ -z "$SEGREDO" ] || [ -z "$PASTA" ] || ! [[ "$GUARDAR" =~ ^[1-9][0-9]*$ ]]; then
  echo "ERRO: falta a configuração da cópia (BACKUP_SEGREDO, BACKUP_PASTA, BACKUP_GUARDAR)." >&2
  exit 1
fi
if [ ! -s "$SEGREDO" ] || ! grep -q '^BANCO_URL=postgres' "$SEGREDO"; then
  echo "ERRO: o arquivo do segredo não tem BANCO_URL=postgresql://..." >&2
  exit 1
fi
if [ -n "$CHAVE" ] && { [ ! -s "$CHAVE" ] || ! command -v gpg > /dev/null; }; then
  echo "ERRO: BACKUP_CHAVE aponta para uma chave que não existe, ou falta o gpg. Nada foi copiado." >&2
  exit 1
fi

umask 077
mkdir -p "$PASTA"
chmod 700 "$PASTA"
dia=$(date -u +%Y-%m-%dT%H%MZ)
destino="$PASTA/banco-$dia.dump"
parcial="$PASTA/.banco-$dia.parcial"
cifrado="$destino.gpg.parcial"
trap 'rm -f "$parcial" "$cifrado"' EXIT

# A senha vai para o contêiner por arquivo de ambiente: não aparece na lista de processos da VPS.
# Os sais e segredos ficam de fora da cópia (vai só a tabela vazia): com o sal da hora ou do dia junto, quem tivesse a cópia
# testaria todos os endereços de rede e ligaria cada resumo a um endereço. Ao restaurar, o apelido do Fediverso ganha
# segredo novo e a chave da tarefa automática (interno.segredos) é posta de novo pelo SQL Editor.
if ! docker run --rm --network host --env-file "$SEGREDO" "$IMAGEM" \
     sh -c 'exec pg_dump --dbname="$BANCO_URL" --format=custom --compress=6 --no-owner --no-privileges \
       --exclude-table-data=interno.origem_segredo --exclude-table-data=interno.origem_sal --exclude-table-data=interno.vale_sal \
       --exclude-table-data=interno.rede_fed_apelido_segredo --exclude-table-data=interno.segredos' > "$parcial"; then
  echo "ERRO: o pg_dump falhou (veja as linhas acima). Nenhuma cópia nova foi guardada."
  exit 1
fi
# Uma cópia de verdade tem o cabeçalho do formato custom ("PGDMP") e não é minúscula.
if [ "$(head -c 5 "$parcial")" != "PGDMP" ] || [ "$(stat -c %s "$parcial")" -lt 100000 ]; then
  echo "ERRO: a cópia saiu estranha ($(stat -c %s "$parcial") bytes, sem o cabeçalho PGDMP). Nada foi guardado."
  exit 1
fi
if [ -n "$CHAVE" ]; then
  # Cifra para a chave pública (a privada fica fora da VPS). O arquivo sem cifra sai logo depois.
  if ! gpg --batch --yes --quiet --no-tty --trust-model always --recipient-file "$CHAVE" --output "$cifrado" --encrypt "$parcial"; then
    echo "ERRO: a cifra da cópia falhou. Nada foi guardado."
    exit 1
  fi
  destino="$destino.gpg"
  mv "$cifrado" "$destino"
  rm -f "$parcial"
else
  echo "AVISO: cópia guardada SEM cifra (falta BACKUP_CHAVE na configuração)." >&2
  mv "$parcial" "$destino"
fi
trap - EXIT
echo "Cópia guardada: $(basename "$destino") ($(du -h "$destino" | cut -f1))."

# As mais velhas saem: ficam as $GUARDAR mais novas (cifradas ou não, contadas juntas).
{ ls -1t "$PASTA"/banco-*.dump "$PASTA"/banco-*.dump.gpg 2>/dev/null || true; } | tail -n +$((GUARDAR + 1)) | while read -r velha; do
  rm -f -- "$velha" && echo "Apagada a cópia antiga: $(basename "$velha")"
done
