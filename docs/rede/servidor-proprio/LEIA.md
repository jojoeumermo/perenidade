# Alumia no servidor da sua organização

Este guia é para uma organização (sindicato, coletivo, movimento, grêmio, mandato) que quer rodar a **própria instância da Alumia**,
com o próprio banco e os próprios segredos, em vez de usar o servidor do Instituto Lúcia. A sua instância conversa com a Alumia do
Instituto e com o resto do Fediverso (Mastodon, Lemmy e outros) pelo ActivityPub: quem está na sua instância segue e é seguido por
quem está em outras.

O código é livre (AGPL-3.0-or-later). Rodar a sua instância quer dizer: os dados das suas pessoas ficam no **seu** banco, as chaves
são **suas** e ninguém do Instituto tem acesso a elas. Quer dizer também: a segurança da máquina, as cópias, as atualizações e a
moderação passam a ser **suas**. A mediação do Instituto não modera a sua instância (ela pode, como qualquer instância, deixar de
federar com a sua).

O que este guia usa, todo no repositório:

- `scripts/servidor-proprio/preparar.sh`: prepara a máquina (feito a partir dos scripts de `infra/` do Instituto, sem endereço,
  porta, domínio ou segredo de lá: tudo é variável).
- `scripts/servidor-proprio/atualizar.sh` (vira o comando `alumia-atualizar`): monta e põe no ar a versão do código sem tirar o
  site do ar.
- `scripts/servidor-proprio/copia.sh` (vira `alumia-copia`): a cópia cifrada do banco.
- `supabase/install.sql`: o banco inteiro, num arquivo só.

## 1. O que você precisa

| O quê | Mínimo | Observação |
| --- | --- | --- |
| Uma VPS | Ubuntu 24.04, 4 vCPU, 8 GB de memória, 60 GB de disco, x86_64 ou ARM | A montagem do site pede uns 8 GB de memória (o script cria 4 GB de reserva em disco). Com menos, monte a imagem em outro computador e traga pronta. |
| Um domínio | `suaorg.org` | O site fica em `suaorg.org` e a Alumia em `alumia.suaorg.org`. O código reconhece a Alumia pelo começo `alumia.` do endereço. |
| Um banco Supabase | um projeto no supabase.com **ou** o Supabase próprio (Docker oficial do Supabase, na mesma VPS ou em outra) | Veja abaixo por que um Postgres sozinho não basta. |
| E-mail que envia (SMTP) | qualquer provedor | A confirmação de e-mail do cadastro depende dele. O e-mail é obrigatório na Alumia; telefone nunca é pedido. |
| Uma chave SSH | a sua | O script desliga a entrada por senha. |

**Supabase próprio ou Postgres?** O banco da Alumia é Postgres, mas o site também usa o serviço de contas (entrar, segundo fator,
confirmação de e-mail), a API que chama as funções do banco e o depósito de arquivos (imagens e stories). O Supabase traz os três em
cima do Postgres. Um Postgres sozinho não tem nada disso, e o site não funciona com ele. Se a organização não quer conta em empresa
nenhuma, rode o Supabase próprio (é software livre, com o Docker oficial do projeto): o banco continua sendo Postgres, só que com os
três serviços em volta.

## 2. O banco

1. Crie o projeto (no supabase.com, região mais perto das suas pessoas) ou suba o Supabase próprio. Guarde a senha do banco num
   gerenciador de senhas.
2. Em **Authentication → Sign In / Providers**: e-mail ligado, **Confirm email** ligado, senha mínima de 12 com letras, números e
   símbolos, e o **TOTP** (aplicativo autenticador) ligado em **Multi-Factor** antes do passo 4. Configure o SMTP do seu provedor.
3. Em **Database → Extensions**, ligue `pg_cron` e `pg_net` (com elas, o banco chama a fila do Fediverso e as faxinas sozinho).
4. Rode o `supabase/install.sql` inteiro (no SQL Editor, ou `psql "<conexão direta>" -f supabase/install.sql`). Pode rodar de novo
   quando o arquivo mudar: ele não apaga nada.
