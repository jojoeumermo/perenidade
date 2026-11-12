# O chat pelo Tor (serviço onion)

**Situação (13/11/2026): o serviço onion está NO AR na VPS** e responde pela rede Tor:

`http://footmiyjssnqgdgg3woplt4vcjb4iisnkcxduqs2s3a3pfrp74eiqjyd.onion`

Hoje ele mostra o site como está publicado. Quando este ramo for juntado e publicado, ele passa a abrir **só o chat** (como
`conversas.institutolucia.org`, `lib/rede/chat/origem.ts`), com a mesma política de scripts estrita.

## Por que

Pelo Tor, nem o nosso servidor, nem o Cloudflare, nem quem estiver na rede de quem acessa sabe de onde vem o acesso: o endereço
de rede da pessoa fica escondido de todo mundo. O Signal não oferece isso.

## Como está montado

- **Tor na VPS** (`apt-get install tor`), com o trecho `infra/contabo/tor-conversas.conf` no fim de `/etc/tor/torrc`. A chave do
  serviço nasce na VPS (`/var/lib/tor/lucia-conversas/`) e nunca sai dela; o endereço `.onion` vem dessa chave.
- **Caddy** escuta em `127.0.0.1:8090` (bloco `http://:8090` em `infra/contabo/Caddyfile`), só dentro da VPS, sem TLS (o Tor já
  cifra de ponta a ponta até o serviço) e sem registro.
- **O site** trata o host `.onion` como o endereço do chat.
- **Onion-Location:** com a variável `NEXT_PUBLIC_CHAT_ONION` (o nome acima, no GitHub Actions), as respostas do chat no
  endereço normal levam o cabeçalho que faz o Navegador Tor oferecer o onion.

## Limites

- Os pedidos ao banco (Supabase) saem do Navegador Tor pela rede Tor até o Supabase: o Supabase vê um nó de saída do Tor, não a
  pessoa. A cifra de ponta a ponta continua igual.
- O servidor de retransmissão da voz (Cloudflare TURN) não passa pelo Tor (o Tor não carrega UDP): pelo onion, a sala de voz
  mostraria o endereço da pessoa à Cloudflare. A tela de voz avisa; quem precisa se esconder usa só o texto.
- **Guardar a chave do serviço:** se a VPS for perdida, o endereço `.onion` se perde junto (um novo é criado). Para manter o
  mesmo endereço, copie `/var/lib/tor/lucia-conversas/` (só o root lê) para um lugar seguro.

## Desligar

Tirar o trecho do `/etc/tor/torrc` e `systemctl restart tor`; tirar o bloco `http://:8090` do Caddy e `systemctl reload caddy`.
