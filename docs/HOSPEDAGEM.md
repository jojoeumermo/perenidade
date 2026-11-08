# Hospedagem: onde o site mora e como ele vai ao ar

## Hoje (6 de novembro de 2026): VPS da Contabo

**O site saiu da Vercel e está numa VPS da Contabo.** O que vem depois desta seção descreve a Vercel (que ficou de reserva)
e o plano antigo com Oracle e Coolify, que não foi usado.

| Peça | O que é | Onde se mexe |
|---|---|---|
| **VPS da Contabo** | Cloud VPS 4: x86_64, 4 núcleos, 8 GB de memória (+4 GB de reserva em disco), 96 GB de disco, Ubuntu 24.04. IP `<IP da VPS>`. | my.contabo.com → VPS → `<id da VPS>` |
| **Caddy** | O HTTPS na frente do site, com o Certificado de Origem do Cloudflare (válido até 2041; a chave privada nasceu e fica só na VPS, em `/etc/caddy/origem/`). Manda `www` para o domínio principal e atende `alumia.institutolucia.org`. | `/etc/caddy/Caddyfile` (cópia em `infra/contabo/Caddyfile`) |
| **Dois contêineres do site** | `site-a` (porta 3001) e `site-b` (3002), só em 127.0.0.1. A troca de versão sobe o novo, espera responder e só então desliga o antigo: o site não sai do ar. | `docker ps`; chaves em `/opt/lucia/site.env` |
| **GitHub** | A rotina "Publicar no servidor" (`producao.yml`) monta a imagem a cada push no master e manda para `ghcr.io/jojoeumermo/perenidade:producao` (a VPS tem só 8 GB; a montagem pede 8 GB sozinha). Uns 4 minutos depois, limpa o cache do Cloudflare. | Actions → Publicar no servidor |
| **Cloudflare** | DNS (`institutolucia.org` A → <IP da VPS> com proxy; `www` CNAME → institutolucia.org), cache e proteção. O firewall da VPS só deixa os endereços do Cloudflare nas portas 80 e 443. SSL/TLS em "Completo (estrito)". | dash.cloudflare.com → institutolucia.org |

**Como uma mudança vai ao ar:** push no master → o GitHub monta a imagem (uns 20 a 30 min) → a VPS confere a cada 2 minutos
(`lucia-atualizar.timer`) e troca sozinha → o GitHub limpa o cache do Cloudflare. Registro: `journalctl -u lucia-atualizar`.

**Voltar para uma versão anterior:** na VPS, `lucia-atualizar <commit completo>` (as 3 últimas imagens ficam guardadas; as
outras são baixadas de novo do GHCR, que guarda todas).

**Entrar na VPS:** só com a chave SSH do Instituto (`~/.ssh/contabo_lucia` no computador da coordenação), porta **22222**
(a 22 também funciona, mas algumas redes interceptam a 22 e só deixam passar senha): `ssh -p 22222 -i ~/.ssh/contabo_lucia root@<IP da VPS>`.
Senha não entra (`PasswordAuthentication no`). Se perder a chave: painel da Contabo → Reset credentials → SSH-Key.

**Chaves do site:** `infra/contabo/segredos.ps1` pergunta cada chave e grava em `/opt/lucia/site.env` sem mostrar na tela; a
VPS reinicia o site com as chaves novas em até 2 minutos, sem tirar do ar. O assistente em todo o site (T03) lê ali `GROQ_API_KEY`, `GEMINI_API_KEY`, `CEREBRAS_API_KEY` e `OPENROUTER_API_KEY` (planos gratuitos; basta uma, e o script já pergunta as quatro) e, opcionais, `ASSISTENTE_POR_HORA`, `ASSISTENTE_POR_DIA`, `ASSISTENTE_LIMITE_GLOBAL`, `ASSISTENTE_ORDEM` e `ASSISTENTE_PUBLICO=0` (desliga): `docs/RECURSOS.md`, seção `assistente-publico`. As variáveis públicas (`NEXT_PUBLIC_*`) ficam no
GitHub (Settings → Secrets and variables → Actions → Variables) e entram na montagem.

