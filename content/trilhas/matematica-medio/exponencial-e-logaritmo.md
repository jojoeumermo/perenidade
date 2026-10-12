---
titulo: "Exponencial e logaritmo"
resumo: "O crescimento que multiplica em vez de somar, e a operação que responde quanto tempo ele leva."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Algebra and Trigonometry 2e, seção 6.1, Exponential Functions"
    autor: "Jay Abramson e outros (OpenStax)"
    ano: "2021"
    url: "https://openstax.org/books/algebra-and-trigonometry-2e/pages/6-1-exponential-functions"
  - titulo: "Algebra and Trigonometry 2e, seção 6.3, Logarithmic Functions"
    autor: "Jay Abramson e outros (OpenStax)"
    ano: "2021"
    url: "https://openstax.org/books/algebra-and-trigonometry-2e/pages/6-3-logarithmic-functions"
  - titulo: "Algebra and Trigonometry 2e, seção 6.5, Logarithmic Properties"
    autor: "Jay Abramson e outros (OpenStax)"
    ano: "2021"
    url: "https://openstax.org/books/algebra-and-trigonometry-2e/pages/6-5-logarithmic-properties"
quiz:
  - pergunta: "Uma cultura de bactérias dobra a cada hora. Começando com 100, quantas haverá depois de 5 horas?"
    opcoes: ["500", "1.000", "3.200"]
    resposta: 2
    explicacao: "Dobrar cinco vezes é multiplicar por 2⁵ = 32. 100 × 32 = 3.200."
  - pergunta: "Quanto vale o logaritmo de 1.000 na base 10?"
    opcoes: ["3", "100", "30"]
    resposta: 0
    explicacao: "É o expoente que se põe no 10 para chegar a 1.000: 10³ = 1.000."
  - pergunta: "Um tremor de magnitude 7 tem ondas com amplitude quantas vezes maior que um de magnitude 5?"
    opcoes: ["2 vezes", "20 vezes", "100 vezes"]
    resposta: 2
    explicacao: "A escala é logarítmica: cada ponto multiplica a amplitude por 10. Dois pontos: 10 × 10 = 100."
---

Nesta aula, o sinal **^** quer dizer "elevado a": 2^x é "dois elevado a x". Se precisar, reveja a aula de [potências e raízes](/trilhas/matematica-fundamental/potencias-e-raizes).

## Somar ou multiplicar

Compare dois jeitos de crescer, partindo de 100:

| Tempo | 0 | 1 | 2 | 3 | 4 | 5 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Somando 100 a cada passo | 100 | 200 | 300 | 400 | 500 | 600 | 1.100 |
| Dobrando a cada passo | 100 | 200 | 400 | 800 | 1.600 | 3.200 | 102.400 |

No primeiro, soma-se sempre a mesma quantidade: é a função do 1º grau. No segundo, **multiplica-se** sempre pelo mesmo número: é a **função exponencial**.

f(x) = c × a^x

- **c** é o valor inicial;
- **a** é a base, o número pelo qual se multiplica a cada passo. Se a é maior que 1, a função cresce; se está entre 0 e 1, decresce.

A variável está **no expoente**: daí o nome.

A marca do crescimento exponencial é parecer lento no começo e disparar depois. Quem olha só os primeiros passos subestima o que vem.

## Onde ele aparece

**Juros compostos.** Uma dívida de R$ 1.000 a 10% ao mês é multiplicada por 1,10 a cada mês: f(t) = 1.000 × 1,10^t. Em um ano, passa de R$ 3.100. Veja a aula de [juros](/trilhas/matematica-medio/juros-simples-e-compostos).

**Epidemias.** Enquanto cada doente passa a doença a mais de uma pessoa e há muita gente ainda não infectada, os casos se multiplicam em intervalos regulares. Por isso, agir cedo, quando os números ainda parecem pequenos, faz tanta diferença.

**Decaimento.** Quando a base é menor que 1, a quantidade encolhe. Um material radioativo perde metade dos seus átomos em um tempo fixo, a **meia-vida**. A do carbono-14 é de cerca de 5.730 anos, o que permite datar ossos, madeiras e tecidos antigos pela quantidade de carbono-14 que ainda resta.

