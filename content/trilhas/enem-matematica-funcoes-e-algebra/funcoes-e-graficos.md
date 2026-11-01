---
titulo: "Função e leitura de gráficos"
resumo: "O que é uma função, como ler um gráfico cartesiano e como medir a rapidez de uma mudança: a base de toda a álgebra do ENEM."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Matriz de Referência do Enem"
    autor: "Instituto Nacional de Estudos e Pesquisas Educacionais Anísio Teixeira (Inep)"
  - titulo: "Algebra and Trigonometry 2e, seção 3.1, Functions and Function Notation"
    autor: "Jay Abramson e outros (OpenStax)"
    ano: "2021"
    url: "https://openstax.org/books/algebra-and-trigonometry-2e/pages/3-1-functions-and-function-notation"
  - titulo: "Algebra and Trigonometry 2e, seção 3.2, Domain and Range"
    autor: "Jay Abramson e outros (OpenStax)"
    ano: "2021"
    url: "https://openstax.org/books/algebra-and-trigonometry-2e/pages/3-2-domain-and-range"
  - titulo: "Algebra and Trigonometry 2e, seção 4.1, Linear Functions"
    autor: "Jay Abramson e outros (OpenStax)"
    ano: "2021"
    url: "https://openstax.org/books/algebra-and-trigonometry-2e/pages/4-1-linear-functions"
quiz:
  - pergunta: "No gráfico de uma função f, aparece o ponto (3, 7). Isso quer dizer que:"
    opcoes: ["f(7) = 3", "f(3) = 7", "3 + 7 = 10 é o valor da função", "a curva corta os eixos em 3 e em 7"]
    resposta: 1
    explicacao: "Num ponto (x, y), o primeiro número é a entrada e o segundo é a saída. Então, quando x = 3, a função vale 7: f(3) = 7."
  - pergunta: "Uma grandeza passa de 10, quando x = 2, para 30, quando x = 6. Qual é a taxa média de variação nesse trecho?"
    opcoes: ["20", "4", "2", "5"]
    resposta: 3
    explicacao: "Taxa média = variação de y ÷ variação de x = (30 − 10) ÷ (6 − 2) = 20 ÷ 4 = 5. Quem marca 20 esqueceu de dividir pelo intervalo de x."
  - pergunta: "Num gráfico de distância (vertical) por tempo (horizontal), um trecho reto e horizontal quer dizer que a pessoa:"
    opcoes: ["ficou parada", "andou muito depressa", "voltou ao ponto de partida", "andou para trás"]
    resposta: 0
    explicacao: "No trecho horizontal o tempo passa, mas a distância não muda. A pessoa está parada. Rapidez se vê na inclinação: quanto mais em pé o trecho, mais rápido."
  - pergunta: "O plano A de celular custa R$ 40 fixos. O plano B custa R$ 20 mais R$ 0,25 por minuto. A partir de quantos minutos o plano A passa a valer mais a pena?"
    opcoes: ["160", "60", "80", "20"]
    resposta: 2
    explicacao: "Os dois custam o mesmo quando 20 + 0,25x = 40, isto é, 0,25x = 20 e x = 80 minutos. Acima de 80 minutos, o B passa de R$ 40 e o A fica mais barato."
---

```provocacao
Na conta de água, o valor a pagar depende de quanto você gastou. Se a sua casa gastar o dobro de água num mês, a conta vem com o dobro do valor? Como saber, só olhando a tabela da companhia ou um gráfico?
```

## O que você vai aprender

Ao fim desta aula você vai saber o que é uma função, ler um gráfico cartesiano sem se perder, dizer onde ele sobe, desce ou fica parado, e calcular a taxa de variação: a rapidez com que uma grandeza muda. É a base de todas as outras aulas desta trilha.

## Uma coisa que depende da outra

Imagine uma corrida de táxi que custa R$ 5,00 de saída mais R$ 2,50 por quilômetro (é um exemplo, não uma tarifa real). O preço depende da distância. Se a corrida tem 4 km, o preço é 5 + 2,5 × 4 = R$ 15,00.

Nesse caso, a distância é a **variável independente**: você escolhe. O preço é a **variável dependente**: ele vem da distância. Em matemática se escreve assim:

```formula
y = f(x)
y é o valor que sai quando x entra; lê-se "y é igual a f de x"
no táxi: f(x) = 5 + 2,5x, em que x é a distância em quilômetros e f(x) é o preço em reais
```

Uma **função** é uma regra que, para cada valor de entrada, dá **um único** valor de saída. A mesma corrida não pode ter dois preços. Se, para um mesmo x, aparecerem dois valores de y, não é função.

Dois nomes aparecem na prova:

- **Domínio:** os valores que x pode ter. No táxi, a distância não pode ser negativa.
- **Imagem:** os valores que y de fato assume. No táxi, o preço nunca é menor que R$ 5,00.

## O gráfico cartesiano

O gráfico cartesiano tem dois eixos. O horizontal é o das entradas (x). O vertical é o das saídas (y). Cada ponto (x, y) diz: "quando a entrada é x, a saída é y".

