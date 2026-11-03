# Hospedagem: onde o site mora e como ele vai ao ar

**Hoje (2 de novembro de 2026) o site está na Vercel**, numa conta nova, como paliativo: veja "Situação atual" logo
abaixo. O destino planejado é um servidor próprio, que ainda não existe; quando ele sair, terá três peças:

| Peça | O que faz | Onde se mexe |
|---|---|---|
| **Oracle Cloud** (Always Free, São Paulo) | A máquina: processador ARM (Ampere A1), 2 núcleos, 12 GB de memória, 100 GB de disco. Fica numa rede privada, **sem endereço público**: ninguém de fora chega nela direto. | cloud.oracle.com → Compute → Instances → `lucia` |
| **Coolify** | O painel que publica e mantém o site na máquina (como a Vercel, só que nosso): variáveis, registros, versões, voltar para a anterior. | `servidor.institutolucia.org` (só entra quem passa pelo Cloudflare Access) |
| **Cloudflare** | O domínio, o túnel que liga a máquina à internet (a máquina sai até o Cloudflare; nada entra nela), a proteção e o cache. | dash.cloudflare.com → institutolucia.org e Zero Trust → Túneis (`lucia-oracle`) |

Tudo o que não é hospedagem continua onde estava: Supabase (contas, banco, funções), Resend (e-mails), o Worker
`estudio-lucia` (estudio.institutolucia.org), as rotinas do GitHub.

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
