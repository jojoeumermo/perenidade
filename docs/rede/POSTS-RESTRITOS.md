# Grupos cifrados e posts restritos (MLS)

Vão cifrados no aparelho de quem escreve, e o banco guarda só o cifrado: o post curto do Mural do núcleo, o post curto com
público "comunidade" numa comunidade fechada e a resposta curta a um post cifrado (para o mesmo grupo). Ainda vão em **texto
aberto** no núcleo e na comunidade fechada (só quem é do grupo vê, pelas regras de quem vê, e nada disso sai pelo RSS nem pelo
Fediverso, mas o servidor consegue ler): a enquete, o texto longo (dúvida, discussão), o fio, o ato e a resposta a um post do
grupo que não veio cifrado. Posts públicos continuam abertos: precisam ser lidos, buscados, federados e moderados, e cifrar não
protegeria nada.

**Histórico:** 13/11/2026, a cifra de grupo feita à mão saiu e entrou o **MLS** (Messaging Layer Security, RFC 9420, o padrão da
IETF para grupos) pela biblioteca `ts-mls`. **11/2026 (R2):** a biblioteca troca para o **OpenMLS**, pelo pacote
`@wireapp/core-crypto` (o mesmo que o aplicativo Wire usa na versão web), e os posts cifrados pela `ts-mls` são apagados na troca
(ninguém mais teria a chave para abri-los; nada fica esquecido no servidor). O mesmo motor serve ao chat da equipe no painel.

## Como funciona

| Peça | Onde | O que faz |
|---|---|---|
| O motor de grupo | `lib/rede/grupos/motor-de-grupo.ts` | Épocas, um commit por época, entrada e saída, conferência da árvore (`grupo_suspeito`). |
| O aparelho no MLS | `lib/rede/grupos/aparelho.ts`, `pacote.ts` | Uma folha por aparelho, com chave de assinatura própria. |
| Segredos da época | `lib/rede/grupos/epoca.ts` | Do *exporter* do MLS, uma chave por finalidade (embrulho, posts, voz). |
| Embrulho | `lib/rede/grupos/embrulho-da-epoca.ts` | Nada do MLS vai ao servidor sem ele (XChaCha20-Poly1305, tamanhos fixos). |
| Posts e voz | `lib/rede/grupos/chaveiro.ts` | O post `p2` e a chave das salas de voz. |
| No navegador | `lib/rede/grupos/navegador.ts`, `loja-do-navegador.ts`, `apagar.ts` | A loja do motor no OPFS e os segredos de época cifrados no IndexedDB `lucia-alumia-grupos`; o "Sair rápido" apaga os dois. |
| Banco | `supabase/migracoes/20261124-r2-grupos.sql` | Folhas, pacotes de chave, commits embrulhados, boas-vindas, pedidos de entrar de novo. |
| Testes | `scripts/testar-r2-grupos-motor.mjs`, `testar-r2-grupos-banco.mjs`, `testar-r2-grupos-cruzado.mjs`, `testar-cifra-grupo.mjs` | O motor de verdade contra o banco (Postgres local), com ataques do servidor; teste cruzado com a `ts-mls`. |

- **A suíte:** a híbrida pós-quântica do OpenMLS, ML-KEM-768 + X25519 com AES-256-GCM e SHA-384 (número 0xF002). Quem quebrar só
  um dos dois (um computador quântico quebra o X25519; uma falha no ML-KEM, que é novo) não abre nada. A assinatura é Ed25519
  (assinatura só importa contra quem forja AGORA, não contra quem guarda o cifrado para quebrar depois).
- **Épocas:** cada entrada ou saída do grupo é um *commit* que leva o grupo a uma época nova, com segredo novo. O banco aceita
  **um commit por época**, em ordem (quem chega junto recebe `versao_ocupada`, lê o commit da outra pessoa e tenta de novo). O
  aparelho manda o commit ANTES de juntá-lo ao próprio estado: se o banco recusar, a biblioteca desfaz, e o grupo não se parte.
- **O que vai ao banco:** só embrulhado. O commit do MLS sai da biblioteca com quem manda e quem entra às claras; a Alumia o
  embrulha com a chave da época (tirada do *exporter*), num bloco de tamanho fixo. A *GroupInfo* (a árvore inteira em texto
  aberto) **nunca** sai do aparelho: ninguém entra sozinho, só por boas-vindas (*Welcome*, cifradas pelo MLS para o pacote de
  chave de quem entra). O banco não guarda autor nem hora de commit (fica só o dia).
- **Quem é do grupo:** o servidor decide (os membros do núcleo ou da comunidade, como sempre). O aparelho que escreve acerta a
  árvore do MLS com essa lista antes de cifrar: põe quem entrou (com um pacote de chave da pessoa) e tira quem saiu.
