# Alumia: o endereço próprio (alumia.institutolucia.org)

A Alumia é a rede social do instituto (o nome interno continua "rede" no código, nas tabelas e nas pastas). Ela mora nas mesmas
rotas de sempre, `/[lang]/comunidade/**`, e ganha um endereço próprio, **alumia.institutolucia.org**, sem duplicar nada: o
`proxy.ts` reconhece o host e reescreve o pedido para essas rotas **sem mudar a URL** (lógica em `lib/rede/alumia.ts`, testada em
`npm run testar:fediverso`).

## Como funciona

| No endereço | Pedido | Vira |
|---|---|---|
| `alumia.institutolucia.org` | `/` | a linha em português (`/pt/comunidade`) |
| | `/en`, `/es`… | a linha no idioma |
| | `/p/<id>`, `/u/<nome>`, `/salvos`, `/fediverso`, `/buscar`… | a tela da Alumia (`/pt/comunidade/…`) |
| | `/@nome` | o perfil; com `Accept: application/activity+json`, o ator do Fediverso |
| | `/pt/comunidade/…` (o endereço completo) | segue igual (os links internos da rede usam este) |
| | `/pt/entrar`, `/entrar`, regras, privacidade, termos, meus dados | abrem ali mesmo (a sessão é por endereço, veja abaixo) |
| | qualquer outra página do site (`/trilhas`, `/acervo`…) | vai (307) para o mesmo caminho em `institutolucia.org` |
| `institutolucia.org` (com `NEXT_PUBLIC_ALUMIA_URL` ligada) | `/pt/comunidade/**` | vai (307) para o endereço próprio |
| `institutolucia.org` (sem a variável) | `/pt/comunidade/**` | nada muda: a Alumia continua aqui |

- **Os links do site para "Comunidade"** (menu do topo, barra de baixo do celular, rodapé) usam `enderecoDaAlumia(lang)`: com a
  variável, `https://alumia.institutolucia.org/` (português sem prefixo, os outros idiomas com ele); sem ela, `/[lang]/comunidade`.
  Os outros links antigos para `/comunidade` (atalhos, aulas, "Mais") continuam funcionando pelo 307 do proxy.
- **"Voltar ao site"**: toda tela da Alumia tem, no alto, a faixa escura com o botão de volta ao site do instituto
  (`components/rede/MolduraDaAlumia.tsx`, pelo `app/[lang]/comunidade/layout.tsx`). Enquanto a Alumia está aberta, o cabeçalho,
  as barras do celular e o rodapé do site saem de cena (a saída rápida e o widget de acessibilidade ficam).
- **O 307 é temporário de propósito**: apagar a variável `NEXT_PUBLIC_ALUMIA_URL` e publicar de novo devolve tudo como era.
- Para testar no computador sem configurar nada: `http://alumia.localhost:3107` (o navegador resolve `*.localhost` sozinho).

## A sessão (entrar na conta) nos dois endereços

A sessão do Supabase fica no **armazenamento do navegador** (`localStorage`, chave `KEYS.session`, `lib/backend.ts`), e o
navegador separa esse armazenamento **por endereço**. Por isso:

- Quem entra pelo site e abre a Alumia **entra de novo uma vez** no endereço da Alumia (a página `/entrar` abre ali mesmo e,
  depois de entrar, volta para a linha da Alumia, não para o painel). Daí em diante, cada endereço lembra a própria sessão.
- **Sair** na Alumia sai só da Alumia (há "Sair da conta" na coluna da direita). O "Sair rápido" apaga o que a Alumia guardou
  naquele endereço e abre a página inicial do instituto.
- Escolhemos não compartilhar a sessão por cookie de domínio (`.institutolucia.org`): isso mandaria o token da conta em todo
  pedido a qualquer subdomínio (estúdio, servidor, aula ao vivo) e quebraria o cache do Cloudflare, que não guarda quem tem
  cookie `sb-`. Entrar de novo uma vez é o preço menor.

## Passo a passo para ligar (Jonathan)

Faça na ordem. Até o passo 4, nada muda para quem usa o site.

1. **Vercel: acrescentar o domínio.** vercel.com → equipe **lucia-b323** → projeto **perenidade** → Settings → Domains → Add →
   `alumia.institutolucia.org` → "Connect to an environment: Production" (sem redirecionar para outro domínio). A Vercel mostra o
   registro que espera (um CNAME para `cname.vercel-dns.com`, ou o valor que ela indicar na tela: use o da tela).
2. **Cloudflare: o registro de DNS.** dash.cloudflare.com → institutolucia.org → DNS → Records → Add record:
   - Type **CNAME**, Name **alumia**, Target **cname.vercel-dns.com** (ou o valor da Vercel), **Proxy status: Proxied** (nuvem
     laranja, como o domínio principal), TTL Auto. Salve.
   - Se a Vercel pedir um TXT `_vercel` para verificar, crie também (pode apagar depois de verificado, como no principal).
   - Volte à Vercel e espere o domínio ficar "Valid Configuration" (alguns minutos). O certificado é emitido sozinho.
3. **Cloudflare: o cache.** A regra "HTML do site na borda 4h" (Caching → Cache Rules) ignora o `Accept` do pedido. Edite a
   regra e acrescente às exceções: **caminho começa com `/.well-known/`** e **(host é `alumia.institutolucia.org` e (caminho começa
   com `/@` ou caminho contém `/p/` ou caminho contém `/u/`))**. Em expressão do Cloudflare:
   `starts_with(http.request.uri.path, "/.well-known/") or (http.host eq "alumia.institutolucia.org" and (starts_with(http.request.uri.path, "/@") or http.request.uri.path contains "/p/" or http.request.uri.path contains "/u/"))`.
   Nesses endereços a mesma URL serve a página (navegador) ou o documento ActivityPub (Mastodon, que manda
   `Accept: application/activity+json`, por exemplo quando alguém cola o link de um post ou perfil da Alumia na busca de lá). Sem
   a exceção, o Fediverso recebe a página HTML guardada no lugar do documento, e quem ligar a federação fica 4 horas
   "inexistente" para o WebFinger. `/api/` já está fora da regra.
4. **Supabase: os endereços de volta.** supabase.com → projeto → Authentication → URL Configuration → Redirect URLs → Add
   `https://alumia.institutolucia.org/**`. (Sem isso, o link de "esqueci a senha" e a confirmação de e-mail pedidos na Alumia
   voltam para o site principal.) Se a entrada usa o desafio contra robôs (Turnstile), acrescente o host
   `alumia.institutolucia.org` ao widget em Cloudflare → Turnstile → o widget → Hostnames.
5. **Vercel: a variável.** Settings → Environment Variables → `NEXT_PUBLIC_ALUMIA_URL` = `https://alumia.institutolucia.org`
   (Production). Ela entra na construção do site: **publique de novo** (Deployments → o último → Redeploy).
6. **Conferir:** abrir `https://alumia.institutolucia.org` (linha da Alumia, faixa "Voltar ao site" no alto); clicar em
   Comunidade no site (tem de ir para lá); `https://institutolucia.org/pt/comunidade` (tem de ir para lá com 307); entrar na conta
   na Alumia; "Voltar ao site".

**Para voltar atrás:** apague `NEXT_PUBLIC_ALUMIA_URL` e publique de novo. O registro de DNS pode ficar (o host da Alumia
continua mostrando a Alumia, e os links voltam para `/comunidade`).

A federação com o Fediverso só liga depois disto, com o segredo dela: `docs/rede/FEDIVERSO.md`.