Antes de qualquer conta, leia três coisas:

1. **O título**: do que o gráfico fala.
2. **Os eixos**: que grandeza está em cada um, e em que unidade (horas, litros, reais, milhares).
3. **A escala**: de quanto em quanto os números andam. Um eixo pode não começar no zero, e isso muda a impressão de quem olha.

Veja um exemplo. Um morador anotou o volume de água na caixa-d'água de um prédio ao longo de um dia (valores de exemplo):

| hora | 0 | 2 | 4 | 6 | 8 | 10 | 12 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| volume (litros) | 1.000 | 1.000 | 700 | 500 | 500 | 800 | 1.000 |

Em palavras, o gráfico desses pontos, ligados por segmentos de reta, conta esta história: das 0 às 2 h a linha fica reta e horizontal, em 1.000 litros. Das 2 às 6 h ela desce até 500 litros, mais inclinada no começo. Das 6 às 8 h fica horizontal de novo. Das 8 às 12 h sobe até voltar a 1.000 litros.

## Sobe, desce, fica parado

Ler um gráfico é contar essa história. Os nomes certos são:

- **Crescente:** quando x aumenta, y aumenta. A linha sobe da esquerda para a direita (das 8 às 12 h).
- **Decrescente:** quando x aumenta, y diminui. A linha desce (das 2 às 6 h).
- **Constante:** y não muda. A linha é horizontal (das 0 às 2 h e das 6 às 8 h).
- **Máximo e mínimo:** o ponto mais alto e o mais baixo. Aqui, o máximo é 1.000 litros e o mínimo é 500 litros.

Cuidado: "mais alto" no gráfico não quer dizer "mais rápido". A altura diz o valor. A rapidez da mudança se vê na **inclinação**.

## A taxa de variação

Para medir a rapidez, use a taxa média de variação:

```formula
taxa = (y₂ − y₁) ÷ (x₂ − x₁)
a taxa média de variação é quanto o y mudou, dividido por quanto o x mudou
o sinal diz o sentido: positivo, a grandeza aumenta; negativo, diminui
a unidade é a de y por unidade de x: litros por hora, reais por dia, quilômetros por minuto
```

Das 2 às 4 h, a caixa foi de 1.000 para 700 litros: (700 − 1.000) ÷ (4 − 2) = −300 ÷ 2 = −150 litros por hora. Das 4 às 6 h, foi de 700 para 500: −200 ÷ 2 = −100 litros por hora. O nível desceu mais depressa no primeiro trecho, e o gráfico mostra isso com uma linha mais inclinada.

```verificar
Se f(x) = 3x − 2, quanto vale f(4)?
- 4
+ 10
- 14
> Troque o x por 4: 3 × 4 − 2 = 12 − 2 = 10.
```

## Dois gráficos no mesmo plano

Muitas questões põem duas funções no mesmo gráfico para comparar. O ponto em que as linhas se cruzam é onde as duas valem o mesmo. Antes dele, uma é menor; depois dele, a outra.

Exemplo: o plano A de celular custa R$ 40,00 fixos por mês. O plano B custa R$ 20,00 mais R$ 0,25 por minuto. Em tabela:

| minutos | 0 | 40 | 80 | 120 |
| --- | --- | --- | --- | --- |
| plano A (R$) | 40 | 40 | 40 | 40 |
| plano B (R$) | 20 | 30 | 40 | 50 |

Em palavras: a linha do plano A é horizontal; a do B começa mais baixa e sobe. Elas se cruzam em 80 minutos, quando os dois custam R$ 40,00. Quem fala menos de 80 minutos paga menos no B; quem fala mais, paga menos no A.

```navidareal
Volte à conta de água da provocação. Quando a companhia cobra por faixas de consumo, os primeiros metros cúbicos têm um preço e os seguintes, um preço mais alto. Nesse caso, gastar o dobro de água faz a conta mais que dobrar. Se a sua conta traz uma tabela de faixas, é o seu caso. O gráfico de uma tarifa assim é feito de pedaços de reta, cada um mais inclinado que o anterior.

A tabela da sua companhia vem na própria conta ou no site dela. Lendo a tabela como uma função, você descobre em que faixa a sua casa está e quanto custa cada metro cúbico a mais.
```

## Exemplo resolvido

**Na tabela da caixa-d'água, em que trecho o volume subiu mais depressa, e a que taxa?**

1. Os trechos de subida são das 8 às 10 h e das 10 às 12 h.
2. Das 8 às 10 h: (800 − 500) ÷ (10 − 8) = 300 ÷ 2 = 150 litros por hora.
3. Das 10 às 12 h: (1.000 − 800) ÷ (12 − 10) = 200 ÷ 2 = 100 litros por hora.
4. Compare: 150 é maior que 100. O volume subiu mais depressa das 8 às 10 h, a 150 litros por hora.

Confira: das 8 às 12 h, no total, a caixa ganhou 500 litros em 4 horas, uma média de 125 litros por hora. Esse número fica entre 100 e 150, como devia.

