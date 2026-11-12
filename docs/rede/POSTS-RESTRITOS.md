# Posts restritos cifrados (C1)

O que só um grupo lê (o núcleo, uma comunidade fechada) é cifrado no aparelho de quem escreve, com uma chave do grupo. O banco
guarda só o cifrado. Posts públicos continuam abertos: precisam ser lidos, buscados, federados e moderados, e cifrar não protegeria
nada.

## Como funciona

| Peça | Onde | O que faz |
|---|---|---|
| Cifra | `lib/rede/cifra-grupo.ts` | O par de cada pessoa, os embrulhos e o post cifrado. |
| Chaveiro do aparelho | `lib/rede/grupo-chaveiro.ts` | Guarda o par, abre a chave de cada grupo, cria a versão seguinte e cifra e abre posts. |
| Banco | `supabase/migracoes/20261112-rede-grupos-cifrados.sql` | As partes públicas, as versões e os embrulhos. |
| Teste | `npm run testar:cifra-grupo` | A cifra, o banco (Postgres local) e o chaveiro de ponta a ponta. |

- **O par de cada pessoa:** X25519 mais ML-KEM-768 (pós-quântico, FIPS 203, pela biblioteca `@noble/post-quantum` 0.7.1, MIT,
  versão exata). Os dois juntos: quem quebrar só um deles (um computador quântico quebra o X25519; uma falha no ML-KEM, que é novo)
  ainda não abre nada. A parte pública vai para o banco; a privada fica num IndexedDB próprio do aparelho (`lucia-alumia-grupos`),
  que o **"Sair rápido" apaga** junto com o chat.
- **A chave do grupo:** 32 bytes por versão, embrulhada para cada membro. O embrulho junta os dois segredos (X25519 efêmero e
  encapsulamento ML-KEM) no HKDF-SHA-256, amarrado ao grupo, à versão e a quem recebe.
- **O post:** AES-GCM-256 com a chave do grupo, num bloco de tamanho fixo (o mesmo do chat), amarrado ao grupo, à versão e ao autor:
  `p1.<versão>.<vetor>.<cifrado>`.
- **Quem entra e quem sai:** a versão nova precisa trazer o embrulho de **todos** os membros que têm chave publicada, e de ninguém
  mais (o banco confere). Quando alguém sai, o estado do grupo passa a dizer "precisa de versão nova", e o próximo que escrever a
  cria: quem saiu não abre o que vier depois. O que ele já tinha recebido, já tinha (isso não tem volta, em nenhum sistema).
- **Grupos:** `nucleo:<uuid>` e `comunidade:<slug>`. Só membro 18+ pega o estado e cria versão.

## O que continua visível ao servidor

Quem postou, quando, em qual grupo e o tamanho aproximado (em faixas fixas). Não o texto.

## Custos que a tela precisa dizer

- A busca do post cifrado só funciona no aparelho.
- O aviso de post novo sai sem prévia do texto.
- Denunciar envia o trecho em texto aberto, pela pessoa que denuncia (como no chat).
- Nunca federa.
- Quem entra no grupo depois não lê o que foi escrito antes de entrar (a versão antiga não foi embrulhada para ele). Se o grupo
  quiser, quem tem a versão antiga pode repassá-la (fica para uma etapa seguinte).

## O que falta para aparecer na tela (Faixa 1)

Pedido P21 em `docs/rede/PEDIDOS-ENTRE-FAIXAS.md`: uma coluna para o corpo cifrado e o grupo em `rede_posts`, o compositor
chamando `cifrar` quando o público é o núcleo ou a comunidade fechada, o cartão chamando `abrir`, e os textos dos custos acima.