```verificar
Um remédio tem meia-vida de 6 horas no organismo. De uma dose de 400 mg, quanto resta depois de 18 horas?
- 200 mg
+ 50 mg
- 0 mg
> São três meias-vidas: divida por 2 três vezes.
```

## A pergunta ao contrário

A exponencial responde: *depois de tanto tempo, quanto haverá?* Muitas vezes a pergunta é a inversa: *quanto tempo até chegar a tanto?*

Se uma população de bactérias dobra a cada hora, em quantas horas ela fica 8 vezes maior? É preciso achar o expoente: 2^x = 8. Como 2³ = 8, a resposta é 3.

Essa operação, achar o expoente, é o **logaritmo**:

log₂ 8 = 3, porque 2³ = 8

Em geral: o logaritmo de b na base a é o expoente que se deve pôr em a para obter b.

- log₁₀ 1.000 = 3, porque 10³ = 1.000
- log₂ 32 = 5, porque 2⁵ = 32
- log₁₀ 0,01 = −2, porque 10⁻² = 0,01

Quando a base não é escrita, entende-se base 10: log 100 = 2. É a tecla "log" da calculadora científica.

## As propriedades

Como logaritmos são expoentes, herdam as regras das potências:

- **log (a × b) = log a + log b** (o logaritmo transforma multiplicação em soma);
- **log (a ÷ b) = log a − log b**;
- **log (a^n) = n × log a**.

Foi para isso que eles foram inventados. Em 1614, o escocês John Napier publicou as primeiras tábuas de logaritmos. Com elas, astrônomos e navegadores trocavam multiplicações enormes por somas, e durante três séculos e meio, até a calculadora eletrônica, as tábuas e a régua de cálculo foram o instrumento de trabalho de engenheiros e cientistas.

## Quanto tempo para dobrar?

Uma dívida cresce 1% ao mês. Em quanto tempo dobra? É preciso resolver 1,01^t = 2. Aplicando logaritmo aos dois lados e usando a terceira propriedade:

```conta
t × log 1,01 = log 2
t = log 2 ÷ log 1,01
t = 0,30103 ÷ 0,00432
= t ≈ 70 meses
```

Existe um atalho de cabeça, a **regra do 70**: divida 70 pela taxa em porcentagem. A 1% ao mês, dobra em cerca de 70 meses; a 5% ao ano, em cerca de 14 anos; a 10% ao mês, em cerca de 7 meses. A regra é uma aproximação e funciona melhor para taxas pequenas.

## Escalas logarítmicas

Quando uma grandeza varia de valores minúsculos a gigantescos, usa-se uma escala em que cada degrau **multiplica** por 10, em vez de somar.

- **Terremotos:** na escala de magnitude, cada ponto corresponde a ondas com amplitude 10 vezes maior.
- **Acidez (pH):** cada unidade a menos indica uma solução 10 vezes mais ácida.
- **Som (decibel):** cada 10 decibéis a mais correspondem a um som 10 vezes mais intenso.

Por isso a diferença entre 80 e 90 decibéis em uma fábrica não é "um pouco mais de barulho": é dez vezes mais energia sonora chegando ao ouvido de quem trabalha.

## Para praticar

1. Resolva 2^x = 32.
2. Calcule log₁₀ 100.000 e log₂ 64.
3. Sabendo que log 2 ≈ 0,301, calcule log 8.
4. Uma colônia triplica a cada dia. Começando com 50 indivíduos, quantos haverá depois de 4 dias?
5. Pela regra do 70, em quanto tempo dobra um preço que sobe 7% ao ano?
6. Um material tem meia-vida de 10 anos. Que fração dele resta depois de 40 anos?

**Respostas:** 1) x = 5. 2) 5 e 6. 3) 3 × 0,301 = 0,903. 4) 50 × 3⁴ = 4.050. 5) Em cerca de 10 anos. 6) 1/16.
