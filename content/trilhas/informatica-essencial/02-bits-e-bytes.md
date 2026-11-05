---
titulo: "Bits e bytes"
modelo: 9
resumo: "Como textos, fotos e músicas viram zeros e uns."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Introduction to Computer Science"
    autor: "Jean-Claude Franchitti e outros (OpenStax)"
    ano: "2024"
    url: "https://openstax.org/details/books/introduction-computer-science"
  - titulo: "Code: The Hidden Language of Computer Hardware and Software"
    autor: "Charles Petzold"
    ano: "1999"
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
## O que você vai aprender

Ao fim desta aula você vai saber o que é um bit e um byte, converter um número pequeno para binário, ver como um texto vira número e não confundir megabits com megabytes.

```suarealidade
Quando você contrata internet ou compra um celular ou um cartão de memória, que números aparecem (mega, giga)? Você sabe o que eles significam?
```


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

## Exemplo resolvido

**Escreva o número 13 em binário. Depois, calcule quanto tempo leva para baixar um arquivo de 500 MB em uma conexão de 100 Mb/s.**

**Parte 1: 13 em binário**

1. Em binário, cada posição vale o dobro da anterior: da direita para a esquerda, 1, 2, 4, 8.
2. Procure as posições cuja soma dá 13: 8 + 4 + 1 = 13. O 2 não entra.
3. Marque 1 nas posições usadas e 0 na que sobrou: 8 → 1, 4 → 1, 2 → 0, 1 → 1.
4. Resultado: **1101**.

Confira: 1×8 + 1×4 + 0×2 + 1×1 = 8 + 4 + 0 + 1 = 13.

**Parte 2: tempo de download**

1. A velocidade vem em **megabits** por segundo, e o arquivo em **megabytes**. Um byte tem 8 bits.
2. Converta: 100 Mb/s ÷ 8 = **12,5 MB/s** no máximo.
3. Divida o tamanho pela velocidade: 500 ÷ 12,5 = **40 segundos**.

Na prática leva um pouco mais, porque a velocidade de uma conexão varia. A conta dá o tempo mínimo.

## Pratique

Converta para decimal: `110`, `1010` e `1111`. As respostas são 6, 10 e 15.

```outrolado
# O argumento mais forte de quem discorda
Há quem diga: "Contratei 100 mega, então tenho de baixar 100 megas por segundo. Se baixa menos, estão me enganando."
---
Como você responderia a esse argumento, com respeito e com fatos?
---
A aula mostra de onde vem a diferença, sem acusar ninguém: a velocidade da internet costuma ser medida em megabits por segundo (Mb/s, com b minúsculo), e o tamanho dos arquivos, em megabytes (MB, com B maiúsculo). Como um byte tem 8 bits, uma conexão de 100 Mb/s baixa, no máximo, cerca de 12,5 MB por segundo. Um arquivo de 500 MB leva, no mínimo, 40 segundos, e na prática um pouco mais, porque a velocidade da conexão varia. Saber a diferença ajuda a conferir o que foi contratado.
```

```agir
# Esta semana
Descubra a velocidade do seu plano de internet (ou do wi-fi que você usa) e divida por 8 para saber quantos megabytes por segundo ela baixa, no máximo. Anote o resultado.
```

## Resumo

- Por dentro, o computador é feito de interruptores que estão ligados ou desligados: 1 e 0. Cada 0 ou 1 é um bit, a menor unidade de informação.
- O sistema binário usa dois algarismos e cada posição vale o dobro da anterior (1, 2, 4, 8, 16...).
- 8 bits formam um byte, com 256 combinações, o suficiente para uma letra.
- Texto vira número por uma tabela como a ASCII: A é 65, B é 66, a é 97.
- Unidades: KB (mil bytes), MB (um milhão), GB (um bilhão), TB (um trilhão).
- Bit não é byte: a internet é medida em megabits por segundo (Mb/s) e os arquivos em megabytes (MB); 100 Mb/s baixam, no máximo, cerca de 12,5 MB/s.
