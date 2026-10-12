---
titulo: "Funções: a ideia"
resumo: "Quando uma quantidade depende de outra: a regra, a tabela e o gráfico que mostram essa dependência."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Algebra and Trigonometry 2e, seção 3.1, Functions and Function Notation"
    autor: "Jay Abramson e outros (OpenStax)"
    ano: "2021"
    url: "https://openstax.org/books/algebra-and-trigonometry-2e/pages/3-1-functions-and-function-notation"
  - titulo: "Algebra and Trigonometry 2e, seção 3.2, Domain and Range"
    autor: "Jay Abramson e outros (OpenStax)"
    ano: "2021"
    url: "https://openstax.org/books/algebra-and-trigonometry-2e/pages/3-2-domain-and-range"
quiz:
  - pergunta: "Se f(x) = 3x − 2, quanto vale f(4)?"
    opcoes: ["10", "14", "5"]
    resposta: 0
    explicacao: "Troque o x por 4: 3 × 4 − 2 = 10."
  - pergunta: "Qual destas relações NÃO é uma função?"
    opcoes: ["Cada pessoa e a sua data de nascimento", "Cada data e as pessoas nascidas nela", "Cada número e o seu dobro"]
    resposta: 1
    explicacao: "Em uma mesma data nascem muitas pessoas. Numa função, cada entrada tem uma saída só."
  - pergunta: "O que é o domínio de uma função?"
    opcoes: ["O conjunto dos valores que podem entrar", "O maior valor que ela atinge", "O ponto em que o gráfico corta o eixo"]
    resposta: 0
    explicacao: "O domínio reúne as entradas permitidas; a imagem, as saídas que de fato aparecem."
---

## Uma coisa depende da outra

O valor da conta de luz depende do consumo. O preço da corrida depende da distância. O salário de quem ganha por produção depende do que foi produzido. Em matemática, quando uma quantidade depende de outra segundo uma regra, fala-se em **função**.

O que faz de uma relação uma função é uma exigência só:

> **cada entrada tem exatamente uma saída.**

Pense em uma máquina: você põe um valor, ela aplica a regra e devolve um resultado. O mesmo valor posto duas vezes tem de dar o mesmo resultado.

- "Cada pessoa e a sua data de nascimento" é função: ninguém nasce em duas datas.
- "Cada data e as pessoas nascidas nela" **não** é função: a mesma data leva a muita gente.

Repare que duas entradas diferentes podem ter a mesma saída (duas pessoas nascidas no mesmo dia). O que não pode é uma entrada com duas saídas.

## A escrita f(x)

Uma corrida de aplicativo custa R$ 4 de taxa fixa mais R$ 2 por quilômetro. Chamando de x os quilômetros, o preço é:

f(x) = 4 + 2x

Lê-se "f de x". O x é a **variável independente** (a que você escolhe); o resultado f(x), muitas vezes chamado de y, é a **variável dependente**.

Calcular a função em um ponto é trocar o x pelo valor:

```conta
f(5) = 4 + 2 × 5 = 14
f(11) = 4 + 2 × 11 = 26
= 5 km custam R$ 14; 11 km custam R$ 26
```

Atenção: f(5) **não** quer dizer "f vezes 5". Quer dizer "o valor da função quando x é 5".

## Três jeitos de mostrar a mesma função

**A regra (fórmula):** f(x) = 4 + 2x.

**A tabela:**

| Distância (km) | 0 | 1 | 2 | 5 | 10 |
| --- | --- | --- | --- | --- | --- |
| Preço (R$) | 4 | 6 | 8 | 14 | 24 |

**O gráfico:** no **plano cartesiano**, traçam-se dois eixos em ângulo reto. O eixo horizontal (x) recebe as entradas; o vertical (y), as saídas. Cada linha da tabela vira um ponto: (0, 4), (1, 6), (2, 8)... Ligando os pontos, aparece o desenho da função. Nesse caso, uma reta que sobe.

Cada forma tem a sua vantagem: a fórmula calcula qualquer valor, a tabela dá o valor pronto e o gráfico mostra o comportamento de uma vez.

```verificar
Uma vendedora recebe R$ 1.200 fixos mais R$ 30 por venda. Qual função dá o salário para x vendas?
- f(x) = 1.230x
+ f(x) = 1.200 + 30x
- f(x) = 30 + 1.200x
> A parte fixa não depende de x. A parte variável é 30 para cada venda.
```

## Domínio e imagem

O **domínio** é o conjunto dos valores que podem entrar na função. A **imagem** é o conjunto dos valores que saem.

Na corrida, não existe distância negativa: o domínio são os números maiores ou iguais a zero. Como o preço começa em 4 e só sobe, a imagem são os valores a partir de 4.

Em fórmulas sem contexto, o domínio são todos os números reais para os quais a conta faz sentido. Há duas proibições clássicas:

- **não se divide por zero:** em f(x) = 1/x, o zero fica fora do domínio;
- **não há raiz quadrada real de número negativo:** em f(x) = √x, só entram os números maiores ou iguais a zero.

## Lendo um gráfico

- A função é **crescente** onde o gráfico sobe da esquerda para a direita, e **decrescente** onde desce.
- Os pontos em que o gráfico corta o eixo x são os **zeros** da função: os valores de x para os quais f(x) = 0.
- O ponto em que corta o eixo y é o valor de f(0).

Para saber se um desenho é gráfico de função, imagine uma reta vertical passeando por ele. Se em algum lugar ela cortar o desenho em **dois pontos**, não é função: aquele x teria duas saídas. Um círculo, por exemplo, não é gráfico de função.

## Por que isso importa

Função é a ferramenta para descrever como o mundo muda: como o preço da cesta muda com o tempo, como a produção muda com as horas trabalhadas, como uma doença se espalha. As próximas aulas apresentam as famílias mais usadas: a [função do 1º grau](/trilhas/matematica-medio/funcao-do-1-grau), que cresce sempre no mesmo passo; a [do 2º grau](/trilhas/matematica-medio/funcao-do-2-grau), que sobe e desce; e a [exponencial](/trilhas/matematica-medio/exponencial-e-logaritmo), que multiplica.

## Para praticar

1. Com f(x) = 3x − 2, calcule f(0), f(4) e f(−1).
2. Para que valor de x a função do exercício 1 vale 13?
3. Qual é o domínio de f(x) = 1/(x − 3)?
4. A relação "cada trabalhador e o seu número de CPF" é função? E "cada sobrenome e as pessoas que o têm"?
5. Um estacionamento cobra R$ 8 pela primeira hora e R$ 3 por hora adicional. Monte uma tabela do preço para 1, 2, 3 e 4 horas.

**Respostas:** 1) −2, 10 e −5. 2) x = 5. 3) Todos os reais, menos o 3. 4) Sim; não. 5) R$ 8, R$ 11, R$ 14 e R$ 17.