**Se a VPS cair (plano de volta para a Vercel):** no Cloudflare, `institutolucia.org` volta para A `76.76.21.21` e `www`
para CNAME `cname.vercel-dns.com` (com proxy). A Vercel tem a última publicação parada. Para ela voltar a publicar, crie lá a
variável `VERCEL_VOLTOU = sim` (`scripts/vercel-ignorar.mjs`).

**Preparar uma VPS nova do zero:** `infra/contabo/preparar.sh` e depois `infra/contabo/instalar.sh` (com os arquivos da pasta
em `/root/lucia-infra/`), o certificado de origem (gerar `origem.key` e `origem.csr` na VPS, criar o certificado no Cloudflare
com "Usar minha própria chave privada e CSR" e gravar `origem.pem`) e as chaves do site.

**Hoje (5 de novembro de 2026) o site continua na Vercel** (conta nova desde 2 de novembro), como paliativo: veja "Situação
atual" logo abaixo. O destino planejado é um servidor próprio, que ainda não existe; quando ele sair, terá três peças (mais uma
máquina à parte só para a sala de aula ao vivo, veja "Aula ao vivo" mais abaixo):

| Peça | O que faz | Onde se mexe |
|---|---|---|
| **Oracle Cloud** (Always Free, São Paulo) | A máquina: processador ARM (Ampere A1), 2 núcleos, 12 GB de memória, 100 GB de disco. Fica numa rede privada, **sem endereço público**: ninguém de fora chega nela direto. | cloud.oracle.com → Compute → Instances → `lucia` |
| **Coolify** | O painel que publica e mantém o site na máquina (como a Vercel, só que nosso): variáveis, registros, versões, voltar para a anterior. | `servidor.institutolucia.org` (só entra quem passa pelo Cloudflare Access) |
| **Cloudflare** | O domínio, o túnel que liga a máquina à internet (a máquina sai até o Cloudflare; nada entra nela), a proteção e o cache. | dash.cloudflare.com → institutolucia.org e Zero Trust → Túneis (`lucia-oracle`) |

Tudo o que não é hospedagem continua onde estava: Supabase (contas, banco, funções), Resend (e-mails), o Worker
`estudio-lucia` (estudio.institutolucia.org), as rotinas do GitHub.

## Robô do Vale o Escrito na VPS (desde 8 de novembro de 2026)

O robô que coleta casos para a fila da curadoria do Vale o Escrito (`scripts/vale-o-escrito/coletar.mjs`, explicado em
`docs/vale-o-escrito/ROBO.md`) rodava só no GitHub, que atrasa e às vezes pula os horários marcados. Agora ele pode rodar
também na VPS, de 2 em 2 horas (00:17, 02:17, ... com até 5 minutos de atraso sorteado), por dois arquivos do systemd:
`infra/contabo/vale-o-escrito.service` e `infra/contabo/vale-o-escrito.timer`. O GitHub fica de reserva.

Como funciona: antes de cada rodada a VPS atualiza uma cópia parcial do repositório em `/opt/lucia/vale-o-escrito` (só
as pastas do robô) e roda o robô num contêiner Node descartável (a VPS não tem Node instalado), sem privilégio e com o
código só para leitura. As chaves ficam em `/etc/instituto-lucia/vale.env`, **fora do repositório**. O robô não publica
nada: só põe sugestões na fila da curadoria.

**Instalar (uma vez).** No computador da coordenação, dentro da pasta do repositório:

```bash
scp -P 22222 -i ~/.ssh/contabo_lucia infra/contabo/vale-o-escrito.service infra/contabo/vale-o-escrito.timer root@<IP da VPS>:/root/lucia-infra/
ssh -p 22222 -i ~/.ssh/contabo_lucia root@<IP da VPS>
```

Já na VPS:

```bash
# 1. Cópia parcial do repositório (só o robô e as fontes)
git clone --depth 1 --filter=blob:none --sparse https://github.com/jojoeumermo/perenidade.git /opt/lucia/vale-o-escrito
git -C /opt/lucia/vale-o-escrito sparse-checkout set scripts/vale-o-escrito content/vale-o-escrito
docker pull node:22-alpine

# 2. Arquivo das chaves, só o root lê
install -d -m 700 /etc/instituto-lucia
install -m 600 /dev/null /etc/instituto-lucia/vale.env
nano /etc/instituto-lucia/vale.env

# 3. Rodada seca: não grava nada, não pede chave; deve terminar com "rodada seca: N sugestões"
docker run --rm --user node -v /opt/lucia/vale-o-escrito:/app:ro -w /app node:22-alpine \
  node scripts/vale-o-escrito/coletar.mjs --seco --sem-ia --minutos 5 > /dev/null

# 4. Liga o horário e faz a primeira rodada de verdade agora
install -m 644 /root/lucia-infra/vale-o-escrito.service /root/lucia-infra/vale-o-escrito.timer /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now vale-o-escrito.timer
systemctl start vale-o-escrito.service
journalctl -u vale-o-escrito -n 30 --no-pager
```

