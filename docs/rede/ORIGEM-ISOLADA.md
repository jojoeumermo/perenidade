# O chat num endereço próprio (origem isolada)

**Situação (13/11/2026): pronto no código e testado no servidor de desenvolvimento** (`conversas.localhost`). Falta ligar em
produção, DEPOIS que este ramo for juntado e publicado (seção "Ligar").

## Por que

As chaves do chat (a loja da biblioteca do Matrix, o histórico cifrado, a gaveta, os grupos) moram no IndexedDB da ORIGEM em que
o chat roda. No mesmo endereço do resto do site, um script malicioso que rode UMA vez em qualquer página (XSS) usaria essas chaves.
Com o chat em `conversas.institutolucia.org`:

- **O IndexedDB e a memória do chat ficam numa origem só dele.** Um XSS em qualquer outra página do site não alcança.
- **Política de scripts estrita, só nesse endereço** (`lib/rede/chat/origem.ts`): `script-src 'nonce-…' 'strict-dynamic'
  'wasm-unsafe-eval'`, com um nonce sorteado a cada pedido. Nada de script inline sem o nonce, nada de `eval` de JavaScript (só
  compilar WebAssembly), `frame-ancestors 'none'` (ninguém põe o chat num quadro), `object-src 'none'`, `base-uri 'none'`. Ela
  vem junto com a política geral do site, e o navegador aplica as duas (vale a mais estrita).
- **Lá só abre o chat** (e entrar na conta). Qualquer outra página vai para o site do instituto; o painel (para onde o entrar
  leva) volta para as conversas. No site e na Alumia, `/alumia/conversas` vai para lá.
- A página das conversas é gerada a cada pedido (`force-dynamic`): é como o Next aplica o nonce.

## O que muda para quem usa

- Entrar na conta de novo no endereço do chat (a sessão é de cada origem).
- **Ativar o chat de novo**: as chaves do endereço antigo não passam para o novo (uma origem não lê o IndexedDB da outra). A chave
  nova muda o código de segurança; a tela já explica isso, como depois do "Sair rápido".

## Ligar (depois do ramo publicado)

1. **Cloudflare, DNS:** um registro `conversas`, igual ao de `alumia` (com proxy, a nuvem laranja).
2. **Cloudflare, Turnstile:** no desafio da entrada, acrescentar o nome `conversas.institutolucia.org` aos domínios permitidos.
3. **VPS, Caddy** (`infra/contabo/Caddyfile`): `conversas.institutolucia.org` entra na lista do bloco do site
   (`institutolucia.org, alumia.institutolucia.org, escola.institutolucia.org, conversas.institutolucia.org`). O certificado de
   origem já cobre `*.institutolucia.org`. Depois, `systemctl reload caddy`.
4. **GitHub, variável do Actions:** `NEXT_PUBLIC_CHAT_URL = https://conversas.institutolucia.org`, e publicar de novo.

A Faixa 2 faz os passos 1 a 4 quando a Faixa 1 avisar que juntou e publicou. Desligar: apagar a variável do passo 4 e publicar
(o chat volta para o endereço antigo; as chaves de lá continuam onde estavam).

## Limites

- Um XSS DENTRO do endereço do chat ainda alcançaria as chaves; a política estrita é o que torna isso muito mais difícil.
- O que aparece na tela do chat (o texto aberto) continua sendo da página, como em qualquer aplicativo.
- O aplicativo Android assinado (do coordenador) fecha o resto: código que não muda sem a assinatura.
