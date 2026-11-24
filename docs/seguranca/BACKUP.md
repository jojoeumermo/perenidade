# Cópias de segurança e restauração

O que existe hoje, onde fica, como restaurar e o que ainda falta. Vale para o site do instituto e para a Alumia.

## Onde estão os dados

| O quê | Onde | Cópia |
|---|---|---|
| Banco (contas, posts, painel, chat cifrado) | Supabase (hospedado) | Diária na VPS e, cifrada, no Cloudflare R2 |
| Arquivos enviados (15 baldes do Supabase Storage: mídia da Alumia, anexos, podcast, aulas…) | Supabase Storage | **Nenhuma ainda.** A cópia do banco leva só o registro de cada arquivo, não o conteúdo |
| Configurações da VPS (`/opt/lucia/site.env`, `/opt/lucia/backup.env`, `/etc/caddy`, `/etc/lucia`, unidades do systemd, `/usr/local/sbin/lucia-*`) | VPS | Pacote cifrado no Cloudflare R2, a cada cópia do banco |
| Chave privada das cópias | Com a coordenação, fora da VPS (gerenciador de senhas ou pendrive) | Sem ela nenhuma cópia abre |

As rotinas `backup.yml`, `copia-do-banco.yml` e `restaurar.yml` do GitHub só rodam em repositório privado. Este repositório é
público, então elas não copiam nada.

## Como as cópias são feitas

1. **Cópia do banco** (`infra/contabo/backup-banco.sh` → `lucia-backup-banco.timer`, uma vez por dia). É um `pg_dump` dentro da
   imagem oficial do Postgres, presa pelo resumo. As tabelas de sais e segredos vão vazias (`interno.origem_segredo`,
   `origem_sal`, `vale_sal`, `rede_fed_apelido_segredo`, `segredos`). Com `BACKUP_CHAVE` no ajuste `/etc/lucia/backup-banco.conf`,
   a cópia fica só cifrada (`banco-<dia>.dump.gpg`). A VPS guarda as 14 mais novas em `/var/backups/lucia/banco`.
2. **Cópia de fora** (`infra/contabo/copia-externa.sh` → `lucia-copia-externa.service`). Roda quando a cópia do banco dá certo
   (`OnSuccess=`). Manda para o balde do R2 a cópia cifrada mais nova e o pacote cifrado das configurações, e confere o tamanho
   no balde. Nada sai sem cifra: sem a chave pública, ou sem cópia cifrada na pasta, a rodada falha. Ela só acrescenta: quanto
   tempo cada arquivo fica e a trava contra apagar são regras do próprio balde, para que quem invadir a VPS não as apague.

Uma rodada que falha aparece em `systemctl --failed`. Ainda não há aviso por e-mail: isso está no plano de alertas.

## Ligar (uma vez)

1. **Chave das cópias, no computador da coordenação.** Assim a parte privada nunca passa pela VPS.

   ```powershell
   & "C:\Program Files\Git\usr\bin\gpg.exe" --quick-gen-key "Instituto Lucia copias" rsa4096 encrypt never
   & "C:\Program Files\Git\usr\bin\gpg.exe" --export --output "$HOME\Documents\copias-publica.gpg" "Instituto Lucia copias"
   & "C:\Program Files\Git\usr\bin\gpg.exe" --export-secret-keys --armor --output "$HOME\Documents\copias-PRIVADA.asc" "Instituto Lucia copias"
   ```

   Guarde `copias-PRIVADA.asc` e a senha fora deste computador, depois apague o arquivo de Documentos. A pública vai para a VPS
   em `/etc/lucia/copias-publica.gpg`, e o ajuste da cópia ganha `BACKUP_CHAVE=/etc/lucia/copias-publica.gpg`.
2. **Balde no Cloudflare R2.** Crie o balde (ex.: `lucia-copias`) com:
   - uma regra de **trava** (*Bucket lock*) de pelo menos 30 dias;
   - uma regra de **ciclo de vida** que apaga depois de 90 dias;
   - um token **Object Read & Write** que vale só para esse balde.
3. **Credenciais na VPS:** `infra/contabo/segredo-copia-externa.ps1`. Ele grava `/etc/lucia/copia-externa.env` sem mostrar os
   valores e manda uma cópia de fora na hora, para conferir.

## Restaurar

Nunca por cima de produção. Primeiro num banco descartável. Em produção, só depois de decidir, e com uma cópia nova do estado atual.

1. Baixe do R2 a cópia `banco/banco-<dia>.dump.gpg` e decifre-a com a chave privada:
   `gpg --output banco.dump --decrypt banco-<dia>.dump.gpg`.
2. **Banco descartável** (para conferir): um Postgres 17 sem rede. Crie os papéis do Supabase e as extensões `pgcrypto` e
   `uuid-ossp` (como em `scripts/operacao/restaurar.sh`, passo 4). Depois rode
   `pg_restore --no-owner --no-privileges -d postgres banco.dump` e `scripts/operacao/conferir-restauracao.sql`. Os erros de
   `pg_cron`, `pg_net`, `supabase_vault` e `pg_stat_statements` são esperados: essas extensões só existem no Supabase.
3. **Projeto Supabase novo** (para voltar ao ar): restaure o mesmo arquivo com `pg_restore` no banco do projeto novo e troque
   `NEXT_PUBLIC_SUPABASE_URL`, a chave anônima e `SUPABASE_SERVICE_ROLE_KEY` (`infra/contabo/segredos.ps1`). O segredo das origens
   e o apelido do Fediverso ganham valores novos. A chave da tarefa automática (`interno.segredos`) é posta de novo pelo SQL Editor.
4. **Configurações:** decifre `configuracoes/configuracoes-<dia>.tar.gz.gpg` e devolva cada arquivo ao seu lugar numa VPS nova.
   Depois rode `infra/contabo/instalar.sh`.

## Testes de restauração

| Data | Cópia | Onde | Resultado |
|---|---|---|---|
| 24/11/2026 | Do dia, sem cifra (antes da chave) | Postgres 17 descartável na VPS, sem rede, dados só na memória, apagado no fim | Restaurou em 25 s. Conferências certas: 623 tabelas no esquema `interno`, tabelas principais presentes, contas com perfil, nenhum segredo nem endereço de rede. 12 erros esperados (extensões só do Supabase). **Não testado:** o site apontado para o banco restaurado (precisa de um projeto Supabase de teste) |

## O que ainda falta

- **Mídia:** copiar os 15 baldes do Supabase Storage para o R2, cifrados. Depende de saber o tamanho (Supabase → Storage).
- **Avisos:** e-mail quando a cópia do banco ou a de fora falharem.
- **Restauração completa:** o site de pé contra um projeto Supabase de teste, com uma amostra da mídia.
- **Plano do Supabase:** confirmar no painel (Database → Backups) se ele guarda cópias próprias.
