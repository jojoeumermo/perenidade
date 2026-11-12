# Grupos cifrados e posts restritos (MLS)

O que só um grupo lê (o núcleo, uma comunidade fechada) é cifrado no aparelho de quem escreve. O banco guarda só o cifrado. Posts
públicos continuam abertos: precisam ser lidos, buscados, federados e moderados, e cifrar não protegeria nada.

**13/11/2026:** a cifra de grupo feita à mão (C1, `lib/rede/cifra-grupo.ts` e `20261112-rede-grupos-cifrados.sql`) saiu e foi
substituída por **MLS** (Messaging Layer Security, RFC 9420, o padrão da IETF para grupos), pela biblioteca `ts-mls`. A C1 nunca
rodou em produção: nada a migrar.

## Como funciona

| Peça | Onde | O que faz |
|---|---|---|
| MLS no aparelho | `lib/rede/grupo-mls.ts` | Pacotes de chave, entrar e sair do grupo, épocas, e o post cifrado. |
| Guarda no navegador | `lib/rede/grupo-chaveiro.ts` | IndexedDB próprio (`lucia-alumia-grupos`), que o "Sair rápido" apaga inteiro. |
| Banco | `supabase/migracoes/20261113-rede-grupos-mls.sql` | Pacotes de chave, o registro dos commits em ordem, a GroupInfo e as boas-vindas. |
| Teste | `npm run testar:cifra-grupo` | O MLS de verdade contra o banco (Postgres local), com ataque do servidor. |

- **A suíte:** `MLS_256_XWING_AES256GCM_SHA512_Ed25519`. A troca de chaves é **híbrida**: X-Wing junta X25519 e ML-KEM-768
  (pós-quântico, FIPS 203). Quem quebrar só um dos dois (um computador quântico quebra o X25519; uma falha no ML-KEM, que é novo)
  não abre nada. A assinatura é Ed25519 (a assinatura pós-quântica ML-DSA existe na biblioteca, mas deixa cada pacote muito maior;
  assinatura só importa contra quem forja AGORA, não contra quem guarda o cifrado para quebrar depois).
- **Épocas:** cada entrada ou saída do grupo é um *commit* que leva o grupo a uma época nova, com segredo novo. O banco aceita um
  commit por vez, em ordem (`p_epoca` = atual + 1; quem chega junto recebe `versao_ocupada`, lê o commit da outra pessoa e tenta
  de novo).
- **Quem é do grupo:** o servidor decide (os membros do núcleo ou da comunidade, como sempre). O aparelho que escreve acerta a
  árvore do MLS com essa lista antes de cifrar: põe quem entrou (com um pacote de chave da pessoa, ou ela entra sozinha depois pela
  GroupInfo) e tira quem saiu.
- **O post:** o segredo de cada época dá, pelo *exporter* do MLS, uma chave de 32 bytes só para posts daquele grupo naquela época.
  O post vai em AES-256-GCM com ela, num bloco de tamanho fixo (o mesmo do chat), amarrado ao grupo, à época e a quem escreveu:
  `p2.<época>.<vetor>.<cifrado>`. O aparelho guarda a chave de cada época que viu, para reler.

## O que o MLS garante (e onde ele passa do Signal)

- **Quem saiu não lê o que vem depois; quem entrou não lê o que veio antes.**
- **Segurança depois do comprometimento:** se alguém copiar as chaves de um aparelho, elas deixam de servir na próxima época
  (quando alguém entra, sai ou atualiza a chave). Nos grupos do Signal (sender keys), a chave de quem envia só muda quando alguém
  sai do grupo.
- **Contra computador quântico:** a troca de chaves já é híbrida (X-Wing). O Signal tem isso na conversa a dois (PQXDH), não nos
  grupos.
- **O servidor não põe chave falsa sem o aparelho notar:** cada conta tem uma chave de assinatura por aparelho, usada em todos os
  pacotes. O aparelho guarda a de cada pessoa na primeira vez ("confiar na primeira vez") e **recusa escrever** num grupo em que
  alguém aparece com outra chave, ou duas vezes (`grupo_suspeito`). O teste prova: o servidor monta à mão um commit com outra
  chave "da Bia", e a Ana recusa.

## O que continua visível ao servidor

Quem é do grupo (isso é do núcleo ou da comunidade, já era público para os membros), quem postou, quando, em qual grupo, em qual
época, e o tamanho aproximado (em faixas fixas). Não o texto.

## Limites, ditos com franqueza

- **A biblioteca `ts-mls` não passou por auditoria externa** (ela diz isso no próprio manual). Ela implementa o padrão e passa nos
  vetores de teste da IETF. A auditoria externa do chat e dos grupos está na lista do coordenador antes de anunciar.
- O "confiar na primeira vez" depende de comparar a chave por fora na primeira vez para ser à prova de tudo. A transparência de
  chaves (registro público verificável, com QR) é a etapa seguinte.
- Quem entra depois não lê o que veio antes (é o que o MLS garante). Repassar o histórico, se o grupo quiser, fica para depois.
- Aparelho novo ou depois do "Sair rápido": a pessoa entra de novo no grupo e lê dali para a frente; o que veio antes não abre
  mais neste aparelho.

## Custos que a tela precisa dizer

- A busca do post cifrado só funciona no aparelho.
- O aviso de post novo sai sem prévia do texto.
- Denunciar envia o trecho em texto aberto, pela pessoa que denuncia (como no chat).
- Nunca federa.

## O que falta para aparecer na tela (Faixa 1)

Pedido P21 em `docs/rede/PEDIDOS-ENTRE-FAIXAS.md`, com a interface de sempre: `criarChaveiroDeGrupo({ chamar, guarda })` →
`preparar(usuario)`, `cifrar(grupo, usuario, texto)` → `"p2.…"`, `abrir(grupo, usuario, autor, corpo)` → texto ou `null`,
`esquecer()`. A `guarda` agora é chave → valor (`guardaNoNavegador()` em `lib/rede/grupo-chaveiro.ts`). O corpo tem até ~11.000
caracteres (bloco de 8192 bytes).
