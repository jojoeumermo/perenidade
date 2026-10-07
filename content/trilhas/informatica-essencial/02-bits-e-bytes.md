---
titulo: "Bits e bytes"
resumo: "Como textos, fotos e músicas viram zeros e uns."
autores: ["Equipe Projeto Lucia"]
quiz:
  - pergunta: "Quantos bits tem um byte?"
    opcoes: ["2", "8", "10"]
    resposta: 1
    explicacao: "Um byte é um grupo de 8 bits."
  - pergunta: "Quanto vale o número binário 101 em decimal?"
    opcoes: ["3", "5", "101"]
    resposta: 1
    explicacao: "Da direita para a esquerda as posições valem 1, 2 e 4. Em 101 estão ligadas a de 4 e a de 1: 4 + 1 = 5."
  - pergunta: "Quantas combinações diferentes cabem em 8 bits?"
    opcoes: ["16", "64", "256"]
    resposta: 2
    explicacao: "Cada bit dobra o número de combinações: 2 multiplicado por si mesmo 8 vezes dá 256."
---

## Por que só zeros e uns

Por dentro, um computador é feito de bilhões de interruptores minúsculos. Cada um só pode estar em dois estados: ligado ou desligado. Representamos esses dois estados com **1** e **0**.

Cada 0 ou 1 é um **bit**, a menor unidade de informação. Sozinho, um bit diz pouco: sim ou não. O segredo está em juntar muitos.

## Contando em binário

No dia a dia usamos o sistema **decimal**, com dez algarismos (0 a 9). Cada posição vale dez vezes a anterior: unidade, dezena, centena.

O computador usa o sistema **binário**, com dois algarismos (0 e 1). Cada posição vale o **dobro** da anterior: 1, 2, 4, 8, 16...

| Decimal | Binário | Como ler |
| --- | --- | --- |
| 0 | 0 | |
| 1 | 1 | |
| 2 | 10 | um 2 e nenhum 1 |
| 3 | 11 | um 2 e um 1 |
| 4 | 100 | um 4 |
| 5 | 101 | um 4 e um 1 |
| 6 | 110 | um 4 e um 2 |
| 7 | 111 | um 4, um 2 e um 1 |
| 8 | 1000 | um 8 |

Para converter um binário em decimal, some o valor das posições que têm 1. Em `1101`, da direita para a esquerda as posições valem 1, 2, 4 e 8. Estão ligadas as de 8, 4 e 1: 8 + 4 + 1 = **13**.

## O byte

Um grupo de 8 bits forma um **byte**. Com 8 bits é possível formar 256 combinações diferentes (de `00000000` a `11111111`), o suficiente para representar, por exemplo, uma letra.

## Como o texto vira número

O computador só guarda números. Para guardar texto, usa-se uma tabela que dá um número a cada caractere. Na tabela **ASCII**, criada nos anos 1960:

- `A` é o número 65, em binário `01000001`
- `B` é o número 66, em binário `01000010`
- `a` é o número 97, em binário `01100001`

A tabela ASCII só cobria o alfabeto inglês. Hoje o padrão é o **Unicode**, que dá um número a cada caractere de praticamente todos os sistemas de escrita, incluindo letras acentuadas, ideogramas e emojis. A forma mais comum de gravá-lo é a codificação **UTF-8**.

O mesmo princípio vale para tudo: uma foto é uma grade de pontos, cada um com números que indicam a cor. Uma música é uma longa lista de números que descrevem a onda sonora.

## Medindo tamanhos

| Unidade | Vale cerca de | Exemplo |
| --- | --- | --- |
| Kilobyte (KB) | mil bytes | Uma página de texto simples |
| Megabyte (MB) | um milhão de bytes | Uma foto de celular tem alguns MB |
| Gigabyte (GB) | um bilhão de bytes | Um filme em alta definição tem alguns GB |
| Terabyte (TB) | um trilhão de bytes | Um disco rígido grande |

> Você talvez encontre a informação de que 1 KB são 1.024 bytes, e não 1.000. As duas convenções existem: os fabricantes de discos contam de mil em mil, e alguns sistemas operacionais contam de 1.024 em 1.024. É por isso que um disco vendido como "500 GB" pode aparecer com um número menor no computador.

## Atenção: bit não é byte

Velocidade de internet costuma ser medida em **megabits** por segundo (Mb/s, com b minúsculo), e tamanho de arquivo em **megabytes** (MB, com B maiúsculo). Como um byte tem 8 bits, uma conexão de 100 megabits por segundo baixa, no máximo, cerca de 12,5 megabytes por segundo.

## Pratique

Converta para decimal: `110`, `1010` e `1111`. As respostas são 6, 10 e 15.
