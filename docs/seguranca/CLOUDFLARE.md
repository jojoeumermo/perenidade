# Cloudflare: a barreira na frente do site

O painel conta, em **Técnico → Endereços-isca**, as visitas a caminhos que só robô de invasão procura (`/wp-login.php`,
`/.env`, `/phpmyadmin`, `/remote/fgt_lang`…). Isso é varredura automática: robôs percorrem a internet inteira testando
falhas de WordPress, PHP, roteadores e VPNs. Este site não tem nenhum desses programas, então nada é atingido; hoje cada
visita dessas já recebe um 404 seco do `proxy.ts` e fica anotada no registro.

O que este documento faz é parar essas visitas **antes** de chegarem à Vercel, na Cloudflare, que fica na frente do
domínio. Menos ruído no registro, menos gasto de função e uma camada a mais contra o que vier de pior.

Nenhum sistema é 100% seguro, e não há como prometer isso com honestidade. O que dá para garantir é camada sobre
camada: a Cloudflare barra a varredura, o `proxy.ts` barra o que passar, o banco só abre as funções da lista conferida
(com testes que travam qualquer função nova fora da regra) e cada função confere quem está pedindo.

Tudo abaixo cabe no **plano gratuito** da Cloudflare (conferido na documentação dela em 29/10/2026): até 5 regras
personalizadas sem expressão regular, e 1 regra de limite de requisições com janela de 10 segundos, bloqueio de
10 segundos, contada por IP e escrita só com o caminho e o campo de robô verificado.

## 1. Regra personalizada "Iscas de varredura"

**Security → WAF → Custom rules → Create rule**

- Nome: `Iscas de varredura`
- Clique em **Edit expression** e cole:

```
(starts_with(http.request.uri.path, "/.") and not starts_with(http.request.uri.path, "/.well-known/"))
or starts_with(lower(http.request.uri.path), "/wp-")
or lower(http.request.uri.path) in {"/wordpress" "/phpmyadmin" "/pma" "/adminer" "/cgi-bin" "/boaform" "/hnap1" "/actuator" "/server-status" "/owa" "/ecp" "/autodiscover" "/solr" "/jenkins" "/telescope" "/geoserver" "/druid" "/nacos" "/jolokia" "/sftp-config.json"}
or starts_with(lower(http.request.uri.path), "/wordpress/")
or starts_with(lower(http.request.uri.path), "/phpmyadmin/")
or starts_with(lower(http.request.uri.path), "/cgi-bin/")
or starts_with(lower(http.request.uri.path), "/vendor/")
or starts_with(lower(http.request.uri.path), "/actuator/")
or starts_with(lower(http.request.uri.path), "/remote/")
or starts_with(lower(http.request.uri.path), "/+cscoe+/")
or starts_with(lower(http.request.uri.path), "/global-protect/")
or starts_with(lower(http.request.uri.path), "/dana-na/")
or starts_with(lower(http.request.uri.path), "/owa/")
or starts_with(lower(http.request.uri.path), "/ecp/")
or starts_with(lower(http.request.uri.path), "/autodiscover/")
or starts_with(lower(http.request.uri.path), "/geoserver/")
or starts_with(lower(http.request.uri.path), "/solr/")
```

- Ação: **Block**
- **Deploy**

Por que não pega nada de verdade: toda página do site começa pelo idioma (`/pt/…`, `/en/…`), e os arquivos da raiz são
os de `public/` e os serviços em `/api/`. A lista foi testada contra os 160 caminhos reais da raiz (pastas públicas,
serviços, ícones, mapa do site, `.well-known`) sem nenhum falso positivo.

## 2. Regra personalizada "Arquivos que o site não tem"

**Security → WAF → Custom rules → Create rule**

- Nome: `Arquivos que o site não tem`
- **Edit expression**:

```
http.request.uri.path.extension in {"php" "php3" "php4" "php5" "php7" "phtml" "asp" "aspx" "ashx" "asmx" "axd" "jsp" "jspx" "jsf" "action" "do" "cgi" "pl" "env" "sql" "sqlite" "db" "bak" "old" "orig" "swp" "ini" "conf" "cfg" "yml" "yaml" "log" "pem" "key" "p12" "pfx" "tar" "tgz" "gz" "rar" "7z"}
and not starts_with(http.request.uri.path, "/pyodide/")
and not starts_with(http.request.uri.path, "/_next/")
```

- Ação: **Block**
- **Deploy**

O site não serve nenhum arquivo com essas extensões fora de `/pyodide/` (conferido em `public/`). Se um dia passar a
servir, acrescente a pasta com mais um `and not starts_with(...)`, como as duas acima, e a mesma pasta no `config.matcher`
do `proxy.ts`.