O que vai em `/etc/instituto-lucia/vale.env` (uma variável por linha, `NOME=valor`, sem aspas). Os valores são os mesmos
dos segredos do GitHub com o mesmo nome; nunca copie este arquivo para o repositório:

| Variável | Para quê | Obrigatória |
|---|---|---|
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | gravar na fila da curadoria (`public.vale_robo_sugerir`) | sim |
| `GEMINI_API_KEY`, `GROQ_API_KEY`, `CEREBRAS_API_KEY`, `OPENROUTER_API_KEY` | a IA gratuita que organiza o rascunho (basta uma) | não: sem nenhuma, o rascunho sai por regras simples e a curadoria revisa |
| `ARCHIVE_ACCESS_KEY`, `ARCHIVE_SECRET_KEY` | cópia no Internet Archive com conta (archive.org/account/s3.php) | não: sem elas o pedido é anônimo; se o Internet Archive recusar, o caso entra do mesmo jeito, marcado como cópia pendente |

**Depois de ligar na VPS,** no GitHub (Settings → Secrets and variables → Actions → Variables) crie `VALE_O_ESCRITO_NA_VPS`
com o valor `sim`: o horário do GitHub para de rodar, para não fazer a rodada em dobro. O botão "Run workflow" da rotina
"Vale o Escrito (robô de coleta)" continua funcionando (é a reserva). Se a VPS cair, apague essa variável e o GitHub volta
a rodar sozinho.

**No dia a dia:**

- Próxima rodada: `systemctl list-timers vale-o-escrito.timer`.
- Registro das rodadas: `journalctl -u vale-o-escrito --since today`. A última linha de cada rodada diz quantas sugestões
  achou e o que aconteceu com cada fonte. Se nenhuma fonte responder ou nada for gravado, a rodada sai com erro e aparece
  como `failed` em `systemctl status vale-o-escrito`.
- Rodar agora: `systemctl start vale-o-escrito.service`.
- Trocou uma chave: edite `/etc/instituto-lucia/vale.env`; vale a partir da rodada seguinte (não precisa reiniciar nada).
- Pausar: `systemctl disable --now vale-o-escrito.timer` (e apague `VALE_O_ESCRITO_NA_VPS` no GitHub se quiser que ele
  assuma).
- Mudou `vale-o-escrito.service` ou `.timer` no repositório: repita o `scp` e o passo 4.

## Situação atual (2 de novembro de 2026): paliativo na Vercel

Enquanto a máquina da Oracle não sai (a rotina `oracle.yml` tenta de hora em hora e abre uma issue quando conseguir),
o site voltou para a Vercel, numa **conta nova** (time "Lúcia", plano Hobby). A conta antiga estourou os limites de uso
em 1º de novembro e foi pausada.

- **Domínio:** `institutolucia.org` é o principal e `www` redireciona para ele (308). O Cloudflare continua na frente
  (A `76.76.21.21` e CNAME `cname.vercel-dns.com`, com proxy). Os TXT `_vercel` só serviram para verificar o domínio.
- **Cache no Cloudflare (o que mais protege a cota):** regra "HTML do site na borda 4h" guarda as páginas por 4 horas e
  ignora o `Cache-Control` do site (que pede um ano). Não guarda `/api/`, `/*/painel`, `/*/entrar`, `/sw.js` nem quem
  tem cookie `sb-`. Para ver ao vivo uma página nova antes de 4 horas: Cloudflare → Caching → Configuração → Limpar cache.
- **Robôs:** treinamento de IA bloqueado, Labirinto para IA e Bot Fight ligados, mais as regras de segurança e o limite
  de chamadas da API que já existiam.