5. Em **Project Settings → API**, confira que o esquema `interno` **não** está em *Exposed schemas*. Copie a *Project URL*, a chave
   *anon public* e a *service_role* (essa nunca vai para o navegador).
6. Crie a sua conta em **Authentication → Users → Add user** (com "Auto Confirm User") e, no SQL Editor, faça dela a coordenação:
   `select public.promover_coordenacao('o-seu-email@suaorg.org');`

## 3. A máquina

1. Aponte os dois registros A do DNS, `suaorg.org` e `alumia.suaorg.org`, para o IP da VPS.
2. Entre na VPS com a sua chave SSH, copie a pasta `scripts/servidor-proprio/` para lá e rode, como root:

   ```sh
   sudo DOMINIO=suaorg.org REPO=https://endereco-do-codigo.git EMAIL_ACME=tecnica@suaorg.org bash preparar.sh
   ```

   Variáveis opcionais: `VERSAO` (ramo ou etiqueta, padrão `master`), `PORTA_SSH` (padrão 22), `FUSO`, `RESERVA_GB`,
   `ATUALIZAR_SOZINHO=sim` (confere versão nova toda madrugada) e `ENTREGA_POR_TIMER=sim` (veja o passo 5).

   O script prepara fuso, memória de reserva, atualizações automáticas de segurança (com reinício às 4h30 quando o sistema pede),
   SSH só com chave, Docker, Caddy, firewall (só SSH, 80 e 443), a cópia do código em `/opt/alumia/codigo`, o arquivo das chaves e o
   HTTPS. O Caddy pede e renova sozinho o certificado do Let's Encrypt para os dois endereços. O registro do Caddy não guarda
   endereço de rede, cabeçalhos nem o que vem depois do "?", e some em 7 dias.
3. Preencha o banco no arquivo das chaves (`sudo nano /opt/alumia/site.env`): `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY`.
4. Monte e ponha no ar: `sudo alumia-atualizar`. A primeira montagem demora (dezenas de minutos numa VPS pequena). Depois abra
   `https://alumia.suaorg.org`.

### Segredos: a sua instância gera os dela

O `preparar.sh` cria `/opt/alumia/site.env` **uma vez**, com segredos gerados na própria máquina (`openssl rand -hex 32`), sem
mostrar nenhum na tela. Nenhum é do Instituto, e nenhum deve ser copiado de outra instância.

| Variável | Para quê | Trocar |
| --- | --- | --- |
| `ALUMIA_IMPRESSAO_SEGREDO` | a impressão de rede (HMAC) que permite barrar uma rede por prazo sem guardar o endereço | invalida as impressões e os bloqueios por rede em vigor |
| `ALUMIA_FEDIVERSO_SEGREDO` | cifra as chaves dos perfis federados e autentica o servidor no banco | as chaves cifradas deixam de abrir: troque só com a federação desligada |
| `REDE_PREVIA_SEGREDO` | assina o endereço da imagem da prévia de link | sem efeito duradouro |
| `OG_SEGREDO` | assina os cartões de compartilhamento | sem efeito duradouro |
| `ALUMIA_FAXINA_SEGREDO` | autentica a chamada da faxina dos arquivos das contas apagadas (o banco chama a rota de hora em hora) | o banco precisa do mesmo valor (passo 5.3) |
| `ALUMIA_VOTO_SEGREDO` | o voto secreto (docs/rede/VOTO-SECRETO.md): a marca de quem já votou nas enquetes de post e de story, na votação secreta da equipe e no termômetro, e a chave que cifra a cédula das consultas. Sem ele, nada disso funciona: o banco recusa o voto direto e o servidor responde "sem serviço" | **nunca troque com consulta aberta ou enquete em andamento**: as cédulas cifradas deixam de abrir e quem já votou pode votar de novo |

