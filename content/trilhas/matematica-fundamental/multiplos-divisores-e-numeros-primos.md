---
titulo: "Múltiplos, divisores e números primos"
resumo: "A tabuada vista por dentro: o que são múltiplos e divisores, como reconhecer um número primo e para que servem o MMC e o MDC."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Prealgebra 2e, seção 2.4, Find Multiples and Factors"
    autor: "Lynn Marecek e outros (OpenStax)"
    ano: "2020"
    url: "https://openstax.org/books/prealgebra-2e/pages/2-4-find-multiples-and-factors"
  - titulo: "Prealgebra 2e, seção 2.5, Prime Factorization and the Least Common Multiple"
    autor: "Lynn Marecek e outros (OpenStax)"
    ano: "2020"
    url: "https://openstax.org/books/prealgebra-2e/pages/2-5-prime-factorization-and-the-least-common-multiple"
  - titulo: "Os Elementos, livro IX, proposição 20"
    autor: "Euclides"
    ano: "c. 300 a.C."
quiz:
  - pergunta: "Qual destes números é primo?"
    opcoes: ["21", "29", "51"]
    resposta: 1
    explicacao: "21 = 3 × 7 e 51 = 3 × 17. Já 29 só se divide por 1 e por ele mesmo."
  - pergunta: "Um ônibus passa a cada 12 minutos e outro a cada 18. Se passaram juntos agora, daqui a quanto tempo passam juntos de novo?"
    opcoes: ["6 minutos", "30 minutos", "36 minutos"]
    resposta: 2
    explicacao: "É o menor múltiplo comum de 12 e 18: 36."
  - pergunta: "Qual é a decomposição de 60 em fatores primos?"
    opcoes: ["6 × 10", "2 × 2 × 3 × 5", "2 × 30"]
    resposta: 1
    explicacao: "6, 10 e 30 não são primos. Decompondo até o fim: 60 = 2 × 2 × 3 × 5."
---

## Múltiplos: a tabuada que não acaba

Os **múltiplos** de um número são os resultados da sua tabuada, continuada sem parar. Os múltiplos de 6 são 0, 6, 12, 18, 24, 30, 36 e assim por diante. Não existe um último.

## Divisores: quem divide sem deixar resto

Um número é **divisor** de outro quando a divisão dá exata. Os divisores de 12 são 1, 2, 3, 4, 6 e 12. São as maneiras de arrumar 12 cadeiras em fileiras iguais: 1 fileira de 12, 2 de 6, 3 de 4, e as mesmas ao contrário.

As duas ideias andam juntas: se 4 é divisor de 12, então 12 é múltiplo de 4.

## Como saber sem fazer a divisão

| Um número se divide por | quando |
| --- | --- |
| 2 | termina em 0, 2, 4, 6 ou 8 (é par) |
| 3 | a soma dos seus algarismos se divide por 3 |
| 4 | os dois últimos algarismos formam um múltiplo de 4 |
| 5 | termina em 0 ou 5 |
| 6 | se divide por 2 e por 3 |
| 9 | a soma dos seus algarismos se divide por 9 |
| 10 | termina em 0 |

Exemplo: 4.518 se divide por 3? Some os algarismos: 4 + 5 + 1 + 8 = 18. Como 18 se divide por 3, sim. E por 9 também.

## Números primos

Um número é **primo** quando tem exatamente dois divisores: o 1 e ele mesmo. Os primeiros são:

2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47...

Três observações:

- o **1 não é primo**, porque tem um divisor só;
- o **2 é o único primo par**: todo outro par se divide por 2;
- números que não são primos (fora o 0 e o 1) chamam-se **compostos**.

Há mais de dois mil anos, o grego Euclides demonstrou que os primos **nunca acabam**: por maior que seja uma lista de primos, sempre existe mais um fora dela.

### A peneira de Eratóstenes

Para achar os primos até 50, escreva os números de 2 a 50. Circule o 2 e risque todos os outros múltiplos de 2. Circule o 3 e risque os outros múltiplos de 3. Faça o mesmo com o 5 e com o 7. O que sobrar sem risco é primo. O método leva o nome de Eratóstenes, sábio grego do século III a.C.

```verificar
O número 91 é primo?
- Sim, porque é ímpar e não termina em 5
+ Não, porque 91 = 7 × 13
- Sim, porque a soma dos algarismos é 10
> Teste a divisão pelos primos pequenos: 2, 3, 5, 7...
```

## Decompor em fatores primos

Todo número composto pode ser escrito como multiplicação de primos, e de um jeito só (a não ser pela ordem). Divida pelo menor primo possível, e continue:

```
 60 | 2
 30 | 2
 15 | 3
  5 | 5
  1 |
```

Logo, 60 = 2 × 2 × 3 × 5. Os primos são como tijolos: todos os outros números são construídos com eles.

Isso tem uso bem atual. Multiplicar dois primos enormes é rápido; descobrir quais primos foram multiplicados, olhando só o resultado, é demorado até para os computadores. Parte da proteção de senhas e compras pela internet se apoia nessa diferença.

## MMC: o menor múltiplo comum

É o menor número (fora o zero) que é múltiplo de dois ou mais números ao mesmo tempo.

Múltiplos de 12: 12, 24, **36**, 48... Múltiplos de 18: 18, **36**, 54... O MMC de 12 e 18 é 36.

**Para que serve:** coisas que se repetem em ritmos diferentes. Dois ônibus, um a cada 12 e outro a cada 18 minutos, saem juntos às 6h. Voltam a sair juntos 36 minutos depois, às 6h36. O MMC também é o que usamos para somar [frações](/trilhas/matematica-fundamental/fracoes) com denominadores diferentes.

## MDC: o maior divisor comum

É o maior número que divide dois ou mais números ao mesmo tempo. Divisores de 12: 1, 2, 3, 4, **6**, 12. Divisores de 18: 1, 2, 3, **6**, 9, 18. O MDC de 12 e 18 é 6.

**Para que serve:** repartir em grupos iguais sem sobra. Com 48 pães e 36 frutas, quantas cestas iguais dá para montar usando tudo? O MDC de 48 e 36 é 12: são 12 cestas, cada uma com 4 pães e 3 frutas.

## Para praticar

1. Escreva todos os divisores de 36.
2. Sem dividir, diga se 2.340 se divide por 2, 3, 5, 9 e 10.
3. Decomponha 180 em fatores primos.
4. Ache o MMC de 8 e 12 e o MDC de 40 e 60.
5. Um remédio é tomado de 6 em 6 horas e outro de 8 em 8. Os dois foram tomados juntos às 8h da manhã. Quando serão tomados juntos de novo?

**Respostas:** 1) 1, 2, 3, 4, 6, 9, 12, 18 e 36. 2) Por todos: termina em 0 e a soma dos algarismos é 9. 3) 2 × 2 × 3 × 3 × 5. 4) MMC = 24; MDC = 20. 5) Depois de 24 horas, às 8h da manhã seguinte.
