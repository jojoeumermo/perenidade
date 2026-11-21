# Provas formais da Alumia

Modelos em [ProVerif](https://bblanche.gitlabpages.inria.fr/proverif/) 2.05 dos protocolos do chat e do modo sem internet (onda R3,
item 2.5). O ProVerif prova propriedades no **modelo simbólico**: as cifras são perfeitas (só abre quem tem a chave) e o atacante
controla a rede inteira (no nosso caso, o servidor e todo aparelho por perto). Ele não prova que as bibliotecas estão certas nem acha
erro de programação fora do que o modelo descreve: isso fica com os testes (`scripts/testar-r2-*.mjs`, `scripts/testar-r3-*.mjs`) e
com a auditoria externa.

## Como rodar

Precisa só do Docker. Na raiz do repositório:

```sh
sh provas/rodar.sh
npm run testar:r3-provas
```

O primeiro comando sobe um contêiner descartável com a imagem oficial do OCaml (fixada pelo resumo), instala o ProVerif 2.05 pelo
opam, roda todos os modelos e grava a saída em `provas/resultados/` (um arquivo por modelo, com o SHA-256 do modelo rodado). Leva uns
5 minutos, quase todos instalando o ProVerif. O segundo confere que cada saída é do modelo de agora e bate com `provas/esperado.json`.

## O que cada modelo prova

| Modelo | Propriedade | Resultado |
|---|---|---|
| `remetente-selado.pv` | sigilo da mensagem; se B aceita uma mensagem como vinda do aparelho de A, A a mandou para aquela caixa, com aquela franquia | provado |
| `remetente-selado-anonimato.pv` | o servidor não distingue qual de duas pessoas mandou para a mesma caixa (anonimato do remetente) | provado |
| `caixas-nao-ligacao.pv` | o servidor não distingue duas caixas da mesma pessoa de caixas de pessoas diferentes (não ligação das caixas) | provado |
| `grupos-epoca.pv` | quem não é membro da época não deriva a caixa nem a chave do grupo, não lê e não se passa por membro | provado |
| `grupos-anonimato.pv` | o servidor não distingue qual membro depositou na caixa do grupo | provado |
| `passes-cegos.pv` | o passe gasto (sem sessão) não se liga a quem o pediu (com sessão), nem para o emissor | provado |
| `voto-limiar.pv` | com K−1 guardiãs corrompidas, a semente da votação e o voto ficam secretos | provado |
| `voto-sigilo.pv` | trocar os votos de duas eleitoras não muda nada que vê quem tem o banco inteiro (sigilo do voto) | provado |
| `voto-sigilo-servidor-ativo.pv` | o mesmo, contra o servidor que muda o que entra na urna | **ataque** (abaixo) |
| `sem-internet.pv` | sigilo e autenticação pela malha; a validade não se estende; o farol só vale com uma assinatura honesta (exige duas) | provado |
| `sem-internet-nao-ligacao.pv` | quem repassa não distingue o destino | provado |
| `sem-internet-remetente.pv` | quem repassa não distingue o remetente | provado |
| `sem-internet-cobertura.pv` | mensagem e farol são iguais a pacotes de cobertura para quem repassa | provado |
| `camada-pq.pv` | a mensagem fica secreta se um dos dois ratchets (o clássico ou o pós-quântico) se mantém | provado |

Os **controles** (`provas/controles/`) são os mesmos modelos com uma defesa tirada de propósito. Cada um tem de dar ataque: é o que
mostra que os modelos não são vazios.

| Controle | A defesa tirada | Resultado |
|---|---|---|
| `sem-internet-etiqueta-sem-corpo.pv` | a etiqueta sem o resumo do corpo | ataque: emendar cabeçalho novo em corpo velho e fazer um pacote vencido valer de novo |
| `sem-internet-etiqueta-sem-nonce.pv` | o nonce sorteado da etiqueta | ataque: dois pacotes para a mesma caixa se ligam |
| `sem-internet-farol-uma-assinatura.pv` | a segunda assinatura do farol | ataque: uma pessoa corrompida da coordenação faz o farol sozinha |

## O que os modelos acharam

1. **A etiqueta da malha sem internet não prendia o corpo** (primeira versão de `lib/rede/malha/pacote.ts`). Quem repassa podia
   guardar um pacote velho e, quando passasse um novo para a mesma caixa, pôr o cabeçalho do novo no corpo do velho: o destino
   reconhecia e abria a mensagem velha com uma validade que ninguém deu. **Consertado**: a etiqueta passou a levar o SHA-256 do corpo
   (`controles/sem-internet-etiqueta-sem-corpo.pv` é a versão de antes; `sem-internet.pv`, a de agora). O teste do ataque está em
   `scripts/testar-r3-malha.mjs`.
2. **O sigilo do voto contra o servidor ativo** (`voto-sigilo-servidor-ativo.pv`). O servidor emite os passes da urna; quem o tomar
   pode jogar fora a cédula de uma eleitora e pôr uma dele no lugar. As conferências da urna (cédula repetida; não mais cédulas que
   pessoas) passam, e o resultado diz o voto de quem sobrou. É o ataque clássico de quem controla a urna. **Em aberto**: o resultado
   só sai com 3 cédulas ou mais (isolar um voto exige trocar todas as outras), e o conserto é a verificação individual (cada eleitora
   confere que a cédula dela está na lista que a abridora abriu, publicada antes do resultado).

## O que fica de fora (dito sem rodeio)

- A repetição e a ordem: o ProVerif não guarda bem o estado "já vi este pacote". O código recusa a repetição pelo resumo do corpo (malha)
  e pela ordem da conversa (contador e `anterior`); os testes cobrem isso.
- O tempo, o tamanho e o IP: os modelos não veem horário, tamanho nem endereço. Os tamanhos são fixos no código; os horários e o
  endereço são do transporte (vias, agenda e cobertura).
- As bibliotecas: Proteus (Double Ratchet, `@wireapp/core-crypto`), OpenMLS, X-Wing e HPKE, Shamir, RSA cego e o SPQR do Signal entram
  como primitivas perfeitas. O SPQR e o ML-KEM da libcrux têm as próprias análises formais; o resto, auditorias e vetores de teste.
- O Shamir entra como "duas partes diferentes refazem a semente" (K = 2, N = 3); outros K e N não foram modelados.
