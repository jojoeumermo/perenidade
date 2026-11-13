# Conversas da equipe (painel): a cifra

**Situação em 16/11/2026:** as conversas da equipe passaram para a biblioteca do Matrix. Pronto no código e testado no banco local
(`npm run testar:banco`, seção "Conversas da equipe na biblioteca do Matrix"; `npm run testar:sigilo`). Falta rodar a migração
`supabase/migracoes/20261116-equipe-chat-olm.sql` (no SQL único) e conferir no painel com duas contas de verdade. Ninguém usava o
chat da equipe ainda: não houve dado a converter. O histórico do projeto está em `docs/RELATORIO-CHAT-E-CARGOS.md`.

## O que mudou

| Peça | Antes (feito à mão) | Agora (biblioteca) |
|---|---|---|
| Mensagens | AES-GCM com a chave da versão da conversa ("c2") | **Megolm** ("e1"), pela biblioteca do Matrix (`@matrix-org/matrix-sdk-crypto-wasm`): chave nova a cada mensagem |
| Entrega das chaves | ECDH + HKDF + AES-GCM para cada aparelho ("w1") | **Olm** (Double Ratchet) de aparelho para aparelho, pela mesma biblioteca |
| Identidade repassada ao aparelho aprovado | o mesmo embrulho "w1" | **HPKE** (RFC 9180, biblioteca `@hpke`), modo autenticado ("h1") |
| Aparelho que chega depois | repasse de embrulhos | **pedido de chave**: o aparelho novo pede a sessão que falta, e um aparelho de quem está na conversa repassa por Olm |

O que ficou igual: a identidade de cada conta (ECDSA, criada no primeiro aparelho), o certificado de cada aparelho, a aprovação
pelo código ou QR, a cópia de recuperação, "confiar na primeira vez, avisar quando mudar", o código de segurança, a versão da
conversa (trocada quando alguém sai) e a **assinatura de cada mensagem** pela identidade de quem escreveu (por dentro do Megolm:
a autoria é conferida mesmo numa sessão repassada). As mensagens "c2" e os embrulhos "w1" antigos continuam abrindo.

## Como funciona

- **Um aparelho da biblioteca por aparelho aprovado** (`lib/chaveiro.ts`, `aparelhoOlm`). As chaves Olm dele vão ao banco
  **certificadas pela identidade da pessoa** (`textoDoCertificadoOlm`, em `lib/equipe-olm.ts`). A loja da biblioteca fica no
  IndexedDB (`lucia-equipe-olm-<aparelho>`), cifrada com uma senha que só a chave privada não exportável do aparelho calcula.
- **Quem recebe a chave de uma sessão:** só os aparelhos de quem está na conversa cujo certificado confere com a identidade que
  este aparelho conhece da pessoa (o filtro `aceita`). O teste prova: o servidor cadastra um aparelho com certificado inventado,
  e ninguém entrega chave a ele.
- **Versões:** cada versão da conversa é uma sala da biblioteca. Versão nova só quando não há nenhuma ou quando alguém sai;
  dentro de uma versão, a biblioteca troca de sessão sozinha a cada 100 mensagens ou 7 dias.
- **Pedido de chave** (`equipe_chat_pedir_chave`, `equipe_chat_pedidos`): quem não tem a sessão de uma mensagem pede uma vez;
  qualquer aparelho de quem está na conversa e tem a sessão a exporta e manda por Olm ao aparelho que pediu (só se o certificado
  dele conferir). Quem recebe só importa sessões daquela conversa, vindas de alguém dela.

## O banco (`20261116-equipe-chat-olm.sql`)

- `equipe_chat_olm`, `equipe_chat_unicas`, `equipe_chat_reserva`, `equipe_chat_caixa`, `equipe_chat_pedidos`: RLS ligada, sem
  política, sem permissão para ninguém; só as funções `equipe_chat_*` (security definer), e só para aparelho aprovado de conta
  não suspensa. São do painel: ficam fora da porta de entrada da Alumia.
- `chat_versao_valida` aceita "e1" (e o "c2" antigo); `conversa_mensagens.corpo` vai até 12000 caracteres.
- `chat_aparelho_aprovar` aceita a identidade em "h1" (e o "w1" antigo).
- Recado da caixa some em 30 dias; pedido de chave, em 7.

## Limites

- O que já estava na tela e foi visto continua visto: nada apaga o que alguém leu.
- Um aparelho novo lê as mensagens antigas só se algum aparelho de quem está na conversa estiver aberto para repassar (o painel
  repassa a cada 30 segundos enquanto está aberto).
- A biblioteca do Matrix é WebAssembly: a política de segurança das páginas já tem `'wasm-unsafe-eval'` (só compilar
  WebAssembly).