O arquivo só o root lê (permissão 600). Guarde uma cópia dos segredos no gerenciador de senhas da organização, fora da máquina.
Numa máquina preparada antes da onda 9, rodar o `preparar.sh` de novo acrescenta o `ALUMIA_VOTO_SEGREDO` (só se faltar). Ponha o
segredo do voto ANTES de rodar o banco novo (a migração `20261115-alumia-o9-resto8.sql`, dentro do `install.sql`): a partir dela,
votar só passa pelo servidor do site.
Depois de mudar o arquivo, rode `sudo alumia-atualizar`: o contêiner troca sem tirar o site do ar.

## 4. O que fica ligado

`NEXT_PUBLIC_RECURSOS` (no `site.env`) diz quais partes do site ligam. Para a Alumia: `rede-v2` e `alumia-2`; organizações com
selo, `alumia-org`; stories, `alumia-stories`. A lista completa e o que cada nome faz estão em `docs/RECURSOS.md`. É uma variável
pública: mudou, rode `alumia-atualizar`. Depois de no ar, a coordenação também liga e desliga funções pelo painel de controle da
Alumia.

A entrada fechada (só entra quem a triagem aprovou) liga no banco: `select interno.alumia_entrada_ligar(true);`
(`docs/rede/ENTRADA.md`).

O botão "Traduzir" (`alumia-traducao`) usa um tradutor da PRÓPRIA instância, por exemplo um LibreTranslate na mesma máquina:
`ALUMIA_TRADUCAO_URL` (no `site.env`) tem de apontar para ele, nunca para um tradutor público de terceiros, porque o texto que vai
pode ser de núcleo, de comunidade fechada ou só de membros. O site só aceita `https://`, ou `http://` dentro da própria máquina ou
da rede interna (`localhost`, um nome sem ponto como o serviço do docker, ou um endereço de rede privada); com outro endereço, a
tradução não liga.

## 5. Ligar o Fediverso e as rotinas do banco

1. Acrescente `fediverso-total` (e, para as comunidades abertas virarem grupos, `fediverso-grupos`) em `NEXT_PUBLIC_RECURSOS`.
2. Diga ao banco qual é o segredo da federação e para onde chamar a fila (SQL Editor; troque os dois valores):

   ```sql
   insert into interno.configuracoes (chave, valor) values ('fediverso', jsonb_build_object(
     'segredo_hash', encode(sha256(convert_to('<o valor de ALUMIA_FEDIVERSO_SEGREDO do site.env>', 'UTF8')), 'hex'),
     'url_entrega', 'https://alumia.suaorg.org/api/fediverso/entregar'))
   on conflict (chave) do update set valor = excluded.valor;
   ```

   O banco guarda só o SHA-256 do segredo, nunca o segredo. Para ler o valor sem deixar no histórico do terminal:
   `sudo grep '^ALUMIA_FEDIVERSO_SEGREDO=' /opt/alumia/site.env | cut -d= -f2`.
3. A faxina dos arquivos das contas apagadas também é chamada pelo banco. Diga a ele o endereço e o segredo (troque os dois valores):

   ```sql
   insert into interno.configuracoes (chave, valor) values ('meus_dados', jsonb_build_object(
     'faxina', 'https://alumia.suaorg.org/api/rede/exportar/faxina',
     'segredo', '<o valor de ALUMIA_FAXINA_SEGREDO do site.env>'))
   on conflict (chave) do update set valor = excluded.valor;
   ```
4. Sem `pg_cron` e `pg_net` no banco, ligue a chamada da fila pela própria máquina: rode o `preparar.sh` de novo com
   `ENTREGA_POR_TIMER=sim` (ou `sudo systemctl enable --now alumia-fediverso.timer`).
5. `sudo alumia-atualizar`.
6. Prove com uma conta de outra instância: ligue a federação no seu perfil da Alumia, busque `@seunome@alumia.suaorg.org` lá fora,
   siga, publique e veja chegar. Detalhes do que sai e do que nunca sai, e de como desligar tudo, em `docs/rede/FEDIVERSO.md`.

## 6. Atualizar

- À mão: `sudo alumia-atualizar` (a versão de `VERSAO`) ou `sudo alumia-atualizar <etiqueta>` (por exemplo, para voltar a uma versão
  anterior). Ele baixa o código, monta, sobe o contêiner novo ao lado do antigo, espera responder e só então desliga o antigo. Se a
  versão nova não responder em 3 minutos, a antiga continua. As 3 últimas imagens ficam guardadas.