- **Vercel:** quem decide se um commit monta é o `scripts/vercel-ignorar.mjs` (o `ignoreCommand` do `vercel.json`).
  Produção (`master`) só publica quando muda arquivo do site; preview só monta em branch `preview/…` (veja
  "Pré-visualização" abaixo). Se o painel ainda mostrar "Don't build anything" em Settings → Git → Ignored Build Step,
  troque para "Automatic", senão nenhum preview monta. Redeploy manual: desmarcar "Use project's Ignore Build Step".
  Variáveis secretas ficam em Settings → Environment Variables do projeto.
- **Limite da Vercel Hobby:** não existe teto de gasto nem alerta de uso (só no Pro). Olhe Usage de vez em quando.
- **Ao migrar para a Oracle:** trocar o CNAME do `www`/apex pelo túnel e aposentar este projeto.

## Pré-visualização (ver uma mudança grande antes de ir ao ar)

Preview só sob pedido, para não gastar build da Vercel Hobby (um por vez, e cada um entra na fila na frente da
produção). A regra está em `scripts/vercel-ignorar.mjs`: **só monta preview o branch que começa com `preview/`**. Os
outros branches aparecem na Vercel como cancelados pelo Ignored Build Step. Dentro de `preview/`, commit que só mexe em
documentação, rotinas, SQL ou testes também não monta.

1. Com a mudança pronta num branch, mande para um nome com o prefixo: `git push origin HEAD:preview/<nome>`
   (ex.: `preview/alumia-feed`).
2. Espere a Vercel montar (Deployments, ambiente Preview; num pull request ela comenta o endereço). Os previews ficam
   atrás da proteção da Vercel (Settings → Deployment Protection) e levam `noindex`: não aparecem em busca.
3. Confira o que mudou no endereço do preview, no computador e no celular. Os testes de ponta a ponta do pull request
   (`.github/workflows/ponta-a-ponta.yml`) rodam a fumaça das telas principais no computador e no Galaxy S24.
4. Tudo certo: junte ao `master` (merge do pull request ou push). A produção monta pelo caminho de sempre.
5. Apague o branch `preview/<nome>` depois de juntar: `git push origin --delete preview/<nome>`.

Cuidado: o preview usa as variáveis do ambiente **Preview** do projeto na Vercel. Se forem as mesmas da produção, ele
lê e grava no Supabase de produção (contas, posts, e-mails de verdade). Teste ali só o que pode acontecer em produção,
ou aponte o escopo Preview para um projeto Supabase de teste.

**Pré-visualização na VPS:** uma porta ou subdomínio separado para previews (por exemplo `preview.institutolucia.org`,
atrás do Cloudflare Access, com um segundo app no Coolify e uma imagem com a tag `preview`) fica para quando o servidor
existir. Hoje não há servidor nenhum configurado e nada no repositório trata de outra VPS (como a da Contabo).

## Como uma mudança vai ao ar (quando o servidor próprio existir)

Enquanto a variável `COOLIFY_URL` não existir no GitHub (Settings → Secrets and variables → Actions → Variables), a
rotina **Publicar no servidor** fica pulada: não monta imagem, porque não há para onde mandar. O site vai ao ar pela
Vercel (veja "Situação atual").

1. O commit chega no `master` (de quem programa ou das rotinas do próprio GitHub).
2. A rotina **Publicar no servidor** (`.github/workflows/producao.yml`) monta a imagem do site numa máquina ARM do
   GitHub, com o `Dockerfile` da raiz, e guarda no GitHub Container Registry (`ghcr.io/jojoeumermo/perenidade`, com o
   nome do commit). O servidor não monta nada: ele só baixa a imagem pronta.
3. A rotina pede ao Coolify a troca. O Coolify sobe a versão nova, espera a checagem de saúde (`/robots.txt`) e só então
   desliga a antiga: o site não sai do ar na troca.
4. A rotina fica verde quando a versão nova está no ar. Se ficar vermelha, o site continua na versão anterior.

O mesmo critério do antigo filtro da Vercel vale aqui: commit que só mexe em `docs/` (fora o modelo de aula e o
checklist, que o guia de contribuição lê), `.github/`, `infra/`, SQL do banco ou testes não vira publicação.
As rotinas que gravam no repositório pelo próprio GitHub (contribuições aprovadas, banco de questões) disparam a
publicação quando terminam bem.