## 3. Limite de requisições nos serviços do site

**Security → WAF → Rate limiting rules → Create rule**

- Nome: `Serviços do site`
- **If incoming requests match** → **Edit expression**:

```
starts_with(http.request.uri.path, "/api/") and not cf.client.bot
```

- **With the same characteristics**: IP (o único possível no plano gratuito)
- **When rate exceeds**: `30` requests per `10 seconds`
- **Then take action**: **Block**, **For duration**: `10 seconds`
- **Deploy**

Os serviços de `/api/` (dicionário, frases, imagens, checagens, gramática…) consultam outros sites. Sem limite, alguém
podia usar o instituto para martelar esses serviços ou gastar as funções da Vercel. Trinta pedidos em dez segundos é
muito mais do que uma pessoa usando o site faz; os robôs verificados (Google, prévias de link do WhatsApp e do
Telegram) ficam de fora pelo `cf.client.bot`.

## 4. Ajustes de uma vez só (gratuitos)

| Onde | O que | Por quê |
| --- | --- | --- |
| SSL/TLS → Overview | **Full (strict)** | A Vercel tem certificado válido; o modo estrito confere o certificado dela. Se o site mostrar o erro 526 depois da troca, volte para **Full** e me avise. |
| SSL/TLS → Edge Certificates | **Always Use HTTPS** ligado; **Minimum TLS Version** 1.2; **TLS 1.3** ligado; **Automatic HTTPS Rewrites** ligado | Ninguém conversa com o site sem criptografia, nem com versões velhas dela. O HSTS já sai do próprio site (`next.config.ts`): deixe o da Cloudflare desligado para não haver dois. |
| Security → Settings | **Browser Integrity Check** ligado | Barra pedidos com cabeçalhos típicos de robô de spam. |
| Security → WAF → Managed rules | **Cloudflare Free Managed Ruleset** ligado | As regras gratuitas da própria Cloudflare contra falhas conhecidas e muito exploradas. |
| DNS → Settings | **DNSSEC** ligado | Impede que alguém falsifique o endereço do site no caminho. Se o domínio foi registrado fora da Cloudflare, a Cloudflare mostra um registro DS para colar no registrador. |

## 5. O que pensar antes de ligar

- **Bot Fight Mode** (Security → Bots): desafia tudo que parece automático e, no plano gratuito, não aceita exceção.
  Duas rotinas do GitHub chamam o site de fora, dos servidores do GitHub: "Publicações agendadas do estúdio" (pede a
  `/api/estudio/instagram/agendados` que publique os posts vencidos) e a conferência de links do acervo
  (`scripts/tarefas.mjs`). As duas seriam barradas, e aí voltam os e-mails de erro. Deixe desligado, a menos que haja
  ataque de verdade.
- **Block AI Scrapers and Crawlers** (Security → Bots): barra os robôs que copiam páginas para treinar IA. O acervo é
  livre (CC BY-SA), então a decisão é sua: ligar poupa servidor; desligar deixa o conteúdo chegar também por esse caminho.
- **I'm Under Attack Mode** (Security → Settings → Security Level): só durante um ataque. Ele põe uma espera de alguns
  segundos para todo mundo e também barra as duas rotinas acima.

## 6. Fora da Cloudflare (também com você)

- **Supabase → Database → Extensions → `pg_graphql`**: desligue. O site não usa GraphQL (só as funções da API REST), e
  extensão desligada é porta a menos. Nada muda no site.
- **Supabase → Authentication → Sign In / Providers → Email**: ligar **Confirm email** e **Secure password change**
  (pendência S1 do relatório de 25/10, que precisa do SMTP do Resend antes).
- **Supabase → Database → Settings**: **Enforce SSL on incoming connections** ligado.
- **Vercel → Settings → Deployment Protection**: **Standard Protection** ligada, para as prévias de ramo (endereços
  `*.vercel.app` de cada envio) não ficarem abertas ao público.

## 7. Como conferir

Depois de ligar as regras 1 e 2, em qualquer terminal:

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://institutolucia.org/wp-login.php
```

Deve responder `403` (barrado na Cloudflare; antes era `404`, vindo da Vercel). E uma página de verdade continua `200`:

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://institutolucia.org/pt
```

Em **Security → Events** aparecem os bloqueios de cada regra. No painel, **Técnico → Endereços-isca nas últimas
24 horas** deve cair perto de zero: o que ainda chegar lá passou pela Cloudflare e foi barrado pelo `proxy.ts`.

## 8. Como desfazer

Cada regra tem um botão de ligar e desligar na lista de **Custom rules** e de **Rate limiting rules**. Desligar volta
tudo ao que era antes, na hora; o `proxy.ts` continua respondendo 404 às iscas.