## Como isso cai no ENEM

- **Formatos:** um gráfico de linhas com uma situação real (temperatura, nível de reservatório, distância percorrida, saldo de conta, número de casos), e a pergunta sobre o intervalo em que algo cresceu, ficou parado ou mudou mais depressa. Também é comum comparar dois gráficos no mesmo plano e achar o ponto em que se cruzam, ou escolher qual gráfico representa uma situação descrita em palavras.
- **Habilidades:** H20 (interpretar gráficos cartesianos que relacionam grandezas), H19 (identificar a expressão algébrica que traduz a relação entre grandezas), H21 (resolver problemas cuja modelagem pede álgebra) e H22 (usar álgebra para construir argumentos). Nas provas de 2022 e 2023, classificadas pelo instituto, o conceito de função e a leitura de gráficos foram o tópico de 3 das 81 questões de Matemática (3,7%). Na área inteira, a H20 apareceu em 5 dessas 81 questões e a H21 em 7. São só duas provas: é tendência, não promessa.
- **Armadilhas:**
  - Ler o eixo errado: o que está no vertical é a saída.
  - Ignorar a unidade ou a escala (milhares, por cento, horas ou minutos).
  - Confundir ponto mais alto com subida mais rápida.
  - Achar que trecho horizontal é movimento: em distância por tempo, é parada.
  - Dividir só pela variação de y e esquecer o intervalo de x.

## Questão comentada

**Texto-base.** Um entregador de bicicleta sai do restaurante, faz duas entregas e volta. O gráfico da distância entre ele e o restaurante, em quilômetros, ao longo do tempo, em minutos, é formado por segmentos de reta que ligam os pontos da tabela:

| tempo (min) | 0 | 10 | 20 | 30 | 40 | 50 |
| --- | --- | --- | --- | --- | --- | --- |
| distância (km) | 0 | 4 | 4 | 7 | 7 | 0 |

Em palavras: a linha sobe de 0 a 4 km nos primeiros 10 minutos, fica horizontal até os 20 minutos, sobe até 7 km aos 30 minutos, fica horizontal até os 40 minutos e desce até 0 aos 50 minutos.

**Comando.** O intervalo de tempo em que o entregador pedalou com a maior velocidade média foi

A) de 0 a 10 minutos.
B) de 10 a 20 minutos.
C) de 20 a 30 minutos.
D) de 30 a 40 minutos.
E) de 40 a 50 minutos.

**Resolução.**

1. Velocidade média é a distância percorrida dividida pelo tempo. Todos os trechos duram 10 minutos, então basta comparar quanto a distância mudou em cada um.
2. De 0 a 10 min: 4 km. De 10 a 20 min: 0 km (parado). De 20 a 30 min: 7 − 4 = 3 km. De 30 a 40 min: 0 km (parado). De 40 a 50 min: 7 km, na volta.
3. O maior deslocamento em 10 minutos foi o da volta: 7 km, ou 0,7 km por minuto. A linha que desce é a mais inclinada de todas.

**Gabarito: E.**

**Por que as outras não:**

- A) de 0 a 10 minutos: é uma subida inclinada, mas de 4 km. Na volta ele percorreu 7 km no mesmo tempo.
- B) de 10 a 20 minutos: o trecho é horizontal. A distância não mudou: ele estava parado, fazendo a primeira entrega.
- C) de 20 a 30 minutos: ele andou só 3 km. A linha sobe, mas pouco.
- D) de 30 a 40 minutos: é quando ele está mais longe do restaurante, mas está parado. Ponto mais alto não é trecho mais rápido.

```realidade
Escolha uma grandeza da sua semana: o dinheiro na carteira, a bateria do celular, as horas de sono. Anote o valor em cinco momentos e monte uma tabela. Em que trecho ela mudou mais depressa? Calcule a taxa e escreva a unidade.
```

## Resumo

- Função: para cada entrada x, uma única saída y = f(x).
- Domínio são as entradas possíveis; imagem são as saídas que aparecem.
- No gráfico, leia título, eixos, unidades e escala antes de tudo.
- Crescente sobe, decrescente desce, constante é horizontal. Altura é valor; inclinação é rapidez.
- Taxa média de variação = (y₂ − y₁) ÷ (x₂ − x₁), com unidade de y por unidade de x.
- Onde dois gráficos se cruzam, as duas funções valem o mesmo.

## Para aprofundar

- [Funções: a ideia](/trilhas/matematica-medio/funcoes-a-ideia)
- [Leitura de gráficos e tabelas](/trilhas/matematica-fundamental/leitura-de-graficos-e-tabelas)
- [Como ler um gráfico sem ser enganado](/trilhas/estatistica-para-ler-o-brasil/como-ler-um-grafico-sem-ser-enganado)
- [Matemática: ler gráficos e tabelas](/trilhas/enem-por-area/matematica-ler-graficos-e-tabelas)
- [Função afim](/trilhas/enem-matematica-funcoes-e-algebra/funcao-afim)
