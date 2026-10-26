# Espelho do site e cópias do banco

O que fazer para o instituto não sumir: se o site for derrubado, se a Vercel ou o Supabase saírem do ar, ou se alguém
apagar algo por engano. Tudo aqui é para a coordenação; nada roda em produção sozinho.

## 1. O espelho de leitura (aulas e acervo)

`scripts/gerar-espelho.mjs` gera uma cópia só de leitura das aulas e das fichas do acervo, em HTML puro: sem JavaScript,
sem banco, sem conta. Abre de qualquer hospedagem estática ou direto do computador.

- **Gerar na mão:** `node scripts/gerar-espelho.mjs` grava a pasta `espelho/` e o arquivo `espelho.zip` (fora do Git).
- **Gerado sozinho:** o workflow **Espelho de leitura** roda no dia 1º de cada mês e guarda o `espelho.zip` por 90 dias
  (GitHub › Actions › Espelho de leitura › a execução mais recente › Artifacts). Para gerar agora: *Run workflow*.

### Pôr o espelho no ar num ataque

Qualquer uma destas, com o `espelho.zip` em mãos:

1. **Cloudflare Pages ou Netlify (mais rápido):** criar um projeto novo, escolher "subir arquivos" e arrastar a pasta
   descompactada. Em um minuto há um endereço `*.pages.dev` ou `*.netlify.app`.
2. **GitHub Pages:** um repositório público só com a pasta descompactada, Settings › Pages › branch `main`.
3. **Domínio:** quando o espelho estiver no ar, apontar `institutolucia.org` para ele no painel do registro do domínio
   (ou pôr um aviso na página do Instagram com o endereço provisório).
4. **Sem internet:** mandar o `.zip` por pendrive ou pelo WhatsApp; quem abrir `index.html` lê tudo.

O espelho não tem a Comunidade, o painel nem o que depende do banco. Quando o site principal voltar, basta tirar o
espelho do ar.

## 2. Cópias do banco (Supabase)

O banco guarda a Comunidade, a Rede, o painel, as horas e os termos. Sem cópia, um erro ou um ataque pode apagar tudo.

### A rotina automática (ligar uma vez)

O workflow **Cópia do banco** faz, toda segunda-feira, uma cópia cifrada do banco e guarda por 30 dias no repositório
privado. Ele só começa a funcionar quando a coordenação puser dois segredos em GitHub › Settings › Secrets and variables
› Actions:

- `SUPABASE_DB_URL`: no Supabase, Project Settings › Database › Connection string › URI (modo *Session*), com a senha do
  banco no lugar de `[YOUR-PASSWORD]`.
- `COPIA_SENHA`: uma frase longa, guardada fora do computador (no papel, com duas pessoas da coordenação). Sem ela,
  ninguém abre a cópia, nem quem invadir o GitHub.

Depois, em Actions › Cópia do banco › *Run workflow*, conferir se a primeira cópia sai.

### Cópia na mão

Com o PostgreSQL 17 instalado no computador:

```bash
pg_dump "postgresql://postgres.[projeto]:[senha]@aws-0-sa-east-1.pooler.supabase.com:5432/postgres" --format=custom --no-owner --no-privileges --schema=interno --schema=public --schema=auth --file=banco.dump
```

O Supabase também guarda cópias diárias no plano pago (Database › Backups). No plano gratuito, a rotina acima é a cópia.

### Restaurar

1. Baixar o artefato `copia-do-banco` mais recente e decifrar:
   `gpg --decrypt --output banco.dump banco-AAAA-MM-DD.dump.gpg` (pede a `COPIA_SENHA`).
2. Num projeto Supabase novo (ou no mesmo, depois de conferir o que se perdeu), rodar primeiro o `supabase/install.sql`
   para criar a estrutura e, em seguida:
   `pg_restore --dbname "postgresql://…" --data-only --disable-triggers --no-owner banco.dump`
3. Conferir no painel: entrar com uma conta da coordenação, abrir Voluntários, a Comunidade e o Registro de atividades.
4. Se o projeto for novo, trocar `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` na Vercel e publicar de
   novo.

Treinar a restauração uma vez num projeto de teste é o que garante que ela funciona no dia ruim.

## 3. O que já está seguro sem fazer nada

- **O conteúdo** (aulas, acervo, jornal, páginas) mora no Git: cada mudança fica no histórico e qualquer cópia do
  repositório é uma cópia do conteúdo.
- **Os livros das trilhas** saem em EPUB a cada montagem (`public/epub`).
- **A página de status** (`/status`) mostra se o site, o banco e a busca estão respondendo.
