#!/usr/bin/env bash
# Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
#
# Teste de restauração da cópia do banco (rotina .github/workflows/restaurar.yml).
# Pega a cópia cifrada mais recente da rotina "Cópia do banco" (backup.yml), decifra, restaura num Postgres DESCARTÁVEL (o
# contêiner da própria rotina, que some no fim) e roda as conferências (scripts/operacao/conferir-restauracao.sql).
#
# Variáveis (a rotina entrega; nenhum valor fica no código):
#   GH_TOKEN          o token da rotina (actions: read), para baixar o artefato
#   COPIA_ROTINA      o arquivo da rotina que faz a cópia (padrão: backup.yml)
#   COPIA_SENHA       a senha da cifra da cópia (o segredo BACKUP_SENHA)
#   PGHOST, PGPORT, PGUSER, PGDATABASE   o banco descartável (o contêiner "postgres" da rotina)
# O que sai no resumo: a data da cópia, quantos erros o pg_restore contou e "certo" ou o nome do que faltou. Nenhum dado.
set -euo pipefail

ROTINA="${COPIA_ROTINA:-backup.yml}"
PASTA="$(mktemp -d)"
DUMP="$PASTA/banco.dump"
RESUMO="${GITHUB_STEP_SUMMARY:-/dev/null}"
AQUI="$(cd "$(dirname "$0")" && pwd)"
# O arquivo aberto existe só enquanto este script roda, numa pasta temporária; sai sempre, com ou sem erro.
trap 'rm -rf "$PASTA"' EXIT

relatar() { echo "$1"; echo "$1" >> "$RESUMO"; }

if [ -z "${COPIA_SENHA:-}" ]; then relatar "Falta a senha da cópia (segredo BACKUP_SENHA)."; exit 1; fi

# Os programas do Postgres 17 (a mesma versão da cópia), pela imagem oficial, ligados ao banco descartável.
pg() { docker run --rm -i --network host -e PGHOST -e PGPORT -e PGUSER -e PGDATABASE -v "$PASTA:/copia" -v "$AQUI:/scripts:ro" postgres:17 "$@"; }

# 1. A cópia mais recente que deu certo.
EXECUCAO="$(gh run list --workflow "$ROTINA" --status success --limit 1 --json databaseId --jq '.[0].databaseId // empty')"
if [ -z "$EXECUCAO" ]; then relatar "Nenhuma execução bem-sucedida de $ROTINA: não há cópia para testar."; exit 1; fi
gh run download "$EXECUCAO" --dir "$PASTA/artefato"
CIFRADO="$(find "$PASTA/artefato" -name '*.dump.gpg' -type f | sort | tail -n 1)"
if [ -z "$CIFRADO" ]; then relatar "A execução $EXECUCAO não tem arquivo .dump.gpg."; exit 1; fi
NOME="$(basename "$CIFRADO")"
DATA="$(echo "$NOME" | grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2}' || true)"
relatar "Cópia testada: $NOME (execução $EXECUCAO)."

# 2. A cópia é recente? (A rotina é semanal: mais de 10 dias quer dizer que ela parou.)
if [ -n "$DATA" ]; then
  IDADE=$(( ( $(date -u +%s) - $(date -u -d "$DATA" +%s) ) / 86400 ))
  if [ "$IDADE" -gt 10 ]; then relatar "A cópia mais recente tem $IDADE dias: a rotina de cópia parou."; exit 1; fi
  relatar "Idade da cópia: $IDADE dia(s)."
fi

# 3. Decifrar (a senha vai pelo descritor 3, nunca pela linha de comando).
gpg --batch --yes --quiet --pinentry-mode loopback --passphrase-fd 3 --decrypt --output "$DUMP" "$CIFRADO" 3<<<"$COPIA_SENHA"
rm -f "$CIFRADO"

# 4. O mínimo que o serviço de contas traz pronto (papéis e extensões), para a cópia ter onde cair.
pg psql -v ON_ERROR_STOP=1 -q <<'SQL'
do $$ begin
  create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin create role service_role nologin bypassrls; exception when duplicate_object then null; end $$;
do $$ begin create role authenticator nologin; exception when duplicate_object then null; end $$;
do $$ begin create role supabase_auth_admin nologin; exception when duplicate_object then null; end $$;
do $$ begin create role supabase_storage_admin nologin; exception when duplicate_object then null; end $$;
do $$ begin create role supabase_admin nologin; exception when duplicate_object then null; end $$;
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;
SQL

# 5. Restaurar. O pg_restore conta os erros que pulou (de objetos do serviço que não existem aqui); o que vale são as
# conferências do passo 6. O registro dele NÃO vai para o resumo: uma mensagem de erro pode citar uma linha da tabela.
set +e
pg pg_restore --no-owner --no-privileges --dbname "$PGDATABASE" /copia/banco.dump > "$PASTA/restaurar.log" 2>&1
set -e
ERROS="$(grep -c '^pg_restore: error' "$PASTA/restaurar.log" || true)"
relatar "O pg_restore pulou $ERROS erro(s) (o registro fica fora do resumo de propósito)."
rm -f "$DUMP"

# 6. As conferências.
if pg psql -v ON_ERROR_STOP=1 -q -f /scripts/conferir-restauracao.sql > "$PASTA/conferir.log" 2>&1; then
  grep -oE 'certo: .*' "$PASTA/conferir.log" | while read -r linha; do relatar "- $linha"; done
  relatar "Restauração conferida."
else
  relatar "- falhou: $(grep -oE 'restauracao:[a-z_.]+' "$PASTA/conferir.log" | head -n 1)"
  exit 1
fi