- **Aparelho que ficou de fora:** se as boas-vindas de um aparelho vencerem (30 dias) antes de ele abrir, ou falharem, ele pede
  para entrar de novo; o próximo membro que acertar a árvore tira a folha dele e põe de novo, com boas-vindas novas.
- **O post:** o segredo de cada época dá uma chave só para posts daquele grupo naquela época. O post vai em AES-256-GCM com ela,
  num bloco de tamanho fixo, amarrado ao grupo, à época e a quem escreveu: `p2.<época>.<vetor>.<cifrado>`. O aparelho guarda o
  segredo de cada época que viu (cifrado), para reler.
- **Troca de chave sem ninguém entrar ou sair:** a própria folha é renovada (commit de troca de chave) a cada 7 dias ou 100 posts
  na mesma época.

## O que o MLS garante (e onde ele passa do Signal)

- **Quem saiu não lê o que vem depois; quem entrou não lê o que veio antes.**
- **Segurança depois do comprometimento:** se alguém copiar as chaves de um aparelho, elas deixam de servir na próxima época.
  Nos grupos do Signal (*sender keys*), a chave de quem envia só muda quando alguém sai do grupo.
- **Contra computador quântico:** a troca de chaves já é híbrida. O Signal tem isso na conversa a dois (PQXDH), não nos grupos.
- **O servidor não põe chave falsa nem aparelho-fantasma sem o aparelho notar:** cada aparelho é uma folha com chave de
  assinatura própria, e (desde a onda R3) cada folha leva um **certificado assinado pela identidade da conta** (a mesma do chat,
  publicada no registro público de chaves): conta, nome da folha e impressão da chave da folha. Antes de pôr alguém no grupo, e ao
  conferir a árvore, o aparelho confere o certificado e que a identidade dele é a que o registro mostra para a conta. Sem certificado,
  com o de outra conta, de outra folha ou de outra chave, a folha não entra (`grupo_suspeito` se já estiver na árvore). Depois de
  aceita, a chave de cada folha fica guardada, e uma folha conhecida com outra chave derruba o grupo. Conta conhecida com aparelho
  novo (certificado) entra com um **aviso forte** no compositor, que diz também quando a identidade da conta mudou. Para escrever e
  ler nos grupos cifrados, o chat precisa estar ligado no aparelho (é a identidade dele que assina a folha).

## O que continua visível ao servidor

Quem é do grupo (isso é do núcleo ou da comunidade), quais aparelhos cada conta tem, quem postou, em qual grupo, em qual época, o
dia, e o tamanho aproximado (em faixas fixas). Não o texto, não quem fez cada commit, não quem entrou em cada época.

## Limites, ditos com franqueza

- **A suíte híbrida usa número de faixa privada** (0xF002): o padrão da IETF para suítes pós-quânticas no MLS ainda não terminou.
  Ela está numa versão publicada e documentada do OpenMLS, mas não é a suíte padrão do Wire.
- **Os vetores de teste do RFC 9420 não rodam contra a biblioteca** (ela não expõe as funções internas). Em troca, há um teste
  cruzado com a `ts-mls` (que passa nos vetores da IETF): boas-vindas, commits e mensagens de uma abrem na outra.
- O certificado da folha vale o que vale o registro público de chaves: quem tem a identidade da conta (a pessoa, ou quem tomou um
  aparelho dela com o chat aberto) liga aparelhos, e o aviso forte é o que torna isso visível. O registro, sem comparar a vista com
  outros aparelhos, não pega um servidor que mostre um registro bifurcado desde a primeira vez.
- **O post vai pela chave do grupo, sem a assinatura de quem escreveu.** A chave da época é a mesma para todos do grupo, e o "de
  quem" vai amarrado ao cifrado, não assinado. Um membro do grupo, com o servidor junto, consegue publicar um post que abre como
  se fosse de outro membro. Quem é de fora do grupo não consegue. A mensagem de aplicação do MLS (assinada pela folha) não serve
  para posts que se releem depois (a biblioteca apaga a chave de cada mensagem depois de abrir).
- O nome de cada folha leva a conta (o servidor já sabe quem é do grupo, e os commits saem embrulhados). Esconder quem é de cada
  grupo é outra parte da mesma reforma (grupos com membros escondidos).
- Quem entra depois não lê o que veio antes (é o que o MLS garante). Repassar o histórico, se o grupo quiser, fica para depois.
- Aparelho novo ou depois do "Sair rápido": a pessoa entra de novo no grupo e lê dali para a frente; o que veio antes não abre
  mais neste aparelho.
- A loja do motor no navegador é cifrada com uma chave que o navegador guarda sem deixar exportar: protege contra quem copia os
  arquivos, não contra quem usa o navegador desbloqueado.

## Custos que a tela precisa dizer

- A busca do post cifrado só funciona no aparelho.
- O aviso de post novo sai sem prévia do texto.
- Denunciar envia o trecho em texto aberto, pela pessoa que denuncia (como no chat).
- Nunca federa.
