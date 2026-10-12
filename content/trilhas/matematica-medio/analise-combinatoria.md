---
titulo: "Análise combinatória"
resumo: "Contar possibilidades sem listar uma por uma: o princípio multiplicativo, as permutações, os arranjos e as combinações."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Algebra and Trigonometry 2e, seção 13.5, Counting Principles"
    autor: "Jay Abramson e outros (OpenStax)"
    ano: "2021"
    url: "https://openstax.org/books/algebra-and-trigonometry-2e/pages/13-5-counting-principles"
  - titulo: "Mega-Sena (regras e probabilidades)"
    autor: "Caixa Econômica Federal"
    url: "https://loterias.caixa.gov.br/Paginas/Mega-Sena.aspx"
quiz:
  - pergunta: "De quantas maneiras 5 pessoas podem formar uma fila?"
    opcoes: ["25", "120", "5"]
    resposta: 1
    explicacao: "5 × 4 × 3 × 2 × 1 = 120. É o fatorial de 5."
  - pergunta: "Uma associação com 10 membros vai escolher presidente, vice e tesoureiro. Quantas chapas são possíveis?"
    opcoes: ["720", "120", "30"]
    resposta: 0
    explicacao: "A ordem importa (os cargos são diferentes): 10 × 9 × 8 = 720."
  - pergunta: "Do mesmo grupo de 10, quantas comissões de 3 pessoas, sem cargos, podem ser formadas?"
    opcoes: ["720", "120", "30"]
    resposta: 1
    explicacao: "Sem cargos, a ordem não importa. Cada trio foi contado 6 vezes nas 720 chapas: 720 ÷ 6 = 120."
---

## Contar sem enumerar

Quantas senhas de 6 dígitos existem? Quantas chapas podem concorrer em uma eleição? Qual é a chance de acertar na loteria? Listar tudo é impossível. A **análise combinatória** é a arte de contar por raciocínio.

## O princípio multiplicativo

Se uma escolha pode ser feita de 3 maneiras e, depois dela, outra pode ser feita de 2 maneiras, as duas juntas podem ser feitas de 3 × 2 = 6 maneiras.

Com 3 camisas e 2 calças, há 6 trajes. Para cada camisa, duas calças:

```
camisa A ─ calça 1        camisa B ─ calça 1        camisa C ─ calça 1
         └ calça 2                 └ calça 2                 └ calça 2
```

Vale para qualquer número de etapas: **multiplicam-se as quantidades de opções de cada etapa**.

### Senhas

- Senha de 4 dígitos: 10 × 10 × 10 × 10 = 10.000 possibilidades.
- Senha de 6 letras minúsculas: 26⁶ = 308.915.776.
- Senha de 8 caracteres escolhidos entre letras maiúsculas, minúsculas e dígitos (62 símbolos): 62⁸, mais de 218 trilhões.

Cada caractere a mais **multiplica** o trabalho de quem tenta adivinhar. Por isso uma senha longa protege muito mais que uma curta cheia de símbolos.

### Placas

A placa no padrão Mercosul tem quatro letras e três números. São 26⁴ × 10³ = 456.976.000 placas possíveis.

## Permutações: pôr em ordem

De quantas maneiras 5 pessoas formam uma fila? Para o primeiro lugar há 5 opções; para o segundo, as 4 que restam; depois 3, 2 e 1.

5 × 4 × 3 × 2 × 1 = 120

Esse produto de um número por todos os inteiros menores, até o 1, chama-se **fatorial** e escreve-se com ponto de exclamação: 5! = 120. O fatorial cresce muito rápido: 10! já passa de 3,6 milhões.

Os **anagramas** de uma palavra são permutações das suas letras. LUTA tem 4! = 24 anagramas.

Quando há letras repetidas, trocar uma pela outra não muda a palavra, e é preciso dividir. ARARA tem 5 letras, com o A três vezes e o R duas:

```conta
5! ÷ (3! × 2!)
= 120 ÷ (6 × 2)
= 10 anagramas
```

## A pergunta que decide tudo

Antes de escolher a fórmula, pergunte: **a ordem importa?**

- Escolher presidente, vice e tesoureiro: importa. Ana presidente e Bia vice é diferente de Bia presidente e Ana vice.
- Escolher uma comissão de três pessoas, sem cargos: não importa. Ana, Bia e Caio formam a mesma comissão em qualquer ordem.

## Arranjos: a ordem importa

Uma associação com 10 membros elege presidente, vice e tesoureiro:

10 × 9 × 8 = 720 chapas

É o princípio multiplicativo, parando antes do fim. Em fórmula, o arranjo de n elementos tomados p a p é n! ÷ (n − p)!.

## Combinações: a ordem não importa

E quantas comissões de 3 pessoas saem do mesmo grupo de 10? Nas 720 chapas, cada trio aparece várias vezes, uma para cada ordem. Três pessoas se ordenam de 3! = 6 maneiras. Então:

720 ÷ 6 = 120 comissões

Em fórmula, a combinação de n elementos tomados p a p é:

**C(n, p) = n! ÷ [p! × (n − p)!]**

```verificar
Doze pessoas chegam a uma reunião e cada uma aperta a mão de todas as outras, uma vez. Quantos apertos de mão acontecem?
- 144
- 132
+ 66
> Cada aperto envolve um par de pessoas, e a ordem não importa: C(12, 2) = (12 × 11) ÷ 2.
```

## A loteria

Na Mega-Sena, sorteiam-se 6 números entre 60, e a ordem não importa. O total de resultados possíveis é C(60, 6):

```conta
(60 × 59 × 58 × 57 × 56 × 55) ÷ (6 × 5 × 4 × 3 × 2 × 1)
= 50.063.860
```

Com uma aposta simples, a chance de acertar a sena é de 1 em 50.063.860. Para ter uma ideia: fazendo uma aposta simples em todos os sorteios, toda semana, você levaria em média centenas de milhares de anos para acertar uma vez. A aula de [probabilidade](/trilhas/matematica-medio/probabilidade) continua essa conversa.

## Para praticar

1. Uma sorveteria tem 4 sabores e 3 coberturas. Quantos sorvetes de um sabor com uma cobertura são possíveis?
2. Quantos anagramas tem a palavra POVO?
3. Quantas senhas de 4 dígitos existem sem repetir nenhum dígito?
4. De quantas maneiras 8 corredores podem ocupar os três lugares do pódio?
5. Quantas comissões de 4 pessoas podem ser formadas em um grupo de 10?
6. Um campeonato tem 8 times, e cada um joga uma vez contra cada outro. Quantos jogos são?

**Respostas:** 1) 12. 2) 4! ÷ 2! = 12 (o O aparece duas vezes). 3) 10 × 9 × 8 × 7 = 5.040. 4) 8 × 7 × 6 = 336. 5) 210. 6) C(8, 2) = 28.
