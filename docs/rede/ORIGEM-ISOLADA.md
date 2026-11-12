# Origem isolada para a cifra (C1): desenho e passo a passo

**Situação (12/11/2026): desenho pronto, nada ligado.** Ligar pede um registro de DNS no Cloudflare e um bloco no Caddy da VPS, que
são passos do dono (seção "Ligar").

## Por que

Toda a cifra da Alumia (o chat privado, os posts restritos e o chat da equipe) roda no navegador, na mesma origem do site
(`alumia.institutolucia.org`). A CSP das páginas permite script inline (`next.config.ts`, `script-src 'self' 'unsafe-inline'`),
porque o site precisa. Um script malicioso que rode UMA vez nessa origem (XSS) usa as chaves do aparelho sem copiá-las: abre
embrulhos, assina como a pessoa e lê as chaves da memória da aba. O "não exportável" do WebCrypto não impede isso
(`docs/rede/CHAT-PRIVADO.md`, "O que um script na página consegue").

Uma **origem isolada** separa as chaves do resto do site. Elas passam a morar em `cofre.institutolucia.org`, uma origem que só
serve o código da cifra, com CSP estrita (`script-src 'self'`, sem inline, sem `eval`, `frame-ancestors` só a Alumia), e o
IndexedDB da cifra fica nessa origem. Um XSS no site principal não alcança esse IndexedDB nem a memória do cofre.

## Desenho

1. **O cofre** é uma página mínima (`/cofre`, um arquivo HTML estático mais um bundle de JS próprio), servida só em
   `cofre.institutolucia.org`, num `<iframe>` invisível dentro da Alumia. Nada de React, de terceiros nem de script inline.
2. **A conversa entre a Alumia e o cofre** é por `postMessage`, com a origem conferida dos dois lados e um protocolo fechado:
   `cifrar`, `abrir`, `embrulhar`, `codigoDeSeguranca`, `apagarTudo`. O cofre nunca devolve chave: só texto aberto ou cifrado.
3. **Os pedidos ao banco** que precisam de chave (publicar a chave pública, os embrulhos) saem do cofre, com o mesmo token de sessão
   que a Alumia passa por `postMessage` a cada pedido (o cofre não guarda sessão).
4. **O "Sair rápido"** manda `apagarTudo` ao cofre antes de sair: o IndexedDB do cofre é apagado lá.
5. **O que continua exposto:** um XSS no site principal ainda vê o texto aberto que aparece na tela e pode pedir ao cofre para
   cifrar ou abrir mensagens enquanto a página estiver aberta. Não leva mais as chaves embora, nem abre nada depois que a aba fecha.

## Ligar (passos do dono)

1. **Cloudflare:** um registro `cofre` (A, com proxy), igual ao de `alumia`.
2. **Caddy na VPS** (`infra/contabo/Caddyfile`): acrescentar `cofre.institutolucia.org` ao bloco do site, ou um bloco próprio que
   sirva só `/cofre/**`, com os cabeçalhos:
   `Content-Security-Policy: default-src 'none'; script-src 'self'; connect-src https://<projeto>.supabase.co; frame-ancestors https://alumia.institutolucia.org`
   e `Cross-Origin-Opener-Policy: same-origin`.
3. **Publicar** o site com o cofre (a Faixa 2 escreve o cofre e o lado da Alumia quando o dono der o sim para os passos 1 e 2).

## Migração

As chaves que já estão no IndexedDB da origem atual não passam sozinhas para o cofre (uma origem não lê o IndexedDB da outra). Na
troca, a pessoa ativa o chat de novo, como depois do "Sair rápido": a chave nova muda o código de segurança, e a tela já explica
isso.