Para publicar na hora, de novo: GitHub → Actions → **Publicar no servidor** → *Run workflow* (marque "Montar e
publicar de novo" para forçar).

## Voltar para uma versão anterior

No Coolify: projeto **Instituto Lúcia** → app → **Deployments** → escolha a versão → *Redeploy*. Ou, no GitHub,
reverta o commit: a rotina publica a versão revertida.

## Variáveis

Esta seção vale para o **servidor próprio** (Coolify). Enquanto o site estiver na Vercel, as mesmas variáveis moram em Settings → Environment Variables do projeto lá. **A lista completa, com o que cada uma faz e onde mora hoje, está em "Segredos e variáveis" mais abaixo.**

- **Públicas** (`NEXT_PUBLIC_*`, gravadas no código na montagem): GitHub → Settings → Secrets and variables →
  Actions → **Variables**. Mudou uma delas: rode a publicação de novo (Run workflow, com "forçar").
- **Secretas** (lidas na hora em que o site roda: chaves do Cloudflare TURN, do Google Fact Check, `CRON_SECRET`…):
  Coolify → app → **Environment Variables**. Mudou: *Restart* no Coolify.
- **Da rotina de publicação** (GitHub → Secrets): `COOLIFY_TOKEN` (token da API do Coolify) e
  `CF_ACCESS_CLIENT_ID` / `CF_ACCESS_CLIENT_SECRET` (a credencial de serviço do Cloudflare Access que deixa a rotina
  passar pela porta do painel). Variáveis: `COOLIFY_URL` e `COOLIFY_APP_UUID`.

## O servidor

- Preparado do zero por `infra/servidor/preparar.sh` (roda sozinho na criação da máquina): fuso, memória de reserva,
  atualizações automáticas de segurança (com reinício às 4h30 quando preciso), SSH só com chave, o `cloudflared`, o
  Coolify e uma trava que impede conexões de fora direto nos contêineres e o acesso deles aos metadados da Oracle.
- Sem endereço público: a saída para a internet é pelo NAT da rede `rede-lucia`; a entrada é só pelo túnel.
- Terminal, quando precisar: Coolify → Servers → `localhost` → Terminal.

## Se o servidor sumir (a Oracle encerrou a conta, a máquina quebrou)

O código está no GitHub, os dados no Supabase e as imagens prontas no GitHub Container Registry. Para subir de novo, em
qualquer máquina Ubuntu ARM ou x86 (outra conta da Oracle, Hetzner, Hostinger):

1. Rodar `infra/servidor/preparar.sh` como root.
2. Instalar o túnel com o comando do Cloudflare (Zero Trust → Túneis → `lucia-oracle` → instalar conector).
3. No Coolify novo: criar o app a partir da imagem `ghcr.io/jojoeumermo/perenidade`, porta 3000, domínios
   `http://institutolucia.org` e `http://www.institutolucia.org`, checagem de saúde `/robots.txt`, colar as variáveis
   secretas e atualizar `COOLIFY_TOKEN` / `COOLIFY_APP_UUID` no GitHub.

Numa máquina x86, a imagem precisa ser montada para amd64 (trocar `runs-on` da rotina para `ubuntu-latest`).

## Aula ao vivo: a sala própria (Galène) numa segunda máquina

A sala de vídeo das aulas ao vivo é um servidor à parte, o **Galène** (licença MIT), com o Caddy na frente para o certificado. **Ela não roda na máquina do site**: o vídeo é UDP e não passa pelo túnel do Cloudflare, então a máquina da sala **precisa de endereço público**, e a `lucia-oracle` foi feita sem ele de propósito. **Não mexa na máquina do site para isso.** O porquê da escolha (comparação com Jitsi + Jibri, BigBlueButton, LiveKit e PeerTube, com fontes) está em `docs/plano-2026-11/notas/aula-ao-vivo.md`; o uso no site, em `docs/AULA-AO-VIVO.md`; o passo a passo da máquina, em `infra/aula-ao-vivo/LEIA-ME.md`.

| Peça | O que faz | Onde se mexe |
|---|---|---|
| **Segunda máquina** (Oracle Ampere A1 se a cota grátis comportar, ou outra Ubuntu pequena com IP público) | Roda `infra/aula-ao-vivo/` com Docker Compose: o Galène (tag `galene-1.2.1`) e o Caddy, ambos na rede do próprio servidor. 2 núcleos e 8 GB bastam para uma turma de uns 50. **Confira no painel da Oracle quanto da cota "sempre grátis" ainda resta antes de criar** (a máquina do site já usa parte). | cloud.oracle.com, `ssh`, pasta `infra/aula-ao-vivo/` |
| **Cloudflare** (DNS) | Registro **A** `aula` apontando para o IP público, com a **nuvem cinza (somente DNS)**. Com a nuvem laranja o vídeo não funciona. | dash.cloudflare.com, institutolucia.org, DNS |
| **Portas na Oracle** (lista de segurança, origem `0.0.0.0/0`) | TCP 80 e 443 (página e certificado), **UDP 10000** (vídeo), UDP e TCP **1194** (retransmissor TURN embutido, que ajuda quem está atrás de rede restrita ou no 3G). | Rede, sub-rede, Lista de segurança |
| **Site** (Vercel) | Assina um token de entrada de **90 segundos** a cada clique em "Entrar na aula" e entrega o endereço da sala. Quem conduz entra com `op`, `present` e `record`; quem assiste, só com o chat (`message`) e **nunca é gravado**. `next.config.ts` libera o endereço da sala no `frame-src` e na `Permissions-Policy`. | variáveis abaixo |

**Subir** (resumo; o detalhe, com o teste de campo obrigatório do passo 6, está no LEIA-ME): `git clone` na máquina nova, `cd infra/aula-ao-vivo`, `bash preparar.sh` (a primeira vez cria o `.env` e para), preencher `DOMINIO` (`aula.institutolucia.org`) e `IP_PUBLICO`, `bash preparar.sh` de novo (gera a chave, cria as quatro salas `aula-a` a `aula-d`, abre as portas e sobe). O script mostra a `GALENE_JWT_KEY` guardada no `.env` da máquina.

**Ligar no site:** na Vercel, `NEXT_PUBLIC_GALENE_URL` = `https://aula.institutolucia.org` (pública, lida **na montagem**: publique de novo), `GALENE_JWT_KEY` = a chave do `.env` da máquina (segredo, só no servidor do site) e, opcionais, `GALENE_GRUPOS` (o mesmo `GRUPOS` do `.env`) e `GALENE_PERMISSOES_ALUNO` (padrão `message`). `NEXT_PUBLIC_VIDEO_HOSTS` lista os domínios do PeerTube do instituto para o plano B e para as gravações. Sem `NEXT_PUBLIC_GALENE_URL` e `GALENE_JWT_KEY` o site fica como antes: a opção "Sala do instituto" nem aparece no painel e a rota `POST /api/aula-ao-vivo/entrada` responde "desligada".

**Servidor próprio (VPS da Contabo):** a rotina `producao.yml` repassa à montagem da imagem `NEXT_PUBLIC_GALENE_URL` e `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (variáveis do repositório no GitHub, em Settings > Variables), além das `NEXT_PUBLIC_*` do banco, do site, do recurso, dos vídeos, do Jitsi, do Turnstile e do estúdio. Sem elas, a sala própria e o aviso no celular não aparecem. Os segredos (`GALENE_JWT_KEY`, `VAPID_PRIVATE_KEY`) ficam só em `/opt/lucia/site.env`.

**Depois de cada aula gravada:** `bash listar-gravacoes.sh`, baixar o arquivo (`scp`), subir no PeerTube ou no YouTube do instituto, colar o link no campo "Gravação" da aula (toca na página, só depois do clique) e **apagar o arquivo da máquina** para não encher o disco. Atualizar o Galène: trocar `GALENE_REF` no `.env`, `docker compose build --no-cache galene && docker compose up -d`. Trocar a chave: apagar a linha `GALENE_JWT_KEY=` do `.env`, rodar `preparar.sh`, copiar a nova para a Vercel e publicar.

**Plano B** (sem a máquina, ou se ela cair): a aula usa a transmissão do canal do instituto no YouTube ou um link de transmissão do PeerTube (os dois só embutem depois do clique), e a reunião interna vai por link do Google Meet (abre fora do site). O Jitsi segue como estava para as chamadas de canal e o estudo em grupo.

**Leis (conferidas no planalto.gov.br em 4 de novembro de 2026, nota `aula-ao-vivo.md`):** a gravação mostra só quem ensina; aluno não é gravado. Se um dia o aluno puder abrir câmera ou voz numa aula gravada, é preciso consentimento antes (LGPD, Lei 13.709/2018, art. 14, caput e § 1º, para crianças e adolescentes; ECA, Lei 8.069/1990, art. 17, imagem) e revisão jurídica. A gravação publicada é da pessoa que ensina (Lei 9.610/1998, art. 29: reprodução depende de autorização prévia e expressa do autor); música de terceiros não deve tocar numa sala gravada. O texto sobre gravação de aula em `/privacidade` é da Etapa 12.

## Segredos e variáveis: a lista completa e onde cada uma mora

Regra de ouro: **nenhuma chave vai para o repositório nem para o chat**; cada uma mora em **um** lugar só (ou em dois, quando a lista diz). Prazos e como trocar cada uma: `docs/seguranca/ROTACAO.md`.

**Vercel** (projeto do site, Settings, Environment Variables; o escopo Preview aponta, se não for trocado, para o mesmo Supabase da produção):

| Variável | Tipo | Para quê |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | pública (montagem) | o projeto do Supabase; sem elas o site não fala com o banco |
| `NEXT_PUBLIC_SITE_URL` | pública | endereço do site (links, sitemap, cartões) |
| `NEXT_PUBLIC_RECURSOS` | pública | recursos ligados: `todos` hoje; `escola`, `vale-o-escrito` e `rede-v2` só ligam pelo nome (`docs/RECURSOS.md`) |
| `NEXT_PUBLIC_VIDEO_HOSTS`, `NEXT_PUBLIC_JITSI_DOMAIN`, `NEXT_PUBLIC_ESTUDIO_URL`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `NEXT_PUBLIC_ESPELHOS` | públicas | PeerTube, Jitsi, Worker do estúdio, chave pública do captcha e lista de espelhos da página de estado |
| `NEXT_PUBLIC_GALENE_URL` | pública | endereço da sala de aula ao vivo (seção acima) |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | pública (montagem) | chave pública do aviso no celular da Rede (`docs/rede/AVISOS.md`); sem ela o botão "Avisar neste aparelho" não aparece |
| `GALENE_JWT_KEY` (+ `GALENE_GRUPOS`, `GALENE_PERMISSOES_ALUNO`) | segredo | assina o token de entrada da sala; **a mesma chave** do `.env` da máquina da sala |
| `REDE_PREVIA_SEGREDO` | segredo | assina (HMAC) a imagem da prévia de link da Rede v2; sem ele a imagem da prévia não é servida (`docs/rede/V2.md`, pendência 3) |
| `OG_SEGREDO` | segredo | assina os cartões de compartilhamento que o próprio site monta; o mesmo na montagem e no servidor |
| `CRON_SECRET`, `INSTAGRAM_TOKEN`, `INSTAGRAM_USER_ID` | segredos | agenda de publicações do estúdio (o token do Instagram vence em 60 dias) |
| `CLOUDFLARE_TURN_KEY_ID`, `CLOUDFLARE_TURN_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_ANALYTICS_TOKEN` | segredos | retransmissão (TURN) das aulas ao vivo antigas, com teto de 800 GB por mês |
| `GOOGLE_FACTCHECK_KEY` | segredo | checagens |
| `GITHUB_PUBLICAR_TOKEN`, `GITHUB_PUBLICAR_REPO` | segredo e variável | botão "Publicar agora" do painel (token fine-grained só deste repositório, só "Actions: escrita") |
| `VERCEL_TOKEN_LEITURA`, `VERCEL_PROJECT_ID` (`VERCEL_TEAM_ID`), `GITHUB_LEITURA_TOKEN`, `CF_TOKEN_CACHE`, `CF_ZONE_ID` | **tokens de operação** | a seção Operação do site, no painel: ver a última publicação, ver a última cópia do banco e limpar o cache. Cada botão só aparece se a variável dele existir. Sempre tokens **só de leitura** (o do Cloudflare, só "Cache Purge") |
| `LANGUAGETOOL_URL` | opcional | servidor do corretor de gramática, se o instituto tiver o seu |

**Supabase** (Edge Functions, Secrets, ou `supabase secrets set`): `ANTHROPIC_API_KEY` e `ASSISTENTE_MODELO` (assistente de reforço, pago por pergunta, nasce desligado); `RESEND_API_KEY` (e-mails); `OPENAI_API_KEY` e `GOOGLE_SAFE_BROWSING_KEY` (avaliação externa da comunidade e da Rede v2); `GROQ_API_KEY` ou `TRANSCRICAO_URL`, `TRANSCRICAO_CHAVE` e `TRANSCRICAO_MODELO` (transcrição de áudio e do podcast); `YOUTUBE_*` (canal); e, para o aviso no celular, **o par VAPID**: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_ASSUNTO` e `PUSH_SEGREDO`, mais a linha `push` em `interno.configuracoes` (passo a passo em `docs/rede/AVISOS.md`, seção 4; gere o par uma vez só e guarde a privada apenas no cofre de segredos). `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` o Supabase já entrega às funções.

**GitHub** (Settings, Secrets and variables, Actions): a tabela por rotina está em `docs/MANUTENCAO.md`, seção 21. Resumo do que é novo: `VALE_O_ESCRITO=sim` (variável que liga o **robô do Vale o Escrito**) com `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` e as chaves de IA opcionais `GEMINI_API_KEY`, `GROQ_API_KEY`, `CEREBRAS_API_KEY` e `OPENROUTER_API_KEY` (sem nenhuma, o robô roda e as sugestões chegam sem resumo); `CF_TOKEN_CACHE` e `CF_ZONE_ID` (rotina que limpa o cache); os `OCI_*` da rotina da Oracle; `COOLIFY_*` e `CF_ACCESS_*` do servidor próprio; `FUNCOES`, `PUBLICAR`, `EMAILS` e `AGENDA_INSTAGRAM`. Fontes do Vale o Escrito que pedem cadastro (Portal da Transparência, ACLED e outras) guardam a chave também aqui, como segredo, nunca no repositório (`docs/vale-o-escrito/CADASTROS-PARA-O-JONATHAN.md`).

**Máquina da sala de aula** (`infra/aula-ao-vivo/.env`, fora do Git): `DOMINIO`, `IP_PUBLICO`, `SITE`, `GALENE_JWT_KEY`, `GRUPOS` e `GALENE_REF`.

## Vercel e Cloudflare: o que cada um guarda e os limites de hoje

- **Cache no Cloudflare:** a regra "HTML do site na borda 4h" protege a cota da Vercel. A rotina `limpar-cache.yml` limpa só o que mudou quando a publicação foi só de conteúdo e tudo quando mudou código; o botão de limpar cache do painel (seção Operação do site, no máximo 3 por hora) faz a limpeza total. Precisam de `CF_TOKEN_CACHE` e `CF_ZONE_ID`. Quando o site migrar para o servidor próprio, a limpeza deve ser chamada no fim da `producao.yml`.
- **Tempo e tamanho do deploy:** a Vercel desiste de um envio que passa de **45 minutos**. O que o torna lento é o número de arquivos que cada função do servidor leva junto (o "rastreio"). Em 5 de novembro de 2026 estamos em **679 mil de 700 mil arquivos**; a rotina `ci.yml` roda `npm run conferir:rastreio` depois do build e falha acima do limite. Regras de código para não estourar: `docs/MANUTENCAO.md`, seção 10a. O build local leva uns 9 minutos e o deploy publicou em 13 a 17 minutos nas últimas rodadas.
- **Cota da Vercel Hobby:** não há teto de gasto nem alerta de uso. Olhe Usage de vez em quando; preview só em branch `preview/…` (`scripts/vercel-ignorar.mjs`).
- **Cloudflare:** DNS (o registro `aula` fica **sem proxy**), cache, regras de robôs, TURN (aulas ao vivo antigas) e, se um dia houver servidor próprio, o túnel. O repositório é público: nenhuma cópia do banco roda enquanto ele for (`backup.yml` e `copia-do-banco.yml`).
- **Recursos de fora no `frame-src`** (`next.config.ts`): só os hosts liberados abrem quadro (Jitsi, a sala Galène, PhET, brunolemos.github.io, netlogoweb.org, www.geogebra.org, Instagram, PeerTube listado em `NEXT_PUBLIC_VIDEO_HOSTS`, o Worker do estúdio). Host novo exige mexer ali e documentar o motivo.
