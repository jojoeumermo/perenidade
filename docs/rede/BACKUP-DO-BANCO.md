# Cópia diária do banco (Supabase) na VPS

O banco está no **plano gratuito do Supabase**, que **não faz backup automático**. Um erro numa migração, ou um "apagar" errado,
não tem volta sem uma cópia. Por isso a VPS faz uma cópia por dia.

## Como funciona

- `lucia-backup-banco.timer` dispara uma vez por dia, às 4h (com até 20 minutos de folga sorteada). Se a VPS estava desligada
  na hora, a cópia sai assim que ela ligar.
- O que roda é `/usr/local/sbin/lucia-backup-banco` (`infra/contabo/backup-banco.sh`): o `pg_dump` dentro da imagem oficial
  `postgres:17-alpine` (lê bancos 15, 16 e 17), sem instalar nada na VPS.
- A cópia vai para `/var/backups/lucia/banco/banco-<data>.dump` (formato "custom", já comprimido), só para o root. Ficam as **14
  mais novas**.
- O endereço do banco, com a senha, fica em `/opt/lucia/backup.env`, só para o root, **separado** de `/opt/lucia/site.env`: o
  site nunca recebe a senha do banco.
- Sem `/opt/lucia/backup.env`, a rodada só avisa no registro e sai sem erro. Erro do `pg_dump` deixa a unidade em `failed`, com o
  motivo no registro, e nenhuma cópia pela metade fica guardada.

## Ligar (uma vez): gravar o endereço do banco

1. No painel do Supabase: botão **Connect** (no alto) › **Session pooler** › copie o **URI**. Troque `[YOUR-PASSWORD]` pela senha
   do banco (**Project Settings › Database › Database password**; se ninguém souber, **Reset database password**: o site não
   usa essa senha, só a chave pública, então trocar não derruba nada). Use o **Session pooler**: a conexão direta do plano
   gratuito é só IPv6, e a VPS sai por IPv4.
2. No computador da coordenação, na pasta do repositório, no PowerShell:

   ```powershell
   .\infra\contabo\segredo-backup.ps1
   ```

   Cole o endereço e aperte Enter (ele não aparece na tela e não fica no computador). O script grava na VPS e já faz a primeira
   cópia, mostrando o resultado.

## Conferir

```bash
systemctl list-timers lucia-backup-banco.timer
journalctl -u lucia-backup-banco -n 20 --no-pager
ls -lh /var/backups/lucia/banco/
```

Uma cópia à mão, a qualquer hora (por exemplo, **logo antes de rodar uma migração**): `systemctl start lucia-backup-banco.service`.

## Restaurar

**Restaurar escreve por cima do banco. Faça antes uma cópia nova (o comando acima) e, se der, restaure primeiro num projeto de
teste do Supabase.**

Para ver o que tem dentro de uma cópia, sem mexer em nada:

```bash
docker run --rm -v /var/backups/lucia/banco:/c:ro postgres:17-alpine pg_restore --list /c/banco-<data>.dump | head -50
```

Para restaurar só uma tabela (o caso mais comum: alguém apagou dados de uma tabela), num banco de destino:

```bash
docker run --rm --network host --env-file /opt/lucia/backup.env -v /var/backups/lucia/banco:/c:ro postgres:17-alpine \
  sh -c 'pg_restore --dbname="$BANCO_URL" --data-only --table=<nome da tabela> --schema=<schema> /c/banco-<data>.dump'
```

Restaurar o banco inteiro num projeto novo do Supabase segue o guia oficial ("Restore dump into a new project"): os esquemas que
o próprio Supabase cria (`auth`, `storage` e outros) já existem no projeto novo e dão avisos de "já existe", que são esperados.

## Limites

- A cópia mora na **mesma VPS** do site. Se a VPS for perdida inteira, a cópia vai junto. Para ter uma segunda cópia fora dela,
  basta baixar de tempos em tempos a mais nova (`scp lucia-vps:/var/backups/lucia/banco/<arquivo> .`)
  e guardar num lugar seguro: o arquivo tem dados pessoais (contas, mensagens cifradas, consentimentos) e precisa ser tratado
  como tal (LGPD, art. 46).
- Os arquivos do Storage (fotos enviadas) não entram no `pg_dump`: só as referências a eles.

## Parar

```bash
systemctl disable --now lucia-backup-banco.timer
```