- Sozinho: `ATUALIZAR_SOZINHO=sim` no `preparar.sh` liga a conferência de toda madrugada.
- **O banco não se atualiza sozinho.** Quando a versão nova traz migração (`supabase/migracoes/`), rode o `install.sql` novo no SQL
  Editor antes de `alumia-atualizar`, como no passo 2.4. Leia as notas da versão antes.
- O sistema da máquina se atualiza sozinho (atualizações de segurança todo dia).

## 7. Cópia do banco

A cópia sai do banco direto para o `age` (ferramenta de cifra consagrada, age-encryption.org) e só toca o disco cifrada, para uma
chave **pública**. A chave privada, que abre as cópias, **nunca** fica na máquina: quem invadir o servidor leva cópias que não abre.

1. No computador de quem cuida das cópias (não na VPS): `age-keygen -o alumia-copias.key`. Guarde o arquivo no gerenciador de senhas
   da organização (e numa segunda mídia, fora de casa). A linha "public key: age1..." é a chave pública.
2. Na VPS, crie `/opt/alumia/copia.env` com permissão 600:

   ```sh
   BANCO_URL=postgresql://...      # a conexão direta do banco
   COPIA_DESTINATARIO=age1...      # a chave pública do passo 1
   COPIAS_GUARDADAS=14
   ```
3. `sudo alumia-copia` (a primeira, para conferir) e `sudo systemctl enable --now alumia-copia.timer` (toda madrugada). As cópias
   ficam em `/var/backups/alumia/`. Leve-as para fora da máquina com a frequência que a organização aguenta perder (uma cópia que só
   existe no mesmo servidor some junto com ele).
4. **Restaurar** (num Postgres de teste primeiro): `age -d -i alumia-copias.key alumia-banco-<data>.dump.age > banco.dump` e
   `pg_restore --no-owner --no-privileges -d "<conexão>" banco.dump`. O passo a passo do teste de restauração do Instituto, que vale
   aqui também, fica com a coordenação. Uma cópia que nunca foi restaurada é uma esperança, não uma cópia.

A cópia deixa de fora o segredo e o sal das origens (`interno.origem_segredo`, `interno.origem_sal`), como a do Instituto.

## 8. O que não fazer

- Não use segredo, chave ou banco de outra instância (nem do Instituto). Cada instância gera os seus.
- Não ponha a `service_role` em nenhuma variável `NEXT_PUBLIC_*`, em mensagem, print ou repositório.
- Não ligue registro de endereço de rede (IP) no Caddy, no Supabase nem em ferramenta de fora. A Alumia não guarda endereço de rede.
- Não ponha script, fonte, imagem ou serviço de terceiros (analytics, captcha de fora) nas telas: o código não usa, e a política de
  segurança do site barra.
- Não exponha o Postgres para a internet (no Supabase próprio, a porta do banco fica só na rede interna do Docker).

## 9. Quando algo dá errado

| Sintoma | O que olhar |
| --- | --- |
| `alumia-atualizar` para em "Preencha NEXT_PUBLIC_SUPABASE_URL" | o passo 3.3 |
| A montagem morre sem mensagem | memória: confira a reserva (`swapon --show`) ou monte em outro computador |
| "a versão não respondeu em 3 minutos" | o fim da mensagem traz o registro do contêiner; quase sempre é variável faltando no `site.env` |
| O certificado não sai | o DNS dos dois endereços ainda não aponta para a VPS, ou a porta 80 está fechada no provedor |
| O Fediverso não acha a conta | `NEXT_PUBLIC_ALUMIA_URL` com o endereço certo, `fediverso-total` ligado e a linha `fediverso` no banco (passo 5) |
| A cópia diz "não está configurada" | falta `/opt/alumia/copia.env` (passo 7.2) |

Registros: `journalctl -u alumia-atualizar`, `journalctl -u alumia-copia`, `docker logs alumia-a` (ou `alumia-b`).
