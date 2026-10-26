# Backup e restauração

## O que existe hoje
- **Código e conteúdo publicado:** o repositório no GitHub (cada publicação é um commit; dá para voltar a qualquer
  versão). Cópia extra recomendada no Codeberg.
- **Banco (Supabase, plano gratuito):** o plano gratuito **não guarda cópias diárias** que se possam restaurar pelo
  painel. Por isso a cópia é nossa (abaixo).
- **Arquivos dos depósitos:** só no Supabase. Os aprovados também vão para `public/arquivos` no repositório.

## Cópia automática (rotina "Cópia do banco", todo domingo)
Fica em GitHub → Actions → Cópia do banco → a execução → Artifacts (90 dias), cifrada com `BACKUP_SENHA`.
Para abrir: baixar o `.zip`, extrair e rodar `gpg -d lucia-banco-AAAA-MM-DD.dump.gpg > banco.dump` (pede a senha).
Restaurar num projeto de teste: rodar o `install.sql` nele e depois
`pg_restore --data-only --no-owner -d "<conexão do projeto de teste>" banco.dump`.

## Cópia manual (se a rotina parar)
1. Instalar uma vez o Supabase CLI (`npm i -g supabase`) e entrar (`supabase login`).
2. `supabase db dump --project-ref yuciphgaejrkamvwllcb --data-only -f lucia-dados-AAAA-MM-DD.sql`
3. Cifrar antes de guardar: `gpg -c lucia-dados-AAAA-MM-DD.sql` (senha forte, guardada no gerenciador de senhas).
4. Guardar o `.gpg` fora do computador (pendrive e um serviço de nuvem); apagar o `.sql` aberto.

O arquivo tem dados pessoais e de saúde: nunca vai para o repositório, e-mail ou conversa sem cifra.

## Teste de restauração (a cada 3 meses)
1. Criar um projeto Supabase de teste, separado.
2. Rodar `supabase/install.sql` nele, em partes (ver `docs/MANUTENCAO.md`).
3. Decifrar e aplicar a cópia: `psql "<conexão do projeto de teste>" -f lucia-dados-AAAA-MM-DD.sql`.
4. Conferir: entrar com uma conta de teste, abrir o painel, a Comunidade e uma aula. Anotar a data e apagar o projeto de teste.

| Teste | Data | Resultado |
| --- | --- | --- |
| (preencher) | | |
